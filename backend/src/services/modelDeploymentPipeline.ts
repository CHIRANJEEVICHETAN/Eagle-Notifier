import * as fs from 'fs/promises';
import * as path from 'path';
import prisma from '../config/db';
import { modelDeploymentService } from './modelDeploymentService';
import { modelDeploymentMonitoringService } from './modelDeploymentMonitoringService';
import { MLAuditService } from './mlAuditService';
import { NotificationService } from './notificationService';

const DEBUG = process.env.NODE_ENV === 'development';

/**
 * Interface for CI/CD pipeline configuration
 */
export interface CICDPipelineConfig {
  autoDeployThreshold: number;
  validateBeforeDeploy: boolean;
  notifyOnDeploy: boolean;
  retentionPolicy: {
    maxVersions: number;
    minAccuracy: number;
    keepDays: number;
    keepDeployed: boolean;
  };
}

/**
 * Interface for pipeline execution result
 */
export interface PipelineExecutionResult {
  success: boolean;
  organizationId: string;
  modelVersion?: string;
  deployed: boolean;
  stages: {
    validation: boolean;
    deployment: boolean;
    monitoring: boolean;
    cleanup: boolean;
  };
  errors?: string[];
}

/**
 * Model Deployment CI/CD Pipeline
 * Automates the process of validating, deploying, and monitoring ML models
 */
export class ModelDeploymentPipeline {
  private readonly pipelineBasePath = process.env.ML_PIPELINE_PATH || path.join(process.cwd(), 'ml', 'pipeline');
  private readonly activePipelines = new Map<string, boolean>();
  
  // Default CI/CD configuration
  private readonly defaultConfig: CICDPipelineConfig = {
    autoDeployThreshold: 0.8, // 80% accuracy threshold for auto-deployment
    validateBeforeDeploy: true,
    notifyOnDeploy: true,
    retentionPolicy: {
      maxVersions: 5,
      minAccuracy: 0.7,
      keepDays: 30,
      keepDeployed: true
    }
  };

  constructor() {
    this.initializeDirectories();
  }

  /**
   * Initialize required directories
   */
  private async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.pipelineBasePath, { recursive: true });
      
      if (DEBUG) {
        console.log(`📁 Created pipeline directory: ${this.pipelineBasePath}`);
      }
    } catch (error) {
      console.error('Error initializing pipeline directories:', error);
    }
  }

  /**
   * Execute CI/CD pipeline for a new model version
   */
  async executePipeline(
    organizationId: string,
    modelVersion: string,
    config?: Partial<CICDPipelineConfig>
  ): Promise<PipelineExecutionResult> {
    // Check if pipeline is already running for this organization
    if (this.activePipelines.get(organizationId)) {
      return {
        success: false,
        organizationId,
        deployed: false,
        stages: {
          validation: false,
          deployment: false,
          monitoring: false,
          cleanup: false
        },
        errors: ['Pipeline already running for this organization']
      };
    }
    
    // Set pipeline as active
    this.activePipelines.set(organizationId, true);
    
    // Generate audit ID for tracking
    const auditId = require('crypto').randomUUID();
    
    try {
      // Log pipeline start
      await MLAuditService.logMLOperation({
        auditId,
        organizationId,
        userId: 'system',
        action: 'PIPELINE_EXECUTION',
        resource: `pipeline/${organizationId}/${modelVersion}`,
        timestamp: new Date(),
        status: 'STARTED'
      });

      if (DEBUG) {
        console.log(`🚀 Starting deployment pipeline for org ${organizationId}, model ${modelVersion}`);
      }

      // Get pipeline configuration
      const pipelineConfig = await this.getPipelineConfig(organizationId, config);
      
      // Initialize result
      const result: PipelineExecutionResult = {
        success: false,
        organizationId,
        modelVersion,
        deployed: false,
        stages: {
          validation: false,
          deployment: false,
          monitoring: false,
          cleanup: false
        }
      };
      
      // Stage 1: Validation
      if (pipelineConfig.validateBeforeDeploy) {
        try {
          const { trainingService } = await import('./trainingService');
          const model = await modelDeploymentService.getModelVersion(organizationId, modelVersion);
          
          if (!model) {
            throw new Error(`Model version ${modelVersion} not found`);
          }
          
          const validation = await trainingService.validateModel(organizationId, model.path);
          
          if (!validation.isValid) {
            throw new Error(`Model validation failed: ${validation.validationErrors.join(', ')}`);
          }
          
          // Check if model meets auto-deployment threshold
          if (validation.accuracy < pipelineConfig.autoDeployThreshold) {
            throw new Error(`Model accuracy ${validation.accuracy.toFixed(3)} below auto-deployment threshold ${pipelineConfig.autoDeployThreshold}`);
          }
          
          result.stages.validation = true;
          
          if (DEBUG) {
            console.log(`✅ Validation passed for org ${organizationId}, model ${modelVersion}`);
          }
        } catch (error) {
          result.errors = [error instanceof Error ? error.message : 'Unknown validation error'];
          
          // Log validation failure
          await MLAuditService.updateMLOperation(auditId, {
            status: 'FAILED',
            errorMessage: result.errors[0],
            completedAt: new Date()
          });
          
          return result;
        }
      } else {
        result.stages.validation = true;
      }
      
      // Stage 2: Deployment
      try {
        const deploymentResult = await modelDeploymentService.deployModel(organizationId, modelVersion, {
          validateBeforeDeploy: false, // Already validated
          updateCache: true,
          createBackup: true,
          notifyUsers: pipelineConfig.notifyOnDeploy
        });
        
        if (!deploymentResult.success) {
          throw new Error(`Deployment failed: ${deploymentResult.errors?.join(', ')}`);
        }
        
        result.stages.deployment = true;
        result.deployed = true;
        
        if (DEBUG) {
          console.log(`✅ Deployment completed for org ${organizationId}, model ${modelVersion}`);
        }
      } catch (error) {
        result.errors = [error instanceof Error ? error.message : 'Unknown deployment error'];
        
        // Log deployment failure
        await MLAuditService.updateMLOperation(auditId, {
          status: 'FAILED',
          errorMessage: result.errors[0],
          completedAt: new Date()
        });
        
        return result;
      }
      
      // Stage 3: Setup Monitoring
      try {
        // Initialize monitoring for the new model
        await modelDeploymentMonitoringService.monitorDeployedModels();
        result.stages.monitoring = true;
        
        if (DEBUG) {
          console.log(`✅ Monitoring setup for org ${organizationId}, model ${modelVersion}`);
        }
      } catch (error) {
        console.warn(`Warning: Monitoring setup failed for org ${organizationId}:`, error);
        // Non-critical error, continue pipeline
      }
      
      // Stage 4: Cleanup old versions
      try {
        const deletedCount = await modelDeploymentService.applyRetentionPolicy(organizationId, pipelineConfig.retentionPolicy);
        result.stages.cleanup = true;
        
        if (DEBUG) {
          console.log(`✅ Cleanup completed for org ${organizationId}, deleted ${deletedCount} old models`);
        }
      } catch (error) {
        console.warn(`Warning: Cleanup failed for org ${organizationId}:`, error);
        // Non-critical error, continue pipeline
      }
      
      // Pipeline completed successfully
      result.success = true;
      
      // Log successful pipeline execution
      await MLAuditService.updateMLOperation(auditId, {
        status: 'COMPLETED',
        responseData: result,
        completedAt: new Date()
      });
      
      return result;
    } catch (error) {
      // Log pipeline failure
      await MLAuditService.updateMLOperation(auditId, {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date()
      });
      
      console.error(`Error in deployment pipeline for org ${organizationId}:`, error);
      
      return {
        success: false,
        organizationId,
        modelVersion,
        deployed: false,
        stages: {
          validation: false,
          deployment: false,
          monitoring: false,
          cleanup: false
        },
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    } finally {
      // Release pipeline lock
      this.activePipelines.set(organizationId, false);
    }
  }

  /**
   * Get CI/CD pipeline configuration for an organization
   */
  private async getPipelineConfig(
    organizationId: string,
    overrides?: Partial<CICDPipelineConfig>
  ): Promise<CICDPipelineConfig> {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { mlModelConfig: true }
      });
      
      const mlModelConfig = org?.mlModelConfig || {};
      let storedConfig = {};
      
      // Handle mlModelConfig which could be a string or an object
      if (typeof mlModelConfig === 'string') {
        try {
          const parsedConfig = JSON.parse(mlModelConfig);
          storedConfig = parsedConfig.cicdConfig || {};
        } catch (e) {
          storedConfig = {};
        }
      } else if (typeof mlModelConfig === 'object' && mlModelConfig !== null) {
        const jsonConfig = mlModelConfig as any;
        storedConfig = jsonConfig.cicdConfig || {};
      }
      
      // Merge configurations with priority: overrides > stored > default
      return {
        ...this.defaultConfig,
        ...storedConfig,
        ...overrides,
        retentionPolicy: {
          ...this.defaultConfig.retentionPolicy,
          ...(typeof storedConfig === 'object' && storedConfig !== null ? 
            (storedConfig as any).retentionPolicy || {} : {}),
          ...(overrides?.retentionPolicy || {})
        }
      };
    } catch (error) {
      console.error(`Error getting pipeline config for organization ${organizationId}:`, error);
      return {
        ...this.defaultConfig,
        ...overrides,
        retentionPolicy: {
          ...this.defaultConfig.retentionPolicy,
          ...(overrides?.retentionPolicy || {})
        }
      };
    }
  }

  /**
   * Check for new models and automatically deploy if they meet criteria
   */
  async checkAndDeployNewModels(): Promise<void> {
    try {
      if (DEBUG) {
        console.log('🔍 Checking for new models to deploy...');
      }

      // Get organizations with prediction enabled
      const organizations = await prisma.organization.findMany({
        where: {
          predictionEnabled: true
        },
        select: {
          id: true,
          name: true,
          mlModelConfig: true,
          modelVersion: true
        }
      });

      for (const org of organizations) {
        try {
          // Skip if pipeline is already running
          if (this.activePipelines.get(org.id)) {
            continue;
          }
          
          // Get CI/CD config
          const mlModelConfig = org.mlModelConfig || {};
          let cicdConfig: any = {};
          
          if (typeof mlModelConfig === 'string') {
            try {
              const parsedConfig = JSON.parse(mlModelConfig);
              cicdConfig = parsedConfig.cicdConfig || {};
            } catch (e) {
              cicdConfig = {};
            }
          } else if (typeof mlModelConfig === 'object' && mlModelConfig !== null) {
            const jsonConfig = mlModelConfig as any;
            cicdConfig = jsonConfig.cicdConfig || {};
          }
          
          // Skip if auto-deployment is disabled
          if (cicdConfig.autoDeployThreshold === 0) {
            continue;
          }
          
          // Get model versions
          const models = await modelDeploymentService.listModelVersions(org.id);
          
          // Find new models that aren't deployed
          const newModels = models.filter(m => !m.isDeployed && m.accuracy >= (cicdConfig.autoDeployThreshold || this.defaultConfig.autoDeployThreshold));
          
          if (newModels.length === 0) {
            continue;
          }
          
          // Sort by accuracy (highest first)
          newModels.sort((a, b) => b.accuracy - a.accuracy);
          
          // Deploy best model
          const bestModel = newModels[0];
          
          if (DEBUG) {
            console.log(`🚀 Auto-deploying new model ${bestModel.version} for org ${org.id} (accuracy: ${bestModel.accuracy.toFixed(3)})`);
          }
          
          // Execute pipeline
          await this.executePipeline(org.id, bestModel.version);
        } catch (error) {
          console.error(`Error checking new models for organization ${org.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error checking for new models:', error);
    }
  }
}

// Export singleton instance
export const modelDeploymentPipeline = new ModelDeploymentPipeline();

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('🛑 Shutting down model deployment pipeline...');
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down model deployment pipeline...');
});