import { ProcessedFeatures } from './organizationDataProcessor';
import { PredictionResult, predictionService } from './predictionService';
import { EventEmitter } from 'events';

const DEBUG = process.env.NODE_ENV === 'development';

/**
 * Interface for batch prediction request
 */
interface BatchPredictionRequest {
  id: string;
  organizationId: string;
  features: ProcessedFeatures;
  timestamp: Date;
  resolve: (result: PredictionResult) => void;
  reject: (error: Error) => void;
  requestingUserId?: string;
}

/**
 * Interface for batch processing configuration
 */
interface BatchConfig {
  maxBatchSize: number;        // Maximum requests per batch
  maxWaitTime: number;         // Maximum wait time in ms
  maxConcurrentBatches: number; // Maximum concurrent batches
  enableBatching: boolean;     // Enable/disable batching
}

/**
 * Interface for batch statistics
 */
interface BatchStatistics {
  totalRequests: number;
  batchedRequests: number;
  individualRequests: number;
  averageBatchSize: number;
  averageWaitTime: number;
  averageProcessingTime: number;
  batchingEfficiency: number; // Percentage of requests that were batched
  currentQueueSize: number;
  activeBatches: number;
}

/**
 * Batch prediction service for efficient processing of multiple prediction requests
 */
export class BatchPredictionService extends EventEmitter {
  private pendingRequests = new Map<string, BatchPredictionRequest[]>();
  private batchTimers = new Map<string, NodeJS.Timeout>();
  private activeBatches = new Set<string>();
  private config: BatchConfig;
  
  // Statistics tracking
  private stats = {
    totalRequests: 0,
    batchedRequests: 0,
    individualRequests: 0,
    totalBatches: 0,
    totalBatchSize: 0,
    totalWaitTime: 0,
    totalProcessingTime: 0,
    startTime: Date.now()
  };

  constructor(config: Partial<BatchConfig> = {}) {
    super();
    
    this.config = {
      maxBatchSize: 10,
      maxWaitTime: 100, // 100ms
      maxConcurrentBatches: 5,
      enableBatching: true,
      ...config
    };

    if (DEBUG) {
      console.log('🔄 Batch prediction service initialized:', this.config);
    }
  }

  /**
   * Add prediction request to batch queue
   */
  async addPredictionRequest(
    features: ProcessedFeatures, 
    requestingUserId?: string
  ): Promise<PredictionResult> {
    this.stats.totalRequests++;
    
    // If batching is disabled, process immediately
    if (!this.config.enableBatching) {
      this.stats.individualRequests++;
      return await predictionService.predict(features, requestingUserId);
    }

    const orgId = features.organizationId;
    const requestId = `${orgId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise<PredictionResult>((resolve, reject) => {
      const request: BatchPredictionRequest = {
        id: requestId,
        organizationId: orgId,
        features,
        timestamp: new Date(),
        resolve,
        reject,
        requestingUserId
      };

      // Add to pending requests for this organization
      if (!this.pendingRequests.has(orgId)) {
        this.pendingRequests.set(orgId, []);
      }
      
      const orgRequests = this.pendingRequests.get(orgId)!;
      orgRequests.push(request);

      if (DEBUG) {
        console.log(`📥 Added prediction request for org ${orgId} (queue size: ${orgRequests.length})`);
      }

      // Check if we should process the batch immediately
      if (orgRequests.length >= this.config.maxBatchSize) {
        this.processBatchForOrganization(orgId);
      } else if (orgRequests.length === 1) {
        // Start timer for first request in batch
        this.startBatchTimer(orgId);
      }
    });
  }

  /**
   * Start batch timer for an organization
   */
  private startBatchTimer(orgId: string): void {
    // Clear existing timer if any
    const existingTimer = this.batchTimers.get(orgId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.processBatchForOrganization(orgId);
    }, this.config.maxWaitTime);

    this.batchTimers.set(orgId, timer);
  }

  /**
   * Process batch for a specific organization
   */
  private async processBatchForOrganization(orgId: string): Promise<void> {
    // Clear timer
    const timer = this.batchTimers.get(orgId);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(orgId);
    }

    // Get pending requests
    const requests = this.pendingRequests.get(orgId);
    if (!requests || requests.length === 0) {
      return;
    }

    // Clear pending requests
    this.pendingRequests.set(orgId, []);

    // Check concurrent batch limit
    if (this.activeBatches.size >= this.config.maxConcurrentBatches) {
      if (DEBUG) {
        console.log(`⏳ Batch limit reached, queuing ${requests.length} requests for org ${orgId}`);
      }
      
      // Re-queue requests and wait
      const orgRequests = this.pendingRequests.get(orgId) || [];
      orgRequests.unshift(...requests);
      this.pendingRequests.set(orgId, orgRequests);
      
      // Retry after a short delay
      setTimeout(() => {
        this.processBatchForOrganization(orgId);
      }, 50);
      return;
    }

    const batchId = `${orgId}_${Date.now()}`;
    this.activeBatches.add(batchId);

    try {
      await this.processBatch(batchId, requests);
    } finally {
      this.activeBatches.delete(batchId);
    }
  }

  /**
   * Process a batch of prediction requests
   */
  private async processBatch(batchId: string, requests: BatchPredictionRequest[]): Promise<void> {
    const startTime = Date.now();
    const batchSize = requests.length;
    
    if (DEBUG) {
      console.log(`🔄 Processing batch ${batchId} with ${batchSize} requests`);
    }

    // Update statistics
    this.stats.batchedRequests += batchSize;
    this.stats.totalBatches++;
    this.stats.totalBatchSize += batchSize;

    // Calculate average wait time for this batch
    const avgWaitTime = requests.reduce((sum, req) => {
      return sum + (startTime - req.timestamp.getTime());
    }, 0) / batchSize;
    
    this.stats.totalWaitTime += avgWaitTime;

    try {
      // Process requests concurrently within the batch
      const promises = requests.map(async (request) => {
        try {
          const result = await predictionService.predict(request.features, request.requestingUserId);
          request.resolve(result);
          return { success: true, requestId: request.id };
        } catch (error) {
          request.reject(error instanceof Error ? error : new Error('Unknown prediction error'));
          return { success: false, requestId: request.id, error };
        }
      });

      const results = await Promise.allSettled(promises);
      const processingTime = Date.now() - startTime;
      this.stats.totalProcessingTime += processingTime;

      // Log batch results
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = batchSize - successful;

      if (DEBUG) {
        console.log(`✅ Batch ${batchId} completed: ${successful} successful, ${failed} failed, ${processingTime}ms`);
      }

      // Emit batch completion event
      this.emit('batchCompleted', {
        batchId,
        batchSize,
        successful,
        failed,
        processingTime,
        waitTime: avgWaitTime
      });

    } catch (error) {
      console.error(`❌ Error processing batch ${batchId}:`, error);
      
      // Reject all requests in the batch
      requests.forEach(request => {
        request.reject(error instanceof Error ? error : new Error('Batch processing failed'));
      });

      // Emit batch error event
      this.emit('batchError', {
        batchId,
        batchSize,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Flush all pending requests immediately
   */
  async flushPendingRequests(): Promise<void> {
    if (DEBUG) {
      console.log('🚀 Flushing all pending prediction requests...');
    }

    const orgIds = Array.from(this.pendingRequests.keys());
    const flushPromises = orgIds.map(orgId => this.processBatchForOrganization(orgId));
    
    await Promise.allSettled(flushPromises);
    
    if (DEBUG) {
      console.log('✅ All pending requests flushed');
    }
  }

  /**
   * Get batch processing statistics
   */
  getBatchStatistics(): BatchStatistics {
    const currentTime = Date.now();
    const uptime = currentTime - this.stats.startTime;
    
    const averageBatchSize = this.stats.totalBatches > 0 
      ? this.stats.totalBatchSize / this.stats.totalBatches 
      : 0;
    
    const averageWaitTime = this.stats.batchedRequests > 0 
      ? this.stats.totalWaitTime / this.stats.totalBatches 
      : 0;
    
    const averageProcessingTime = this.stats.totalBatches > 0 
      ? this.stats.totalProcessingTime / this.stats.totalBatches 
      : 0;
    
    const batchingEfficiency = this.stats.totalRequests > 0 
      ? (this.stats.batchedRequests / this.stats.totalRequests) * 100 
      : 0;
    
    const currentQueueSize = Array.from(this.pendingRequests.values())
      .reduce((sum, requests) => sum + requests.length, 0);

    return {
      totalRequests: this.stats.totalRequests,
      batchedRequests: this.stats.batchedRequests,
      individualRequests: this.stats.individualRequests,
      averageBatchSize,
      averageWaitTime,
      averageProcessingTime,
      batchingEfficiency,
      currentQueueSize,
      activeBatches: this.activeBatches.size
    };
  }

  /**
   * Update batch configuration
   */
  updateConfig(newConfig: Partial<BatchConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (DEBUG) {
      console.log('🔧 Batch prediction config updated:', this.config);
    }
    
    this.emit('configUpdated', this.config);
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.stats = {
      totalRequests: 0,
      batchedRequests: 0,
      individualRequests: 0,
      totalBatches: 0,
      totalBatchSize: 0,
      totalWaitTime: 0,
      totalProcessingTime: 0,
      startTime: Date.now()
    };
    
    if (DEBUG) {
      console.log('📊 Batch prediction statistics reset');
    }
  }

  /**
   * Shutdown the batch service
   */
  shutdown(): void {
    // Clear all timers
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }
    this.batchTimers.clear();

    // Process any remaining requests
    this.flushPendingRequests().catch(error => {
      console.error('Error flushing pending requests during shutdown:', error);
    });

    if (DEBUG) {
      console.log('🛑 Batch prediction service shutdown complete');
    }
  }
}

// Export singleton instance
export const batchPredictionService = new BatchPredictionService();

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('🛑 Shutting down batch prediction service...');
  batchPredictionService.shutdown();
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down batch prediction service...');
  batchPredictionService.shutdown();
});