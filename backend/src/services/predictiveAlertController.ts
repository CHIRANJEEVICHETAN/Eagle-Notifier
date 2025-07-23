import { NotificationService } from './notificationService';
import { PredictionResult } from './predictionService';
import { ProcessedFeatures } from './organizationDataProcessor';
import { enhancedPredictionService, EnhancedPredictionResult } from './errorHandling/enhancedPredictionService';
import { ErrorLogger } from './errorHandling/errorLogger';
import { ErrorClassifier } from './errorHandling/errorTypes';
import prisma from '../config/db';

const DEBUG = process.env.NODE_ENV === 'development';

// Alert types and interfaces
export interface Alert {
  id: string;
  organizationId: string;
  type: 'CRITICAL' | 'WARNING' | 'PREDICTIVE';
  component: string;
  message: string;
  confidence?: number;
  timeToFailure?: number;
  timestamp: Date;
  metadata: AlertMetadata;
}

export interface AlertMetadata {
  source: 'rule-based' | 'predictive' | 'hybrid';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  probability?: number;
  modelVersion?: string;
  features?: Record<string, number>;
  processingTime?: number;
}

export interface OrganizationContext {
  organizationId: string;
  scadaConfig: any;
  schemaConfig: any;
  modelConfig?: any;
}

// Alert deduplication cache
interface AlertCacheEntry {
  alertKey: string;
  timestamp: Date;
  count: number;
}

/**
 * Enhanced Alert Controller for Predictive Maintenance
 * Supports both rule-based and predictive alerts with organization scoping
 */
export class PredictiveAlertController {
  private static alertCache = new Map<string, AlertCacheEntry>();
  private static readonly DEDUPLICATION_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly PREDICTIVE_THRESHOLD = 0.85; // 85% failure probability
  private static readonly CONFIDENCE_THRESHOLD = 0.7; // 70% confidence minimum

  /**
   * Analyze data and generate both rule-based and predictive alerts
   */
  static async analyzeData(
    rawData: any, 
    orgContext: OrganizationContext,
    predictionResult?: PredictionResult | EnhancedPredictionResult
  ): Promise<Alert[]> {
    try {
      if (DEBUG) {
        console.log(`🔍 Analyzing data for organization ${orgContext.organizationId}`);
      }

      const alerts: Alert[] = [];

      // Generate rule-based alerts using existing SCADA alarm processing
      try {
        const { processAndFormatAlarms } = await import('./scadaService');
        const scadaAlarms = await processAndFormatAlarms(orgContext.organizationId, false);
        
        // Convert SCADA alarms to Alert format
        const ruleBasedAlerts = this.convertScadaAlarmsToAlerts(scadaAlarms, orgContext.organizationId);
        alerts.push(...ruleBasedAlerts);
        
        if (DEBUG) {
          console.log(`📊 Generated ${ruleBasedAlerts.length} rule-based alerts`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to generate rule-based alerts for org ${orgContext.organizationId}:`, error);
      }
      
      // Generate predictive alerts if prediction result is provided
      if (predictionResult) {
        const predictiveAlerts = await this.generatePredictiveAlerts(predictionResult, orgContext);
        alerts.push(...predictiveAlerts);
        
        if (DEBUG) {
          console.log(`🤖 Generated ${predictiveAlerts.length} predictive alerts`);
        }
      }

      // Deduplicate alerts within organization scope
      const deduplicatedAlerts = this.deduplicateAlerts(alerts, orgContext.organizationId);

      // Broadcast alerts to organization users
      if (deduplicatedAlerts.length > 0) {
        await this.broadcastAlerts(deduplicatedAlerts, orgContext.organizationId);
      }

      if (DEBUG) {
        console.log(`✅ Total alerts after deduplication: ${deduplicatedAlerts.length}`);
      }

      return deduplicatedAlerts;
    } catch (error) {
      console.error(`❌ Error analyzing data for organization ${orgContext.organizationId}:`, error);
      return [];
    }
  }

  /**
   * Convert SCADA alarms to standardized Alert format
   */
  private static convertScadaAlarmsToAlerts(scadaAlarms: any, organizationId: string): Alert[] {
    try {
      const alerts: Alert[] = [];
      
      if (!scadaAlarms) {
        return alerts;
      }

      // Convert analog alarms
      if (scadaAlarms.analogAlarms) {
        for (const analogAlarm of scadaAlarms.analogAlarms) {
          const alert: Alert = {
            id: `rule-${organizationId}-${analogAlarm.name}-${Date.now()}`,
            organizationId,
            type: analogAlarm.severity === 'critical' ? 'CRITICAL' : 'WARNING',
            component: analogAlarm.name,
            message: analogAlarm.description || `${analogAlarm.name}: ${analogAlarm.currentValue} (Setpoint: ${analogAlarm.setPoint})`,
            timestamp: new Date(analogAlarm.timestamp || Date.now()),
            metadata: {
              source: 'rule-based',
              severity: analogAlarm.severity === 'critical' ? 'CRITICAL' : 'WARNING',
              processingTime: 0
            }
          };
          alerts.push(alert);
        }
      }

      // Convert binary alarms
      if (scadaAlarms.binaryAlarms) {
        for (const binaryAlarm of scadaAlarms.binaryAlarms) {
          const alert: Alert = {
            id: `rule-${organizationId}-${binaryAlarm.name}-${Date.now()}`,
            organizationId,
            type: binaryAlarm.severity === 'critical' ? 'CRITICAL' : 'WARNING',
            component: binaryAlarm.name,
            message: binaryAlarm.description || `${binaryAlarm.name}: ${binaryAlarm.status}`,
            timestamp: new Date(binaryAlarm.timestamp || Date.now()),
            metadata: {
              source: 'rule-based',
              severity: binaryAlarm.severity === 'critical' ? 'CRITICAL' : 'WARNING',
              processingTime: 0
            }
          };
          alerts.push(alert);
        }
      }

      return alerts;
    } catch (error) {
      console.error(`❌ Error converting SCADA alarms to alerts:`, error);
      return [];
    }
  }

  /**
   * Generate predictive alerts based on ML prediction results
   */
  static async generatePredictiveAlerts(
    prediction: PredictionResult,
    orgContext: OrganizationContext
  ): Promise<Alert[]> {
    try {
      const alerts: Alert[] = [];

      // Check if prediction exceeds threshold for alert generation
      if (prediction.probability >= this.PREDICTIVE_THRESHOLD && 
          prediction.confidence >= this.CONFIDENCE_THRESHOLD &&
          !prediction.metadata.fallbackUsed) {
        
        // Determine alert severity based on probability
        let alertType: 'CRITICAL' | 'WARNING' | 'PREDICTIVE' = 'PREDICTIVE';
        let severity: 'CRITICAL' | 'WARNING' | 'INFO' = 'WARNING';
        
        if (prediction.probability >= 0.95) {
          alertType = 'CRITICAL';
          severity = 'CRITICAL';
        } else if (prediction.probability >= 0.90) {
          alertType = 'WARNING';
          severity = 'WARNING';
        }

        // Create predictive alert
        const alert: Alert = {
          id: `pred-${prediction.organizationId}-${Date.now()}`,
          organizationId: prediction.organizationId,
          type: alertType,
          component: prediction.predictedComponent,
          message: this.formatPredictiveAlertMessage(prediction),
          confidence: prediction.confidence,
          timeToFailure: prediction.timeToFailure,
          timestamp: new Date(),
          metadata: {
            source: 'predictive',
            severity,
            probability: prediction.probability,
            modelVersion: prediction.modelVersion,
            features: prediction.features,
            processingTime: prediction.metadata.processingTime
          }
        };

        alerts.push(alert);

        // Store predictive alert in database
        await this.storePredictiveAlert(alert, prediction);

        if (DEBUG) {
          console.log(`🚨 Generated predictive alert for ${prediction.predictedComponent} with ${(prediction.probability * 100).toFixed(1)}% probability`);
        }
      }

      return alerts;
    } catch (error) {
      console.error(`❌ Error generating predictive alerts:`, error);
      return [];
    }
  }

  /**
   * Format predictive alert message with confidence scores
   */
  private static formatPredictiveAlertMessage(prediction: PredictionResult): string {
    const probabilityPercent = (prediction.probability * 100).toFixed(1);
    const confidencePercent = (prediction.confidence * 100).toFixed(1);
    const timeToFailureText = prediction.timeToFailure > 60 
      ? `${Math.round(prediction.timeToFailure / 60)} hours`
      : `${prediction.timeToFailure} minutes`;

    return `Predictive maintenance alert: ${prediction.predictedComponent} has ${probabilityPercent}% probability of failure within ${timeToFailureText}. Confidence: ${confidencePercent}%`;
  }

  /**
   * Store predictive alert in database
   */
  private static async storePredictiveAlert(alert: Alert, prediction: PredictionResult): Promise<void> {
    try {
      await prisma.predictionAlert.create({
        data: {
          organizationId: alert.organizationId,
          type: 'PREDICTIVE',
          component: alert.component,
          probability: prediction.probability,
          confidence: prediction.confidence,
          timeToFailure: prediction.timeToFailure,
          modelVersion: prediction.modelVersion,
          createdAt: alert.timestamp
        }
      });

      if (DEBUG) {
        console.log(`📝 Stored predictive alert in database for organization ${alert.organizationId}`);
      }
    } catch (error) {
      console.error(`❌ Error storing predictive alert:`, error);
    }
  }

  /**
   * Deduplicate alerts within organization scope using 5-minute window
   */
  private static deduplicateAlerts(alerts: Alert[], organizationId: string): Alert[] {
    const now = new Date();
    const deduplicatedAlerts: Alert[] = [];

    for (const alert of alerts) {
      // Create unique key for alert deduplication
      const alertKey = `${organizationId}-${alert.component}-${alert.type}`;
      const cacheKey = `${organizationId}-${alertKey}`;

      // Check if similar alert exists in cache
      const cachedEntry = this.alertCache.get(cacheKey);
      
      if (cachedEntry) {
        const timeDiff = now.getTime() - cachedEntry.timestamp.getTime();
        
        // If within deduplication window, skip this alert
        if (timeDiff < this.DEDUPLICATION_WINDOW_MS) {
          cachedEntry.count++;
          if (DEBUG) {
            console.log(`🔄 Deduplicated alert for ${alert.component} (count: ${cachedEntry.count})`);
          }
          continue;
        }
      }

      // Add/update cache entry
      this.alertCache.set(cacheKey, {
        alertKey,
        timestamp: now,
        count: 1
      });

      deduplicatedAlerts.push(alert);
    }

    // Clean up old cache entries
    this.cleanupAlertCache();

    return deduplicatedAlerts;
  }

  /**
   * Clean up old entries from alert cache
   */
  private static cleanupAlertCache(): void {
    const now = new Date();
    const cutoffTime = now.getTime() - (this.DEDUPLICATION_WINDOW_MS * 2); // Keep entries for 2x window

    const entriesToDelete: string[] = [];
    this.alertCache.forEach((entry, key) => {
      if (entry.timestamp.getTime() < cutoffTime) {
        entriesToDelete.push(key);
      }
    });
    
    entriesToDelete.forEach(key => {
      this.alertCache.delete(key);
    });
  }

  /**
   * Broadcast alerts to organization users via existing notification system
   */
  private static async broadcastAlerts(alerts: Alert[], organizationId: string): Promise<void> {
    try {
      for (const alert of alerts) {
        // Use existing NotificationService to send notifications
        await NotificationService.createNotification({
          title: this.getAlertTitle(alert),
          body: alert.message,
          severity: alert.metadata.severity,
          type: alert.type === 'PREDICTIVE' ? 'MAINTENANCE' : 'ALARM',
          organizationId: organizationId,
          metadata: {
            alertId: alert.id,
            component: alert.component,
            confidence: alert.confidence,
            timeToFailure: alert.timeToFailure,
            source: alert.metadata.source,
            probability: alert.metadata.probability,
            modelVersion: alert.metadata.modelVersion
          }
        });

        if (DEBUG) {
          console.log(`📡 Broadcasted ${alert.type} alert for ${alert.component} to organization ${organizationId}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error broadcasting alerts:`, error);
    }
  }

  /**
   * Generate appropriate alert title based on alert type
   */
  private static getAlertTitle(alert: Alert): string {
    switch (alert.type) {
      case 'PREDICTIVE':
        return `Predictive Alert: ${alert.component}`;
      case 'CRITICAL':
        return `Critical Alert: ${alert.component}`;
      case 'WARNING':
        return `Warning Alert: ${alert.component}`;
      default:
        return `Alert: ${alert.component}`;
    }
  }

  /**
   * Get alert statistics for organization
   */
  static async getAlertStatistics(organizationId: string, hours: number = 24): Promise<{
    totalAlerts: number;
    predictiveAlerts: number;
    ruleBasedAlerts: number;
    accuracy: number;
  }> {
    try {
      const since = new Date(Date.now() - (hours * 60 * 60 * 1000));

      // Get predictive alerts from database
      const predictiveAlerts = await prisma.predictionAlert.findMany({
        where: {
          organizationId,
          createdAt: {
            gte: since
          }
        }
      });

      // Get rule-based alerts from notifications (traditional alarms)
      const ruleBasedAlerts = await prisma.notification.findMany({
        where: {
          organizationId,
          type: 'ALARM',
          createdAt: {
            gte: since
          }
        }
      });

      // Calculate accuracy from feedback
      const feedbackAlerts = predictiveAlerts.filter(alert => alert.isAccurate !== null);
      const accurateAlerts = feedbackAlerts.filter(alert => alert.isAccurate === true);
      const accuracy = feedbackAlerts.length > 0 ? (accurateAlerts.length / feedbackAlerts.length) * 100 : 0;

      const totalAlerts = predictiveAlerts.length + ruleBasedAlerts.length;

      return {
        totalAlerts,
        predictiveAlerts: predictiveAlerts.length,
        ruleBasedAlerts: ruleBasedAlerts.length,
        accuracy: Math.round(accuracy * 100) / 100
      };
    } catch (error) {
      console.error(`❌ Error getting alert statistics:`, error);
      return {
        totalAlerts: 0,
        predictiveAlerts: 0,
        ruleBasedAlerts: 0,
        accuracy: 0
      };
    }
  }

  /**
   * Process alert feedback for accuracy tracking
   */
  static async processAlertFeedback(
    alertId: string,
    organizationId: string,
    isAccurate: boolean,
    userId: string
  ): Promise<void> {
    try {
      await prisma.predictionAlert.updateMany({
        where: {
          id: alertId,
          organizationId: organizationId
        },
        data: {
          isAccurate: isAccurate,
          feedbackAt: new Date(),
          feedbackBy: userId
        }
      });

      if (DEBUG) {
        console.log(`📝 Processed feedback for alert ${alertId}: ${isAccurate ? 'accurate' : 'inaccurate'}`);
      }
    } catch (error) {
      console.error(`❌ Error processing alert feedback:`, error);
    }
  }
}