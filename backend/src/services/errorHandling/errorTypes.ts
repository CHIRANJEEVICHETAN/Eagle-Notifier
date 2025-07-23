/**
 * Comprehensive error types and classification for ML services
 */

export enum ErrorCategory {
  MODEL_ERROR = 'MODEL_ERROR',
  DATA_ERROR = 'DATA_ERROR',
  INFRASTRUCTURE_ERROR = 'INFRASTRUCTURE_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RESOURCE_ERROR = 'RESOURCE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export enum ErrorSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  INFO = 'INFO'
}

export enum ErrorRecoveryAction {
  RETRY = 'RETRY',
  FALLBACK = 'FALLBACK',
  CIRCUIT_BREAK = 'CIRCUIT_BREAK',
  ESCALATE = 'ESCALATE',
  IGNORE = 'IGNORE',
  MANUAL_INTERVENTION = 'MANUAL_INTERVENTION'
}

export interface ErrorContext {
  organizationId: string;
  serviceName: string;
  operationName: string;
  timestamp: Date;
  requestId?: string;
  userId?: string;
  modelVersion?: string;
  featureCount?: number;
  processingTime?: number;
  memoryUsage?: number;
  additionalData?: Record<string, any>;
}

export interface ErrorMetadata {
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoveryAction: ErrorRecoveryAction;
  retryable: boolean;
  fallbackAvailable: boolean;
  escalationRequired: boolean;
  userNotificationRequired: boolean;
  context: ErrorContext;
  stackTrace?: string;
  innerError?: Error;
  correlationId?: string;
}

/**
 * Base class for all ML service errors
 */
export abstract class MLServiceError extends Error {
  public readonly metadata: ErrorMetadata;
  public readonly timestamp: Date;
  public readonly correlationId: string;

  constructor(
    message: string,
    metadata: Partial<ErrorMetadata>,
    cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.correlationId = this.generateCorrelationId();
    
    // Set default metadata
    this.metadata = {
      category: ErrorCategory.UNKNOWN_ERROR,
      severity: ErrorSeverity.MEDIUM,
      recoveryAction: ErrorRecoveryAction.RETRY,
      retryable: true,
      fallbackAvailable: false,
      escalationRequired: false,
      userNotificationRequired: false,
      context: {
        organizationId: '',
        serviceName: '',
        operationName: '',
        timestamp: this.timestamp
      },
      ...metadata
    };

    if (cause) {
      this.metadata.innerError = cause;
      this.metadata.stackTrace = cause.stack;
    }

    // Maintain stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get error details for logging
   */
  getLogDetails(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      correlationId: this.correlationId,
      timestamp: this.timestamp.toISOString(),
      category: this.metadata.category,
      severity: this.metadata.severity,
      recoveryAction: this.metadata.recoveryAction,
      organizationId: this.metadata.context.organizationId,
      serviceName: this.metadata.context.serviceName,
      operationName: this.metadata.context.operationName,
      retryable: this.metadata.retryable,
      fallbackAvailable: this.metadata.fallbackAvailable,
      escalationRequired: this.metadata.escalationRequired,
      additionalData: this.metadata.context.additionalData,
      innerError: this.metadata.innerError?.message,
      stack: this.stack
    };
  }

  /**
   * Check if error should trigger circuit breaker
   */
  shouldTriggerCircuitBreaker(): boolean {
    return this.metadata.recoveryAction === ErrorRecoveryAction.CIRCUIT_BREAK ||
           this.metadata.severity === ErrorSeverity.CRITICAL;
  }

  /**
   * Check if error requires user notification
   */
  requiresUserNotification(): boolean {
    return this.metadata.userNotificationRequired ||
           this.metadata.severity === ErrorSeverity.CRITICAL;
  }
}

/**
 * Model-related errors
 */
export class ModelLoadError extends MLServiceError {
  constructor(
    organizationId: string,
    modelPath: string,
    cause?: Error
  ) {
    super(
      `Failed to load ML model for organization ${organizationId}: ${modelPath}`,
      {
        category: ErrorCategory.MODEL_ERROR,
        severity: ErrorSeverity.HIGH,
        recoveryAction: ErrorRecoveryAction.FALLBACK,
        retryable: true,
        fallbackAvailable: true,
        escalationRequired: true,
        userNotificationRequired: false,
        context: {
          organizationId,
          serviceName: 'PredictionService',
          operationName: 'loadModel',
          timestamp: new Date(),
          additionalData: { modelPath }
        }
      },
      cause
    );
  }
}

export class ModelPredictionError extends MLServiceError {
  constructor(
    organizationId: string,
    modelVersion: string,
    featureCount: number,
    cause?: Error
  ) {
    super(
      `Model prediction failed for organization ${organizationId}`,
      {
        category: ErrorCategory.MODEL_ERROR,
        severity: ErrorSeverity.MEDIUM,
        recoveryAction: ErrorRecoveryAction.FALLBACK,
        retryable: true,
        fallbackAvailable: true,
        escalationRequired: false,
        userNotificationRequired: false,
        context: {
          organizationId,
          serviceName: 'PredictionService',
          operationName: 'predict',
          timestamp: new Date(),
          modelVersion,
          featureCount,
          additionalData: { modelVersion, featureCount }
        }
      },
      cause
    );
  }
}

export class ModelValidationError extends MLServiceError {
  constructor(
    organizationId: string,
    validationDetails: string,
    cause?: Error
  ) {
    super(
      `Model validation failed for organization ${organizationId}: ${validationDetails}`,
      {
        category: ErrorCategory.MODEL_ERROR,
        severity: ErrorSeverity.HIGH,
        recoveryAction: ErrorRecoveryAction.MANUAL_INTERVENTION,
        retryable: false,
        fallbackAvailable: true,
        escalationRequired: true,
        userNotificationRequired: true,
        context: {
          organizationId,
          serviceName: 'PredictionService',
          operationName: 'validateModel',
          timestamp: new Date(),
          additionalData: { validationDetails }
        }
      },
      cause
    );
  }
}

/**
 * Data processing errors
 */
export class DataProcessingError extends MLServiceError {
  constructor(
    organizationId: string,
    processingStage: string,
    cause?: Error
  ) {
    super(
      `Data processing failed for organization ${organizationId} at stage: ${processingStage}`,
      {
        category: ErrorCategory.DATA_ERROR,
        severity: ErrorSeverity.MEDIUM,
        recoveryAction: ErrorRecoveryAction.RETRY,
        retryable: true,
        fallbackAvailable: false,
        escalationRequired: false,
        userNotificationRequired: false,
        context: {
          organizationId,
          serviceName: 'DataProcessor',
          operationName: 'processData',
          timestamp: new Date(),
          additionalData: { processingStage }
        }
      },
      cause
    );
  }
}

export class FeatureGenerationError extends MLServiceError {
  constructor(
    organizationId: string,
    featureType: string,
    cause?: Error
  ) {
    super(
      `Feature generation failed for organization ${organizationId}: ${featureType}`,
      {
        category: ErrorCategory.DATA_ERROR,
        severity: ErrorSeverity.MEDIUM,
        recoveryAction: ErrorRecoveryAction.FALLBACK,
        retryable: true,
        fallbackAvailable: true,
        escalationRequired: false,
        userNotificationRequired: false,
        context: {
          organizationId,
          serviceName: 'DataProcessor',
          operationName: 'generateFeatures',
          timestamp: new Date(),
          additionalData: { featureType }
        }
      },
      cause
    );
  }
}

/**
 * Infrastructure errors
 */
export class DatabaseConnectionError extends MLServiceError {
  constructor(
    organizationId: string,
    databaseType: 'app' | 'scada',
    cause?: Error
  ) {
    super(
      `Database connection failed for organization ${organizationId} (${databaseType})`,
      {
        category: ErrorCategory.INFRASTRUCTURE_ERROR,
        severity: ErrorSeverity.HIGH,
        recoveryAction: ErrorRecoveryAction.RETRY,
        retryable: true,
        fallbackAvailable: databaseType === 'scada',
        escalationRequired: true,
        userNotificationRequired: databaseType === 'app',
        context: {
          organizationId,
          serviceName: 'DatabaseService',
          operationName: 'connect',
          timestamp: new Date(),
          additionalData: { databaseType }
        }
      },
      cause
    );
  }
}

export class MemoryExhaustionError extends MLServiceError {
  constructor(
    organizationId: string,
    memoryUsage: number,
    memoryLimit: number,
    cause?: Error
  ) {
    super(
      `Memory exhaustion detected for organization ${organizationId}: ${memoryUsage}MB/${memoryLimit}MB`,
      {
        category: ErrorCategory.RESOURCE_ERROR,
        severity: ErrorSeverity.CRITICAL,
        recoveryAction: ErrorRecoveryAction.CIRCUIT_BREAK,
        retryable: false,
        fallbackAvailable: true,
        escalationRequired: true,
        userNotificationRequired: false,
        context: {
          organizationId,
          serviceName: 'ModelCacheService',
          operationName: 'cacheModel',
          timestamp: new Date(),
          memoryUsage,
          additionalData: { memoryUsage, memoryLimit }
        }
      },
      cause
    );
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends MLServiceError {
  constructor(
    organizationId: string,
    configType: string,
    missingFields: string[],
    cause?: Error
  ) {
    super(
      `Configuration error for organization ${organizationId}: ${configType} missing fields: ${missingFields.join(', ')}`,
      {
        category: ErrorCategory.CONFIGURATION_ERROR,
        severity: ErrorSeverity.HIGH,
        recoveryAction: ErrorRecoveryAction.MANUAL_INTERVENTION,
        retryable: false,
        fallbackAvailable: true,
        escalationRequired: true,
        userNotificationRequired: true,
        context: {
          organizationId,
          serviceName: 'ConfigurationService',
          operationName: 'validateConfig',
          timestamp: new Date(),
          additionalData: { configType, missingFields }
        }
      },
      cause
    );
  }
}

/**
 * Training errors
 */
export class TrainingError extends MLServiceError {
  constructor(
    organizationId: string,
    trainingStage: string,
    cause?: Error
  ) {
    super(
      `Model training failed for organization ${organizationId} at stage: ${trainingStage}`,
      {
        category: ErrorCategory.MODEL_ERROR,
        severity: ErrorSeverity.HIGH,
        recoveryAction: ErrorRecoveryAction.RETRY,
        retryable: true,
        fallbackAvailable: false,
        escalationRequired: true,
        userNotificationRequired: true,
        context: {
          organizationId,
          serviceName: 'TrainingService',
          operationName: 'trainModel',
          timestamp: new Date(),
          additionalData: { trainingStage }
        }
      },
      cause
    );
  }
}

/**
 * Network and timeout errors
 */
export class NetworkTimeoutError extends MLServiceError {
  constructor(
    organizationId: string,
    operation: string,
    timeoutMs: number,
    cause?: Error
  ) {
    super(
      `Network timeout for organization ${organizationId} during ${operation} (${timeoutMs}ms)`,
      {
        category: ErrorCategory.TIMEOUT_ERROR,
        severity: ErrorSeverity.MEDIUM,
        recoveryAction: ErrorRecoveryAction.RETRY,
        retryable: true,
        fallbackAvailable: true,
        escalationRequired: false,
        userNotificationRequired: false,
        context: {
          organizationId,
          serviceName: 'NetworkService',
          operationName: operation,
          timestamp: new Date(),
          additionalData: { timeoutMs }
        }
      },
      cause
    );
  }
}

/**
 * Error classification utility
 */
export class ErrorClassifier {
  /**
   * Classify unknown error into appropriate ML service error
   */
  static classify(
    error: Error,
    organizationId: string,
    serviceName: string,
    operationName: string
  ): MLServiceError {
    const errorMessage = error.message.toLowerCase();
    const context: ErrorContext = {
      organizationId,
      serviceName,
      operationName,
      timestamp: new Date()
    };

    // Model-related errors
    if (errorMessage.includes('model') || errorMessage.includes('onnx')) {
      if (errorMessage.includes('load') || errorMessage.includes('file not found')) {
        return new ModelLoadError(organizationId, 'unknown', error);
      }
      if (errorMessage.includes('predict') || errorMessage.includes('inference')) {
        return new ModelPredictionError(organizationId, 'unknown', 0, error);
      }
      if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
        return new ModelValidationError(organizationId, errorMessage, error);
      }
    }

    // Database errors
    if (errorMessage.includes('connection') || errorMessage.includes('database') || 
        errorMessage.includes('timeout') || errorMessage.includes('pool')) {
      return new DatabaseConnectionError(organizationId, 'app', error);
    }

    // Memory errors
    if (errorMessage.includes('memory') || errorMessage.includes('heap') || 
        errorMessage.includes('out of memory')) {
      return new MemoryExhaustionError(organizationId, 0, 0, error);
    }

    // Configuration errors
    if (errorMessage.includes('config') || errorMessage.includes('missing') || 
        errorMessage.includes('required')) {
      return new ConfigurationError(organizationId, 'unknown', ['unknown'], error);
    }

    // Network/timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('network') || 
        errorMessage.includes('connection refused')) {
      return new NetworkTimeoutError(organizationId, operationName, 0, error);
    }

    // Default to generic ML service error
    return new class extends MLServiceError {
      constructor() {
        super(
          `Unclassified error in ${serviceName}.${operationName}: ${error.message}`,
          {
            category: ErrorCategory.UNKNOWN_ERROR,
            severity: ErrorSeverity.MEDIUM,
            recoveryAction: ErrorRecoveryAction.RETRY,
            retryable: true,
            fallbackAvailable: false,
            escalationRequired: false,
            userNotificationRequired: false,
            context
          },
          error
        );
      }
    }();
  }

  /**
   * Determine if error should trigger circuit breaker
   */
  static shouldTriggerCircuitBreaker(error: Error | MLServiceError): boolean {
    if (error instanceof MLServiceError) {
      return error.shouldTriggerCircuitBreaker();
    }

    // For unknown errors, be conservative
    const errorMessage = error.message.toLowerCase();
    return errorMessage.includes('critical') || 
           errorMessage.includes('fatal') || 
           errorMessage.includes('out of memory');
  }

  /**
   * Determine if error is retryable
   */
  static isRetryable(error: Error | MLServiceError): boolean {
    if (error instanceof MLServiceError) {
      return error.metadata.retryable;
    }

    // For unknown errors, check common patterns
    const errorMessage = error.message.toLowerCase();
    const nonRetryablePatterns = [
      'not found',
      'invalid',
      'unauthorized',
      'forbidden',
      'bad request',
      'validation',
      'configuration'
    ];

    return !nonRetryablePatterns.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * Get recommended recovery action
   */
  static getRecoveryAction(error: Error | MLServiceError): ErrorRecoveryAction {
    if (error instanceof MLServiceError) {
      return error.metadata.recoveryAction;
    }

    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('timeout') || errorMessage.includes('connection')) {
      return ErrorRecoveryAction.RETRY;
    }
    
    if (errorMessage.includes('model') || errorMessage.includes('prediction')) {
      return ErrorRecoveryAction.FALLBACK;
    }
    
    if (errorMessage.includes('memory') || errorMessage.includes('critical')) {
      return ErrorRecoveryAction.CIRCUIT_BREAK;
    }
    
    if (errorMessage.includes('configuration') || errorMessage.includes('invalid')) {
      return ErrorRecoveryAction.MANUAL_INTERVENTION;
    }
    
    return ErrorRecoveryAction.RETRY;
  }
}