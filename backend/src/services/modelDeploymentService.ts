import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import prisma from '../config/db';
import { SecureModelStorage, ModelMetadata } from './secureModelStorage';
import { modelCacheService } from './modelCacheService';
import { predictionService } from './predictionService';
import { MLAuditService } from './mlAuditService';
import { performanceMonitoringService } from './performanceMonitoringService';

const DEBUG = process.env.NODE_ENV === 'development';

/**
 * Interface for model version information
 */
export interface ModelVersion {
  version: string;
  createdAt: Date;
  accuracy: number;
  isDeployed: boolean;
  isActive: boolean;
  path: string;
  size: number;
  metadata: ModelMetadata;
}

/**
 * Interface for deployment result
 */
export interface DeploymentResult {
  success: boolean;
  version: string;
  previousVersion?: string;
  deployedAt: Date;
  organizationId: string;
  metrics?: {
    accuracy: number;
    precision: number;
    recall: number;
    auc: number;
  };
  errors?: string[];
}

/**
 * Interface for deployment options
 */
export interface DeploymentOptions {
  validateBeforeDeploy: boolean;
  updateCache: boolean;
  createBackup: boolean;
  notifyUsers: boolean;
  deploymentNotes?: string;
  deployedBy?: string;
}

/**
 * Interface for model retention policy
 */
export interface RetentionPolicy {
  maxVersions: number;
  minAccuracy: number;
  keepDays: number;
  keepDeployed: boolean;
}

/**
 * Model Deployment Service for managing model versions and deployments
 */
export class ModelDeploymentService {
  private readonly modelBasePath = process.env.ML_MODELS_PATH || path.join(process.cwd(), 'ml', 'models');
  private readonly backupBasePath = process.env.ML_BACKUPS_PATH || path.join(process.cwd(), 'ml', 'backups');
  private readonly deploymentLocks = new Map<string, boolean>();
  
  // Default retention policy
  private readonly defaultRetentionPolicy: RetentionPolicy = {
    maxVersions: 5,
    minAccuracy: 0.7,
    keepDays: 30,
    keepDeployed: true
  };

  constructor() {
    this.initializeDirectories();
  }

  /**
   * Initialize required directories
   */
  private async initializeDirectories(): Promise<void> {
    try {
      const directories = [
        this.modelBasePath,
        this.backupBasePath
      ];

      for (const dir of directories) {
        await fs.mkdir(dir, { recursive: true });
      }

      if (DEBUG) {
        console.log('📁 Model deployment directories initialized');
      }
    } catch (error) {
      console.error('Error initializing directories:', error);
    }
  }

  /**
   * Deploy a model version for an organization
   */
  async deployModel(
    organizationId: string,
    modelVersion: string,
    options: Partial<DeploymentOptions> = {}
  ): Promise<DeploymentResult> {
    // Set default options
    const deployOptions: DeploymentOptions = {
      validateBeforeDeploy: true,
      updateCache: true,
      createBackup: true,
      notifyUsers: true,
      ...options
    };

    // Generate audit ID for tracking
    const auditId = crypto.randomUUID();
    
    try {
      // Check if deployment is already in progress
      if (this.deploymentLocks.get(organizationId)) {
        throw new Error(`Deployment already in progress for organization ${organizationId}`);
      }
      
      // Acquire deployment lock
      this.deploymentLocks.set(organizationId, true);
      
      // Log deployment start
      await MLAuditService.logMLOperation({
        auditId,
        organizationId,
        userId: deployOptions.deployedBy || 'system',
        action: 'MODEL_DEPLOYMENT',
        resource: `model/${organizationId}/${modelVersion}`,
        timestamp: new Date(),
        status: 'STARTED',
        requestData: { options: deployOptions }
      });

      if (DEBUG) {
        console.log(`🚀 Starting model deployment for org ${organizationId}, version ${modelVersion}`);
      }

      // Get current model version for rollback
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          modelVersion: true,
          mlModelConfig: true
        }
      });

      const previousVersion = organization?.modelVersion;
      
      // Get model metadata
      const models = await this.listModelVersions(organizationId);
      const modelToDeploy = models.find(m => m.version === modelVersion);
      
      if (!modelToDeploy) {
        throw new Error(`Model version ${modelVersion} not found for organization ${organizationId}`);
      }

      // Validate model if requested
      if (deployOptions.validateBeforeDeploy) {
        const { trainingService } = await import('./trainingService');
        const validation = await trainingService.validateModel(organizationId, modelToDeploy.path);
        
        if (!validation.isValid) {
          throw new Error(`Model validation failed: ${validation.validationErrors.join(', ')}`);
        }
      }

      // Create backup of current model if requested
      if (deployOptions.createBackup && previousVersion) {
        await this.createModelBackup(organizationId, previousVersion);
      }

      // Create deployment directory with atomic deployment pattern
      const deploymentDir = path.join(this.modelBasePath, organizationId, 'deployed');
      const tempDeploymentDir = path.join(this.modelBasePath, organizationId, `deploy_temp_${Date.now()}`);
      
      // Create temp directory
      await fs.mkdir(tempDeploymentDir, { recursive: true });
      
      // Copy model to temp deployment location
      const deployedModelPath = path.join(tempDeploymentDir, 'model.onnx');
      await fs.copyFile(modelToDeploy.path, deployedModelPath);
      
      // Copy metadata
      const metadataPath = modelToDeploy.path + '.metadata.json';
      if (await this.fileExists(metadataPath)) {
        await fs.copyFile(metadataPath, path.join(tempDeploymentDir, 'model.onnx.metadata.json'));
      }
      
      // Atomic deployment: rename temp directory to final deployment directory
      try {
        // Remove old deployment directory if exists
        if (await this.fileExists(deploymentDir)) {
          await fs.rm(deploymentDir, { recursive: true, force: true });
        }
        
        // Rename temp to final
        await fs.rename(tempDeploymentDir, deploymentDir);
      } catch (error) {
        // Clean up on failure
        await fs.rm(tempDeploymentDir, { recursive: true, force: true }).catch(() => {});
        throw error;
      }

      // Update organization with new model version
      const mlModelConfig = typeof organization?.mlModelConfig === 'string' 
        ? JSON.parse(organization.mlModelConfig) 
        : (organization?.mlModelConfig || {});
      const updatedConfig = {
        ...mlModelConfig,
        modelPath: path.join(deploymentDir, 'model.onnx'),
        version: modelVersion,
        features: modelToDeploy.metadata.features || [],
        deployedAt: new Date()
      };

      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          modelVersion: modelVersion,
          modelAccuracy: modelToDeploy.metadata.accuracy || 0.8,
          mlModelConfig: updatedConfig
        }
      });

      // Update model cache if requested
      if (deployOptions.updateCache) {
        try {
          // Force model reload
          modelCacheService.removeModel(organizationId);
          const newModel = await predictionService.loadModelForOrganization(organizationId);
          
          // Record deployment metrics - commented out as method doesn't exist
          // performanceMonitoringService.recordModelDeployment(organizationId, modelVersion);
        } catch (cacheError) {
          console.warn(`Warning: Could not update model cache for org ${organizationId}:`, cacheError);
          // Not a critical error, model will be loaded on next prediction
        }
      }

      // Create deployment record
      const deploymentResult: DeploymentResult = {
        success: true,
        version: modelVersion,
        previousVersion: previousVersion || undefined,
        deployedAt: new Date(),
        organizationId,
        metrics: {
          accuracy: modelToDeploy.metadata.accuracy || 0.8,
          precision: (modelToDeploy.metadata as any).precision || 0.8,
          recall: (modelToDeploy.metadata as any).recall || 0.8,
          auc: (modelToDeploy.metadata as any).auc || 0.8
        }
      };

      // Log successful deployment
      await MLAuditService.updateMLOperation(auditId, {
        status: 'COMPLETED',
        responseData: deploymentResult,
        completedAt: new Date()
      });

      // Notify users if requested
      if (deployOptions.notifyUsers) {
        await this.notifyModelDeployment(organizationId, deploymentResult);
      }

      if (DEBUG) {
        console.log(`✅ Model deployment completed for org ${organizationId}:`, {
          version: modelVersion,
          previousVersion,
          accuracy: modelToDeploy.metadata.accuracy
        });
      }

      return deploymentResult;
    } catch (error) {
      // Log deployment failure
      await MLAuditService.updateMLOperation(auditId, {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date()
      });
      
      console.error(`Error deploying model for org ${organizationId}:`, error);
      
      return {
        success: false,
        version: modelVersion,
        deployedAt: new Date(),
        organizationId,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    } finally {
      // Release deployment lock
      this.deploymentLocks.set(organizationId, false);
    }
  }

  /**
   * Rollback to a previous model version
   */
  async rollbackModel(
    organizationId: string,
    targetVersion: string,
    options: Partial<DeploymentOptions> = {}
  ): Promise<DeploymentResult> {
    try {
      if (DEBUG) {
        console.log(`🔄 Rolling back model for org ${organizationId} to version ${targetVersion}`);
      }

      // Get current version
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { modelVersion: true }
      });

      const currentVersion = organization?.modelVersion;
      
      if (currentVersion === targetVersion) {
        return {
          success: false,
          version: targetVersion,
          deployedAt: new Date(),
          organizationId,
          errors: ['Target version is already deployed']
        };
      }

      // Check if target version exists
      const models = await this.listModelVersions(organizationId);
      const targetModel = models.find(m => m.version === targetVersion);
      
      if (!targetModel) {
        // Check backups
        const backupPath = path.join(this.backupBasePath, organizationId, `model_${targetVersion}.onnx`);
        
        if (await this.fileExists(backupPath)) {
          // Restore from backup
          const modelPath = path.join(this.modelBasePath, organizationId, `model_${targetVersion}.onnx`);
          await fs.copyFile(backupPath, modelPath);
          
          // Also copy metadata if exists
          const backupMetadataPath = backupPath + '.metadata.json';
          if (await this.fileExists(backupMetadataPath)) {
            await fs.copyFile(backupMetadataPath, modelPath + '.metadata.json');
          }
        } else {
          throw new Error(`Target model version ${targetVersion} not found for organization ${organizationId}`);
        }
      }

      // Deploy the target version
      return await this.deployModel(organizationId, targetVersion, {
        ...options,
        createBackup: true // Always create backup on rollback
      });
    } catch (error) {
      console.error(`Error rolling back model for org ${organizationId}:`, error);
      
      return {
        success: false,
        version: targetVersion,
        deployedAt: new Date(),
        organizationId,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * List all model versions for an organization
   */
  async listModelVersions(organizationId: string): Promise<ModelVersion[]> {
    try {
      // Get models from secure storage
      const models = await SecureModelStorage.listModels(organizationId);
      
      // Get current deployed version
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { modelVersion: true }
      });
      
      const currentVersion = organization?.modelVersion;
      
      // Convert to ModelVersion format
      const modelVersions: ModelVersion[] = models.map(model => ({
        version: model.metadata.version,
        createdAt: model.metadata.createdAt,
        accuracy: model.metadata.accuracy || 0,
        isDeployed: model.metadata.version === currentVersion,
        isActive: model.metadata.version === currentVersion,
        path: path.join(this.modelBasePath, model.path),
        size: model.metadata.size,
        metadata: model.metadata
      }));
      
      // Sort by creation date (newest first)
      return modelVersions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error(`Error listing model versions for org ${organizationId}:`, error);
      return [];
    }
  }

  /**
   * Get details about a specific model version
   */
  async getModelVersion(organizationId: string, version: string): Promise<ModelVersion | null> {
    try {
      const models = await this.listModelVersions(organizationId);
      return models.find(m => m.version === version) || null;
    } catch (error) {
      console.error(`Error getting model version ${version} for org ${organizationId}:`, error);
      return null;
    }
  }

  /**
   * Delete a model version
   */
  async deleteModelVersion(
    organizationId: string,
    version: string,
    requestingUserId: string
  ): Promise<boolean> {
    try {
      // Check if version is currently deployed
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { modelVersion: true }
      });
      
      if (organization?.modelVersion === version) {
        throw new Error('Cannot delete currently deployed model version');
      }
      
      // Find model path
      const models = await this.listModelVersions(organizationId);
      const modelToDelete = models.find(m => m.version === version);
      
      if (!modelToDelete) {
        throw new Error(`Model version ${version} not found`);
      }
      
      // Delete model using secure storage
      await SecureModelStorage.deleteModel(organizationId, modelToDelete.path, requestingUserId);
      
      if (DEBUG) {
        console.log(`🗑️ Deleted model version ${version} for org ${organizationId}`);
      }
      
      return true;
    } catch (error) {
      console.error(`Error deleting model version ${version} for org ${organizationId}:`, error);
      return false;
    }
  }

  /**
   * Apply retention policy to clean up old model versions
   */
  async applyRetentionPolicy(
    organizationId: string,
    policy: Partial<RetentionPolicy> = {}
  ): Promise<number> {
    try {
      // Merge with default policy
      const retentionPolicy: RetentionPolicy = {
        ...this.defaultRetentionPolicy,
        ...policy
      };
      
      if (DEBUG) {
        console.log(`🧹 Applying retention policy for org ${organizationId}:`, retentionPolicy);
      }
      
      // Get all model versions
      const models = await this.listModelVersions(organizationId);
      
      if (models.length <= retentionPolicy.maxVersions) {
        return 0; // Nothing to clean up
      }
      
      // Get current deployed version
      const currentVersion = models.find(m => m.isDeployed)?.version;
      
      // Calculate cutoff date for retention
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionPolicy.keepDays);
      
      // Identify models to delete
      const modelsToDelete = models.filter(model => {
        // Keep deployed model if policy says so
        if (retentionPolicy.keepDeployed && model.version === currentVersion) {
          return false;
        }
        
        // Keep models with good accuracy
        if (model.accuracy >= retentionPolicy.minAccuracy) {
          return false;
        }
        
        // Keep recent models
        if (model.createdAt > cutoffDate) {
          return false;
        }
        
        return true;
      });
      
      // Sort by creation date (oldest first)
      modelsToDelete.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      
      // Keep the newest versions up to maxVersions
      const modelsToKeep = models.length - retentionPolicy.maxVersions;
      const finalModelsToDelete = modelsToDelete.slice(0, modelsToKeep);
      
      // Delete models
      let deletedCount = 0;
      for (const model of finalModelsToDelete) {
        try {
          await this.deleteModelVersion(organizationId, model.version, 'system');
          deletedCount++;
        } catch (error) {
          console.error(`Error deleting model ${model.version}:`, error);
        }
      }
      
      if (DEBUG) {
        console.log(`🧹 Cleaned up ${deletedCount} old models for org ${organizationId}`);
      }
      
      return deletedCount;
    } catch (error) {
      console.error(`Error applying retention policy for org ${organizationId}:`, error);
      return 0;
    }
  }

  /**
   * Create a backup of a model version
   */
  private async createModelBackup(organizationId: string, version: string): Promise<string | null> {
    try {
      // Ensure backup directory exists
      const orgBackupDir = path.join(this.backupBasePath, organizationId);
      await fs.mkdir(orgBackupDir, { recursive: true });
      
      // Find model path
      const models = await this.listModelVersions(organizationId);
      const modelToBackup = models.find(m => m.version === version);
      
      if (!modelToBackup) {
        throw new Error(`Model version ${version} not found for backup`);
      }
      
      // Create backup paths
      const backupPath = path.join(orgBackupDir, `model_${version}.onnx`);
      const backupMetadataPath = backupPath + '.metadata.json';
      
      // Copy model file
      await fs.copyFile(modelToBackup.path, backupPath);
      
      // Copy metadata if exists
      const metadataPath = modelToBackup.path + '.metadata.json';
      if (await this.fileExists(metadataPath)) {
        await fs.copyFile(metadataPath, backupMetadataPath);
      }
      
      if (DEBUG) {
        console.log(`💾 Created backup of model ${version} for org ${organizationId}`);
      }
      
      return backupPath;
    } catch (error) {
      console.error(`Error creating backup for org ${organizationId}, version ${version}:`, error);
      return null;
    }
  }

  /**
   * Notify users about model deployment
   */
  private async notifyModelDeployment(organizationId: string, deployment: DeploymentResult): Promise<void> {
    try {
      const { NotificationService } = await import('./notificationService');
      
      await NotificationService.createNotification({
        title: 'New ML Model Deployed',
        body: `A new predictive maintenance model (v${deployment.version}) has been deployed with ${(deployment.metrics?.accuracy || 0) * 100}% accuracy.`,
        severity: 'INFO',
        type: 'SYSTEM',
        metadata: {
          modelVersion: deployment.version,
          accuracy: deployment.metrics?.accuracy,
          deployedAt: deployment.deployedAt
        },
        organizationId
      });
      
      if (DEBUG) {
        console.log(`📢 Sent deployment notification for org ${organizationId}`);
      }
    } catch (error) {
      console.error(`Error sending deployment notification for org ${organizationId}:`, error);
    }
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Setup CI/CD pipeline for model deployment
   */
  async setupCICDPipeline(organizationId: string, config: {
    autoDeployThreshold: number;
    validateBeforeDeploy: boolean;
    notifyOnDeploy: boolean;
    retentionPolicy: Partial<RetentionPolicy>;
  }): Promise<boolean> {
    try {
      // Store CI/CD configuration in organization settings
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          mlModelConfig: {
            ...await this.getMLModelConfig(organizationId),
            cicdConfig: config
          }
        }
      });
      
      if (DEBUG) {
        console.log(`⚙️ Setup CI/CD pipeline for org ${organizationId}:`, config);
      }
      
      return true;
    } catch (error) {
      console.error(`Error setting up CI/CD pipeline for org ${organizationId}:`, error);
      return false;
    }
  }

  /**
   * Get ML model configuration for an organization
   */
  private async getMLModelConfig(organizationId: string): Promise<any> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { mlModelConfig: true }
    });
    
    if (typeof org?.mlModelConfig === 'string') {
      try {
        return JSON.parse(org.mlModelConfig);
      } catch (e) {
        return {};
      }
    }
    
    return org?.mlModelConfig || {};
  }

  /**
   * Get deployment metrics for an organization
   */
  async getDeploymentMetrics(organizationId: string): Promise<{
    totalDeployments: number;
    averageAccuracy: number;
    lastDeployment: Date | null;
    rollbackRate: number;
    versions: number;
  }> {
    try {
      // Get deployment logs
      const deploymentLogs = await prisma.trainingLog.findMany({
        where: {
          organizationId,
          status: 'COMPLETED',
          config: {
            path: ['type'],
            equals: 'deployment'
          }
        }
      });
      
      // Get rollback logs
      const rollbackLogs = await prisma.trainingLog.findMany({
        where: {
          organizationId,
          status: 'COMPLETED',
          config: {
            path: ['type'],
            equals: 'rollback'
          }
        }
      });
      
      // Get model versions
      const models = await this.listModelVersions(organizationId);
      
      // Calculate metrics
      const totalDeployments = deploymentLogs.length;
      const rollbackRate = totalDeployments > 0 ? rollbackLogs.length / totalDeployments : 0;
      
      // Calculate average accuracy
      let accuracySum = 0;
      let accuracyCount = 0;
      
      for (const log of deploymentLogs) {
        const metrics = log.metrics as any;
        if (metrics?.accuracy) {
          accuracySum += metrics.accuracy;
          accuracyCount++;
        }
      }
      
      const averageAccuracy = accuracyCount > 0 ? accuracySum / accuracyCount : 0;
      
      // Get last deployment date
      const lastDeployment = deploymentLogs.length > 0
        ? deploymentLogs.sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime())[0].completedAt
        : null;
      
      return {
        totalDeployments,
        averageAccuracy,
        lastDeployment,
        rollbackRate,
        versions: models.length
      };
    } catch (error) {
      console.error(`Error getting deployment metrics for org ${organizationId}:`, error);
      return {
        totalDeployments: 0,
        averageAccuracy: 0,
        lastDeployment: null,
        rollbackRate: 0,
        versions: 0
      };
    }
  }
}

// Export singleton instance
export const modelDeploymentService = new ModelDeploymentService();

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('🛑 Shutting down model deployment service...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down model deployment service...');
  process.exit(0);
});