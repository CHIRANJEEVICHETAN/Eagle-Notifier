import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { 
  encryptForOrganization, 
  decryptForOrganization, 
  generateSecureModelPath,
  ML_SECURITY_CONFIG 
} from '../config/security';
import { MLAuditService } from './mlAuditService';

export interface ModelMetadata {
  organizationId: string;
  version: string;
  createdAt: Date;
  size: number;
  checksum: string;
  features: string[];
  accuracy?: number;
  encrypted: boolean;
}

export interface SecureModelInfo {
  path: string;
  metadata: ModelMetadata;
  isValid: boolean;
}

/**
 * Secure Model Storage Service with encryption and access controls
 */
export class SecureModelStorage {
  private static readonly MODEL_BASE_PATH = process.env.ML_MODELS_PATH || './ml/models';
  private static readonly METADATA_SUFFIX = '.metadata.json';
  private static readonly CHECKSUM_SUFFIX = '.checksum';

  /**
   * Store model with organization-specific encryption
   */
  static async storeModel(
    organizationId: string,
    modelVersion: string,
    modelBuffer: Buffer,
    metadata: Omit<ModelMetadata, 'organizationId' | 'version' | 'createdAt' | 'size' | 'checksum' | 'encrypted'>
  ): Promise<string> {
    try {
      // Validate model size
      if (modelBuffer.length > ML_SECURITY_CONFIG.VALIDATION.MAX_MODEL_SIZE_MB * 1024 * 1024) {
        throw new Error(`Model size exceeds maximum allowed: ${ML_SECURITY_CONFIG.VALIDATION.MAX_MODEL_SIZE_MB}MB`);
      }

      // Generate secure path
      const modelPath = generateSecureModelPath(organizationId, modelVersion);
      const fullPath = path.join(this.MODEL_BASE_PATH, modelPath);
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      // Calculate checksum
      const checksum = crypto.createHash('sha256').update(modelBuffer).digest('hex');

      // Encrypt model data
      const modelData = modelBuffer.toString('base64');
      const encryptedModel = encryptForOrganization(modelData, organizationId);

      // Create metadata
      const modelMetadata: ModelMetadata = {
        organizationId,
        version: modelVersion,
        createdAt: new Date(),
        size: modelBuffer.length,
        checksum,
        features: metadata.features,
        accuracy: metadata.accuracy,
        encrypted: true,
      };

      // Store encrypted model
      const modelFileData = JSON.stringify({
        encrypted: encryptedModel.encrypted,
        iv: encryptedModel.iv,
        tag: encryptedModel.tag,
      });

      await fs.writeFile(fullPath, modelFileData, 'utf8');

      // Store metadata
      const metadataPath = fullPath + this.METADATA_SUFFIX;
      await fs.writeFile(metadataPath, JSON.stringify(modelMetadata, null, 2), 'utf8');

      // Store checksum separately for integrity verification
      const checksumPath = fullPath + this.CHECKSUM_SUFFIX;
      await fs.writeFile(checksumPath, checksum, 'utf8');

      // Log storage operation
      await MLAuditService.logMLOperation({
        auditId: crypto.randomUUID(),
        organizationId,
        userId: 'system',
        action: 'MODEL_STORE',
        resource: modelPath,
        timestamp: new Date(),
        status: 'COMPLETED',
        requestData: { version: modelVersion, size: modelBuffer.length },
      });

      return modelPath;
    } catch (error) {
      await MLAuditService.logMLOperation({
        auditId: crypto.randomUUID(),
        organizationId,
        userId: 'system',
        action: 'MODEL_STORE',
        resource: `${organizationId}/${modelVersion}`,
        timestamp: new Date(),
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Retrieve and decrypt model for organization
   */
  static async retrieveModel(
    organizationId: string,
    modelPath: string,
    requestingUserId: string
  ): Promise<Buffer> {
    try {
      const fullPath = path.join(this.MODEL_BASE_PATH, modelPath);
      
      // Verify model belongs to organization
      const metadata = await this.getModelMetadata(modelPath);
      if (metadata.organizationId !== organizationId) {
        throw new Error('Access denied: Model does not belong to organization');
      }

      // Read encrypted model data
      const encryptedData = await fs.readFile(fullPath, 'utf8');
      const { encrypted, iv, tag } = JSON.parse(encryptedData);

      // Decrypt model
      const decryptedData = decryptForOrganization(encrypted, iv, tag, organizationId);
      const modelBuffer = Buffer.from(decryptedData, 'base64');

      // Verify integrity
      const checksum = crypto.createHash('sha256').update(modelBuffer).digest('hex');
      if (checksum !== metadata.checksum) {
        throw new Error('Model integrity check failed');
      }

      // Log access
      await MLAuditService.logMLOperation({
        auditId: crypto.randomUUID(),
        organizationId,
        userId: requestingUserId,
        action: 'MODEL_RETRIEVE',
        resource: modelPath,
        timestamp: new Date(),
        status: 'COMPLETED',
      });

      return modelBuffer;
    } catch (error) {
      await MLAuditService.logMLOperation({
        auditId: crypto.randomUUID(),
        organizationId,
        userId: requestingUserId,
        action: 'MODEL_RETRIEVE',
        resource: modelPath,
        timestamp: new Date(),
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get model metadata
   */
  static async getModelMetadata(modelPath: string): Promise<ModelMetadata> {
    const fullPath = path.join(this.MODEL_BASE_PATH, modelPath);
    const metadataPath = fullPath + this.METADATA_SUFFIX;
    
    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      return JSON.parse(metadataContent);
    } catch (error) {
      throw new Error(`Failed to read model metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List models for organization
   */
  static async listModels(organizationId: string): Promise<SecureModelInfo[]> {
    try {
      const orgPath = path.join(this.MODEL_BASE_PATH, organizationId);
      
      try {
        await fs.access(orgPath);
      } catch {
        return []; // Organization has no models
      }

      const models: SecureModelInfo[] = [];
      
      // Recursively find all .onnx files in organization directory
      const findModels = async (dir: string): Promise<void> => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            await findModels(fullPath);
          } else if (entry.name.endsWith('.onnx') && !entry.name.includes(this.METADATA_SUFFIX)) {
            try {
              const relativePath = path.relative(this.MODEL_BASE_PATH, fullPath);
              const metadata = await this.getModelMetadata(relativePath);
              const isValid = await this.validateModelIntegrity(relativePath);
              
              models.push({
                path: relativePath,
                metadata,
                isValid,
              });
            } catch (error) {
              console.warn(`Failed to read model metadata for ${fullPath}:`, error);
            }
          }
        }
      };

      await findModels(orgPath);
      return models.sort((a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime());
    } catch (error) {
      console.error(`Failed to list models for organization ${organizationId}:`, error);
      return [];
    }
  }

  /**
   * Delete model and associated files
   */
  static async deleteModel(
    organizationId: string,
    modelPath: string,
    requestingUserId: string
  ): Promise<void> {
    try {
      // Verify model belongs to organization
      const metadata = await this.getModelMetadata(modelPath);
      if (metadata.organizationId !== organizationId) {
        throw new Error('Access denied: Model does not belong to organization');
      }

      const fullPath = path.join(this.MODEL_BASE_PATH, modelPath);
      
      // Delete model file, metadata, and checksum
      await Promise.all([
        fs.unlink(fullPath).catch(() => {}), // Ignore if file doesn't exist
        fs.unlink(fullPath + this.METADATA_SUFFIX).catch(() => {}),
        fs.unlink(fullPath + this.CHECKSUM_SUFFIX).catch(() => {}),
      ]);

      // Log deletion
      await MLAuditService.logMLOperation({
        auditId: crypto.randomUUID(),
        organizationId,
        userId: requestingUserId,
        action: 'MODEL_DELETE',
        resource: modelPath,
        timestamp: new Date(),
        status: 'COMPLETED',
      });
    } catch (error) {
      await MLAuditService.logMLOperation({
        auditId: crypto.randomUUID(),
        organizationId,
        userId: requestingUserId,
        action: 'MODEL_DELETE',
        resource: modelPath,
        timestamp: new Date(),
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Validate model integrity
   */
  static async validateModelIntegrity(modelPath: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.MODEL_BASE_PATH, modelPath);
      const checksumPath = fullPath + this.CHECKSUM_SUFFIX;
      
      // Read stored checksum
      const storedChecksum = await fs.readFile(checksumPath, 'utf8');
      
      // Read and decrypt model to calculate current checksum
      const metadata = await this.getModelMetadata(modelPath);
      const encryptedData = await fs.readFile(fullPath, 'utf8');
      const { encrypted, iv, tag } = JSON.parse(encryptedData);
      
      const decryptedData = decryptForOrganization(encrypted, iv, tag, metadata.organizationId);
      const modelBuffer = Buffer.from(decryptedData, 'base64');
      const currentChecksum = crypto.createHash('sha256').update(modelBuffer).digest('hex');
      
      return storedChecksum.trim() === currentChecksum;
    } catch (error) {
      console.error(`Failed to validate model integrity for ${modelPath}:`, error);
      return false;
    }
  }

  /**
   * Clean up old model versions
   */
  static async cleanupOldModels(organizationId: string, keepVersions: number = 5): Promise<void> {
    try {
      const models = await this.listModels(organizationId);
      
      if (models.length <= keepVersions) {
        return; // Nothing to clean up
      }

      // Sort by creation date and keep only the newest versions
      const modelsToDelete = models
        .sort((a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime())
        .slice(keepVersions);

      for (const model of modelsToDelete) {
        try {
          await this.deleteModel(organizationId, model.path, 'system');
        } catch (error) {
          console.error(`Failed to delete old model ${model.path}:`, error);
        }
      }

      console.log(`Cleaned up ${modelsToDelete.length} old models for organization ${organizationId}`);
    } catch (error) {
      console.error(`Failed to cleanup old models for organization ${organizationId}:`, error);
    }
  }

  /**
   * Get storage statistics for organization
   */
  static async getStorageStats(organizationId: string): Promise<{
    totalModels: number;
    totalSize: number;
    oldestModel: Date | null;
    newestModel: Date | null;
  }> {
    try {
      const models = await this.listModels(organizationId);
      
      if (models.length === 0) {
        return {
          totalModels: 0,
          totalSize: 0,
          oldestModel: null,
          newestModel: null,
        };
      }

      const totalSize = models.reduce((sum, model) => sum + model.metadata.size, 0);
      const dates = models.map(model => model.metadata.createdAt);
      
      return {
        totalModels: models.length,
        totalSize,
        oldestModel: new Date(Math.min(...dates.map(d => d.getTime()))),
        newestModel: new Date(Math.max(...dates.map(d => d.getTime()))),
      };
    } catch (error) {
      console.error(`Failed to get storage stats for organization ${organizationId}:`, error);
      return {
        totalModels: 0,
        totalSize: 0,
        oldestModel: null,
        newestModel: null,
      };
    }
  }
}