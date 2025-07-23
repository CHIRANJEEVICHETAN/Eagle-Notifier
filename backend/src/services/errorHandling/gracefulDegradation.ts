/**
 * Graceful degradation service for ML operations
 * Provides fallback mechanisms when ML services fail
 */

import { ProcessedFeatures } from '../organizationDataProcessor';
import { PredictionResult } from '../predictionService';
import { Alert } from '../predictiveAlertController';
import { ErrorLogger } from './errorLogger';
import { MLServiceError, ErrorSeverity, ErrorCategory } from './errorTypes';
import prisma from '../../config/db';

const DEBUG = process.env.NODE_ENV === 'development';

export interface FallbackConfig {
  organizationId: string;
  enableRuleBasedFallback: boolean;
  enableStatisticalFallback: boolean;
  enableCachedPredictionFallback: boolean;
  fallbackThresholds: {
    temperatureHigh: number;
    temperatureLow: number;
    pressureHigh: number;
    pressureLow: number;
    vibrationHigh: number;
    currentHigh: number;
    voltageHigh: number;
    voltageLow: number;
  };
  statisticalWindows: {
    shortTerm: number; // minutes
    longTerm: number; // minutes
  };
  cacheRetentionHours: number;
}

export interface FallbackResult {
  success: boolean;
  method: 'rule_based' | 'statistical' | 'cached_prediction' | 'none';
  prediction?: PredictionResult;
  alerts?: Alert[];
  confidence: number;
  reason: string;
  metadata: {
    fallbackTriggered: boolean;
    originalError?: string;
    processingTime: number;
    dataQuality: 'good' | 'degraded' | 'poor';
  };
}

/**
 * Service for handling graceful degradation when ML services fail
 */
export class GracefulDegradationService {
  private static instance: GracefulDegradationService;
  private fallbackConfigs = new Map<string, FallbackConfig>();
  private predictionCache = new Map<string, { prediction: PredictionResult; timestamp: Date }>();
  private statisticalBaselines = new Map<string, { mean: number; std: number; timestamp: Date }>();
  
  private constructor() {
    this.startCacheCleanup();
  }
  
  static getInstance(): GracefulDegradationService {
    if (!GracefulDegradationService.instance) {
      GracefulDegradationService.instance = new GracefulDegradationService();
    }
    return GracefulDegradationService.instance;
  }

  /**
   * Handle ML service failure with graceful degradation
   */
  async handleMLFailure(
    organizationId: string,
    features: ProcessedFeatures,
    originalError: Error | MLServiceError,
    operationName: string
  ): Promise<FallbackResult> {
    const startTime = Date.now();
    
    try {
      // Log the original error
      await ErrorLogger.getInstance().logError(originalError, {
        organizationId,
        serviceName: 'GracefulDegradationService',
        operationName: 'handleMLFailure',
        originalOperation: operationName
      });

      // Get fallback configuration
      const config = await this.getFallbackConfig(organizationId);
      
      // Try fallback methods in order of preference
      let result = await this.tryRuleBasedFallback(organizationId, features, config);
      
      if (!result.success) {
        result = await this.tryStatisticalFallback(organizationId, features, config);
      }
      
      if (!result.success) {
        result = await this.tryCachedPredictionFallback(organizationId, features, config);
      }
      
      // If all fallbacks fail, return minimal safe result
      if (!result.success) {
        result = this.getMinimalSafeResult(organizationId, features, originalError);
      }
      
      const processingTime = Date.now() - startTime;
      result.metadata.processingTime = processingTime;
      result.metadata.fallbackTriggered = true;
      result.metadata.originalError = originalError.message;
      
      if (DEBUG) {
        console.log(`🛡️ Graceful degradation completed for org ${organizationId}: method=${result.method}, confidence=${result.confidence}`);
      }
      
      return result;
      
    } catch (error) {
      console.error(`Error in graceful degradation for org ${organizationId}:`, error);
      
      // Return absolute minimal result
      return {
        success: false,
        method: 'none',
        confidence: 0,
        reason: 'All fallback methods failed',
        metadata: {
          fallbackTriggered: true,
          originalError: originalError.message,
          processingTime: Date.now() - startTime,
          dataQuality: 'poor'
        }
      };
    }
  }

  /**
   * Try rule-based fallback using traditional alarm logic
   */
  private async tryRuleBasedFallback(
    organizationId: string,
    features: ProcessedFeatures,
    config: FallbackConfig
  ): Promise<FallbackResult> {
    try {
      if (!config.enableRuleBasedFallback) {
        return {
          success: false,
          method: 'rule_based',
          confidence: 0,
          reason: 'Rule-based fallback disabled',
          metadata: {
            fallbackTriggered: true,
            processingTime: 0,
            dataQuality: 'good'
          }
        };
      }

      const alerts: Alert[] = [];
      let highestSeverity = 0;
      let failureProbability = 0;

      // Check temperature thresholds
      const temperature = features.features['temperature'] || features.features['temp'] || 0;
      if (temperature > config.fallbackThresholds.temperatureHigh) {
        alerts.push(this.createRuleBasedAlert(
          organizationId,
          'Temperature',
          `High temperature detected: ${temperature.toFixed(1)}°C`,
          'CRITICAL'
        ));
        highestSeverity = Math.max(highestSeverity, 3);
        failureProbability = Math.max(failureProbability, 0.8);
      } else if (temperature < config.fallbackThresholds.temperatureLow) {
        alerts.push(this.createRuleBasedAlert(
          organizationId,
          'Temperature',
          `Low temperature detected: ${temperature.toFixed(1)}°C`,
          'WARNING'
        ));
        highestSeverity = Math.max(highestSeverity, 2);
        failureProbability = Math.max(failureProbability, 0.6);
      }

      // Check pressure thresholds
      const pressure = features.features['pressure'] || 0;
      if (pressure > config.fallbackThresholds.pressureHigh) {
        alerts.push(this.createRuleBasedAlert(
          organizationId,
          'Pressure',
          `High pressure detected: ${pressure.toFixed(1)} bar`,
          'CRITICAL'
        ));
        highestSeverity = Math.max(highestSeverity, 3);
        failureProbability = Math.max(failureProbability, 0.85);
      } else if (pressure < config.fallbackThresholds.pressureLow) {
        alerts.push(this.createRuleBasedAlert(
          organizationId,
          'Pressure',
          `Low pressure detected: ${pressure.toFixed(1)} bar`,
          'WARNING'
        ));
        highestSeverity = Math.max(highestSeverity, 2);
        failureProbability = Math.max(failureProbability, 0.5);
      }

      // Check vibration thresholds
      const vibration = features.features['vibration'] || 0;
      if (vibration > config.fallbackThresholds.vibrationHigh) {
        alerts.push(this.createRuleBasedAlert(
          organizationId,
          'Vibration',
          `High vibration detected: ${vibration.toFixed(2)} mm/s`,
          'WARNING'
        ));
        highestSeverity = Math.max(highestSeverity, 2);
        failureProbability = Math.max(failureProbability, 0.7);
      }

      // Check electrical parameters
      const current = features.features['current'] || 0;
      const voltage = features.features['voltage'] || 0;

      if (current > config.fallbackThresholds.currentHigh) {
        alerts.push(this.createRuleBasedAlert(
          organizationId,
          'Current',
          `High current detected: ${current.toFixed(1)} A`,
          'WARNING'
        ));
        highestSeverity = Math.max(highestSeverity, 2);
        failureProbability = Math.max(failureProbability, 0.6);
      }

      if (voltage > config.fallbackThresholds.voltageHigh || voltage < config.fallbackThresholds.voltageLow) {
        const severity = voltage > config.fallbackThresholds.voltageHigh ? 'CRITICAL' : 'WARNING';
        alerts.push(this.createRuleBasedAlert(
          organizationId,
          'Voltage',
          `Voltage anomaly detected: ${voltage.toFixed(1)} V`,
          severity
        ));
        highestSeverity = Math.max(highestSeverity, severity === 'CRITICAL' ? 3 : 2);
        failureProbability = Math.max(failureProbability, severity === 'CRITICAL' ? 0.75 : 0.55);
      }

      // Create prediction result if any issues detected
      let prediction: PredictionResult | undefined;
      if (failureProbability > 0) {
        prediction = {
          organizationId,
          probability: failureProbability,
          confidence: 0.7, // Rule-based has moderate confidence
          predictedComponent: this.getPrimaryComponent(alerts),
          timeToFailure: this.estimateTimeToFailure(failureProbability),
          modelVersion: 'rule-based-fallback',
          timestamp: features.timestamp,
          features: features.features,
          metadata: {
            processingTime: 0,
            modelLoadTime: 0,
            featureCount: Object.keys(features.features).length,
            modelHealth: 'degraded',
            fallbackUsed: true
          }
        };
      }

      const confidence = alerts.length > 0 ? 0.7 : 0.3;
      const dataQuality = this.assessDataQuality(features);

      return {
        success: alerts.length > 0 || failureProbability > 0.5,
        method: 'rule_based',
        prediction,
        alerts,
        confidence,
        reason: alerts.length > 0 ? `Generated ${alerts.length} rule-based alerts` : 'No rule-based alerts triggered',
        metadata: {
          fallbackTriggered: true,
          processingTime: 0,
          dataQuality
        }
      };

    } catch (error) {
      console.error('Error in rule-based fallback:', error);
      return {
        success: false,
        method: 'rule_based',
        confidence: 0,
        reason: `Rule-based fallback failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          fallbackTriggered: true,
          processingTime: 0,
          dataQuality: 'poor'
        }
      };
    }
  }

  /**
   * Try statistical fallback using historical data analysis
   */
  private async tryStatisticalFallback(
    organizationId: string,
    features: ProcessedFeatures,
    config: FallbackConfig
  ): Promise<FallbackResult> {
    try {
      if (!config.enableStatisticalFallback) {
        return {
          success: false,
          method: 'statistical',
          confidence: 0,
          reason: 'Statistical fallback disabled',
          metadata: {
            fallbackTriggered: true,
            processingTime: 0,
            dataQuality: 'good'
          }
        };
      }

      // Get or calculate statistical baselines
      const baseline = await this.getStatisticalBaseline(organizationId, config);
      if (!baseline) {
        return {
          success: false,
          method: 'statistical',
          confidence: 0,
          reason: 'No statistical baseline available',
          metadata: {
            fallbackTriggered: true,
            processingTime: 0,
            dataQuality: 'poor'
          }
        };
      }

      // Calculate anomaly scores for key features
      const anomalyScores: Record<string, number> = {};
      let maxAnomalyScore = 0;
      let anomalousFeatures: string[] = [];

      for (const [featureName, value] of Object.entries(features.features)) {
        if (typeof value === 'number' && baseline[featureName]) {
          const { mean, std } = baseline[featureName];
          const zScore = Math.abs((value - mean) / std);
          anomalyScores[featureName] = zScore;
          
          if (zScore > 2) { // 2 standard deviations
            anomalousFeatures.push(featureName);
            maxAnomalyScore = Math.max(maxAnomalyScore, zScore);
          }
        }
      }

      // Calculate failure probability based on anomaly scores
      const failureProbability = Math.min(maxAnomalyScore / 5, 0.9); // Cap at 90%
      const confidence = anomalousFeatures.length > 0 ? 0.6 : 0.2;

      let prediction: PredictionResult | undefined;
      let alerts: Alert[] = [];

      if (failureProbability > 0.5) {
        // Create prediction
        prediction = {
          organizationId,
          probability: failureProbability,
          confidence,
          predictedComponent: 'Statistical Anomaly',
          timeToFailure: this.estimateTimeToFailure(failureProbability),
          modelVersion: 'statistical-fallback',
          timestamp: features.timestamp,
          features: features.features,
          metadata: {
            processingTime: 0,
            modelLoadTime: 0,
            featureCount: Object.keys(features.features).length,
            modelHealth: 'degraded',
            fallbackUsed: true
          }
        };

        // Create alerts for anomalous features
        for (const featureName of anomalousFeatures) {
          const score = anomalyScores[featureName];
          const severity = score > 3 ? 'CRITICAL' : 'WARNING';
          
          alerts.push(this.createRuleBasedAlert(
            organizationId,
            featureName,
            `Statistical anomaly detected: ${featureName} (z-score: ${score.toFixed(2)})`,
            severity
          ));
        }
      }

      const dataQuality = this.assessDataQuality(features);

      return {
        success: failureProbability > 0.5,
        method: 'statistical',
        prediction,
        alerts,
        confidence,
        reason: anomalousFeatures.length > 0 
          ? `Detected anomalies in ${anomalousFeatures.length} features`
          : 'No statistical anomalies detected',
        metadata: {
          fallbackTriggered: true,
          processingTime: 0,
          dataQuality
        }
      };

    } catch (error) {
      console.error('Error in statistical fallback:', error);
      return {
        success: false,
        method: 'statistical',
        confidence: 0,
        reason: `Statistical fallback failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          fallbackTriggered: true,
          processingTime: 0,
          dataQuality: 'poor'
        }
      };
    }
  }

  /**
   * Try cached prediction fallback using recent predictions
   */
  private async tryCachedPredictionFallback(
    organizationId: string,
    features: ProcessedFeatures,
    config: FallbackConfig
  ): Promise<FallbackResult> {
    try {
      if (!config.enableCachedPredictionFallback) {
        return {
          success: false,
          method: 'cached_prediction',
          confidence: 0,
          reason: 'Cached prediction fallback disabled',
          metadata: {
            fallbackTriggered: true,
            processingTime: 0,
            dataQuality: 'good'
          }
        };
      }

      // Look for recent cached predictions
      const cacheKey = organizationId;
      const cached = this.predictionCache.get(cacheKey);
      
      if (!cached) {
        return {
          success: false,
          method: 'cached_prediction',
          confidence: 0,
          reason: 'No cached predictions available',
          metadata: {
            fallbackTriggered: true,
            processingTime: 0,
            dataQuality: 'poor'
          }
        };
      }

      // Check if cache is still valid
      const cacheAgeHours = (Date.now() - cached.timestamp.getTime()) / (1000 * 60 * 60);
      if (cacheAgeHours > config.cacheRetentionHours) {
        this.predictionCache.delete(cacheKey);
        return {
          success: false,
          method: 'cached_prediction',
          confidence: 0,
          reason: 'Cached prediction expired',
          metadata: {
            fallbackTriggered: true,
            processingTime: 0,
            dataQuality: 'poor'
          }
        };
      }

      // Create modified prediction with reduced confidence
      const cachedPrediction = cached.prediction;
      const degradedConfidence = Math.max(cachedPrediction.confidence * 0.5, 0.1);
      
      const prediction: PredictionResult = {
        ...cachedPrediction,
        timestamp: features.timestamp,
        confidence: degradedConfidence,
        modelVersion: `${cachedPrediction.modelVersion}-cached`,
        metadata: {
          ...cachedPrediction.metadata,
          fallbackUsed: true,
          modelHealth: 'degraded'
        }
      };

      const dataQuality = this.assessDataQuality(features);

      return {
        success: true,
        method: 'cached_prediction',
        prediction,
        confidence: degradedConfidence,
        reason: `Using cached prediction from ${cacheAgeHours.toFixed(1)} hours ago`,
        metadata: {
          fallbackTriggered: true,
          processingTime: 0,
          dataQuality
        }
      };

    } catch (error) {
      console.error('Error in cached prediction fallback:', error);
      return {
        success: false,
        method: 'cached_prediction',
        confidence: 0,
        reason: `Cached prediction fallback failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          fallbackTriggered: true,
          processingTime: 0,
          dataQuality: 'poor'
        }
      };
    }
  }

  /**
   * Get minimal safe result when all fallbacks fail
   */
  private getMinimalSafeResult(
    organizationId: string,
    features: ProcessedFeatures,
    originalError: Error | MLServiceError
  ): FallbackResult {
    // Create a very conservative prediction indicating system degradation
    const prediction: PredictionResult = {
      organizationId,
      probability: 0.1, // Very low probability to avoid false alarms
      confidence: 0.1,   // Very low confidence
      predictedComponent: 'System Monitoring',
      timeToFailure: 60, // 1 hour default
      modelVersion: 'minimal-safe-fallback',
      timestamp: features.timestamp,
      features: features.features,
      metadata: {
        processingTime: 0,
        modelLoadTime: 0,
        featureCount: Object.keys(features.features).length,
        modelHealth: 'failed',
        fallbackUsed: true
      }
    };

    // Create system alert about degraded monitoring
    const alert = this.createRuleBasedAlert(
      organizationId,
      'System Monitoring',
      'Predictive maintenance system is operating in degraded mode. Please check system status.',
      'WARNING'
    );

    return {
      success: true,
      method: 'none',
      prediction,
      alerts: [alert],
      confidence: 0.1,
      reason: 'All fallback methods failed, using minimal safe mode',
      metadata: {
        fallbackTriggered: true,
        originalError: originalError.message,
        processingTime: 0,
        dataQuality: 'poor'
      }
    };
  }

  /**
   * Cache successful prediction for fallback use
   */
  cachePrediction(organizationId: string, prediction: PredictionResult): void {
    try {
      // Only cache predictions with reasonable confidence
      if (prediction.confidence > 0.5 && !prediction.metadata.fallbackUsed) {
        this.predictionCache.set(organizationId, {
          prediction,
          timestamp: new Date()
        });

        if (DEBUG) {
          console.log(`💾 Cached prediction for org ${organizationId} (confidence: ${prediction.confidence})`);
        }
      }
    } catch (error) {
      console.error('Error caching prediction:', error);
    }
  }

  /**
   * Get fallback configuration for organization
   */
  private async getFallbackConfig(organizationId: string): Promise<FallbackConfig> {
    let config = this.fallbackConfigs.get(organizationId);
    
    if (!config) {
      // Load from database or use defaults
      try {
        const org = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { mlModelConfig: true }
        });

        const mlConfig = org?.mlModelConfig as any;
        const fallbackConfig = mlConfig?.fallbackConfig;

        config = {
          organizationId,
          enableRuleBasedFallback: fallbackConfig?.enableRuleBasedFallback ?? true,
          enableStatisticalFallback: fallbackConfig?.enableStatisticalFallback ?? true,
          enableCachedPredictionFallback: fallbackConfig?.enableCachedPredictionFallback ?? true,
          fallbackThresholds: {
            temperatureHigh: fallbackConfig?.fallbackThresholds?.temperatureHigh ?? 80,
            temperatureLow: fallbackConfig?.fallbackThresholds?.temperatureLow ?? 10,
            pressureHigh: fallbackConfig?.fallbackThresholds?.pressureHigh ?? 10,
            pressureLow: fallbackConfig?.fallbackThresholds?.pressureLow ?? 0.5,
            vibrationHigh: fallbackConfig?.fallbackThresholds?.vibrationHigh ?? 5,
            currentHigh: fallbackConfig?.fallbackThresholds?.currentHigh ?? 100,
            voltageHigh: fallbackConfig?.fallbackThresholds?.voltageHigh ?? 250,
            voltageLow: fallbackConfig?.fallbackThresholds?.voltageLow ?? 200,
            ...fallbackConfig?.fallbackThresholds
          },
          statisticalWindows: {
            shortTerm: fallbackConfig?.statisticalWindows?.shortTerm ?? 60,
            longTerm: fallbackConfig?.statisticalWindows?.longTerm ?? 1440,
            ...fallbackConfig?.statisticalWindows
          },
          cacheRetentionHours: fallbackConfig?.cacheRetentionHours ?? 4
        };

        this.fallbackConfigs.set(organizationId, config);
      } catch (error) {
        console.error(`Error loading fallback config for org ${organizationId}:`, error);
        
        // Use default configuration
        config = this.getDefaultFallbackConfig(organizationId);
        this.fallbackConfigs.set(organizationId, config);
      }
    }
    
    return config;
  }

  /**
   * Get default fallback configuration
   */
  private getDefaultFallbackConfig(organizationId: string): FallbackConfig {
    return {
      organizationId,
      enableRuleBasedFallback: true,
      enableStatisticalFallback: true,
      enableCachedPredictionFallback: true,
      fallbackThresholds: {
        temperatureHigh: 80,
        temperatureLow: 10,
        pressureHigh: 10,
        pressureLow: 0.5,
        vibrationHigh: 5,
        currentHigh: 100,
        voltageHigh: 250,
        voltageLow: 200
      },
      statisticalWindows: {
        shortTerm: 60,   // 1 hour
        longTerm: 1440   // 24 hours
      },
      cacheRetentionHours: 4
    };
  }

  /**
   * Get statistical baseline for organization
   */
  private async getStatisticalBaseline(
    organizationId: string,
    config: FallbackConfig
  ): Promise<Record<string, { mean: number; std: number }> | null> {
    try {
      // Check cache first
      const cacheKey = organizationId;
      const cached = this.statisticalBaselines.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp.getTime()) < 60 * 60 * 1000) { // 1 hour cache
        return cached as any;
      }

      // Calculate from recent data (this would need to be implemented based on your SCADA data structure)
      // For now, return null to indicate no baseline available
      return null;

    } catch (error) {
      console.error('Error getting statistical baseline:', error);
      return null;
    }
  }

  /**
   * Create rule-based alert
   */
  private createRuleBasedAlert(
    organizationId: string,
    component: string,
    message: string,
    severity: 'CRITICAL' | 'WARNING' | 'INFO'
  ): Alert {
    return {
      id: `fallback-${organizationId}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      organizationId,
      type: severity as any,
      component,
      message,
      timestamp: new Date(),
      metadata: {
        source: 'rule-based',
        severity: severity as any,
        processingTime: 0
      }
    };
  }

  /**
   * Get primary component from alerts
   */
  private getPrimaryComponent(alerts: Alert[]): string {
    if (alerts.length === 0) return 'Unknown';
    
    // Return the component from the most severe alert
    const criticalAlerts = alerts.filter(a => a.type === 'CRITICAL');
    if (criticalAlerts.length > 0) {
      return criticalAlerts[0].component;
    }
    
    return alerts[0].component;
  }

  /**
   * Estimate time to failure based on probability
   */
  private estimateTimeToFailure(probability: number): number {
    // Simple heuristic: higher probability = shorter time to failure
    if (probability > 0.9) return 5;   // 5 minutes
    if (probability > 0.8) return 15;  // 15 minutes
    if (probability > 0.7) return 30;  // 30 minutes
    if (probability > 0.6) return 60;  // 1 hour
    if (probability > 0.5) return 120; // 2 hours
    return 240; // 4 hours
  }

  /**
   * Assess data quality based on features
   */
  private assessDataQuality(features: ProcessedFeatures): 'good' | 'degraded' | 'poor' {
    const featureCount = Object.keys(features.features).length;
    const nullCount = Object.values(features.features).filter(v => v === null || v === undefined).length;
    const nullRatio = nullCount / featureCount;

    if (nullRatio > 0.5) return 'poor';
    if (nullRatio > 0.2) return 'degraded';
    return 'good';
  }

  /**
   * Start cache cleanup timer
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      this.cleanupCaches();
    }, 60 * 60 * 1000); // Clean up every hour
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCaches(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean prediction cache
    for (const [key, value] of this.predictionCache.entries()) {
      if (now - value.timestamp.getTime() > maxAge) {
        this.predictionCache.delete(key);
      }
    }

    // Clean statistical baselines cache
    for (const [key, value] of this.statisticalBaselines.entries()) {
      if (now - value.timestamp.getTime() > maxAge) {
        this.statisticalBaselines.delete(key);
      }
    }
  }
}

// Export singleton instance
export const gracefulDegradationService = GracefulDegradationService.getInstance();