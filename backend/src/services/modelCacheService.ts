import { MLModel, ModelMetadata } from './predictionService';
import prisma from '../config/db';
import { Prisma } from '../generated/prisma-client';
import * as os from 'os';

const DEBUG = process.env.NODE_ENV === 'development';

/**
 * Interface for cache statistics
 */
export interface CacheStatistics {
  totalModels: number;
  activeModels: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  hitRate: number;
  missRate: number;
  evictionCount: number;
  organizations: string[];
  lastCleanup: Date;
}

/**
 * Interface for cache entry with metadata
 */
interface CacheEntry {
  model: MLModel;
  lastAccessed: Date;
  accessCount: number;
  memorySize: number;
  preloaded: boolean;
}

/**
 * Interface for memory monitoring configuration
 */
interface MemoryConfig {
  maxMemoryUsagePercent: number; // Maximum memory usage percentage (default: 80%)
  cleanupThresholdPercent: number; // Cleanup threshold (default: 70%)
  monitoringInterval: number; // Memory monitoring interval in ms (default: 30s)
  preloadActiveOrgs: boolean; // Whether to preload models for active organizations
}

/**
 * Advanced model cache service with LRU eviction, memory monitoring, and preloading
 */
export class ModelCacheService {
  private cache = new Map<string, CacheEntry>();
  private readonly maxCacheSize: number;
  private readonly memoryConfig: MemoryConfig;
  private memoryMonitorTimer?: NodeJS.Timeout;
  private preloadTimer?: NodeJS.Timeout;
  
  // Statistics tracking
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    lastCleanup: new Date()
  };

  constructor(
    maxCacheSize: number = 15,
    memoryConfig: Partial<MemoryConfig> = {}
  ) {
    this.maxCacheSize = maxCacheSize;
    this.memoryConfig = {
      maxMemoryUsagePercent: 80,
      cleanupThresholdPercent: 70,
      monitoringInterval: 30000, // 30 seconds
      preloadActiveOrgs: true,
      ...memoryConfig
    };

    this.startMemoryMonitoring();
    this.startPreloadScheduler();
  }

  /**
   * Get model from cache or return null if not found
   */
  async getModel(organizationId: string): Promise<MLModel | null> {
    const entry = this.cache.get(organizationId);
    
    if (entry) {
      // Update access statistics
      entry.lastAccessed = new Date();
      entry.accessCount++;
      this.stats.hits++;
      
      if (DEBUG) {
        console.log(`🎯 Cache HIT for org ${organizationId} (access count: ${entry.accessCount})`);
      }
      
      return entry.model;
    }
    
    this.stats.misses++;
    if (DEBUG) {
      console.log(`❌ Cache MISS for org ${organizationId}`);
    }
    
    return null;
  }

  /**
   * Add model to cache with LRU eviction and memory management
   */
  async setModel(organizationId: string, model: MLModel, preloaded: boolean = false): Promise<void> {
    try {
      // Estimate memory size (rough approximation)
      const memorySize = this.estimateModelMemorySize(model);
      
      // Check if we need to make space
      await this.ensureMemoryAvailable(memorySize);
      
      // Create cache entry
      const entry: CacheEntry = {
        model,
        lastAccessed: new Date(),
        accessCount: preloaded ? 0 : 1,
        memorySize,
        preloaded
      };
      
      // Add to cache
      this.cache.set(organizationId, entry);
      
      if (DEBUG) {
        console.log(`💾 Cached model for org ${organizationId} (size: ${(memorySize / 1024 / 1024).toFixed(1)}MB, preloaded: ${preloaded})`);
      }
      
      // Update model metadata in database
      await this.updateModelMetrics(organizationId, model.metadata);
      
    } catch (error) {
      console.error(`Error caching model for org ${organizationId}:`, error);
      throw error;
    }
  }

  /**
   * Remove model from cache
   */
  removeModel(organizationId: string): boolean {
    const entry = this.cache.get(organizationId);
    if (entry) {
      // Clean up ONNX session
      if (entry.model.session) {
        // ONNX sessions don't have a release method in newer versions
        // The session will be garbage collected automatically
      }
      
      this.cache.delete(organizationId);
      
      if (DEBUG) {
        console.log(`🗑️ Removed model for org ${organizationId} from cache`);
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Preload models for active organizations
   */
  async preloadActiveModels(): Promise<void> {
    try {
      if (!this.memoryConfig.preloadActiveOrgs) {
        return;
      }

      if (DEBUG) {
        console.log('🔄 Starting model preloading for active organizations...');
      }

      // Get active organizations (those with prediction enabled and recent SCADA activity)
      const activeOrgs = await this.getActiveOrganizationsWithScadaData();
      
      if (DEBUG) {
        console.log(`🔍 Found ${activeOrgs.length} active organizations for preloading`);
      }

      let preloadedCount = 0;
      for (const org of activeOrgs) {
        try {
          // Skip if already cached
          if (this.cache.has(org.id)) {
            continue;
          }

          // Check memory before preloading
          const memoryUsage = this.getMemoryUsage();
          if (memoryUsage.percentage > this.memoryConfig.cleanupThresholdPercent) {
            if (DEBUG) {
              console.log(`⚠️ Skipping preload due to memory usage: ${memoryUsage.percentage.toFixed(1)}%`);
            }
            break;
          }

          // Load model using the prediction service
          const { predictionService } = await import('./predictionService');
          const model = await predictionService.loadModelForOrganization(org.id);
          
          // Add to our cache as preloaded
          await this.setModel(org.id, model, true);
          preloadedCount++;
          
        } catch (error) {
          console.error(`Error preloading model for org ${org.id}:`, error);
        }
      }

      if (DEBUG) {
        console.log(`✅ Preloaded ${preloadedCount} models for active organizations`);
      }

    } catch (error) {
      console.error('Error in model preloading:', error);
    }
  }

  /**
   * Perform hot model swap (replace model without downtime)
   */
  async hotSwapModel(organizationId: string, newModel: MLModel): Promise<void> {
    try {
      const oldEntry = this.cache.get(organizationId);
      
      // Create new entry preserving access statistics
      const newEntry: CacheEntry = {
        model: newModel,
        lastAccessed: oldEntry?.lastAccessed || new Date(),
        accessCount: oldEntry?.accessCount || 0,
        memorySize: this.estimateModelMemorySize(newModel),
        preloaded: oldEntry?.preloaded || false
      };
      
      // Atomic swap
      this.cache.set(organizationId, newEntry);
      
      // Clean up old model session
      if (oldEntry?.model.session) {
        // ONNX sessions don't have a release method in newer versions
        // The session will be garbage collected automatically
      }
      
      if (DEBUG) {
        console.log(`🔄 Hot swapped model for org ${organizationId}`);
      }
      
      // Update metrics
      await this.updateModelMetrics(organizationId, newModel.metadata);
      
    } catch (error) {
      console.error(`Error in hot model swap for org ${organizationId}:`, error);
      throw error;
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  getCacheStatistics(): CacheStatistics {
    const memoryUsage = this.getMemoryUsage();
    const totalRequests = this.stats.hits + this.stats.misses;
    
    return {
      totalModels: this.cache.size,
      activeModels: Array.from(this.cache.values()).filter(entry => !entry.preloaded || entry.accessCount > 0).length,
      memoryUsage,
      hitRate: totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0,
      missRate: totalRequests > 0 ? (this.stats.misses / totalRequests) * 100 : 0,
      evictionCount: this.stats.evictions,
      organizations: Array.from(this.cache.keys()),
      lastCleanup: this.stats.lastCleanup
    };
  }

  /**
   * Force cleanup of cache based on memory usage and LRU
   */
  async performCleanup(targetMemoryPercent: number = this.memoryConfig.cleanupThresholdPercent): Promise<void> {
    try {
      if (DEBUG) {
        console.log(`🧹 Starting cache cleanup (target: ${targetMemoryPercent}%)`);
      }

      const memoryUsage = this.getMemoryUsage();
      if (memoryUsage.percentage <= targetMemoryPercent) {
        if (DEBUG) {
          console.log(`✅ Memory usage OK (${memoryUsage.percentage.toFixed(1)}%), no cleanup needed`);
        }
        return;
      }

      // Sort entries by LRU (least recently used first)
      const entries = Array.from(this.cache.entries()).sort((a, b) => {
        const aTime = a[1].lastAccessed.getTime();
        const bTime = b[1].lastAccessed.getTime();
        
        // Prioritize preloaded models with no access for eviction
        if (a[1].preloaded && a[1].accessCount === 0 && (!b[1].preloaded || b[1].accessCount > 0)) {
          return -1;
        }
        if (b[1].preloaded && b[1].accessCount === 0 && (!a[1].preloaded || a[1].accessCount > 0)) {
          return 1;
        }
        
        return aTime - bTime;
      });

      let evictedCount = 0;
      for (const [orgId, entry] of entries) {
        // Check if we've reached target memory usage
        const currentMemory = this.getMemoryUsage();
        if (currentMemory.percentage <= targetMemoryPercent) {
          break;
        }

        // Evict model
        this.removeModel(orgId);
        this.stats.evictions++;
        evictedCount++;

        if (DEBUG) {
          console.log(`🗑️ Evicted model for org ${orgId} (last accessed: ${entry.lastAccessed.toISOString()})`);
        }
      }

      this.stats.lastCleanup = new Date();

      if (DEBUG) {
        const finalMemory = this.getMemoryUsage();
        console.log(`✅ Cleanup completed: evicted ${evictedCount} models, memory usage: ${finalMemory.percentage.toFixed(1)}%`);
      }

    } catch (error) {
      console.error('Error during cache cleanup:', error);
    }
  }

  /**
   * Clear all cached models
   */
  clearAll(): void {
    const entries = Array.from(this.cache.entries());
    for (const [orgId, entry] of entries) {
      if (entry.model.session) {
        // ONNX sessions don't have a release method in newer versions
        // The session will be garbage collected automatically
      }
    }
    
    this.cache.clear();
    this.stats.evictions += entries.length;
    
    if (DEBUG) {
      console.log('🧹 Cleared all cached models');
    }
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    this.memoryMonitorTimer = setInterval(async () => {
      try {
        const memoryUsage = this.getMemoryUsage();
        
        if (DEBUG && memoryUsage.percentage > this.memoryConfig.cleanupThresholdPercent) {
          console.log(`⚠️ High memory usage detected: ${memoryUsage.percentage.toFixed(1)}%`);
        }
        
        // Trigger cleanup if memory usage is too high
        if (memoryUsage.percentage > this.memoryConfig.maxMemoryUsagePercent) {
          console.warn(`🚨 Memory usage critical: ${memoryUsage.percentage.toFixed(1)}%, triggering cleanup`);
          await this.performCleanup();
        }
        
      } catch (error) {
        console.error('Error in memory monitoring:', error);
      }
    }, this.memoryConfig.monitoringInterval);
  }

  /**
   * Start preload scheduler
   */
  private startPreloadScheduler(): void {
    if (!this.memoryConfig.preloadActiveOrgs) {
      return;
    }

    // Run preloading every 10 minutes
    this.preloadTimer = setInterval(async () => {
      try {
        await this.preloadActiveModels();
      } catch (error) {
        console.error('Error in scheduled preloading:', error);
      }
    }, 10 * 60 * 1000); // 10 minutes
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): { used: number; total: number; percentage: number } {
    const memInfo = process.memoryUsage();
    const totalSystemMemory = os.totalmem();
    const usedMemory = memInfo.heapUsed;
    
    return {
      used: usedMemory,
      total: totalSystemMemory,
      percentage: (usedMemory / totalSystemMemory) * 100
    };
  }

  /**
   * Estimate memory size of a model (rough approximation)
   */
  private estimateModelMemorySize(model: MLModel): number {
    // Base size for model metadata and session
    let size = 1024 * 1024; // 1MB base
    
    // Add estimated size based on features
    size += model.features.length * 1024; // 1KB per feature
    
    // Add estimated size based on model complexity (using metadata)
    if (model.metadata.dataPoints) {
      size += Math.min(model.metadata.dataPoints * 10, 50 * 1024 * 1024); // Max 50MB
    }
    
    return size;
  }

  /**
   * Ensure enough memory is available for new model
   */
  private async ensureMemoryAvailable(requiredSize: number): Promise<void> {
    const memoryUsage = this.getMemoryUsage();
    
    // If we're over the cache size limit, perform LRU eviction
    if (this.cache.size >= this.maxCacheSize) {
      await this.evictLRU();
    }
    
    // If memory usage is still too high, perform cleanup
    if (memoryUsage.percentage > this.memoryConfig.cleanupThresholdPercent) {
      await this.performCleanup();
    }
  }

  /**
   * Evict least recently used model
   */
  private async evictLRU(): Promise<void> {
    if (this.cache.size === 0) {
      return;
    }

    let oldestOrgId = '';
    let oldestTime = Date.now();

    // Find least recently used model
    const entries = Array.from(this.cache.entries());
    for (const [orgId, entry] of entries) {
      if (entry.lastAccessed.getTime() < oldestTime) {
        oldestTime = entry.lastAccessed.getTime();
        oldestOrgId = orgId;
      }
    }

    if (oldestOrgId) {
      this.removeModel(oldestOrgId);
      this.stats.evictions++;
      
      if (DEBUG) {
        console.log(`🗑️ LRU evicted model for org ${oldestOrgId}`);
      }
    }
  }

  /**
   * Update model metrics in database
   */
  private async updateModelMetrics(organizationId: string, metadata: ModelMetadata): Promise<void> {
    try {
      // Find existing metrics for this organization and version
      const existingMetrics = await prisma.modelMetrics.findFirst({
        where: {
          organizationId,
          version: metadata.createdAt.toISOString()
        }
      });

      if (existingMetrics) {
        // Update existing metrics (we can't update accuracy, precision etc. as they're training metrics)
        // But we can track usage in a separate way if needed
        if (DEBUG) {
          console.log(`📊 Found existing metrics for org ${organizationId}, version ${metadata.createdAt.toISOString()}`);
        }
      } else {
        // Create new metrics entry
        await prisma.modelMetrics.create({
          data: {
            organizationId,
            version: metadata.createdAt.toISOString(),
            accuracy: metadata.accuracy,
            precision: metadata.precision,
            recall: metadata.recall,
            auc: metadata.auc,
            trainingTime: metadata.trainingTime,
            dataPoints: metadata.dataPoints,
            features: [], // We'll populate this when we have the actual feature list
            createdAt: metadata.createdAt
          }
        });

        if (DEBUG) {
          console.log(`📊 Created new metrics for org ${organizationId}: accuracy=${metadata.accuracy}, usage=${metadata.usageCount}`);
        }
      }
    } catch (error) {
      console.error(`Error updating model metrics for org ${organizationId}:`, error);
    }
  }

  /**
   * Get organizations with recent SCADA activity by checking their individual SCADA databases
   */
  private async getActiveOrganizationsWithScadaData(): Promise<Array<{
    id: string;
    mlModelConfig: any;
    modelVersion: string | null;
    lastTrainingDate: Date | null;
  }>> {
    try {
      // First get all organizations with prediction enabled
      const orgsWithPrediction = await prisma.organization.findMany({
        where: {
          predictionEnabled: true,
          mlModelConfig: {
            not: Prisma.JsonNull
          }
        },
        select: {
          id: true,
          name: true,
          mlModelConfig: true,
          modelVersion: true,
          lastTrainingDate: true,
          scadaDbConfig: true,
          schemaConfig: true
        },
        take: Math.floor(this.maxCacheSize * 0.8) // Check up to 80% of cache capacity
      });

      if (DEBUG) {
        console.log(`🔍 Checking SCADA activity for ${orgsWithPrediction.length} organizations with prediction enabled`);
      }

      const activeOrgs = [];

      // Check each organization's SCADA database for recent activity
      for (const org of orgsWithPrediction) {
        try {
          const hasRecentActivity = await this.checkRecentScadaActivity(org.id, org.scadaDbConfig, org.schemaConfig);
          
          if (hasRecentActivity) {
            activeOrgs.push({
              id: org.id,
              mlModelConfig: org.mlModelConfig,
              modelVersion: org.modelVersion,
              lastTrainingDate: org.lastTrainingDate
            });
            
            if (DEBUG) {
              console.log(`✅ Organization ${org.name || org.id} has recent SCADA activity`);
            }
          } else if (DEBUG) {
            console.log(`⏸️ Organization ${org.name || org.id} has no recent SCADA activity`);
          }
        } catch (error) {
          console.error(`Error checking SCADA activity for org ${org.id}:`, error);
          // If we can't check SCADA activity, fall back to other indicators
          if (org.lastTrainingDate && 
              org.lastTrainingDate > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
            activeOrgs.push({
              id: org.id,
              mlModelConfig: org.mlModelConfig,
              modelVersion: org.modelVersion,
              lastTrainingDate: org.lastTrainingDate
            });
            
            if (DEBUG) {
              console.log(`✅ Organization ${org.name || org.id} added based on recent training (SCADA check failed)`);
            }
          }
        }
      }

      // Sort by priority: recently trained models first
      activeOrgs.sort((a, b) => {
        const aTrainingTime = a.lastTrainingDate?.getTime() || 0;
        const bTrainingTime = b.lastTrainingDate?.getTime() || 0;
        return bTrainingTime - aTrainingTime;
      });

      return activeOrgs.slice(0, Math.floor(this.maxCacheSize * 0.7)); // Return up to 70% of cache capacity
    } catch (error) {
      console.error('Error getting active organizations with SCADA data:', error);
      
      // Fallback: return organizations with recent training or prediction alerts
      return await prisma.organization.findMany({
        where: {
          predictionEnabled: true,
          OR: [
            {
              lastTrainingDate: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
              }
            },
            {
              predictionAlerts: {
                some: {
                  createdAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
                  }
                }
              }
            }
          ]
        },
        select: {
          id: true,
          mlModelConfig: true,
          modelVersion: true,
          lastTrainingDate: true
        },
        orderBy: {
          lastTrainingDate: 'desc'
        },
        take: Math.floor(this.maxCacheSize * 0.7)
      });
    }
  }

  /**
   * Check if an organization has recent SCADA activity
   */
  private async checkRecentScadaActivity(orgId: string, scadaDbConfig: any, schemaConfig: any): Promise<boolean> {
    try {
      // Import SCADA database utilities
      const { getClientWithRetry } = await import('../config/scadaDb');
      
      // Get SCADA database client for this organization
      const client = await getClientWithRetry(orgId);
      
      try {
        // Parse schema config to get table name
        const tableName = scadaDbConfig?.table || 'scada_data';
        
        // Check for recent data (last 24 hours)
        const query = `
          SELECT COUNT(*) as count 
          FROM ${tableName} 
          WHERE created_timestamp > NOW() - INTERVAL '24 hours'
          LIMIT 1
        `;
        
        const result = await client.query(query);
        const count = parseInt(result.rows[0]?.count || '0');
        
        if (DEBUG && count > 0) {
          console.log(`📊 Organization ${orgId} has ${count} recent SCADA records`);
        }
        
        return count > 0;
      } finally {
        client.release();
      }
    } catch (error) {
      if (DEBUG) {
        if (error instanceof Error) {
        console.log(`⚠️ Could not check SCADA activity for org ${orgId}:`, error.message);
        }
        else {
            console.log(`⚠️ Could not check SCADA activity for org ${orgId}:`, error);
        }
      }
      return false; // If we can't check, assume no recent activity
    }
  }

  /**
   * Shutdown the cache service
   */
  shutdown(): void {
    if (this.memoryMonitorTimer) {
      clearInterval(this.memoryMonitorTimer);
    }
    
    if (this.preloadTimer) {
      clearInterval(this.preloadTimer);
    }
    
    this.clearAll();
    
    if (DEBUG) {
      console.log('🛑 Model cache service shutdown complete');
    }
  }
}

// Export singleton instance
export const modelCacheService = new ModelCacheService();

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('🛑 Shutting down model cache service...');
  modelCacheService.shutdown();
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down model cache service...');
  modelCacheService.shutdown();
});