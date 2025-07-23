import prisma from '../config/db';
import { NotificationService } from './notificationService';
import { trainingScheduler, TrainingJobStatus } from './trainingScheduler';

const DEBUG = process.env.NODE_ENV === 'development';

export interface TrainingMetrics {
  organizationId: string;
  totalTrainingRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageAccuracy: number;
  averageTrainingTime: number;
  lastTrainingDate?: Date;
  currentModelVersion?: string;
  successRate: number;
  trends: {
    accuracyTrend: 'IMPROVING' | 'STABLE' | 'DECLINING';
    performanceTrend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  };
}

export interface SystemTrainingMetrics {
  totalOrganizations: number;
  activeSchedules: number;
  runningJobs: number;
  failedJobs: number;
  systemSuccessRate: number;
  averageSystemAccuracy: number;
  organizationMetrics: TrainingMetrics[];
}

export interface TrainingAlert {
  organizationId: string;
  alertType: 'LOW_ACCURACY' | 'TRAINING_FAILURE' | 'STUCK_JOB' | 'MODEL_DEGRADATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  details: any;
  timestamp: Date;
}

/**
 * Training Pipeline Monitoring Service
 * Monitors training performance, detects issues, and sends alerts
 */
export class TrainingMonitor {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertThresholds = {
    minAccuracy: 0.75,
    maxFailureRate: 0.3,
    maxTrainingTime: 2 * 60 * 60 * 1000, // 2 hours
    accuracyDeclineThreshold: 0.05,
    consecutiveFailuresAlert: 3
  };

  constructor() {
    this.startMonitoring();
  }

  /**
   * Start continuous monitoring
   */
  private startMonitoring(): void {
    // Monitor every 15 minutes
    this.monitoringInterval = setInterval(async () => {
      await this.performMonitoringCycle();
    }, 15 * 60 * 1000);

    if (DEBUG) {
      console.log('📊 Training Monitor started - checking every 15 minutes');
    }
  }

  /**
   * Perform a complete monitoring cycle
   */
  private async performMonitoringCycle(): Promise<void> {
    try {
      if (DEBUG) {
        console.log('🔍 Performing training monitoring cycle...');
      }

      // Get system metrics
      const systemMetrics = await this.getSystemMetrics();
      
      // Check for alerts
      const alerts = await this.checkForAlerts();
      
      // Process alerts
      for (const alert of alerts) {
        await this.processAlert(alert);
      }

      // Log monitoring summary
      if (DEBUG) {
        console.log('📊 Monitoring cycle completed:', {
          totalOrgs: systemMetrics.totalOrganizations,
          activeSchedules: systemMetrics.activeSchedules,
          runningJobs: systemMetrics.runningJobs,
          alertsFound: alerts.length
        });
      }

    } catch (error) {
      console.error('❌ Error in monitoring cycle:', error);
    }
  }

  /**
   * Get comprehensive system training metrics
   */
  async getSystemMetrics(): Promise<SystemTrainingMetrics> {
    try {
      // Get all organizations with predictive maintenance enabled
      const organizations = await prisma.organization.findMany({
        where: { predictionEnabled: true },
        select: {
          id: true,
          name: true,
          modelVersion: true,
          modelAccuracy: true,
          lastTrainingDate: true,
          trainingLogs: {
            orderBy: { startedAt: 'desc' },
            take: 10
          },
          modelMetrics: {
            orderBy: { createdAt: 'desc' },
            take: 5
          }
        }
      });

      // Get job statuses from scheduler
      const jobStatuses = trainingScheduler.getAllJobStatuses();
      const activeSchedules = jobStatuses.length;
      const runningJobs = jobStatuses.filter(job => job.status === 'RUNNING').length;
      const failedJobs = jobStatuses.filter(job => job.status === 'FAILED').length;

      // Calculate organization metrics
      const organizationMetrics: TrainingMetrics[] = [];
      let totalAccuracy = 0;
      let totalOrgsWithAccuracy = 0;

      for (const org of organizations) {
        const metrics = await this.calculateOrganizationMetrics(org);
        organizationMetrics.push(metrics);
        
        if (metrics.averageAccuracy > 0) {
          totalAccuracy += metrics.averageAccuracy;
          totalOrgsWithAccuracy++;
        }
      }

      const systemSuccessRate = organizationMetrics.length > 0
        ? organizationMetrics.reduce((sum, m) => sum + m.successRate, 0) / organizationMetrics.length
        : 0;

      const averageSystemAccuracy = totalOrgsWithAccuracy > 0
        ? totalAccuracy / totalOrgsWithAccuracy
        : 0;

      return {
        totalOrganizations: organizations.length,
        activeSchedules,
        runningJobs,
        failedJobs,
        systemSuccessRate,
        averageSystemAccuracy,
        organizationMetrics
      };

    } catch (error) {
      console.error('Error getting system metrics:', error);
      throw error;
    }
  }

  /**
   * Calculate metrics for a specific organization
   */
  private async calculateOrganizationMetrics(org: any): Promise<TrainingMetrics> {
    const trainingLogs = org.trainingLogs || [];
    const modelMetrics = org.modelMetrics || [];

    const totalRuns = trainingLogs.length;
    const successfulRuns = trainingLogs.filter((log: any) => log.status === 'COMPLETED').length;
    const failedRuns = trainingLogs.filter((log: any) => log.status === 'FAILED').length;
    const successRate = totalRuns > 0 ? successfulRuns / totalRuns : 0;

    // Calculate average accuracy from model metrics
    const accuracyValues = modelMetrics
      .filter((metric: any) => metric.accuracy > 0)
      .map((metric: any) => metric.accuracy);
    const averageAccuracy = accuracyValues.length > 0
      ? accuracyValues.reduce((sum: number, acc: number) => sum + acc, 0) / accuracyValues.length
      : 0;

    // Calculate average training time
    const trainingTimes = modelMetrics
      .filter((metric: any) => metric.trainingTime > 0)
      .map((metric: any) => metric.trainingTime);
    const averageTrainingTime = trainingTimes.length > 0
      ? trainingTimes.reduce((sum: number, time: number) => sum + time, 0) / trainingTimes.length
      : 0;

    // Calculate trends
    const trends = this.calculateTrends(modelMetrics);

    return {
      organizationId: org.id,
      totalTrainingRuns: totalRuns,
      successfulRuns,
      failedRuns,
      averageAccuracy,
      averageTrainingTime,
      lastTrainingDate: org.lastTrainingDate,
      currentModelVersion: org.modelVersion,
      successRate,
      trends
    };
  }

  /**
   * Calculate performance trends
   */
  private calculateTrends(modelMetrics: any[]): TrainingMetrics['trends'] {
    if (modelMetrics.length < 2) {
      return {
        accuracyTrend: 'STABLE',
        performanceTrend: 'STABLE'
      };
    }

    // Sort by creation date (newest first)
    const sortedMetrics = modelMetrics.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Compare recent vs older metrics
    const recentMetrics = sortedMetrics.slice(0, 2);
    const olderMetrics = sortedMetrics.slice(2, 4);

    // Accuracy trend
    const recentAccuracy = recentMetrics.reduce((sum, m) => sum + (m.accuracy || 0), 0) / recentMetrics.length;
    const olderAccuracy = olderMetrics.length > 0
      ? olderMetrics.reduce((sum, m) => sum + (m.accuracy || 0), 0) / olderMetrics.length
      : recentAccuracy;

    const accuracyDiff = recentAccuracy - olderAccuracy;
    let accuracyTrend: 'IMPROVING' | 'STABLE' | 'DECLINING' = 'STABLE';
    
    if (accuracyDiff > 0.02) accuracyTrend = 'IMPROVING';
    else if (accuracyDiff < -0.02) accuracyTrend = 'DECLINING';

    // Performance trend (training time)
    const recentTime = recentMetrics.reduce((sum, m) => sum + (m.trainingTime || 0), 0) / recentMetrics.length;
    const olderTime = olderMetrics.length > 0
      ? olderMetrics.reduce((sum, m) => sum + (m.trainingTime || 0), 0) / olderMetrics.length
      : recentTime;

    const timeDiff = recentTime - olderTime;
    let performanceTrend: 'IMPROVING' | 'STABLE' | 'DECLINING' = 'STABLE';
    
    if (timeDiff < -60) performanceTrend = 'IMPROVING'; // Faster training
    else if (timeDiff > 60) performanceTrend = 'DECLINING'; // Slower training

    return {
      accuracyTrend,
      performanceTrend
    };
  }

  /**
   * Check for training alerts
   */
  private async checkForAlerts(): Promise<TrainingAlert[]> {
    const alerts: TrainingAlert[] = [];

    try {
      // Get system metrics
      const systemMetrics = await this.getSystemMetrics();
      
      // Get job statuses
      const jobStatuses = trainingScheduler.getAllJobStatuses();

      // Check each organization
      for (const orgMetrics of systemMetrics.organizationMetrics) {
        const orgAlerts = await this.checkOrganizationAlerts(orgMetrics, jobStatuses);
        alerts.push(...orgAlerts);
      }

      // Check system-wide alerts
      const systemAlerts = this.checkSystemAlerts(systemMetrics);
      alerts.push(...systemAlerts);

    } catch (error) {
      console.error('Error checking for alerts:', error);
    }

    return alerts;
  }

  /**
   * Check alerts for a specific organization
   */
  private async checkOrganizationAlerts(
    metrics: TrainingMetrics, 
    jobStatuses: TrainingJobStatus[]
  ): Promise<TrainingAlert[]> {
    const alerts: TrainingAlert[] = [];
    const { organizationId } = metrics;

    // Check low accuracy
    if (metrics.averageAccuracy > 0 && metrics.averageAccuracy < this.alertThresholds.minAccuracy) {
      alerts.push({
        organizationId,
        alertType: 'LOW_ACCURACY',
        severity: 'HIGH',
        message: `Model accuracy below threshold: ${(metrics.averageAccuracy * 100).toFixed(1)}%`,
        details: {
          currentAccuracy: metrics.averageAccuracy,
          threshold: this.alertThresholds.minAccuracy,
          modelVersion: metrics.currentModelVersion
        },
        timestamp: new Date()
      });
    }

    // Check high failure rate
    if (metrics.totalTrainingRuns > 0 && 
        (1 - metrics.successRate) > this.alertThresholds.maxFailureRate) {
      alerts.push({
        organizationId,
        alertType: 'TRAINING_FAILURE',
        severity: 'MEDIUM',
        message: `High training failure rate: ${((1 - metrics.successRate) * 100).toFixed(1)}%`,
        details: {
          successRate: metrics.successRate,
          failedRuns: metrics.failedRuns,
          totalRuns: metrics.totalTrainingRuns
        },
        timestamp: new Date()
      });
    }

    // Check model degradation
    if (metrics.trends.accuracyTrend === 'DECLINING') {
      alerts.push({
        organizationId,
        alertType: 'MODEL_DEGRADATION',
        severity: 'MEDIUM',
        message: 'Model accuracy is declining over recent training runs',
        details: {
          trend: metrics.trends.accuracyTrend,
          currentAccuracy: metrics.averageAccuracy
        },
        timestamp: new Date()
      });
    }

    // Check stuck jobs
    const jobStatus = jobStatuses.find(job => job.organizationId === organizationId);
    if (jobStatus && jobStatus.status === 'RUNNING' && jobStatus.lastRun) {
      const runningTime = Date.now() - jobStatus.lastRun.getTime();
      if (runningTime > this.alertThresholds.maxTrainingTime) {
        alerts.push({
          organizationId,
          alertType: 'STUCK_JOB',
          severity: 'CRITICAL',
          message: `Training job stuck for ${Math.round(runningTime / 60000)} minutes`,
          details: {
            runningTime,
            lastRun: jobStatus.lastRun,
            attempts: jobStatus.attempts
          },
          timestamp: new Date()
        });
      }
    }

    return alerts;
  }

  /**
   * Check system-wide alerts
   */
  private checkSystemAlerts(systemMetrics: SystemTrainingMetrics): TrainingAlert[] {
    const alerts: TrainingAlert[] = [];

    // Check if too many jobs are failing system-wide
    if (systemMetrics.failedJobs > systemMetrics.activeSchedules * 0.5) {
      alerts.push({
        organizationId: 'SYSTEM',
        alertType: 'TRAINING_FAILURE',
        severity: 'CRITICAL',
        message: `High system-wide training failure rate: ${systemMetrics.failedJobs}/${systemMetrics.activeSchedules} jobs failed`,
        details: {
          failedJobs: systemMetrics.failedJobs,
          activeSchedules: systemMetrics.activeSchedules,
          systemSuccessRate: systemMetrics.systemSuccessRate
        },
        timestamp: new Date()
      });
    }

    return alerts;
  }

  /**
   * Process and send alerts
   */
  private async processAlert(alert: TrainingAlert): Promise<void> {
    try {
      if (DEBUG) {
        console.log(`🚨 Processing alert for org ${alert.organizationId}:`, {
          type: alert.alertType,
          severity: alert.severity,
          message: alert.message
        });
      }

      // Determine notification severity
      const notificationSeverity = this.mapAlertSeverityToNotification(alert.severity);

      // Send notification to organization (or system admins for system alerts)
      if (alert.organizationId === 'SYSTEM') {
        // Send to all super admins
        await this.sendSystemAlert(alert);
      } else {
        // Send to organization admins
        await NotificationService.createNotification({
          title: `🤖 ML Training Alert: ${alert.alertType.replace('_', ' ')}`,
          body: alert.message,
          severity: notificationSeverity,
          type: 'SYSTEM',
          organizationId: alert.organizationId,
          metadata: {
            alertType: alert.alertType,
            alertSeverity: alert.severity,
            details: alert.details
          }
        });
      }

      // Log alert to database
      await this.logAlert(alert);

    } catch (error) {
      console.error('Error processing alert:', error);
    }
  }

  /**
   * Send system-wide alert to super admins
   */
  private async sendSystemAlert(alert: TrainingAlert): Promise<void> {
    try {
      // Get all organizations to send system alert
      const organizations = await prisma.organization.findMany({
        where: { predictionEnabled: true },
        select: { id: true }
      });

      // Send alert to each organization (will reach admins)
      for (const org of organizations) {
        await NotificationService.createNotification({
          title: `🚨 System Alert: ${alert.alertType.replace('_', ' ')}`,
          body: `System-wide issue detected: ${alert.message}`,
          severity: 'CRITICAL',
          type: 'SYSTEM',
          organizationId: org.id,
          metadata: {
            alertType: alert.alertType,
            alertSeverity: alert.severity,
            systemAlert: true,
            details: alert.details
          }
        });
      }
    } catch (error) {
      console.error('Error sending system alert:', error);
    }
  }

  /**
   * Log alert to database
   */
  private async logAlert(alert: TrainingAlert): Promise<void> {
    try {
      // Create a training log entry for the alert
      await prisma.trainingLog.create({
        data: {
          organizationId: alert.organizationId,
          status: 'FAILED',
          version: `alert_${Date.now()}`,
          startedAt: alert.timestamp,
          completedAt: alert.timestamp,
          config: {
            alertType: alert.alertType,
            severity: alert.severity
          },
          errorMessage: alert.message,
          metrics: alert.details
        }
      });
    } catch (error) {
      console.error('Error logging alert:', error);
    }
  }

  /**
   * Map alert severity to notification severity
   */
  private mapAlertSeverityToNotification(alertSeverity: string): 'CRITICAL' | 'WARNING' | 'INFO' {
    switch (alertSeverity) {
      case 'CRITICAL':
      case 'HIGH':
        return 'CRITICAL';
      case 'MEDIUM':
        return 'WARNING';
      case 'LOW':
      default:
        return 'INFO';
    }
  }

  /**
   * Get training metrics for a specific organization
   */
  async getOrganizationMetrics(organizationId: string): Promise<TrainingMetrics | null> {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          id: true,
          name: true,
          modelVersion: true,
          modelAccuracy: true,
          lastTrainingDate: true,
          trainingLogs: {
            orderBy: { startedAt: 'desc' },
            take: 10
          },
          modelMetrics: {
            orderBy: { createdAt: 'desc' },
            take: 5
          }
        }
      });

      if (!org) {
        return null;
      }

      return await this.calculateOrganizationMetrics(org);
    } catch (error) {
      console.error(`Error getting metrics for org ${organizationId}:`, error);
      return null;
    }
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      
      if (DEBUG) {
        console.log('🛑 Training Monitor stopped');
      }
    }
  }
}

// Export singleton instance
export const trainingMonitor = new TrainingMonitor();