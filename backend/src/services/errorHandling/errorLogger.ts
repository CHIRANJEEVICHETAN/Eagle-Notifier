/**
 * Comprehensive error logging and monitoring system
 */

import prisma from '../../config/db';
import { MLServiceError, ErrorSeverity, ErrorCategory } from './errorTypes';
import { NotificationService } from '../notificationService';

export interface ErrorLogEntry {
  id?: string;
  organizationId: string;
  serviceName: string;
  operationName: string;
  errorName: string;
  errorMessage: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  correlationId: string;
  stackTrace?: string;
  context: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
}

export interface ErrorMetrics {
  organizationId: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByService: Record<string, number>;
  topErrors: Array<{
    errorName: string;
    count: number;
    lastOccurrence: Date;
  }>;
  errorRate: number; // errors per hour
  mttr: number; // mean time to resolution in minutes
  resolvedErrors: number;
  unresolvedErrors: number;
}

export interface AlertThreshold {
  organizationId: string;
  errorCategory?: ErrorCategory;
  errorSeverity?: ErrorSeverity;
  serviceName?: string;
  errorCount: number;
  timeWindowMinutes: number;
  alertEnabled: boolean;
  lastAlertSent?: Date;
  cooldownMinutes: number;
}

/**
 * Error logging and monitoring service
 */
export class ErrorLogger {
  private static instance: ErrorLogger;
  private alertThresholds = new Map<string, AlertThreshold>();
  private errorCounts = new Map<string, { count: number; firstSeen: Date; lastSeen: Date }>();
  
  private constructor() {
    this.initializeDefaultThresholds();
    this.startPeriodicCleanup();
  }
  
  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  /**
   * Log error with comprehensive details
   */
  async logError(error: Error | MLServiceError, additionalContext?: Record<string, any>): Promise<void> {
    try {
      let errorDetails: ErrorLogEntry;
      
      if (error instanceof MLServiceError) {
        errorDetails = {
          organizationId: error.metadata.context.organizationId,
          serviceName: error.metadata.context.serviceName,
          operationName: error.metadata.context.operationName,
          errorName: error.name,
          errorMessage: error.message,
          category: error.metadata.category,
          severity: error.metadata.severity,
          correlationId: error.correlationId,
          stackTrace: error.stack,
          context: {
            ...error.metadata.context.additionalData,
            ...additionalContext,
            retryable: error.metadata.retryable,
            fallbackAvailable: error.metadata.fallbackAvailable,
            escalationRequired: error.metadata.escalationRequired,
            userNotificationRequired: error.metadata.userNotificationRequired
          },
          timestamp: error.timestamp,
          resolved: false
        };
      } else {
        // Handle generic errors
        errorDetails = {
          organizationId: additionalContext?.organizationId || 'unknown',
          serviceName: additionalContext?.serviceName || 'unknown',
          operationName: additionalContext?.operationName || 'unknown',
          errorName: error.name || 'Error',
          errorMessage: error.message,
          category: ErrorCategory.UNKNOWN_ERROR,
          severity: ErrorSeverity.MEDIUM,
          correlationId: this.generateCorrelationId(),
          stackTrace: error.stack,
          context: additionalContext || {},
          timestamp: new Date(),
          resolved: false
        };
      }

      // Store in database
      await this.storeErrorLog(errorDetails);
      
      // Log to console with structured format
      this.logToConsole(errorDetails);
      
      // Update error tracking
      this.updateErrorTracking(errorDetails);
      
      // Check alert thresholds
      await this.checkAlertThresholds(errorDetails);
      
      // Send notifications if required
      if (error instanceof MLServiceError && error.requiresUserNotification()) {
        await this.sendErrorNotification(errorDetails);
      }
      
    } catch (logError) {
      // Fallback logging to prevent infinite loops
      console.error('Failed to log error:', logError);
      console.error('Original error:', error);
    }
  }

  /**
   * Store error log in database
   */
  private async storeErrorLog(errorDetails: ErrorLogEntry): Promise<void> {
    try {
      await prisma.errorLog.create({
        data: {
          organizationId: errorDetails.organizationId,
          serviceName: errorDetails.serviceName,
          operationName: errorDetails.operationName,
          errorName: errorDetails.errorName,
          errorMessage: errorDetails.errorMessage,
          category: errorDetails.category,
          severity: errorDetails.severity,
          correlationId: errorDetails.correlationId,
          stackTrace: errorDetails.stackTrace,
          context: errorDetails.context,
          timestamp: errorDetails.timestamp,
          resolved: errorDetails.resolved
        }
      });
    } catch (dbError) {
      console.error('Failed to store error log in database:', dbError);
    }
  }

  /**
   * Log to console with structured format
   */
  private logToConsole(errorDetails: ErrorLogEntry): void {
    const logLevel = this.getLogLevel(errorDetails.severity);
    const logMessage = {
      timestamp: errorDetails.timestamp.toISOString(),
      level: errorDetails.severity,
      service: errorDetails.serviceName,
      operation: errorDetails.operationName,
      organization: errorDetails.organizationId,
      error: errorDetails.errorName,
      message: errorDetails.errorMessage,
      category: errorDetails.category,
      correlationId: errorDetails.correlationId,
      context: errorDetails.context
    };

    switch (logLevel) {
      case 'error':
        console.error('🚨 ML Service Error:', JSON.stringify(logMessage, null, 2));
        break;
      case 'warn':
        console.warn('⚠️ ML Service Warning:', JSON.stringify(logMessage, null, 2));
        break;
      case 'info':
        console.info('ℹ️ ML Service Info:', JSON.stringify(logMessage, null, 2));
        break;
      default:
        console.log('📝 ML Service Log:', JSON.stringify(logMessage, null, 2));
    }
  }

  /**
   * Update error tracking for metrics
   */
  private updateErrorTracking(errorDetails: ErrorLogEntry): void {
    const key = `${errorDetails.organizationId}-${errorDetails.errorName}`;
    const existing = this.errorCounts.get(key);
    
    if (existing) {
      existing.count++;
      existing.lastSeen = errorDetails.timestamp;
    } else {
      this.errorCounts.set(key, {
        count: 1,
        firstSeen: errorDetails.timestamp,
        lastSeen: errorDetails.timestamp
      });
    }
  }

  /**
   * Check if error thresholds are exceeded and send alerts
   */
  private async checkAlertThresholds(errorDetails: ErrorLogEntry): Promise<void> {
    try {
      const relevantThresholds = this.getRelevantThresholds(errorDetails);
      
      for (const threshold of relevantThresholds) {
        const shouldAlert = await this.shouldSendAlert(threshold, errorDetails);
        
        if (shouldAlert) {
          await this.sendThresholdAlert(threshold, errorDetails);
          threshold.lastAlertSent = new Date();
        }
      }
    } catch (error) {
      console.error('Error checking alert thresholds:', error);
    }
  }

  /**
   * Get relevant alert thresholds for error
   */
  private getRelevantThresholds(errorDetails: ErrorLogEntry): AlertThreshold[] {
    return Array.from(this.alertThresholds.values()).filter(threshold => {
      return threshold.organizationId === errorDetails.organizationId &&
             threshold.alertEnabled &&
             (!threshold.errorCategory || threshold.errorCategory === errorDetails.category) &&
             (!threshold.errorSeverity || threshold.errorSeverity === errorDetails.severity) &&
             (!threshold.serviceName || threshold.serviceName === errorDetails.serviceName);
    });
  }

  /**
   * Check if alert should be sent based on threshold
   */
  private async shouldSendAlert(threshold: AlertThreshold, errorDetails: ErrorLogEntry): Promise<boolean> {
    try {
      // Check cooldown period
      if (threshold.lastAlertSent) {
        const cooldownMs = threshold.cooldownMinutes * 60 * 1000;
        const timeSinceLastAlert = Date.now() - threshold.lastAlertSent.getTime();
        
        if (timeSinceLastAlert < cooldownMs) {
          return false;
        }
      }

      // Count errors in time window
      const windowStart = new Date(Date.now() - (threshold.timeWindowMinutes * 60 * 1000));
      
      const errorCount = await prisma.errorLog.count({
        where: {
          organizationId: threshold.organizationId,
          timestamp: {
            gte: windowStart
          },
          ...(threshold.errorCategory && { category: threshold.errorCategory }),
          ...(threshold.errorSeverity && { severity: threshold.errorSeverity }),
          ...(threshold.serviceName && { serviceName: threshold.serviceName })
        }
      });

      return errorCount >= threshold.errorCount;
    } catch (error) {
      console.error('Error checking alert threshold:', error);
      return false;
    }
  }

  /**
   * Send threshold alert notification
   */
  private async sendThresholdAlert(threshold: AlertThreshold, errorDetails: ErrorLogEntry): Promise<void> {
    try {
      const message = this.formatThresholdAlertMessage(threshold, errorDetails);
      
      await NotificationService.createNotification({
        title: 'ML Service Error Threshold Exceeded',
        body: message,
        severity: 'CRITICAL',
        type: 'SYSTEM',
        organizationId: threshold.organizationId,
        metadata: {
          alertType: 'error_threshold',
          threshold: threshold.errorCount,
          timeWindow: threshold.timeWindowMinutes,
          category: threshold.errorCategory,
          severity: threshold.errorSeverity,
          serviceName: threshold.serviceName
        }
      });

      console.warn(`🚨 Error threshold alert sent for organization ${threshold.organizationId}`);
    } catch (error) {
      console.error('Failed to send threshold alert:', error);
    }
  }

  /**
   * Format threshold alert message
   */
  private formatThresholdAlertMessage(threshold: AlertThreshold, errorDetails: ErrorLogEntry): string {
    const filters = [];
    if (threshold.errorCategory) filters.push(`category: ${threshold.errorCategory}`);
    if (threshold.errorSeverity) filters.push(`severity: ${threshold.errorSeverity}`);
    if (threshold.serviceName) filters.push(`service: ${threshold.serviceName}`);
    
    const filterText = filters.length > 0 ? ` (${filters.join(', ')})` : '';
    
    return `Error threshold exceeded: ${threshold.errorCount} errors in ${threshold.timeWindowMinutes} minutes${filterText}. Latest error: ${errorDetails.errorMessage}`;
  }

  /**
   * Send error notification to users
   */
  private async sendErrorNotification(errorDetails: ErrorLogEntry): Promise<void> {
    try {
      const title = this.getErrorNotificationTitle(errorDetails);
      const message = this.getErrorNotificationMessage(errorDetails);
      
      await NotificationService.createNotification({
        title,
        body: message,
        severity: this.mapErrorSeverityToNotificationSeverity(errorDetails.severity),
        type: 'SYSTEM',
        organizationId: errorDetails.organizationId,
        metadata: {
          errorType: 'ml_service_error',
          correlationId: errorDetails.correlationId,
          category: errorDetails.category,
          serviceName: errorDetails.serviceName,
          operationName: errorDetails.operationName
        }
      });
    } catch (error) {
      console.error('Failed to send error notification:', error);
    }
  }

  /**
   * Get error notification title
   */
  private getErrorNotificationTitle(errorDetails: ErrorLogEntry): string {
    switch (errorDetails.severity) {
      case ErrorSeverity.CRITICAL:
        return `Critical ML Service Error`;
      case ErrorSeverity.HIGH:
        return `High Priority ML Service Error`;
      default:
        return `ML Service Error`;
    }
  }

  /**
   * Get error notification message
   */
  private getErrorNotificationMessage(errorDetails: ErrorLogEntry): string {
    return `${errorDetails.serviceName} encountered an error during ${errorDetails.operationName}: ${errorDetails.errorMessage}`;
  }

  /**
   * Get error metrics for organization
   */
  async getErrorMetrics(organizationId: string, hours: number = 24): Promise<ErrorMetrics> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - (hours * 60 * 60 * 1000));

      const errors = await prisma.errorLog.findMany({
        where: {
          organizationId,
          timestamp: {
            gte: startTime,
            lte: endTime
          }
        },
        orderBy: {
          timestamp: 'desc'
        }
      });

      const totalErrors = errors.length;
      const errorRate = totalErrors / hours;

      // Group by category
      const errorsByCategory = {} as Record<ErrorCategory, number>;
      Object.values(ErrorCategory).forEach(category => {
        errorsByCategory[category] = 0;
      });
      
      // Group by severity
      const errorsBySeverity = {} as Record<ErrorSeverity, number>;
      Object.values(ErrorSeverity).forEach(severity => {
        errorsBySeverity[severity] = 0;
      });
      
      // Group by service
      const errorsByService = {} as Record<string, number>;
      
      // Count top errors
      const errorCounts = new Map<string, number>();
      const errorLastSeen = new Map<string, Date>();
      
      let resolvedErrors = 0;
      const resolutionTimes: number[] = [];

      for (const error of errors) {
        // Category counts
        errorsByCategory[error.category as ErrorCategory]++;
        
        // Severity counts
        errorsBySeverity[error.severity as ErrorSeverity]++;
        
        // Service counts
        errorsByService[error.serviceName] = (errorsByService[error.serviceName] || 0) + 1;
        
        // Top errors
        const errorKey = error.errorName;
        errorCounts.set(errorKey, (errorCounts.get(errorKey) || 0) + 1);
        errorLastSeen.set(errorKey, error.timestamp);
        
        // Resolution metrics
        if (error.resolved) {
          resolvedErrors++;
          if (error.resolvedAt) {
            const resolutionTime = error.resolvedAt.getTime() - error.timestamp.getTime();
            resolutionTimes.push(resolutionTime / (1000 * 60)); // Convert to minutes
          }
        }
      }

      // Calculate MTTR
      const mttr = resolutionTimes.length > 0 
        ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length
        : 0;

      // Get top errors
      const topErrors = Array.from(errorCounts.entries())
        .map(([errorName, count]) => ({
          errorName,
          count,
          lastOccurrence: errorLastSeen.get(errorName)!
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        organizationId,
        timeRange: { start: startTime, end: endTime },
        totalErrors,
        errorsByCategory,
        errorsBySeverity,
        errorsByService,
        topErrors,
        errorRate: Math.round(errorRate * 100) / 100,
        mttr: Math.round(mttr * 100) / 100,
        resolvedErrors,
        unresolvedErrors: totalErrors - resolvedErrors
      };
    } catch (error) {
      console.error('Error getting error metrics:', error);
      throw error;
    }
  }

  /**
   * Mark error as resolved
   */
  async resolveError(
    correlationId: string,
    resolvedBy: string,
    resolutionNotes?: string
  ): Promise<void> {
    try {
      await prisma.errorLog.updateMany({
        where: {
          correlationId
        },
        data: {
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy,
          resolutionNotes
        }
      });

      console.log(`✅ Error resolved: ${correlationId} by ${resolvedBy}`);
    } catch (error) {
      console.error('Error marking error as resolved:', error);
      throw error;
    }
  }

  /**
   * Set alert threshold for organization
   */
  setAlertThreshold(threshold: AlertThreshold): void {
    const key = `${threshold.organizationId}-${threshold.errorCategory || 'all'}-${threshold.errorSeverity || 'all'}-${threshold.serviceName || 'all'}`;
    this.alertThresholds.set(key, threshold);
  }

  /**
   * Initialize default alert thresholds
   */
  private initializeDefaultThresholds(): void {
    // Default thresholds can be loaded from configuration or database
    // For now, we'll set some sensible defaults
    
    // Critical errors - alert immediately
    this.setAlertThreshold({
      organizationId: '*', // Wildcard for all organizations
      errorSeverity: ErrorSeverity.CRITICAL,
      errorCount: 1,
      timeWindowMinutes: 5,
      alertEnabled: true,
      cooldownMinutes: 15
    });
    
    // High severity errors - alert after 3 in 10 minutes
    this.setAlertThreshold({
      organizationId: '*',
      errorSeverity: ErrorSeverity.HIGH,
      errorCount: 3,
      timeWindowMinutes: 10,
      alertEnabled: true,
      cooldownMinutes: 30
    });
    
    // Model errors - alert after 5 in 15 minutes
    this.setAlertThreshold({
      organizationId: '*',
      errorCategory: ErrorCategory.MODEL_ERROR,
      errorCount: 5,
      timeWindowMinutes: 15,
      alertEnabled: true,
      cooldownMinutes: 60
    });
  }

  /**
   * Get log level for console output
   */
  private getLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'info' | 'log' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.LOW:
        return 'info';
      default:
        return 'log';
    }
  }

  /**
   * Map ErrorSeverity to notification severity
   */
  private mapErrorSeverityToNotificationSeverity(severity: ErrorSeverity): 'CRITICAL' | 'WARNING' | 'INFO' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'CRITICAL';
      case ErrorSeverity.HIGH:
        return 'CRITICAL';
      case ErrorSeverity.MEDIUM:
        return 'WARNING';
      case ErrorSeverity.LOW:
        return 'INFO';
      default:
        return 'WARNING';
    }
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start periodic cleanup of old error tracking data
   */
  private startPeriodicCleanup(): void {
    // Clean up every hour
    setInterval(() => {
      this.cleanupOldErrorTracking();
    }, 60 * 60 * 1000);
  }

  /**
   * Clean up old error tracking data
   */
  private cleanupOldErrorTracking(): void {
    const cutoffTime = new Date(Date.now() - (24 * 60 * 60 * 1000)); // 24 hours ago
    
    for (const [key, data] of this.errorCounts.entries()) {
      if (data.lastSeen < cutoffTime) {
        this.errorCounts.delete(key);
      }
    }
  }
}

// Export singleton instance
export const errorLogger = ErrorLogger.getInstance();