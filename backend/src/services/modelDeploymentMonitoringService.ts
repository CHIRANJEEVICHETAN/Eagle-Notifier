import prisma from '../config/db';
import { performanceMonitoringService } from './performanceMonitoringService';
import { NotificationService } from './notificationService';
import { Prisma } from '../generated/prisma-client';

const DEBUG = process.env.NODE_ENV === 'development';

/**
 * Interface for model performance metrics
 */
interface ModelPerformanceMetrics {
  organizationId: string;
  accuracy: number;
  errorRate: number;
  avgLatency: number;
  memoryUsage: number;
  baselineAccuracy: number;
  baselineErrorRate: number;
  baselineLatency: number;
  baselineMemoryUsage: number;
}

/**
 * Interface for deployment alert thresholds
 */
interface DeploymentAlertThresholds {
  accuracyDropPercent: number;
  errorRateIncreasePercent: number;
  latencyIncreasePercent: number;
  memoryUsageIncreasePercent: number;
}

/**
 * Model Deployment Monitoring Service
 * Monitors deployed models for performance issues and alerts administrators
 */
export class ModelDeploymentMonitoringService {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly monitoringFrequency = 15 * 60 * 1000; // 15 minutes

  // Default alert thresholds
  private readonly defaultAlertThresholds: DeploymentAlertThresholds = {
    accuracyDropPercent: 5,
    errorRateIncreasePercent: 10,
    latencyIncreasePercent: 20,
    memoryUsageIncreasePercent: 30
  };

  constructor() {
    this.startMonitoring();
  }

  /**
   * Start monitoring deployed models
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.monitorDeployedModels();
      } catch (error) {
        console.error('Error in model deployment monitoring:', error);
      }
    }, this.monitoringFrequency);

    if (DEBUG) {
      console.log(`🔍 Model deployment monitoring started (frequency: ${this.monitoringFrequency / 60000} minutes)`);
    }
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Monitor all deployed models for issues
   */
  async monitorDeployedModels(): Promise<void> {
    try {
      if (DEBUG) {
        console.log('🔍 Running model deployment monitoring check...');
      }

      // Get all organizations with deployed models
      const organizations = await prisma.organization.findMany({
        where: {
          predictionEnabled: true,
          modelVersion: { not: null }
        },
        select: {
          id: true,
          name: true,
          modelVersion: true,
          modelAccuracy: true
        }
      });

      if (DEBUG) {
        console.log(`Found ${organizations.length} organizations with deployed models`);
      }

      for (const org of organizations) {
        try {
          await this.monitorOrganizationModel(org.id, org.name || 'Unknown', org.modelVersion!, org.modelAccuracy || 0);
        } catch (error) {
          console.error(`Error monitoring model for organization ${org.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in model deployment monitoring:', error);
    }
  }

  /**
   * Monitor a specific organization's deployed model
   */
  private async monitorOrganizationModel(
    organizationId: string,
    organizationName: string,
    modelVersion: string,
    baselineAccuracy: number
  ): Promise<void> {
    try {
      // Get organization-specific alert thresholds
      const thresholds = await this.getAlertThresholds(organizationId);

      // Get performance metrics
      const performanceMetrics = await this.getModelPerformanceMetrics(organizationId);

      // Check for issues
      const issues: string[] = [];

      // Check accuracy drop
      if (performanceMetrics.accuracy < baselineAccuracy * (1 - thresholds.accuracyDropPercent / 100)) {
        issues.push(`Accuracy drop detected: ${(performanceMetrics.accuracy * 100).toFixed(1)}% vs baseline ${(baselineAccuracy * 100).toFixed(1)}%`);
      }

      // Check error rate increase
      if (performanceMetrics.errorRate > performanceMetrics.baselineErrorRate * (1 + thresholds.errorRateIncreasePercent / 100)) {
        issues.push(`Error rate increase detected: ${(performanceMetrics.errorRate * 100).toFixed(1)}% vs baseline ${(performanceMetrics.baselineErrorRate * 100).toFixed(1)}%`);
      }

      // Check latency increase
      if (performanceMetrics.avgLatency > performanceMetrics.baselineLatency * (1 + thresholds.latencyIncreasePercent / 100)) {
        issues.push(`Latency increase detected: ${performanceMetrics.avgLatency.toFixed(1)}ms vs baseline ${performanceMetrics.baselineLatency.toFixed(1)}ms`);
      }

      // Check memory usage increase
      if (performanceMetrics.memoryUsage > performanceMetrics.baselineMemoryUsage * (1 + thresholds.memoryUsageIncreasePercent / 100)) {
        issues.push(`Memory usage increase detected: ${(performanceMetrics.memoryUsage / 1024 / 1024).toFixed(1)}MB vs baseline ${(performanceMetrics.baselineMemoryUsage / 1024 / 1024).toFixed(1)}MB`);
      }

      // Alert if issues found
      if (issues.length > 0) {
        await this.alertModelIssues(organizationId, organizationName, modelVersion, issues);
      }
    } catch (error) {
      console.error(`Error monitoring model for organization ${organizationId}:`, error);
    }
  }

  /**
   * Get model performance metrics for an organization
   */
  async getModelPerformanceMetrics(organizationId: string): Promise<ModelPerformanceMetrics> {
    try {
      // Get current metrics from performance monitoring service
      const metrics = await performanceMonitoringService.getCurrentMetrics(organizationId);

      // Get baseline metrics from database
      const baselineMetrics = await prisma.modelMetrics.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'desc' }
      });

      // Get prediction alerts for error rate calculation (using existing table)
      const recentAlerts = await prisma.predictionAlert.findMany({
        where: {
          organizationId,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        select: {
          isAccurate: true
        }
      });

      // Calculate error rate based on prediction accuracy feedback
      const totalPredictions = recentAlerts.length;
      const inaccuratePredictions = recentAlerts.filter(p => p.isAccurate === false).length;
      const errorRate = totalPredictions > 0 ? inaccuratePredictions / totalPredictions : 0.05; // Default 5%

      return {
        organizationId,
        accuracy: baselineMetrics?.accuracy || 0.8,
        errorRate,
        avgLatency: metrics.predictionLatency.avg,
        memoryUsage: metrics.systemMetrics.memoryUsage * 1024 * 1024, // Convert to bytes
        baselineAccuracy: baselineMetrics?.accuracy || 0.8,
        baselineErrorRate: 0.05, // Default 5% error rate
        baselineLatency: 50, // Default 50ms
        baselineMemoryUsage: 100 * 1024 * 1024 // Default 100MB
      };
    } catch (error) {
      console.error(`Error getting model performance metrics for organization ${organizationId}:`, error);

      // Return default metrics
      return {
        organizationId,
        accuracy: 0.8,
        errorRate: 0.05,
        avgLatency: 50,
        memoryUsage: 100 * 1024 * 1024,
        baselineAccuracy: 0.8,
        baselineErrorRate: 0.05,
        baselineLatency: 50,
        baselineMemoryUsage: 100 * 1024 * 1024
      };
    }
  }

  /**
   * Get alert thresholds for an organization
   */
  private async getAlertThresholds(organizationId: string): Promise<DeploymentAlertThresholds> {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { mlModelConfig: true }
      });

      const mlModelConfig = org?.mlModelConfig || {};

      // Handle different types of mlModelConfig
      let alertThresholds: Partial<DeploymentAlertThresholds> = {};

      if (typeof mlModelConfig === 'string') {
        try {
          const parsedConfig = JSON.parse(mlModelConfig);
          alertThresholds = parsedConfig.alertThresholds || {};
        } catch (e) {
          // If parsing fails, use default thresholds
          alertThresholds = {};
        }
      } else if (typeof mlModelConfig === 'object' && mlModelConfig !== null) {
        // Handle Prisma.JsonObject
        const jsonConfig = mlModelConfig as Prisma.JsonObject;
        const thresholds = jsonConfig.alertThresholds as Prisma.JsonObject;

        if (thresholds) {
          alertThresholds = {
            accuracyDropPercent: Number(thresholds.accuracyDropPercent) || this.defaultAlertThresholds.accuracyDropPercent,
            errorRateIncreasePercent: Number(thresholds.errorRateIncreasePercent) || this.defaultAlertThresholds.errorRateIncreasePercent,
            latencyIncreasePercent: Number(thresholds.latencyIncreasePercent) || this.defaultAlertThresholds.latencyIncreasePercent,
            memoryUsageIncreasePercent: Number(thresholds.memoryUsageIncreasePercent) || this.defaultAlertThresholds.memoryUsageIncreasePercent
          };
        }
      }

      return {
        ...this.defaultAlertThresholds,
        ...alertThresholds
      };
    } catch (error) {
      console.error(`Error getting alert thresholds for organization ${organizationId}:`, error);
      return this.defaultAlertThresholds;
    }
  }

  /**
   * Alert administrators about model issues
   */
  private async alertModelIssues(
    organizationId: string,
    organizationName: string,
    modelVersion: string,
    issues: string[]
  ): Promise<void> {
    try {
      // Create notification
      await NotificationService.createNotification({
        title: `Model Performance Alert: ${organizationName}`,
        body: `Issues detected with model ${modelVersion}: ${issues.join('; ')}`,
        severity: 'WARNING',
        type: 'SYSTEM',
        metadata: {
          modelVersion,
          issues,
          timestamp: new Date()
        },
        organizationId
      });

      if (DEBUG) {
        console.log(`⚠️ Sent model performance alert for org ${organizationId}:`, issues);
      }

      // Log issue in database
      await prisma.trainingLog.create({
        data: {
          organizationId,
          status: 'WARNING',
          version: modelVersion,
          startedAt: new Date(),
          completedAt: new Date(),
          config: {
            type: 'performance_alert',
            issues
          } as any,
          errorMessage: issues.join('; ')
        }
      });
    } catch (error) {
      console.error(`Error alerting model issues for organization ${organizationId}:`, error);
    }
  }

  /**
   * Check if a model needs retraining based on performance
   */
  async checkRetrainingNeeded(organizationId: string): Promise<{
    retrainingNeeded: boolean;
    reason?: string;
  }> {
    try {
      // Get performance metrics
      const performanceMetrics = await this.getModelPerformanceMetrics(organizationId);

      // Get organization model info
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          modelAccuracy: true,
          lastTrainingDate: true
        }
      });

      if (!org) {
        return { retrainingNeeded: false };
      }

      // Check accuracy drop
      if (performanceMetrics.accuracy < (org.modelAccuracy || 0) * 0.9) {
        return {
          retrainingNeeded: true,
          reason: `Accuracy drop detected: ${(performanceMetrics.accuracy * 100).toFixed(1)}% vs baseline ${((org.modelAccuracy || 0) * 100).toFixed(1)}%`
        };
      }

      // Check error rate
      if (performanceMetrics.errorRate > 0.2) {
        return {
          retrainingNeeded: true,
          reason: `High error rate: ${(performanceMetrics.errorRate * 100).toFixed(1)}%`
        };
      }

      // Check time since last training (90 days)
      if (org.lastTrainingDate) {
        const daysSinceTraining = (Date.now() - org.lastTrainingDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceTraining > 90) {
          return {
            retrainingNeeded: true,
            reason: `Model age: ${Math.floor(daysSinceTraining)} days since last training`
          };
        }
      }

      return { retrainingNeeded: false };
    } catch (error) {
      console.error(`Error checking if retraining needed for organization ${organizationId}:`, error);
      return { retrainingNeeded: false };
    }
  }
}

// Export singleton instance
export const modelDeploymentMonitoringService = new ModelDeploymentMonitoringService();

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('🛑 Shutting down model deployment monitoring service...');
  modelDeploymentMonitoringService.stopMonitoring();
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down model deployment monitoring service...');
  modelDeploymentMonitoringService.stopMonitoring();
});