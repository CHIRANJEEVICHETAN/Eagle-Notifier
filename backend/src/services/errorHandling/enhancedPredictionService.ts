/**
 * Enhanced Prediction Service with comprehensive error handling and circuit breaker
 */

import { PredictionService, IPredictionService, PredictionResult } from '../predictionService';
import { ProcessedFeatures } from '../organizationDataProcessor';
import { CircuitBreakerManager, CircuitState } from './circuitBreaker';
import { ErrorLogger } from './errorLogger';
import { GracefulDegradationService, FallbackResult } from './gracefulDegradation';
import { 
  MLServiceError, 
  ModelLoadError, 
  ModelPredictionError, 
  ErrorClassifier,
  ErrorRecoveryAction 
} from './errorTypes';

const DEBUG = process.env.NODE_ENV === 'development';

export interface EnhancedPredictionResult extends PredictionResult {
  errorHandling: {
    circuitBreakerState: CircuitState;
    fallbackUsed: boolean;
    retryCount: number;
    errorRecoveryAction?: ErrorRecoveryAction;
    degradationLevel: 'none' | 'partial' | 'full';
  };
}

/**
 * Enhanced prediction service with error handling, circuit breaker, and graceful degradation
 */
export class EnhancedPredictionService implements IPredictionService {
  private basePredictionService: PredictionService;
  private circuitBreakerManager: CircuitBreakerManager;
  private errorLogger: ErrorLogger;
  private gracefulDegradation: GracefulDegradationService;

  constructor() {
    this.basePredictionService = new PredictionService();
    this.circuitBreakerManager = CircuitBreakerManager.getInstance();
    this.errorLogger = ErrorLogger.getInstance();
    this.gracefulDegradation = GracefulDegradationService.getInstance();
  }

  /**
   * Initialize models with error handling
   */
  async initializeModels(): Promise<void> {
    const circuitBreaker = this.circuitBreakerManager.getCircuitBreaker(
      'ModelInitialization',
      'system',
      {
        failureThreshold: 3,
        recoveryTimeout: 30000, // 30 seconds
        maxRetries: 2
      }
    );

    try {
      await circuitBreaker.executeWithRetry(async () => {
        await this.basePredictionService.initializeModels();
      });

      if (DEBUG) {
        console.log('✅ Enhanced prediction service initialized successfully');
      }
    } catch (error) {
      const mlError = ErrorClassifier.classify(
        error as Error,
        'system',
        'EnhancedPredictionService',
        'initializeModels'
      );

      await this.errorLogger.logError(mlError);
      
      console.error('❌ Failed to initialize enhanced prediction service:', error);
      throw mlError;
    }
  }

  /**
   * Make prediction with comprehensive error handling
   */
  async predict(features: ProcessedFeatures): Promise<EnhancedPredictionResult> {
    const organizationId = features.organizationId;
    const circuitBreaker = this.circuitBreakerManager.getCircuitBreaker(
      'Prediction',
      organizationId,
      {
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        maxRetries: 3,
        retryDelay: 1000
      }
    );

    let retryCount = 0;
    let fallbackResult: FallbackResult | null = null;
    let degradationLevel: 'none' | 'partial' | 'full' = 'none';

    try {
      // Try primary prediction with circuit breaker
      const result = await circuitBreaker.executeWithRetry(async () => {
        retryCount++;
        return await this.basePredictionService.predict(features);
      }, 3);

      // Cache successful prediction for fallback
      this.gracefulDegradation.cachePrediction(organizationId, result);

      // Return enhanced result
      const enhancedResult: EnhancedPredictionResult = {
        ...result,
        errorHandling: {
          circuitBreakerState: circuitBreaker.getStats().state,
          fallbackUsed: false,
          retryCount: retryCount - 1, // Subtract 1 because first attempt isn't a retry
          degradationLevel
        }
      };

      if (DEBUG) {
        console.log(`🎯 Prediction successful for org ${organizationId} (retries: ${retryCount - 1})`);
      }

      return enhancedResult;

    } catch (error) {
      // Classify and log the error
      const mlError = ErrorClassifier.classify(
        error as Error,
        organizationId,
        'EnhancedPredictionService',
        'predict'
      );

      await this.errorLogger.logError(mlError, {
        featureCount: Object.keys(features.features).length,
        retryCount,
        circuitBreakerState: circuitBreaker.getStats().state
      });

      // Determine recovery action
      const recoveryAction = ErrorClassifier.getRecoveryAction(mlError);

      // Handle different recovery actions
      switch (recoveryAction) {
        case ErrorRecoveryAction.FALLBACK:
          fallbackResult = await this.handleFallback(organizationId, features, mlError);
          degradationLevel = fallbackResult.success ? 'partial' : 'full';
          break;

        case ErrorRecoveryAction.CIRCUIT_BREAK:
          // Circuit breaker will handle this automatically
          fallbackResult = await this.handleFallback(organizationId, features, mlError);
          degradationLevel = 'full';
          break;

        case ErrorRecoveryAction.RETRY:
          // Already handled by circuit breaker retry logic
          fallbackResult = await this.handleFallback(organizationId, features, mlError);
          degradationLevel = fallbackResult.success ? 'partial' : 'full';
          break;

        case ErrorRecoveryAction.ESCALATE:
          await this.escalateError(mlError, organizationId);
          fallbackResult = await this.handleFallback(organizationId, features, mlError);
          degradationLevel = 'full';
          break;

        case ErrorRecoveryAction.MANUAL_INTERVENTION:
          await this.requestManualIntervention(mlError, organizationId);
          fallbackResult = await this.handleFallback(organizationId, features, mlError);
          degradationLevel = 'full';
          break;

        default:
          fallbackResult = await this.handleFallback(organizationId, features, mlError);
          degradationLevel = fallbackResult.success ? 'partial' : 'full';
      }

      // Return fallback result or throw if no fallback available
      if (fallbackResult && fallbackResult.success && fallbackResult.prediction) {
        const enhancedResult: EnhancedPredictionResult = {
          ...fallbackResult.prediction,
          errorHandling: {
            circuitBreakerState: circuitBreaker.getStats().state,
            fallbackUsed: true,
            retryCount,
            errorRecoveryAction: recoveryAction,
            degradationLevel
          }
        };

        if (DEBUG) {
          console.log(`🛡️ Fallback prediction successful for org ${organizationId} (method: ${fallbackResult.method})`);
        }

        return enhancedResult;
      }

      // If all recovery methods fail, throw the original error
      console.error(`❌ All recovery methods failed for org ${organizationId}`);
      throw mlError;
    }
  }

  /**
   * Load model for organization with error handling
   */
  async loadModelForOrganization(orgId: string): Promise<any> {
    const circuitBreaker = this.circuitBreakerManager.getCircuitBreaker(
      'ModelLoad',
      orgId,
      {
        failureThreshold: 3,
        recoveryTimeout: 120000, // 2 minutes
        maxRetries: 2
      }
    );

    try {
      return await circuitBreaker.executeWithRetry(async () => {
        return await this.basePredictionService.loadModelForOrganization(orgId);
      });
    } catch (error) {
      const mlError = new ModelLoadError(orgId, 'unknown', error as Error);
      await this.errorLogger.logError(mlError);
      throw mlError;
    }
  }

  /**
   * Validate model health with error handling
   */
  async validateModelHealth(orgId: string): Promise<boolean> {
    try {
      return await this.basePredictionService.validateModelHealth(orgId);
    } catch (error) {
      const mlError = ErrorClassifier.classify(
        error as Error,
        orgId,
        'EnhancedPredictionService',
        'validateModelHealth'
      );

      await this.errorLogger.logError(mlError);
      
      // Return false for health check failures
      return false;
    }
  }

  /**
   * Unload model (no error handling needed for cleanup operations)
   */
  unloadModel(orgId: string): void {
    try {
      this.basePredictionService.unloadModel(orgId);
    } catch (error) {
      console.warn(`Warning: Error unloading model for org ${orgId}:`, error);
    }
  }

  /**
   * Get model metrics with error handling
   */
  async getModelMetrics(orgId: string): Promise<any> {
    try {
      return await this.basePredictionService.getModelMetrics(orgId);
    } catch (error) {
      const mlError = ErrorClassifier.classify(
        error as Error,
        orgId,
        'EnhancedPredictionService',
        'getModelMetrics'
      );

      await this.errorLogger.logError(mlError);
      return null;
    }
  }

  /**
   * Handle fallback when primary prediction fails
   */
  private async handleFallback(
    organizationId: string,
    features: ProcessedFeatures,
    originalError: MLServiceError
  ): Promise<FallbackResult> {
    try {
      return await this.gracefulDegradation.handleMLFailure(
        organizationId,
        features,
        originalError,
        'predict'
      );
    } catch (fallbackError) {
      console.error(`Fallback handling failed for org ${organizationId}:`, fallbackError);
      
      return {
        success: false,
        method: 'none',
        confidence: 0,
        reason: 'Fallback handling failed',
        metadata: {
          fallbackTriggered: true,
          originalError: originalError.message,
          processingTime: 0,
          dataQuality: 'poor'
        }
      };
    }
  }

  /**
   * Escalate error to administrators
   */
  private async escalateError(error: MLServiceError, organizationId: string): Promise<void> {
    try {
      // Import notification service to send escalation alerts
      const { NotificationService } = await import('../notificationService');
      
      await NotificationService.createNotification({
        title: 'ML Service Error Escalation',
        body: `Critical ML service error requires attention: ${error.message}`,
        severity: 'CRITICAL',
        type: 'SYSTEM',
        organizationId,
        metadata: {
          errorType: 'ml_escalation',
          correlationId: error.correlationId,
          category: error.metadata.category,
          severity: error.metadata.severity
        }
      });

      console.error(`🚨 Error escalated for org ${organizationId}: ${error.correlationId}`);
    } catch (escalationError) {
      console.error('Failed to escalate error:', escalationError);
    }
  }

  /**
   * Request manual intervention
   */
  private async requestManualIntervention(error: MLServiceError, organizationId: string): Promise<void> {
    try {
      // Import notification service to send intervention requests
      const { NotificationService } = await import('../notificationService');
      
      await NotificationService.createNotification({
        title: 'Manual Intervention Required',
        body: `ML service requires manual intervention: ${error.message}`,
        severity: 'CRITICAL',
        type: 'SYSTEM',
        organizationId,
        metadata: {
          errorType: 'manual_intervention',
          correlationId: error.correlationId,
          category: error.metadata.category,
          interventionRequired: true
        }
      });

      console.warn(`🔧 Manual intervention requested for org ${organizationId}: ${error.correlationId}`);
    } catch (interventionError) {
      console.error('Failed to request manual intervention:', interventionError);
    }
  }

  /**
   * Get comprehensive service health status
   */
  getServiceHealth(): {
    overall: 'healthy' | 'degraded' | 'critical';
    circuitBreakers: Record<string, CircuitState>;
    errorRates: Record<string, number>;
    lastErrors: Array<{
      organizationId: string;
      error: string;
      timestamp: Date;
    }>;
  } {
    const circuitBreakers = this.circuitBreakerManager.getAllCircuitBreakers();
    const systemStats = this.circuitBreakerManager.getSystemStats();
    
    // Determine overall health
    let overall: 'healthy' | 'degraded' | 'critical' = 'healthy';
    
    if (systemStats.openCircuits > 0) {
      overall = systemStats.openCircuits > systemStats.totalCircuitBreakers * 0.5 ? 'critical' : 'degraded';
    } else if (systemStats.halfOpenCircuits > 0) {
      overall = 'degraded';
    }

    // Get circuit breaker states
    const circuitBreakerStates: Record<string, CircuitState> = {};
    for (const [key, cb] of circuitBreakers.entries()) {
      circuitBreakerStates[key] = cb.getStats().state;
    }

    // Calculate error rates (simplified)
    const errorRates: Record<string, number> = {};
    for (const [key, cb] of circuitBreakers.entries()) {
      const stats = cb.getStats();
      const totalRequests = stats.totalRequests;
      const errorRate = totalRequests > 0 ? (stats.totalFailures / totalRequests) * 100 : 0;
      errorRates[key] = Math.round(errorRate * 100) / 100;
    }

    return {
      overall,
      circuitBreakers: circuitBreakerStates,
      errorRates,
      lastErrors: [] // This would be populated from error logger if needed
    };
  }

  /**
   * Shutdown the enhanced prediction service
   */
  shutdown(): void {
    try {
      this.basePredictionService.shutdown();
      console.log('🛑 Enhanced prediction service shutdown complete');
    } catch (error) {
      console.error('Error during enhanced prediction service shutdown:', error);
    }
  }
}

// Export singleton instance
export const enhancedPredictionService = new EnhancedPredictionService();