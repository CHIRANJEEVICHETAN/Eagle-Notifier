import prisma from '../config/db';
import { ML_SECURITY_CONFIG, sanitizeForAudit, generateAuditId } from '../config/security';

export interface MLAuditLog {
  auditId: string;
  organizationId: string;
  userId: string;
  action: string;
  resource: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  requestData?: any;
  responseData?: any;
  status: 'STARTED' | 'COMPLETED' | 'FAILED';
  statusCode?: number;
  duration?: number;
  timestamp: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export interface SecurityIncident {
  organizationId: string;
  userId: string;
  type: 'SUSPICIOUS_PATTERN' | 'UNAUTHORIZED_ACCESS' | 'RATE_LIMIT_EXCEEDED' | 'MODEL_ACCESS_VIOLATION';
  pattern?: string;
  request?: any;
  ip?: string;
  userAgent?: string;
  timestamp: Date;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  resolved?: boolean;
}

/**
 * Service for ML operations audit logging and security monitoring
 */
export class MLAuditService {
  /**
   * Log ML operation start
   */
  static async logMLOperation(auditData: MLAuditLog): Promise<void> {
    try {
      await prisma.mLAuditLog.create({
        data: {
          auditId: auditData.auditId,
          organizationId: auditData.organizationId,
          userId: auditData.userId,
          action: auditData.action,
          resource: auditData.resource,
          method: auditData.method,
          ip: auditData.ip,
          userAgent: auditData.userAgent,
          requestData: auditData.requestData ? JSON.stringify(sanitizeForAudit(auditData.requestData)) : null,
          status: auditData.status,
          timestamp: auditData.timestamp,
        },
      });
    } catch (error) {
      console.error('Failed to log ML operation:', error);
      // Don't throw - audit failures shouldn't break the main operation
    }
  }

  /**
   * Update ML operation completion
   */
  static async updateMLOperation(auditId: string, updateData: Partial<MLAuditLog>): Promise<void> {
    try {
      await prisma.mLAuditLog.update({
        where: { auditId },
        data: {
          status: updateData.status,
          statusCode: updateData.statusCode,
          duration: updateData.duration,
          responseData: updateData.responseData ? JSON.stringify(sanitizeForAudit(updateData.responseData)) : null,
          completedAt: updateData.completedAt,
          errorMessage: updateData.errorMessage,
        },
      });
    } catch (error) {
      console.error('Failed to update ML operation audit:', error);
    }
  }

  /**
   * Log security incident
   */
  static async logSecurityIncident(incident: Omit<SecurityIncident, 'severity' | 'resolved'>): Promise<void> {
    try {
      // Determine severity based on incident type
      let severity: SecurityIncident['severity'] = 'MEDIUM';
      
      switch (incident.type) {
        case 'UNAUTHORIZED_ACCESS':
        case 'MODEL_ACCESS_VIOLATION':
          severity = 'HIGH';
          break;
        case 'SUSPICIOUS_PATTERN':
          severity = 'CRITICAL';
          break;
        case 'RATE_LIMIT_EXCEEDED':
          severity = 'LOW';
          break;
      }

      await prisma.securityIncident.create({
        data: {
          organizationId: incident.organizationId,
          userId: incident.userId,
          type: incident.type,
          pattern: incident.pattern,
          request: incident.request ? JSON.stringify(sanitizeForAudit(incident.request)) : null,
          ip: incident.ip,
          userAgent: incident.userAgent,
          timestamp: incident.timestamp,
          severity,
          resolved: false,
        },
      });

      // Alert on high/critical incidents
      if (severity === 'HIGH' || severity === 'CRITICAL') {
        await this.alertSecurityTeam(incident, severity);
      }
    } catch (error) {
      console.error('Failed to log security incident:', error);
    }
  }

  /**
   * Get audit logs for organization
   */
  static async getAuditLogs(
    organizationId: string,
    filters: {
      action?: string;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
      status?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<MLAuditLog[]> {
    try {
      const where: any = { organizationId };

      if (filters.action) where.action = filters.action;
      if (filters.userId) where.userId = filters.userId;
      if (filters.status) where.status = filters.status;
      if (filters.startDate || filters.endDate) {
        where.timestamp = {};
        if (filters.startDate) where.timestamp.gte = filters.startDate;
        if (filters.endDate) where.timestamp.lte = filters.endDate;
      }

      const logs = await prisma.mLAuditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: filters.limit || 100,
        skip: filters.offset || 0,
      });

      return logs.map(log => ({
        auditId: log.auditId,
        organizationId: log.organizationId,
        userId: log.userId,
        action: log.action,
        resource: log.resource,
        method: log.method || undefined,
        ip: log.ip || undefined,
        userAgent: log.userAgent || undefined,
        requestData: log.requestData ? JSON.parse(log.requestData) : undefined,
        responseData: log.responseData ? JSON.parse(log.responseData) : undefined,
        status: log.status as 'STARTED' | 'COMPLETED' | 'FAILED',
        statusCode: log.statusCode || undefined,
        duration: log.duration || undefined,
        timestamp: log.timestamp,
        completedAt: log.completedAt || undefined,
        errorMessage: log.errorMessage || undefined,
      }));
    } catch (error) {
      console.error('Failed to get audit logs:', error);
      return [];
    }
  }

  /**
   * Get security incidents for organization
   */
  static async getSecurityIncidents(
    organizationId: string,
    filters: {
      type?: string;
      severity?: string;
      resolved?: boolean;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<SecurityIncident[]> {
    try {
      const where: any = { organizationId };

      if (filters.type) where.type = filters.type;
      if (filters.severity) where.severity = filters.severity;
      if (filters.resolved !== undefined) where.resolved = filters.resolved;
      if (filters.startDate || filters.endDate) {
        where.timestamp = {};
        if (filters.startDate) where.timestamp.gte = filters.startDate;
        if (filters.endDate) where.timestamp.lte = filters.endDate;
      }

      const incidents = await prisma.securityIncident.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      });

      return incidents.map(incident => ({
        organizationId: incident.organizationId,
        userId: incident.userId,
        type: incident.type as SecurityIncident['type'],
        pattern: incident.pattern || undefined,
        request: incident.request ? JSON.parse(incident.request) : undefined,
        ip: incident.ip || undefined,
        userAgent: incident.userAgent || undefined,
        timestamp: incident.timestamp,
        severity: incident.severity as SecurityIncident['severity'],
        resolved: incident.resolved || false,
      }));
    } catch (error) {
      console.error('Failed to get security incidents:', error);
      return [];
    }
  }

  /**
   * Generate security report for organization
   */
  static async generateSecurityReport(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalOperations: number;
    failedOperations: number;
    securityIncidents: number;
    topActions: Array<{ action: string; count: number }>;
    incidentsByType: Array<{ type: string; count: number }>;
    averageResponseTime: number;
  }> {
    try {
      const [auditStats, incidentStats] = await Promise.all([
        prisma.mLAuditLog.groupBy({
          by: ['action', 'status'],
          where: {
            organizationId,
            timestamp: { gte: startDate, lte: endDate },
          },
          _count: true,
          _avg: { duration: true },
        }),
        prisma.securityIncident.groupBy({
          by: ['type'],
          where: {
            organizationId,
            timestamp: { gte: startDate, lte: endDate },
          },
          _count: true,
        }),
      ]);

      const totalOperations = auditStats.reduce((sum, stat) => sum + stat._count, 0);
      const failedOperations = auditStats
        .filter(stat => stat.status === 'FAILED')
        .reduce((sum, stat) => sum + stat._count, 0);
      
      const securityIncidents = incidentStats.reduce((sum, stat) => sum + stat._count, 0);
      
      const topActions = auditStats
        .reduce((acc, stat) => {
          const existing = acc.find(a => a.action === stat.action);
          if (existing) {
            existing.count += stat._count;
          } else {
            acc.push({ action: stat.action, count: stat._count });
          }
          return acc;
        }, [] as Array<{ action: string; count: number }>)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const incidentsByType = incidentStats.map(stat => ({
        type: stat.type,
        count: stat._count,
      }));

      const averageResponseTime = auditStats
        .filter(stat => stat._avg.duration)
        .reduce((sum, stat, _, arr) => sum + (stat._avg.duration || 0) / arr.length, 0);

      return {
        totalOperations,
        failedOperations,
        securityIncidents,
        topActions,
        incidentsByType,
        averageResponseTime,
      };
    } catch (error) {
      console.error('Failed to generate security report:', error);
      throw error;
    }
  }

  /**
   * Clean up old audit logs
   */
  static async cleanupOldLogs(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - ML_SECURITY_CONFIG.AUDIT.RETENTION_DAYS);

      await Promise.all([
        prisma.mLAuditLog.deleteMany({
          where: { timestamp: { lt: cutoffDate } },
        }),
        prisma.securityIncident.deleteMany({
          where: { 
            timestamp: { lt: cutoffDate },
            resolved: true,
          },
        }),
      ]);

      console.log(`Cleaned up audit logs older than ${ML_SECURITY_CONFIG.AUDIT.RETENTION_DAYS} days`);
    } catch (error) {
      console.error('Failed to cleanup old audit logs:', error);
    }
  }

  /**
   * Alert security team about critical incidents
   */
  private static async alertSecurityTeam(
    incident: Omit<SecurityIncident, 'severity' | 'resolved'>,
    severity: SecurityIncident['severity']
  ): Promise<void> {
    try {
      // In a real implementation, this would send alerts via email, Slack, etc.
      console.warn(`🚨 SECURITY ALERT [${severity}]: ${incident.type}`, {
        organizationId: incident.organizationId,
        userId: incident.userId,
        ip: incident.ip,
        timestamp: incident.timestamp,
      });

      // Could integrate with notification service
      // await NotificationService.createNotification({
      //   title: `Security Alert: ${incident.type}`,
      //   body: `Suspicious activity detected from user ${incident.userId}`,
      //   severity: 'CRITICAL',
      //   type: 'SYSTEM',
      //   organizationId: incident.organizationId,
      // });
    } catch (error) {
      console.error('Failed to alert security team:', error);
    }
  }
}