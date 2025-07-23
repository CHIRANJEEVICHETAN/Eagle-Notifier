import express from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware';
import { performanceMonitoringService } from '../services/performanceMonitoringService';
import { batchPredictionService } from '../services/batchPredictionService';
import { modelCacheService } from '../services/modelCacheService';

const router = express.Router();

/**
 * Get current performance metrics
 */
router.get('/metrics', authenticate, async (req, res): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId || undefined;
    const metrics = await performanceMonitoringService.getCurrentMetrics(organizationId);

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get performance metrics'
    });
  }
});

/**
 * Get performance metrics history
 */
router.get('/metrics/history', authenticate, async (req, res): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId || undefined;
    const startTime = req.query.startTime ? new Date(req.query.startTime as string) : undefined;
    const endTime = req.query.endTime ? new Date(req.query.endTime as string) : undefined;

    const history = performanceMonitoringService.getMetricsHistory(organizationId, startTime, endTime);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error getting performance history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get performance history'
    });
  }
});

/**
 * Get performance alerts
 */
router.get('/alerts', authenticate, async (req, res): Promise<void> => {
  try {
    const resolved = req.query.resolved === 'true' ? true : req.query.resolved === 'false' ? false : undefined;
    const alerts = performanceMonitoringService.getPerformanceAlerts(resolved);

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('Error getting performance alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get performance alerts'
    });
  }
});

/**
 * Resolve performance alert
 */
router.post('/alerts/:alertId/resolve', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req, res): Promise<void> => {
  try {
    const { alertId } = req.params;
    const resolved = performanceMonitoringService.resolveAlert(alertId);

    if (resolved) {
      res.json({
        success: true,
        message: 'Alert resolved successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Alert not found or already resolved'
      });
    }
  } catch (error) {
    console.error('Error resolving performance alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve alert'
    });
  }
});

/**
 * Get performance summary for dashboard
 */
router.get('/summary', authenticate, async (req, res): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId || undefined;
    const summary = await performanceMonitoringService.getPerformanceSummary(organizationId);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error getting performance summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get performance summary'
    });
  }
});

/**
 * Update performance thresholds (Admin only)
 */
router.put('/thresholds', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req, res): Promise<void> => {
  try {
    const thresholds = req.body;
    performanceMonitoringService.updateThresholds(thresholds);

    res.json({
      success: true,
      message: 'Performance thresholds updated successfully',
      data: thresholds
    });
  } catch (error) {
    console.error('Error updating performance thresholds:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update performance thresholds'
    });
  }
});

/**
 * Get batch prediction statistics
 */
router.get('/batch/statistics', authenticate, async (req, res): Promise<void> => {
  try {
    const statistics = batchPredictionService.getBatchStatistics();

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Error getting batch statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get batch statistics'
    });
  }
});

/**
 * Update batch configuration (Admin only)
 */
router.put('/batch/config', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req, res): Promise<void> => {
  try {
    const config = req.body;
    batchPredictionService.updateConfig(config);

    res.json({
      success: true,
      message: 'Batch configuration updated successfully',
      data: config
    });
  } catch (error) {
    console.error('Error updating batch configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update batch configuration'
    });
  }
});

/**
 * Get model cache statistics
 */
router.get('/cache/statistics', authenticate, async (req, res): Promise<void> => {
  try {
    const statistics = modelCacheService.getCacheStatistics();

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Error getting cache statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cache statistics'
    });
  }
});

/**
 * Force cache cleanup (Admin only)
 */
router.post('/cache/cleanup', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req, res): Promise<void> => {
  try {
    const targetMemoryPercent = req.body.targetMemoryPercent || 70;
    await modelCacheService.performCleanup(targetMemoryPercent);

    res.json({
      success: true,
      message: 'Cache cleanup completed successfully'
    });
  } catch (error) {
    console.error('Error performing cache cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform cache cleanup'
    });
  }
});

/**
 * Preload active models (Admin only)
 */
router.post('/cache/preload', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req, res): Promise<void> => {
  try {
    await modelCacheService.preloadActiveModels();

    res.json({
      success: true,
      message: 'Model preloading completed successfully'
    });
  } catch (error) {
    console.error('Error preloading models:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to preload models'
    });
  }
});

export default router;