import * as ort from 'onnxruntime-node';
import prisma from '../config/db';
import { ProcessedFeatures } from './organizationDataProcessor';
import path from 'path';
import fs from 'fs';
import { SecureModelStorage } from './secureModelStorage';
import { MLAuditService } from './mlAuditService';
import { validateOrganizationBoundary } from '../config/security';
import { modelCacheService } from './modelCacheService';
import { performanceMonitoringService } from './performanceMonitoringService';
import crypto from 'crypto';

const DEBUG = process.env.NODE_ENV === 'development';

// Core interfaces for the prediction service
export interface MLModel {
  organizationId: string;
  modelPath: string;
  version: string;
  features: string[];
  session: ort.InferenceSession;
  metadata: ModelMetadata;
}

export interface ModelMetadata {
  accuracy: number;
  precision: number;
  recall: number;
  auc: number;
  trainingTime: number;
  dataPoints: number;
  createdAt: Date;
  lastUsed: Date;
  usageCount: number;
}

export interface PredictionResult {
  organizationId: string;
  probability: number;
  confidence: number;
  predictedComponent: string;
  timeToFailure: number;
  modelVersion: string;
  timestamp: Date;
  features: Record<string, number>;
  metadata: PredictionMetadata;
}

export interface PredictionMetadata {
  processingTime: number;
  modelLoadTime: number;
  featureCount: number;
  modelHealth: 'healthy' | 'degraded' | 'failed';
  fallbackUsed: boolean;
}

export interface ModelConfig {
  organizationId: string;
  modelPath: string;
  version: string;
  features: string[];
  thresholds: {
    failureProbability: number; // Default 0.85
    confidenceThreshold: number; // Default 0.7
  };
  componentMapping: Record<string, string>; // Map prediction classes to component names
  timeToFailureMinutes: number; // Default prediction window
}

/**
 * Interface for the prediction service
 */
export interface IPredictionService {
  initializeModels(): Promise<void>;
  predict(features: ProcessedFeatures): Promise<PredictionResult>;
  loadModelForOrganization(orgId: string): Promise<MLModel>;
  validateModelHealth(orgId: string): Promise<boolean>;
  unloadModel(orgId: string): void;
  getModelMetrics(orgId: string): Promise<ModelMetadata | null>;
}

/**
 * Organization-aware prediction service with ONNX runtime integration
 */
export class PredictionService implements IPredictionService {
  private modelCache = new Map<string, MLModel>();
  private modelConfigs = new Map<string, ModelConfig>();
  private readonly maxCacheSize = 10; // Maximum models to keep in memory
  private readonly modelBasePath = process.env.ML_MODELS_PATH || path.join(process.cwd(), 'ml', 'models');
  private readonly healthCheckInterval = 5 * 60 * 1000; // 5 minutes
  private healthCheckTimer?: NodeJS.Timeout;

  constructor() {
    // Start health check timer
    this.startHealthCheck();
  }

  /**
   * Initialize models for all active organizations
   */
  async initializeModels(): Promise<void> {
    try {
      if (DEBUG) {
        console.log('🤖 Initializing prediction service...');
      }

      // Ensure models directory exists
      if (!fs.existsSync(this.modelBasePath)) {
        fs.mkdirSync(this.modelBasePath, { recursive: true });
        if (DEBUG) {
          console.log(`📁 Created models directory: ${this.modelBasePath}`);
        }
      }

      // Load model configurations for organizations with prediction enabled
      const organizations = await prisma.organization.findMany({
        where: {
          predictionEnabled: true
        },
        select: {
          id: true,
          mlModelConfig: true,
          modelVersion: true,
          modelAccuracy: true
        }
      });

      if (DEBUG) {
        console.log(`🏢 Found ${organizations.length} organizations with prediction enabled`);
      }

      // Load model configurations
      for (const org of organizations) {
        try {
          await this.loadModelConfig(org.id);
          if (DEBUG) {
            console.log(`✅ Loaded model config for organization ${org.id}`);
          }
        } catch (error) {
          console.error(`❌ Failed to load model config for organization ${org.id}:`, error);
        }
      }

      if (DEBUG) {
        console.log(`🤖 Prediction service initialized with ${this.modelConfigs.size} model configurations`);
      }
    } catch (error) {
      console.error('❌ Error initializing prediction service:', error);
      throw error;
    }
  }

  /**
   * Load model configuration for an organization
   */
  private async loadModelConfig(orgId: string): Promise<void> {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          mlModelConfig: true,
          modelVersion: true,
          modelAccuracy: true
        }
      });

      if (!org) {
        throw new Error(`Organization not found: ${orgId}`);
      }

      // Parse ML model config
      const mlModelConfig = typeof org.mlModelConfig === 'string'
        ? JSON.parse(org.mlModelConfig)
        : org.mlModelConfig;

      if (!mlModelConfig) {
        throw new Error(`No ML model configuration found for organization ${orgId}`);
      }

      // Build model configuration with defaults
      const modelConfig: ModelConfig = {
        organizationId: orgId,
        modelPath: mlModelConfig.modelPath || path.join(this.modelBasePath, orgId, `model_${org.modelVersion || 'v1'}.onnx`),
        version: org.modelVersion || 'v1',
        features: mlModelConfig.features || [],
        thresholds: {
          failureProbability: mlModelConfig.thresholds?.failureProbability || 0.85,
          confidenceThreshold: mlModelConfig.thresholds?.confidenceThreshold || 0.7
        },
        componentMapping: mlModelConfig.componentMapping || {
          '0': 'General Equipment',
          '1': 'Heating System',
          '2': 'Cooling System',
          '3': 'Control System'
        },
        timeToFailureMinutes: mlModelConfig.timeToFailureMinutes || 8 // Default 8 minutes prediction window
      };

      this.modelConfigs.set(orgId, modelConfig);

      if (DEBUG) {
        console.log(`📋 Model config loaded for org ${orgId}:`, {
          version: modelConfig.version,
          features: modelConfig.features.length,
          thresholds: modelConfig.thresholds
        });
      }
    } catch (error) {
      console.error(`Error loading model config for organization ${orgId}:`, error);
      throw error;
    }
  }

  /**
   * Load ONNX model for an organization with security controls
   */
  async loadModelForOrganization(orgId: string, requestingUserId?: string): Promise<MLModel> {
    const auditId = crypto.randomUUID();
    
    try {
      // Log model access attempt
      await MLAuditService.logMLOperation({
        auditId,
        organizationId: orgId,
        userId: requestingUserId || 'system',
        action: 'MODEL_LOAD',
        resource: `model/${orgId}`,
        timestamp: new Date(),
        status: 'STARTED',
      });

      // Check if model is already cached in advanced cache service
      const cachedModel = await modelCacheService.getModel(orgId);
      if (cachedModel) {
        // Update last used timestamp
        cachedModel.metadata.lastUsed = new Date();
        cachedModel.metadata.usageCount++;
        
        await MLAuditService.updateMLOperation(auditId, {
          status: 'COMPLETED',
          responseData: { cached: true, version: cachedModel.version },
          completedAt: new Date(),
        });
        
        return cachedModel;
      }

      // Check legacy cache as fallback
      const legacyCachedModel = this.modelCache.get(orgId);
      if (legacyCachedModel) {
        // Update last used timestamp
        legacyCachedModel.metadata.lastUsed = new Date();
        legacyCachedModel.metadata.usageCount++;
        
        // Add to advanced cache
        await modelCacheService.setModel(orgId, legacyCachedModel);
        
        await MLAuditService.updateMLOperation(auditId, {
          status: 'COMPLETED',
          responseData: { cached: true, version: legacyCachedModel.version },
          completedAt: new Date(),
        });
        
        return legacyCachedModel;
      }

      // Load model configuration if not already loaded
      if (!this.modelConfigs.has(orgId)) {
        await this.loadModelConfig(orgId);
      }

      const modelConfig = this.modelConfigs.get(orgId);
      if (!modelConfig) {
        throw new Error(`No model configuration found for organization ${orgId}`);
      }

      const startTime = Date.now();

      // Use secure model storage to retrieve encrypted model
      let modelBuffer: Buffer;
      try {
        modelBuffer = await SecureModelStorage.retrieveModel(
          orgId, 
          modelConfig.modelPath, 
          requestingUserId || 'system'
        );
      } catch (error) {
        // Fallback to file system for backward compatibility
        if (fs.existsSync(modelConfig.modelPath)) {
          modelBuffer = fs.readFileSync(modelConfig.modelPath);
        } else {
          throw new Error(`Model file not found: ${modelConfig.modelPath}`);
        }
      }

      // Create ONNX session from buffer
      const session = await ort.InferenceSession.create(modelBuffer);
      const loadTime = Date.now() - startTime;

      // Get model metadata from database
      const modelMetrics = await prisma.modelMetrics.findFirst({
        where: {
          organizationId: orgId,
          version: modelConfig.version
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const metadata: ModelMetadata = {
        accuracy: modelMetrics?.accuracy || 0.8,
        precision: modelMetrics?.precision || 0.8,
        recall: modelMetrics?.recall || 0.8,
        auc: modelMetrics?.auc || 0.8,
        trainingTime: modelMetrics?.trainingTime || 0,
        dataPoints: modelMetrics?.dataPoints || 0,
        createdAt: modelMetrics?.createdAt || new Date(),
        lastUsed: new Date(),
        usageCount: 1
      };

      const mlModel: MLModel = {
        organizationId: orgId,
        modelPath: modelConfig.modelPath,
        version: modelConfig.version,
        features: modelConfig.features,
        session,
        metadata
      };

      // Add to advanced cache service
      await modelCacheService.setModel(orgId, mlModel);
      
      // Also add to legacy cache for backward compatibility
      this.addToCache(orgId, mlModel);

      // Log successful model load
      await MLAuditService.updateMLOperation(auditId, {
        status: 'COMPLETED',
        responseData: { 
          version: mlModel.version,
          loadTime,
          features: mlModel.features.length 
        },
        duration: loadTime,
        completedAt: new Date(),
      });

      if (DEBUG) {
        console.log(`🤖 Model loaded for org ${orgId} in ${loadTime}ms`);
        console.log(`📊 Model metadata:`, {
          version: mlModel.version,
          accuracy: metadata.accuracy,
          features: mlModel.features.length
        });
      }

      return mlModel;
    } catch (error) {
      // Log failed model load
      await MLAuditService.updateMLOperation(auditId, {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      });
      
      console.error(`Error loading model for organization ${orgId}:`, error);
      throw error;
    }
  }

  /**
   * Add model to cache with LRU eviction
   */
  private addToCache(orgId: string, model: MLModel): void {
    // If cache is full, remove least recently used model
    if (this.modelCache.size >= this.maxCacheSize) {
      let oldestOrgId = '';
      let oldestTime = Date.now();

      for (const [id, cachedModel] of this.modelCache.entries()) {
        if (cachedModel.metadata.lastUsed.getTime() < oldestTime) {
          oldestTime = cachedModel.metadata.lastUsed.getTime();
          oldestOrgId = id;
        }
      }

      if (oldestOrgId) {
        this.unloadModel(oldestOrgId);
        if (DEBUG) {
          console.log(`🗑️ Evicted model for org ${oldestOrgId} from cache`);
        }
      }
    }

    this.modelCache.set(orgId, model);
  }

  /**
   * Validate model health for an organization
   */
  async validateModelHealth(orgId: string): Promise<boolean> {
    try {
      const model = this.modelCache.get(orgId);
      if (!model) {
        // Try to load the model
        await this.loadModelForOrganization(orgId);
        return true;
      }

      // Check if model session is still valid
      if (!model.session) {
        return false;
      }

      // Perform a simple health check with dummy data
      const dummyFeatures = new Float32Array(model.features.length).fill(0);
      const inputTensor = new ort.Tensor('float32', dummyFeatures, [1, model.features.length]);
      
      try {
        const results = await model.session.run({ input: inputTensor });
        return results && Object.keys(results).length > 0;
      } catch (error) {
        console.error(`Model health check failed for org ${orgId}:`, error);
        return false;
      }
    } catch (error) {
      console.error(`Error validating model health for org ${orgId}:`, error);
      return false;
    }
  }

  /**
   * Make prediction using organization-specific model with security controls
   */
  async predict(features: ProcessedFeatures, requestingUserId?: string): Promise<PredictionResult> {
    const startTime = Date.now();
    const auditId = crypto.randomUUID();
    let modelLoadTime = 0;
    let fallbackUsed = false;
    let modelHealth: 'healthy' | 'degraded' | 'failed' = 'healthy';

    try {
      const orgId = features.organizationId;

      // Log prediction attempt
      await MLAuditService.logMLOperation({
        auditId,
        organizationId: orgId,
        userId: requestingUserId || 'system',
        action: 'PREDICTION',
        resource: `prediction/${orgId}`,
        timestamp: new Date(),
        status: 'STARTED',
        requestData: {
          featureCount: Object.keys(features.features).length,
          timestamp: features.timestamp,
        },
      });

      // Load model for organization
      const modelLoadStart = Date.now();
      const model = await this.loadModelForOrganization(orgId, requestingUserId);
      modelLoadTime = Date.now() - modelLoadStart;

      const modelConfig = this.modelConfigs.get(orgId);
      if (!modelConfig) {
        throw new Error(`No model configuration found for organization ${orgId}`);
      }

      // Prepare input features in the correct order
      const inputFeatures = new Float32Array(model.features.length);
      for (let i = 0; i < model.features.length; i++) {
        const featureName = model.features[i];
        inputFeatures[i] = features.features[featureName] || 0;
      }

      // Create input tensor
      const inputTensor = new ort.Tensor('float32', inputFeatures, [1, model.features.length]);

      // Run prediction
      const results = await model.session.run({ input: inputTensor });
      
      // Extract prediction results (assuming binary classification)
      const outputTensor = results[Object.keys(results)[0]] as ort.Tensor;
      const outputData = outputTensor.data as Float32Array;
      
      // For binary classification, we typically get probabilities for each class
      // If we have 2 outputs, take the second one (probability of failure)
      // If we have 1 output, use it directly
      const failureProbability = outputData.length > 1 ? outputData[1] : outputData[0];
      
      // Calculate confidence (distance from decision boundary)
      const confidence = Math.abs(failureProbability - 0.5) * 2;

      // Determine predicted component (simplified - could be enhanced with multi-class)
      const predictedClass = failureProbability > 0.5 ? '1' : '0';
      const predictedComponent = modelConfig.componentMapping[predictedClass] || 'Unknown Component';

      // Calculate time to failure based on probability and model configuration
      const timeToFailure = Math.max(
        1, 
        Math.round(modelConfig.timeToFailureMinutes * (1 - failureProbability))
      );

      const processingTime = Date.now() - startTime;

      // Record performance metrics
      performanceMonitoringService.recordPredictionLatency(processingTime, orgId);

      const result: PredictionResult = {
        organizationId: orgId,
        probability: failureProbability,
        confidence,
        predictedComponent,
        timeToFailure,
        modelVersion: model.version,
        timestamp: features.timestamp,
        features: features.features,
        metadata: {
          processingTime,
          modelLoadTime,
          featureCount: model.features.length,
          modelHealth,
          fallbackUsed
        }
      };

      if (DEBUG) {
        console.log(`🔮 Prediction completed for org ${orgId}:`, {
          probability: failureProbability.toFixed(3),
          confidence: confidence.toFixed(3),
          component: predictedComponent,
          timeToFailure,
          processingTime
        });
      }

      return result;
    } catch (error) {
      console.error(`Error making prediction for org ${features.organizationId}:`, error);
      
      // Record error for performance monitoring
      performanceMonitoringService.recordError('prediction', features.organizationId);
      
      // Return fallback prediction
      modelHealth = 'failed';
      fallbackUsed = true;
      
      const processingTime = Date.now() - startTime;
      
      return {
        organizationId: features.organizationId,
        probability: 0.0,
        confidence: 0.0,
        predictedComponent: 'Unknown (Fallback)',
        timeToFailure: 10, // Default fallback time
        modelVersion: 'fallback',
        timestamp: features.timestamp,
        features: features.features,
        metadata: {
          processingTime,
          modelLoadTime,
          featureCount: 0,
          modelHealth,
          fallbackUsed
        }
      };
    }
  }

  /**
   * Unload model from cache
   */
  unloadModel(orgId: string): void {
    // Remove from advanced cache service
    modelCacheService.removeModel(orgId);
    
    // Remove from legacy cache
    const model = this.modelCache.get(orgId);
    if (model) {
      // Clean up ONNX session
      if (model.session) {
        try {
          // ONNX sessions don't have a release method in newer versions
          // The session will be garbage collected automatically
        } catch (error) {
          console.warn('Error releasing ONNX session:', error);
        }
      }
      this.modelCache.delete(orgId);
      
      if (DEBUG) {
        console.log(`🗑️ Unloaded model for org ${orgId}`);
      }
    }
  }

  /**
   * Get model metrics for an organization
   */
  async getModelMetrics(orgId: string): Promise<ModelMetadata | null> {
    try {
      // Check if model is in cache
      const cachedModel = this.modelCache.get(orgId);
      if (cachedModel) {
        return cachedModel.metadata;
      }

      // Get from database
      const modelMetrics = await prisma.modelMetrics.findFirst({
        where: {
          organizationId: orgId
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (!modelMetrics) {
        return null;
      }

      return {
        accuracy: modelMetrics.accuracy,
        precision: modelMetrics.precision,
        recall: modelMetrics.recall,
        auc: modelMetrics.auc,
        trainingTime: modelMetrics.trainingTime,
        dataPoints: modelMetrics.dataPoints,
        createdAt: modelMetrics.createdAt,
        lastUsed: new Date(),
        usageCount: 0
      };
    } catch (error) {
      console.error(`Error getting model metrics for org ${orgId}:`, error);
      return null;
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      if (DEBUG) {
        console.log('🏥 Running model health checks...');
      }

      const orgIds = Array.from(this.modelCache.keys());
      for (const orgId of orgIds) {
        try {
          const isHealthy = await this.validateModelHealth(orgId);
          if (!isHealthy) {
            console.warn(`⚠️ Model health check failed for org ${orgId}, unloading model`);
            this.unloadModel(orgId);
          }
        } catch (error) {
          console.error(`Error in health check for org ${orgId}:`, error);
        }
      }
    }, this.healthCheckInterval);
  }

  /**
   * Stop health checks and cleanup
   */
  shutdown(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // Unload all models
    for (const orgId of this.modelCache.keys()) {
      this.unloadModel(orgId);
    }

    if (DEBUG) {
      console.log('🛑 Prediction service shutdown complete');
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; organizations: string[] } {
    return {
      size: this.modelCache.size,
      maxSize: this.maxCacheSize,
      organizations: Array.from(this.modelCache.keys())
    };
  }

  /**
   * Update model configuration for an organization
   */
  async updateModelConfig(orgId: string, config: Partial<ModelConfig>): Promise<void> {
    try {
      const existingConfig = this.modelConfigs.get(orgId);
      if (existingConfig) {
        const updatedConfig = { ...existingConfig, ...config };
        this.modelConfigs.set(orgId, updatedConfig);
        
        // Unload cached model to force reload with new config
        this.unloadModel(orgId);
        
        if (DEBUG) {
          console.log(`🔄 Updated model config for org ${orgId}`);
        }
      }
    } catch (error) {
      console.error(`Error updating model config for org ${orgId}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const predictionService = new PredictionService();

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('🛑 Shutting down prediction service...');
  predictionService.shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down prediction service...');
  predictionService.shutdown();
  process.exit(0);
});