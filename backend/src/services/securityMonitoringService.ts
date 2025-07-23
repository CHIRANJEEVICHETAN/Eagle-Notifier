import { MLAuditService } from './mlAuditService';
import { ML_SECURITY_CONFIG } from '../config/security';
import prisma from '../config/db';
import cron from 'node-cron';

export interface SecurityAlert {
  id: string;
  organizationId: string;
  type: 'ANOMALY_DETECTION' | 'THRESHOLD_BREACH' | 'PATTERN_ANALYSIS' | 'COMPLIANCE_VIOLATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  data: any;
  timestamp: Date;
  resolved: boolean;
}

export interface SecurityMetrics {
  organizationId: string;
  period: { start: Date; end: Date };
  totalOperations: number;
  failedOperations: number;
  securityIncidents: number;
  averageResponseTime: number;
  topThreats: Array<{ type: string; count: number }>;
  complianceScore: number;
  recommendations: string[];
}

/**
 * Security Monitoring Service for ML operations
 */
export class SecurityMonitoringService {
  private static instance: SecurityMonitoringService;
  private monitoringActive = false;
  private alertThresholds = {
    failureRate: 0.1, // 10% failure rate threshold
    responseTime: 5000, // 5 second response time threshold
    incidentRate: 10, // 10 incidents per hour threshold
    anomalyScore: 0.8, // Anomaly detection threshold
  };

  private constructor() {
    this.startMonitoring();
  }

  static getInstance(): SecurityMonitoringService {
    if (!SecurityMonitoringService.instance) {
      SecurityMonitoringService.instance = new SecurityMonitoringService();
    }
    return SecurityMonitoringService.instance;
  }

  /**
   * Start continuous security monitoring
   */
  private startMonitoring(): void {
    if (this.monitoringActive) return;

    console.log('🔒 Starting ML Security Monitoring Service...');

    // Run security checks every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      await this.runSecurityChecks();
    });

    // Run compliance checks daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
      await this.runComplianceChecks();
    });

    // Clean up old data weekly
    cron.schedule('0 3 * * 0', async () => {
      await this.cleanupOldData();
    });

    this.monitoringActive = true;
    console.log('✅ ML Security Monitoring Service started');
  }

  /**
   * Run comprehensive security checks
   */
  private async runSecurityChecks(): Promise<void> {
    try {
      const organizations = await prisma.organization.findMany({
        where: { predictionEnabled: true },
        select: { id: true, name: true }
      });

      for (const org of organizations) {
        await this.checkOrganizationSecurity(org.id);
      }
    } catch (error) {
      console.error('Error running security checks:', error);
    }
  }

  /**
   * Check security for specific organization
   */
  private async checkOrganizationSecurity(organizationId: string): Promise<void> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    try {
      // Get recent audit logs
      const recentLogs = await MLAuditService.getAuditLogs(organizationId, {
        startDate: oneHourAgo,
        endDate: now,
        limit: 1000
      });

      // Check failure rate
      await this.checkFailureRate(organizationId, recentLogs);

      // Check response times
      await this.checkResponseTimes(organizationId, recentLogs);

      // Check for anomalies
      await this.detectAnomalies(organizationId, recentLogs);

      // Check security incidents
      await this.checkSecurityIncidents(organizationId, oneHourAgo, now);

    } catch (error) {
      console.error(`Error checking security for org ${organizationId}:`, error);
    }
  }

  /**
   * Check operation failure rate
   */
  private async checkFailureRate(organizationId: string, logs: any[]): Promise<void> {
    if (logs.length === 0) return;

    const failedOps = logs.filter(log => log.status === 'FAILED').length;
    const failureRate = failedOps / logs.length;

    if (failureRate > this.alertThresholds.failureRate) {
      await this.createSecurityAlert({
        organizationId,
        type: 'THRESHOLD_BREACH',
        severity: failureRate > 0.2 ? 'HIGH' : 'MEDIUM',
        title: 'High ML Operation Failure Rate',
        description: `ML operations failure rate is ${(failureRate * 100).toFixed(1)}% (${failedOps}/${logs.length})`,
        data: { failureRate, failedOperations: failedOps, totalOperations: logs.length },
      });
    }
  }

  /**
   * Check response times
   */
  private async checkResponseTimes(organizationId: string, logs: any[]): Promise<void> {
    const logsWithDuration = logs.filter(log => log.duration);
    if (logsWithDuration.length === 0) return;

    const avgResponseTime = logsWithDuration.reduce((sum, log) => sum + log.duration, 0) / logsWithDuration.length;
    const slowOperations = logsWithDuration.filter(log => log.duration > this.alertThresholds.responseTime);

    if (avgResponseTime > this.alertThresholds.responseTime || slowOperations.length > logsWithDuration.length * 0.1) {
      await this.createSecurityAlert({
        organizationId,
        type: 'THRESHOLD_BREACH',
        severity: avgResponseTime > this.alertThresholds.responseTime * 2 ? 'HIGH' : 'MEDIUM',
        title: 'Slow ML Operation Response Times',
        description: `Average response time is ${avgResponseTime.toFixed(0)}ms with ${slowOperations.length} slow operations`,
        data: { averageResponseTime: avgResponseTime, slowOperations: slowOperations.length },
      });
    }
  }

  /**
   * Detect anomalies in operation patterns
   */
  private async detectAnomalies(organizationId: string, logs: any[]): Promise<void> {
    if (logs.length < 10) return; // Need sufficient data

    // Analyze operation patterns
    const actionCounts = logs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {});

    const hourlyDistribution = logs.reduce((acc, log) => {
      const hour = new Date(log.timestamp).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {});

    // Check for unusual patterns
    const totalOps = logs.length;
    const unusualActions = Object.entries(actionCounts).filter(([action, count]: [string, any]) => {
      const percentage = count / totalOps;
      return percentage > 0.8 || (percentage < 0.05 && count > 1); // Very high or very low frequency
    });

    if (unusualActions.length > 0) {
      await this.createSecurityAlert({
        organizationId,
        type: 'ANOMALY_DETECTION',
        severity: 'MEDIUM',
        title: 'Unusual ML Operation Patterns Detected',
        description: `Detected unusual patterns in ML operations: ${unusualActions.map(([action, count]) => `${action}: ${count}`).join(', ')}`,
        data: { actionCounts, hourlyDistribution, unusualActions },
      });
    }
  }

  /**
   * Check security incidents
   */
  private async checkSecurityIncidents(organizationId: string, startDate: Date, endDate: Date): Promise<void> {
    const incidents = await MLAuditService.getSecurityIncidents(organizationId, {
      startDate,
      endDate,
      resolved: false
    });

    if (incidents.length > this.alertThresholds.incidentRate) {
      await this.createSecurityAlert({
        organizationId,
        type: 'THRESHOLD_BREACH',
        severity: 'HIGH',
        title: 'High Security Incident Rate',
        description: `${incidents.length} unresolved security incidents in the last hour`,
        data: { incidentCount: incidents.length, incidents: incidents.slice(0, 5) },
      });
    }

    // Check for critical incidents
    const criticalIncidents = incidents.filter(inc => inc.severity === 'CRITICAL');
    if (criticalIncidents.length > 0) {
      await this.createSecurityAlert({
        organizationId,
        type: 'THRESHOLD_BREACH',
        severity: 'CRITICAL',
        title: 'Critical Security Incidents Detected',
        description: `${criticalIncidents.length} critical security incidents require immediate attention`,
        data: { criticalIncidents },
      });
    }
  }

  /**
   * Run compliance checks
   */
  private async runComplianceChecks(): Promise<void> {
    try {
      const organizations = await prisma.organization.findMany({
        where: { predictionEnabled: true },
        select: { id: true, name: true }
      });

      for (const org of organizations) {
        await this.checkCompliance(org.id);
      }
    } catch (error) {
      console.error('Error running compliance checks:', error);
    }
  }

  /**
   * Check compliance for organization
   */
  private async checkCompliance(organizationId: string): Promise<void> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    try {
      // Check audit log completeness
      const auditLogs = await MLAuditService.getAuditLogs(organizationId, {
        startDate: thirtyDaysAgo,
        endDate: now,
        limit: 10000
      });

      // Check for gaps in audit logging
      const logGaps = this.findAuditLogGaps(auditLogs);
      if (logGaps.length > 0) {
        await this.createSecurityAlert({
          organizationId,
          type: 'COMPLIANCE_VIOLATION',
          severity: 'HIGH',
          title: 'Audit Log Gaps Detected',
          description: `Found ${logGaps.length} gaps in audit logging over the last 30 days`,
          data: { gaps: logGaps },
        });
      }

      // Check data retention compliance
      await this.checkDataRetention(organizationId);

      // Check access control compliance
      await this.checkAccessControlCompliance(organizationId, auditLogs);

    } catch (error) {
      console.error(`Error checking compliance for org ${organizationId}:`, error);
    }
  }

  /**
   * Find gaps in audit logging
   */
  private findAuditLogGaps(logs: any[]): Array<{ start: Date; end: Date; duration: number }> {
    if (logs.length < 2) return [];

    const gaps = [];
    const sortedLogs = logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (let i = 1; i < sortedLogs.length; i++) {
      const prevTime = new Date(sortedLogs[i - 1].timestamp).getTime();
      const currTime = new Date(sortedLogs[i].timestamp).getTime();
      const gapDuration = currTime - prevTime;

      // Flag gaps longer than 1 hour during business hours
      if (gapDuration > 60 * 60 * 1000) {
        gaps.push({
          start: new Date(prevTime),
          end: new Date(currTime),
          duration: gapDuration
        });
      }
    }

    return gaps;
  }

  /**
   * Check data retention compliance
   */
  private async checkDataRetention(organizationId: string): Promise<void> {
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - ML_SECURITY_CONFIG.AUDIT.RETENTION_DAYS);

    try {
      const oldLogs = await prisma.mLAuditLog.count({
        where: {
          organizationId,
          timestamp: { lt: retentionDate }
        }
      });

      if (oldLogs > 0) {
        await this.createSecurityAlert({
          organizationId,
          type: 'COMPLIANCE_VIOLATION',
          severity: 'MEDIUM',
          title: 'Data Retention Policy Violation',
          description: `${oldLogs} audit logs exceed the ${ML_SECURITY_CONFIG.AUDIT.RETENTION_DAYS}-day retention policy`,
          data: { oldLogCount: oldLogs, retentionDays: ML_SECURITY_CONFIG.AUDIT.RETENTION_DAYS },
        });
      }
    } catch (error) {
      console.error('Error checking data retention:', error);
    }
  }

  /**
   * Check access control compliance
   */
  private async checkAccessControlCompliance(organizationId: string, logs: any[]): Promise<void> {
    // Check for unauthorized access attempts
    const unauthorizedAttempts = logs.filter(log => 
      log.action.includes('UNAUTHORIZED') || log.status === 'FAILED'
    );

    if (unauthorizedAttempts.length > logs.length * 0.05) { // More than 5% unauthorized
      await this.createSecurityAlert({
        organizationId,
        type: 'COMPLIANCE_VIOLATION',
        severity: 'HIGH',
        title: 'High Unauthorized Access Rate',
        description: `${unauthorizedAttempts.length} unauthorized access attempts detected (${((unauthorizedAttempts.length / logs.length) * 100).toFixed(1)}%)`,
        data: { unauthorizedAttempts: unauthorizedAttempts.length, totalAttempts: logs.length },
      });
    }
  }

  /**
   * Create security alert
   */
  private async createSecurityAlert(alertData: Omit<SecurityAlert, 'id' | 'timestamp' | 'resolved'>): Promise<void> {
    try {
      const alert: SecurityAlert = {
        id: require('crypto').randomUUID(),
        ...alertData,
        timestamp: new Date(),
        resolved: false,
      };

      // Store alert (you might want to create a SecurityAlert model)
      console.warn(`🚨 SECURITY ALERT [${alert.severity}]: ${alert.title}`, {
        organizationId: alert.organizationId,
        description: alert.description,
        data: alert.data,
      });

      // In a real implementation, you would:
      // 1. Store the alert in the database
      // 2. Send notifications to security team
      // 3. Trigger automated responses if needed

    } catch (error) {
      console.error('Error creating security alert:', error);
    }
  }

  /**
   * Get security metrics for organization
   */
  async getSecurityMetrics(organizationId: string, days: number = 30): Promise<SecurityMetrics> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    try {
      const [auditLogs, incidents] = await Promise.all([
        MLAuditService.getAuditLogs(organizationId, { startDate, endDate, limit: 10000 }),
        MLAuditService.getSecurityIncidents(organizationId, { startDate, endDate })
      ]);

      const totalOperations = auditLogs.length;
      const failedOperations = auditLogs.filter(log => log.status === 'FAILED').length;
      const securityIncidents = incidents.length;

      const logsWithDuration = auditLogs.filter(log => log.duration);
      const averageResponseTime = logsWithDuration.length > 0
        ? logsWithDuration.reduce((sum, log) => sum + (log.duration || 0), 0) / logsWithDuration.length
        : 0;

      const topThreats = incidents.reduce((acc, incident) => {
        const existing = acc.find(t => t.type === incident.type);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ type: incident.type, count: 1 });
        }
        return acc;
      }, [] as Array<{ type: string; count: number }>)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

      // Calculate compliance score (0-100)
      let complianceScore = 100;
      if (totalOperations > 0) {
        const failureRate = failedOperations / totalOperations;
        complianceScore -= failureRate * 30; // Deduct up to 30 points for failures
      }
      if (securityIncidents > 0) {
        complianceScore -= Math.min(securityIncidents * 5, 40); // Deduct up to 40 points for incidents
      }
      complianceScore = Math.max(0, Math.round(complianceScore));

      // Generate recommendations
      const recommendations = this.generateRecommendations({
        totalOperations,
        failedOperations,
        securityIncidents,
        averageResponseTime,
        complianceScore
      });

      return {
        organizationId,
        period: { start: startDate, end: endDate },
        totalOperations,
        failedOperations,
        securityIncidents,
        averageResponseTime,
        topThreats,
        complianceScore,
        recommendations,
      };
    } catch (error) {
      console.error('Error getting security metrics:', error);
      throw error;
    }
  }

  /**
   * Generate security recommendations
   */
  private generateRecommendations(metrics: {
    totalOperations: number;
    failedOperations: number;
    securityIncidents: number;
    averageResponseTime: number;
    complianceScore: number;
  }): string[] {
    const recommendations = [];

    if (metrics.failedOperations / metrics.totalOperations > 0.05) {
      recommendations.push('High failure rate detected. Review error logs and improve error handling.');
    }

    if (metrics.securityIncidents > 10) {
      recommendations.push('Multiple security incidents detected. Consider enhanced monitoring and access controls.');
    }

    if (metrics.averageResponseTime > 3000) {
      recommendations.push('High response times detected. Consider performance optimization and caching.');
    }

    if (metrics.complianceScore < 80) {
      recommendations.push('Compliance score is below acceptable threshold. Review security policies and procedures.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Security posture is good. Continue regular monitoring and maintenance.');
    }

    return recommendations;
  }

  /**
   * Clean up old monitoring data
   */
  private async cleanupOldData(): Promise<void> {
    try {
      await MLAuditService.cleanupOldLogs();
      console.log('✅ Security monitoring data cleanup completed');
    } catch (error) {
      console.error('Error cleaning up old monitoring data:', error);
    }
  }

  /**
   * Stop monitoring service
   */
  stop(): void {
    this.monitoringActive = false;
    console.log('🛑 ML Security Monitoring Service stopped');
  }
}

// Export singleton instance
export const securityMonitoringService = SecurityMonitoringService.getInstance();