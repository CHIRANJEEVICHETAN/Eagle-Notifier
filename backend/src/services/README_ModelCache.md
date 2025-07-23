# Model Cache Service

The ModelCacheService provides advanced caching capabilities for ML models in the Eagle Notifier predictive maintenance system. It extends the basic caching in PredictionService with sophisticated memory management, preloading, and performance optimization features.

## Features

- **Advanced LRU Eviction**: Intelligent cache eviction based on access patterns and memory usage
- **Memory Monitoring**: Real-time memory usage tracking with automatic cleanup
- **Model Preloading**: Proactive loading of models for active organizations
- **Hot Model Swapping**: Zero-downtime model updates
- **Performance Metrics**: Comprehensive cache statistics and hit rate tracking
- **Memory Optimization**: Automatic memory management with configurable thresholds

## Architecture

```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   PredictionService │───▶│  ModelCacheService   │───▶│   Enhanced Cache    │
└─────────────────────┘    └──────────────────────┘    └─────────────────────┘
                                      │                           │
                                      ▼                           ▼
                           ┌──────────────────────┐    ┌─────────────────────┐
                           │  Memory Monitoring   │    │   Model Preloading  │
                           │   (Auto Cleanup)     │    │  (Active Orgs Only) │
                           └──────────────────────┘    └─────────────────────┘
```

## Configuration

### Memory Configuration

```typescript
interface MemoryConfig {
  maxMemoryUsagePercent: number;     // Maximum memory usage (default: 80%)
  cleanupThresholdPercent: number;   // Cleanup trigger threshold (default: 70%)
  monitoringInterval: number;        // Memory check interval (default: 30s)
  preloadActiveOrgs: boolean;        // Enable preloading (default: true)
}
```

### Environment Variables

```bash
# Memory management
MAX_CACHE_SIZE=15
MAX_MEMORY_PERCENT=80
CLEANUP_THRESHOLD_PERCENT=70
MEMORY_MONITOR_INTERVAL=30000

# Preloading
PRELOAD_ACTIVE_ORGS=true
PRELOAD_INTERVAL=600000  # 10 minutes
```

## Usage

### Basic Usage

```typescript
import { modelCacheService } from '../services/modelCacheService';
import { predictionService } from '../services/predictionService';

// Get model from cache
const model = await modelCacheService.getModel('org-123');

if (!model) {
  // Load model if not cached
  const loadedModel = await predictionService.loadModelForOrganization('org-123');
  
  // Cache the model
  await modelCacheService.setModel('org-123', loadedModel);
}
```

### Advanced Integration

```typescript
import { CachedPredictionService } from '../services/integration/modelCacheIntegration';

// Use enhanced prediction service with advanced caching
const cachedService = new CachedPredictionService();

// Initialize with preloading
await cachedService.initializeModels();

// Make predictions with automatic caching
const result = await cachedService.predict(features);

// Get comprehensive statistics
const stats = cachedService.getServiceStatistics();
```

### Hot Model Swapping

```typescript
// Deploy new model without downtime
const newModel = await loadNewModel('org-123', 'v2.0');
await modelCacheService.hotSwapModel('org-123', newModel);

// Model is immediately available for predictions
const result = await predictionService.predict(features);
```

### Memory Management

```typescript
// Force cleanup if memory usage is high
await modelCacheService.performCleanup(60); // Target 60% memory usage

// Get memory statistics
const stats = modelCacheService.getCacheStatistics();
console.log(`Memory usage: ${stats.memoryUsage.percentage.toFixed(1)}%`);

// Clear all cached models
modelCacheService.clearAll();
```

## Performance Optimization

### Cache Hit Rate Optimization

The service automatically optimizes cache hit rates through:

1. **Intelligent Preloading**: Models for active organizations are preloaded
2. **Access Pattern Learning**: Frequently accessed models are prioritized
3. **Memory-Aware Eviction**: LRU eviction considers both access time and memory pressure

### Memory Usage Optimization

```typescript
// Configure memory thresholds
const cacheService = new ModelCacheService(20, {
  maxMemoryUsagePercent: 75,      // Trigger aggressive cleanup at 75%
  cleanupThresholdPercent: 60,    // Start cleanup at 60%
  monitoringInterval: 15000,      // Check every 15 seconds
  preloadActiveOrgs: true         // Enable smart preloading
});
```

### Performance Monitoring

```typescript
// Get detailed performance metrics
const stats = modelCacheService.getCacheStatistics();

console.log('Cache Performance:', {
  hitRate: `${stats.hitRate.toFixed(1)}%`,
  missRate: `${stats.missRate.toFixed(1)}%`,
  memoryUsage: `${stats.memoryUsage.percentage.toFixed(1)}%`,
  totalModels: stats.totalModels,
  activeModels: stats.activeModels,
  evictionCount: stats.evictionCount
});
```

## Preloading Strategy

### Automatic Preloading

The service automatically preloads models for organizations with recent activity:

```sql
-- Organizations with SCADA data in the last 24 hours
SELECT id FROM organizations 
WHERE predictionEnabled = true 
  AND EXISTS (
    SELECT 1 FROM scadaData 
    WHERE organizationId = organizations.id 
      AND created_timestamp > NOW() - INTERVAL '24 hours'
  )
LIMIT 70% of cache capacity
```

### Manual Preloading

```typescript
// Preload specific organizations
const priorityOrgs = ['org-1', 'org-2', 'org-3'];

for (const orgId of priorityOrgs) {
  try {
    const model = await predictionService.loadModelForOrganization(orgId);
    await modelCacheService.setModel(orgId, model, true); // Mark as preloaded
  } catch (error) {
    console.error(`Failed to preload model for ${orgId}:`, error);
  }
}
```

## Memory Management

### Automatic Memory Monitoring

The service continuously monitors memory usage and performs automatic cleanup:

```typescript
// Memory monitoring runs every 30 seconds by default
setInterval(async () => {
  const memoryUsage = getMemoryUsage();
  
  if (memoryUsage.percentage > maxMemoryUsagePercent) {
    console.warn(`High memory usage: ${memoryUsage.percentage}%`);
    await performCleanup();
  }
}, monitoringInterval);
```

### Manual Memory Management

```typescript
// Check current memory usage
const memoryUsage = modelCacheService.getCacheStatistics().memoryUsage;

if (memoryUsage.percentage > 80) {
  // Perform aggressive cleanup
  await modelCacheService.performCleanup(50); // Target 50% memory usage
}

// Remove specific models to free memory
modelCacheService.removeModel('inactive-org');
```

## Error Handling

### Graceful Degradation

The service handles errors gracefully and falls back to the base prediction service:

```typescript
try {
  // Try advanced cache first
  let model = await modelCacheService.getModel(orgId);
  
  if (!model) {
    // Fallback to base service
    model = await predictionService.loadModelForOrganization(orgId);
    
    // Try to cache for future use
    try {
      await modelCacheService.setModel(orgId, model);
    } catch (cacheError) {
      console.warn('Failed to cache model:', cacheError);
      // Continue without caching
    }
  }
  
  return model;
} catch (error) {
  console.error('Cache service error:', error);
  // Fallback to base service
  return await predictionService.loadModelForOrganization(orgId);
}
```

### Error Recovery

```typescript
// Handle cache corruption
try {
  const model = await modelCacheService.getModel(orgId);
  
  // Validate model health
  if (model && !await validateModelHealth(model)) {
    // Remove corrupted model
    modelCacheService.removeModel(orgId);
    
    // Reload fresh model
    const freshModel = await predictionService.loadModelForOrganization(orgId);
    await modelCacheService.setModel(orgId, freshModel);
  }
} catch (error) {
  console.error('Model validation failed:', error);
  // Clear cache and reload
  modelCacheService.clearAll();
  await modelCacheService.preloadActiveModels();
}
```

## Monitoring and Alerting

### Performance Metrics

```typescript
// Set up performance monitoring
setInterval(() => {
  const stats = modelCacheService.getCacheStatistics();
  
  // Alert on low hit rate
  if (stats.hitRate < 70) {
    console.warn(`Low cache hit rate: ${stats.hitRate.toFixed(1)}%`);
  }
  
  // Alert on high memory usage
  if (stats.memoryUsage.percentage > 85) {
    console.warn(`High memory usage: ${stats.memoryUsage.percentage.toFixed(1)}%`);
  }
  
  // Alert on excessive evictions
  if (stats.evictionCount > 100) {
    console.warn(`High eviction count: ${stats.evictionCount}`);
  }
}, 60000); // Check every minute
```

### Health Checks

```typescript
// Implement health check endpoint
app.get('/health/cache', (req, res) => {
  const stats = modelCacheService.getCacheStatistics();
  
  const health = {
    status: 'healthy',
    cache: {
      hitRate: stats.hitRate,
      memoryUsage: stats.memoryUsage.percentage,
      totalModels: stats.totalModels,
      lastCleanup: stats.lastCleanup
    }
  };
  
  // Determine health status
  if (stats.memoryUsage.percentage > 90) {
    health.status = 'critical';
  } else if (stats.hitRate < 50 || stats.memoryUsage.percentage > 80) {
    health.status = 'warning';
  }
  
  res.json(health);
});
```

## Best Practices

### Cache Sizing

```typescript
// Size cache based on available memory and organization count
const totalMemoryGB = os.totalmem() / (1024 * 1024 * 1024);
const avgModelSizeMB = 100; // Estimate based on your models
const maxCacheSize = Math.floor((totalMemoryGB * 1024 * 0.3) / avgModelSizeMB);

const cacheService = new ModelCacheService(maxCacheSize, {
  maxMemoryUsagePercent: 70, // Conservative for production
  cleanupThresholdPercent: 50,
  preloadActiveOrgs: true
});
```

### Production Configuration

```typescript
// Production-optimized configuration
const productionCacheService = new ModelCacheService(25, {
  maxMemoryUsagePercent: 75,
  cleanupThresholdPercent: 60,
  monitoringInterval: 30000,
  preloadActiveOrgs: true
});

// Set up monitoring
setInterval(async () => {
  const stats = productionCacheService.getCacheStatistics();
  
  // Log metrics for monitoring systems
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    cacheHitRate: stats.hitRate,
    memoryUsage: stats.memoryUsage.percentage,
    totalModels: stats.totalModels,
    evictionCount: stats.evictionCount
  }));
}, 60000);
```

### Testing

```typescript
// Test cache performance
async function testCachePerformance() {
  const testOrgs = ['test-org-1', 'test-org-2', 'test-org-3'];
  const iterations = 100;
  
  console.log('Testing cache performance...');
  
  const startTime = Date.now();
  
  for (let i = 0; i < iterations; i++) {
    const orgId = testOrgs[i % testOrgs.length];
    await modelCacheService.getModel(orgId);
  }
  
  const totalTime = Date.now() - startTime;
  const stats = modelCacheService.getCacheStatistics();
  
  console.log(`Performance Test Results:
    Total time: ${totalTime}ms
    Average per request: ${(totalTime / iterations).toFixed(2)}ms
    Hit rate: ${stats.hitRate.toFixed(1)}%
    Memory usage: ${stats.memoryUsage.percentage.toFixed(1)}%
  `);
}
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   ```typescript
   // Check memory usage
   const stats = modelCacheService.getCacheStatistics();
   if (stats.memoryUsage.percentage > 80) {
     await modelCacheService.performCleanup(50);
   }
   ```

2. **Low Hit Rate**
   ```typescript
   // Enable preloading for better hit rates
   await modelCacheService.preloadActiveModels();
   
   // Check if cache size is too small
   const stats = modelCacheService.getCacheStatistics();
   if (stats.evictionCount > stats.totalModels * 2) {
     console.warn('Consider increasing cache size');
   }
   ```

3. **Memory Leaks**
   ```typescript
   // Ensure proper cleanup on shutdown
   process.on('SIGTERM', () => {
     modelCacheService.shutdown();
   });
   ```

### Debug Mode

```typescript
// Enable debug logging
process.env.NODE_ENV = 'development';

// The service will log detailed information about:
// - Cache hits and misses
// - Memory usage changes
// - Model loading and eviction
// - Cleanup operations
```