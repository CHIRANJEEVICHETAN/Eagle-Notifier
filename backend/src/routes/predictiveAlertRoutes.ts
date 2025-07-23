import express from 'express';
import { authenticate, authorize, getRequestOrgId } from '../middleware/authMiddleware';
import { 
  mlSecurityHeaders, 
  validateOrgBoundary, 
  validateMLInput, 
  mlAuditLog, 
  completeMLAudit,
  mlRateLimit,
  validateModelAccess,
  threatDetection 
} from '../middleware/mlSecurity';
import { PredictiveAlertController } from '../services/predictiveAlertController';
import { predictionService } from '../services/predictionService';
import { trainingService } from '../services/trainingService';
import { batchPredictionService } from '../services/batchPredictionService';
import prisma from '../config/db';
import { processorManager } from '../services/organizationDataProcessor';

const router = express.Router();

// Apply security middleware to all ML routes
router.use(mlSecurityHeaders);
router.use(threatDetection);
router.use(authenticate);
router.use(validateOrgBoundary);

/**
 * Get batch prediction statistics
 */
router.get('/batch/statistics', authenticate, async (req, res): Promise<void> => {
  try {
    const batchStats = batchPredictionService.getBatchStatistics();

    res.json({
      success: true,
      data: batchStats
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
 * Get predictive alert statistics for organization
 */
router.get('/statistics', authenticate, async (req, res): Promise<void> => {
  try {
    const { organizationId } = req.user as any;
    const hours = parseInt(req.query.hours as string) || 24;

    const statistics = await PredictiveAlertController.getAlertStatistics(organizationId, hours);

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Error getting predictive alert statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get alert statistics'
    });
  }
});

/**
 * Get predictive alerts for organization
 */
router.get('/', authenticate, async (req, res): Promise<void> => {
  try {
    const { organizationId } = req.user as any;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Get predictive alerts from database
    const alerts = await prisma.predictionAlert.findMany({
      where: {
        organizationId: organizationId
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    });

    // Get total count for pagination
    const totalCount = await prisma.predictionAlert.count({
      where: {
        organizationId: organizationId
      }
    });

    res.json({
      success: true,
      data: {
        alerts,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting predictive alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get predictive alerts'
    });
  }
});

/**
 * Provide feedback on predictive alert accuracy
 */
router.post('/:alertId/feedback', authenticate, async (req, res): Promise<void> => {
  try {
    const { organizationId, id: userId } = req.user as any;
    const { alertId } = req.params;
    const { isAccurate } = req.body;

    if (typeof isAccurate !== 'boolean') {
      res.status(400).json({
        success: false,
        message: 'isAccurate must be a boolean value'
      });
      return;
    }

    // Verify alert belongs to user's organization
    const alert = await prisma.predictionAlert.findFirst({
      where: {
        id: alertId,
        organizationId: organizationId
      }
    });

    if (!alert) {
      res.status(404).json({
        success: false,
        message: 'Alert not found or access denied'
      });
      return;
    }

    // Process feedback
    await PredictiveAlertController.processAlertFeedback(
      alertId,
      organizationId,
      isAccurate,
      userId
    );

    res.json({
      success: true,
      message: 'Feedback recorded successfully'
    });
  } catch (error) {
    console.error('Error processing alert feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process feedback'
    });
  }
});

/**
 * Get predictive alert details
 */
router.get('/:alertId', authenticate, async (req, res): Promise<void> => {
  try {
    const { organizationId } = req.user as any;
    const { alertId } = req.params;

    const alert = await prisma.predictionAlert.findFirst({
      where: {
        id: alertId,
        organizationId: organizationId
      }
    });

    if (!alert) {
      res.status(404).json({
        success: false,
        message: 'Alert not found or access denied'
      });
      return;
    }

    res.json({
      success: true,
      data: alert
    });
  } catch (error) {
    console.error('Error getting alert details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get alert details'
    });
  }
});

/**
 * Get predictive alerts by component
 */
router.get('/component/:component', authenticate, async (req, res): Promise<void> => {
  try {
    const { organizationId } = req.user as any;
    const { component } = req.params;
    const hours = parseInt(req.query.hours as string) || 24;
    const since = new Date(Date.now() - (hours * 60 * 60 * 1000));

    const alerts = await prisma.predictionAlert.findMany({
      where: {
        organizationId: organizationId,
        component: component,
        createdAt: {
          gte: since
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('Error getting component alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get component alerts'
    });
  }
});

/**
 * Get predictive alert trends
 */
router.get('/trends/summary', authenticate, async (req, res): Promise<void> => {
  try {
    const { organizationId } = req.user as any;
    const days = parseInt(req.query.days as string) || 7;
    const since = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

    // Get alerts grouped by day
    const alerts = await prisma.predictionAlert.findMany({
      where: {
        organizationId: organizationId,
        createdAt: {
          gte: since
        }
      },
      select: {
        createdAt: true,
        component: true,
        probability: true,
        isAccurate: true
      }
    });

    // Group by day and component
    const trends = alerts.reduce((acc: any, alert) => {
      const day = alert.createdAt.toISOString().split('T')[0];
      if (!acc[day]) {
        acc[day] = {
          date: day,
          totalAlerts: 0,
          components: {},
          averageProbability: 0,
          accuracyRate: 0
        };
      }
      
      acc[day].totalAlerts++;
      
      if (!acc[day].components[alert.component]) {
        acc[day].components[alert.component] = 0;
      }
      acc[day].components[alert.component]++;
      
      return acc;
    }, {});

    // Calculate averages and accuracy rates
    Object.values(trends).forEach((trend: any) => {
      const dayAlerts = alerts.filter(a => 
        a.createdAt.toISOString().split('T')[0] === trend.date
      );
      
      trend.averageProbability = dayAlerts.reduce((sum, a) => sum + a.probability, 0) / dayAlerts.length;
      
      const feedbackAlerts = dayAlerts.filter(a => a.isAccurate !== null);
      if (feedbackAlerts.length > 0) {
        const accurateCount = feedbackAlerts.filter(a => a.isAccurate === true).length;
        trend.accuracyRate = (accurateCount / feedbackAlerts.length) * 100;
      }
    });

    res.json({
      success: true,
      data: Object.values(trends)
    });
  } catch (error) {
    console.error('Error getting alert trends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get alert trends'
    });
  }
});

// ============================================================================
// PREDICTION API ENDPOINTS
// ============================================================================

/**
 * Get real-time prediction for organization's current data
 * POST /api/predictive-alerts/predict
 */
router.post('/predict', 
  mlRateLimit('PREDICTION'),
  validateMLInput,
  mlAuditLog('PREDICTION'),
  async (req, res): Promise<void> => {
  try {
    const organizationId = getRequestOrgId(req);
    const { features, timestamp } = req.body;

    if (!features || typeof features !== 'object') {
      res.status(400).json({
        success: false,
        message: 'Features object is required'
      });
      return;
    }

    // Create processed features object
    const processedFeatures = {
      organizationId,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      features,
      metadata: {
        totalFeatures: Object.keys(features).length,
        lagFeatureCount: 0,
        rollingFeatureCount: 0,
        missingValues: [],
        processingTime: 0
      }
    };

    // Get prediction using batch service for efficiency
    const prediction = await batchPredictionService.addPredictionRequest(processedFeatures, req.user?.id);

    res.json({
      success: true,
      data: prediction
    });
  } catch (error) {
    console.error('Error making prediction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to make prediction',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get prediction service health status
 * GET /api/predictive-alerts/predict/health
 */
router.get('/predict/health', authenticate, async (req, res): Promise<void> => {
  try {
    const organizationId = getRequestOrgId(req);
    
    const isHealthy = await predictionService.validateModelHealth(organizationId);
    const cacheStats = predictionService.getCacheStats();
    const modelMetrics = await predictionService.getModelMetrics(organizationId);

    res.json({
      success: true,
      data: {
        healthy: isHealthy,
        organizationId,
        cacheStats,
        modelMetrics,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error checking prediction health:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check prediction health'
    });
  }
});

// ============================================================================
// MODEL MANAGEMENT ENDPOINTS (SUPER ADMIN ONLY)
// ============================================================================

/**
 * Get all organization models (Super Admin only)
 * GET /api/predictive-alerts/admin/models
 */
router.get('/admin/models', authenticate, authorize(['SUPER_ADMIN']), async (req, res): Promise<void> => {
  try {
    const organizations = await prisma.organization.findMany({
      where: {
        predictionEnabled: true
      },
      select: {
        id: true,
        name: true,
        modelVersion: true,
        modelAccuracy: true,
        lastTrainingDate: true,
        predictionEnabled: true,
        mlModelConfig: true
      }
    });

    // Get latest metrics for each organization
    const modelsWithMetrics = await Promise.all(
      organizations.map(async (org) => {
        const latestMetrics = await prisma.modelMetrics.findFirst({
          where: { organizationId: org.id },
          orderBy: { createdAt: 'desc' }
        });

        const cacheStats = predictionService.getCacheStats();
        const isInCache = cacheStats.organizations.includes(org.id);

        return {
          ...org,
          latestMetrics,
          isInCache,
          cacheStats: isInCache ? cacheStats : null
        };
      })
    );

    res.json({
      success: true,
      data: modelsWithMetrics
    });
  } catch (error) {
    console.error('Error getting organization models:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get organization models'
    });
  }
});

/**
 * Update organization model configuration (Super Admin only)
 * PUT /api/predictive-alerts/admin/models/:orgId
 */
router.put('/admin/models/:orgId', authenticate, authorize(['SUPER_ADMIN']), async (req, res): Promise<void> => {
  try {
    const { orgId } = req.params;
    const { mlModelConfig, predictionEnabled, trainingSchedule } = req.body;

    // Validate organization exists
    const org = await prisma.organization.findUnique({
      where: { id: orgId }
    });

    if (!org) {
      res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
      return;
    }

    // Update organization
    const updatedOrg = await prisma.organization.update({
      where: { id: orgId },
      data: {
        mlModelConfig: mlModelConfig || org.mlModelConfig,
        predictionEnabled: predictionEnabled !== undefined ? predictionEnabled : org.predictionEnabled,
        trainingSchedule: trainingSchedule || org.trainingSchedule
      }
    });

    // If model config changed, update prediction service
    if (mlModelConfig) {
      await predictionService.updateModelConfig(orgId, mlModelConfig);
    }

    res.json({
      success: true,
      data: updatedOrg,
      message: 'Model configuration updated successfully'
    });
  } catch (error) {
    console.error('Error updating model configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update model configuration'
    });
  }
});

/**
 * Force model reload for organization (Super Admin only)
 * POST /api/predictive-alerts/admin/models/:orgId/reload
 */
router.post('/admin/models/:orgId/reload', authenticate, authorize(['SUPER_ADMIN']), async (req, res): Promise<void> => {
  try {
    const { orgId } = req.params;

    // Unload current model
    predictionService.unloadModel(orgId);

    // Load fresh model
    const model = await predictionService.loadModelForOrganization(orgId);

    res.json({
      success: true,
      data: {
        organizationId: orgId,
        modelVersion: model.version,
        features: model.features.length,
        reloadedAt: new Date().toISOString()
      },
      message: 'Model reloaded successfully'
    });
  } catch (error) {
    console.error('Error reloading model:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reload model'
    });
  }
});

// ============================================================================
// TRAINING ENDPOINTS
// ============================================================================

/**
 * Trigger model training for organization
 * POST /api/predictive-alerts/training/trigger
 */
router.post('/training/trigger', 
  authorize(['ADMIN', 'SUPER_ADMIN']),
  mlRateLimit('TRAINING'),
  validateMLInput,
  mlAuditLog('TRAINING_TRIGGER'),
  async (req, res): Promise<void> => {
  try {
    const organizationId = getRequestOrgId(req);
    const {
      dataRange,
      hyperparameters,
      validationSplit = 0.2,
      targetColumn = 'failure_indicator',
      featureColumns,
      modelName,
      description
    } = req.body;

    // Validate required fields
    if (!dataRange || !dataRange.startDate || !dataRange.endDate) {
      res.status(400).json({
        success: false,
        message: 'dataRange with startDate and endDate is required'
      });
      return;
    }

    const trainingConfig = {
      organizationId,
      dataRange: {
        startDate: new Date(dataRange.startDate),
        endDate: new Date(dataRange.endDate)
      },
      hyperparameters: hyperparameters || {
        numLeaves: 31,
        learningRate: 0.05,
        featureFraction: 0.9,
        baggingFraction: 0.8,
        baggingFreq: 5,
        minDataInLeaf: 20,
        maxDepth: -1,
        numIterations: 100,
        objective: 'binary',
        metric: 'binary_logloss',
        verbosity: -1
      },
      validationSplit,
      targetColumn,
      featureColumns: featureColumns || ['temperature', 'pressure', 'flow_rate', 'vibration'],
      modelName: modelName || `manual_${new Date().toISOString().split('T')[0]}`,
      description: description || 'Manual training trigger'
    };

    // Start training (async)
    const trainingResult = await trainingService.trainModel(organizationId, trainingConfig);

    res.json({
      success: true,
      data: trainingResult,
      message: 'Training completed successfully'
    });
  } catch (error) {
    console.error('Error triggering training:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger training',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get training status for organization
 * GET /api/predictive-alerts/training/status
 */
router.get('/training/status', authenticate, async (req, res): Promise<void> => {
  try {
    const organizationId = getRequestOrgId(req);

    // Get latest training logs
    const trainingLogs = await prisma.trainingLog.findMany({
      where: { organizationId },
      orderBy: { startedAt: 'desc' },
      take: 10
    });

    // Get current training status
    const latestLog = trainingLogs[0];
    const isTraining = latestLog && latestLog.status === 'STARTED' && !latestLog.completedAt;

    res.json({
      success: true,
      data: {
        organizationId,
        isTraining,
        latestLog,
        recentLogs: trainingLogs,
        lastTrainingDate: latestLog?.completedAt || null
      }
    });
  } catch (error) {
    console.error('Error getting training status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get training status'
    });
  }
});

/**
 * Get training history for organization
 * GET /api/predictive-alerts/training/history
 */
router.get('/training/history', authenticate, async (req, res): Promise<void> => {
  try {
    const organizationId = getRequestOrgId(req);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const history = await trainingService.getTrainingHistory(organizationId);
    
    // Apply pagination
    const paginatedHistory = history.slice(skip, skip + limit);
    const totalCount = history.length;

    res.json({
      success: true,
      data: {
        history: paginatedHistory,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting training history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get training history'
    });
  }
});

/**
 * Cancel active training for organization
 * POST /api/predictive-alerts/training/cancel
 */
router.post('/training/cancel', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req, res): Promise<void> => {
  try {
    const organizationId = getRequestOrgId(req);

    await trainingService.cancelTraining(organizationId);

    res.json({
      success: true,
      message: 'Training cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling training:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel training'
    });
  }
});

/**
 * Schedule automated training for organization
 * POST /api/predictive-alerts/training/schedule
 */
router.post('/training/schedule', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req, res): Promise<void> => {
  try {
    const organizationId = getRequestOrgId(req);
    const { pattern, timezone = 'UTC', enabled = true } = req.body;

    if (!pattern) {
      res.status(400).json({
        success: false,
        message: 'Cron pattern is required'
      });
      return;
    }

    const schedule = { pattern, timezone, enabled };
    await trainingService.scheduleTraining(organizationId, schedule);

    res.json({
      success: true,
      data: { organizationId, schedule },
      message: 'Training schedule updated successfully'
    });
  } catch (error) {
    console.error('Error scheduling training:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to schedule training'
    });
  }
});

// ============================================================================
// MODEL METRICS AND PERFORMANCE ENDPOINTS
// ============================================================================

/**
 * Get model metrics for organization
 * GET /api/predictive-alerts/metrics
 */
router.get('/metrics', authenticate, async (req, res): Promise<void> => {
  try {
    const organizationId = getRequestOrgId(req);
    const version = req.query.version as string;

    let metrics;
    if (version) {
      // Get specific version metrics
      metrics = await prisma.modelMetrics.findFirst({
        where: { organizationId, version },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      // Get latest metrics
      metrics = await prisma.modelMetrics.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (!metrics) {
      res.status(404).json({
        success: false,
        message: 'No metrics found for organization'
      });
      return;
    }

    // Get runtime metrics from prediction service
    const runtimeMetrics = await predictionService.getModelMetrics(organizationId);

    res.json({
      success: true,
      data: {
        stored: metrics,
        runtime: runtimeMetrics,
        organizationId
      }
    });
  } catch (error) {
    console.error('Error getting model metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get model metrics'
    });
  }
});

/**
 * Get model performance report for organization
 * GET /api/predictive-alerts/metrics/performance
 */
router.get('/metrics/performance', authenticate, async (req, res): Promise<void> => {
  try {
    const organizationId = getRequestOrgId(req);
    const days = parseInt(req.query.days as string) || 30;
    const since = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

    // Get model metrics over time
    const metricsHistory = await prisma.modelMetrics.findMany({
      where: {
        organizationId,
        createdAt: { gte: since }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Get prediction accuracy from feedback
    const feedbackData = await prisma.predictionAlert.findMany({
      where: {
        organizationId,
        createdAt: { gte: since },
        isAccurate: { not: null }
      },
      select: {
        createdAt: true,
        isAccurate: true,
        probability: true,
        modelVersion: true
      }
    });

    // Calculate accuracy by model version
    const accuracyByVersion = feedbackData.reduce((acc: any, alert) => {
      const version = alert.modelVersion;
      if (!acc[version]) {
        acc[version] = { total: 0, accurate: 0 };
      }
      acc[version].total++;
      if (alert.isAccurate) {
        acc[version].accurate++;
      }
      return acc;
    }, {});

    // Calculate overall performance metrics
    const totalFeedback = feedbackData.length;
    const accuratePredictions = feedbackData.filter(f => f.isAccurate).length;
    const overallAccuracy = totalFeedback > 0 ? (accuratePredictions / totalFeedback) * 100 : 0;

    const performanceReport = {
      organizationId,
      period: { days, since },
      overallAccuracy,
      totalPredictions: totalFeedback,
      accuratePredictions,
      metricsHistory,
      accuracyByVersion: Object.entries(accuracyByVersion).map(([version, stats]: [string, any]) => ({
        version,
        accuracy: (stats.accurate / stats.total) * 100,
        total: stats.total,
        accurate: stats.accurate
      })),
      trends: {
        improving: metricsHistory.length > 1 && 
                  metricsHistory[metricsHistory.length - 1].accuracy > metricsHistory[0].accuracy,
        latestAccuracy: metricsHistory[metricsHistory.length - 1]?.accuracy || 0
      }
    };

    res.json({
      success: true,
      data: performanceReport
    });
  } catch (error) {
    console.error('Error getting performance report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get performance report'
    });
  }
});

/**
 * Get model versions for organization
 * GET /api/predictive-alerts/metrics/versions
 */
router.get('/metrics/versions', authenticate, async (req, res): Promise<void> => {
  try {
    const organizationId = getRequestOrgId(req);

    const versions = await prisma.modelMetrics.findMany({
      where: { organizationId },
      select: {
        version: true,
        accuracy: true,
        precision: true,
        recall: true,
        auc: true,
        createdAt: true,
        trainingTime: true,
        dataPoints: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get current active version
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { modelVersion: true }
    });

    res.json({
      success: true,
      data: {
        versions,
        currentVersion: org?.modelVersion,
        organizationId
      }
    });
  } catch (error) {
    console.error('Error getting model versions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get model versions'
    });
  }
});

/**
 * Rollback to previous model version (Admin/Super Admin only)
 * POST /api/predictive-alerts/metrics/rollback
 */
router.post('/metrics/rollback', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req, res): Promise<void> => {
  try {
    const organizationId = getRequestOrgId(req);
    const { targetVersion } = req.body;

    if (!targetVersion) {
      res.status(400).json({
        success: false,
        message: 'Target version is required'
      });
      return;
    }

    await trainingService.rollbackModel(organizationId, targetVersion);

    res.json({
      success: true,
      data: { organizationId, targetVersion },
      message: 'Model rollback completed successfully'
    });
  } catch (error) {
    console.error('Error rolling back model:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to rollback model',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// BATCH PREDICTION ENDPOINTS
// ============================================================================

/**
 * Batch prediction endpoint for processing multiple feature sets
 * POST /api/predictive-alerts/predict/batch
 */
router.post('/predict/batch', authenticate, async (req, res): Promise<void> => {
  try {
    const organizationId = getRequestOrgId(req);
    const { predictions } = req.body;

    if (!Array.isArray(predictions) || predictions.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Predictions array is required and must not be empty'
      });
      return;
    }

    if (predictions.length > 100) {
      res.status(400).json({
        success: false,
        message: 'Batch size cannot exceed 100 predictions'
      });
      return;
    }

    // Process each prediction request
    const results = await Promise.all(
      predictions.map(async (predictionRequest: any, index: number) => {
        try {
          const { features, timestamp, metadata } = predictionRequest;

          if (!features || typeof features !== 'object') {
            return {
              index,
              success: false,
              error: 'Features object is required'
            };
          }

          // Create processed features object
          const processedFeatures = {
            organizationId,
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            features,
            metadata: {
              totalFeatures: Object.keys(features).length,
              lagFeatureCount: 0,
              rollingFeatureCount: 0,
              missingValues: [],
              processingTime: 0,
              batchIndex: index,
              ...metadata
            }
          };

          // Get prediction
          const prediction = await predictionService.predict(processedFeatures);

          return {
            index,
            success: true,
            data: prediction
          };
        } catch (error) {
          return {
            index,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    // Calculate batch statistics
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    res.json({
      success: true,
      data: {
        results,
        statistics: {
          total: results.length,
          successful,
          failed,
          successRate: (successful / results.length) * 100
        }
      }
    });
  } catch (error) {
    console.error('Error in batch prediction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process batch predictions',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Process raw SCADA data and return prediction
 * POST /api/predictive-alerts/predict/scada
 */
router.post('/predict/scada', authenticate, async (req, res): Promise<void> => {
  try {
    const organizationId = getRequestOrgId(req);
    const { scadaData, timestamp } = req.body;

    if (!scadaData || typeof scadaData !== 'object') {
      res.status(400).json({
        success: false,
        message: 'SCADA data object is required'
      });
      return;
    }

    // Process raw SCADA data through the data processor
    const processor = await processorManager.getProcessor(organizationId);
    const processedFeatures = await processor.processData(scadaData);

    // Override timestamp if provided
    if (timestamp) {
      processedFeatures.timestamp = new Date(timestamp);
    }

    // Get prediction
    const prediction = await predictionService.predict(processedFeatures);

    res.json({
      success: true,
      data: {
        prediction,
        processedFeatures: {
          featureCount: Object.keys(processedFeatures.features).length,
          processingTime: processedFeatures.metadata.processingTime,
          lagFeatureCount: processedFeatures.metadata.lagFeatureCount,
          rollingFeatureCount: processedFeatures.metadata.rollingFeatureCount
        }
      }
    });
  } catch (error) {
    console.error('Error processing SCADA prediction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process SCADA prediction',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// REAL-TIME STREAMING ENDPOINTS (Server-Sent Events)
// ============================================================================

/**
 * Real-time prediction streaming using Server-Sent Events
 * GET /api/predictive-alerts/stream/predictions
 */
router.get('/stream/predictions', authenticate, async (req, res): Promise<void> => {
  try {
    const organizationId = getRequestOrgId(req);
    const interval = parseInt(req.query.interval as string) || 5000; // Default 5 seconds

    // Validate interval bounds
    if (interval < 1000 || interval > 60000) {
      res.status(400).json({
        success: false,
        message: 'Interval must be between 1000ms and 60000ms'
      });
      return;
    }

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection event
    res.write(`data: ${JSON.stringify({
      type: 'connected',
      organizationId,
      timestamp: new Date().toISOString(),
      interval
    })}\n\n`);

    let streamActive = true;
    let streamInterval: NodeJS.Timeout;

    // Function to send prediction updates
    const sendPredictionUpdate = async () => {
      try {
        if (!streamActive) return;

        // Get latest SCADA data for the organization
        const processor = await processorManager.getProcessor(organizationId);
        
        // Get the latest processed data (this would typically come from real-time SCADA feed)
        // For now, we'll simulate by getting recent data
        const latestData = await processor.getLatestProcessedData();
        
        if (latestData) {
          // Get prediction
          const prediction = await predictionService.predict(latestData);
          
          // Send prediction event
          res.write(`data: ${JSON.stringify({
            type: 'prediction',
            organizationId,
            timestamp: new Date().toISOString(),
            data: prediction
          })}\n\n`);
        }

        // Send heartbeat to keep connection alive
        res.write(`data: ${JSON.stringify({
          type: 'heartbeat',
          timestamp: new Date().toISOString()
        })}\n\n`);

      } catch (error) {
        console.error('Error in prediction stream:', error);
        res.write(`data: ${JSON.stringify({
          type: 'error',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        })}\n\n`);
      }
    };

    // Start streaming
    streamInterval = setInterval(sendPredictionUpdate, interval);

    // Handle client disconnect
    req.on('close', () => {
      streamActive = false;
      if (streamInterval) {
        clearInterval(streamInterval);
      }
      console.log(`Prediction stream closed for organization ${organizationId}`);
    });

    req.on('error', (error) => {
      streamActive = false;
      if (streamInterval) {
        clearInterval(streamInterval);
      }
      console.error('Prediction stream error:', error);
    });

  } catch (error) {
    console.error('Error setting up prediction stream:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set up prediction stream',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Real-time alert streaming using Server-Sent Events
 * GET /api/predictive-alerts/stream/alerts
 */
router.get('/stream/alerts', authenticate, async (req, res): Promise<void> => {
  try {
    const organizationId = getRequestOrgId(req);
    const severityFilter = req.query.severity as string;

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection event
    res.write(`data: ${JSON.stringify({
      type: 'connected',
      organizationId,
      timestamp: new Date().toISOString(),
      filters: { severity: severityFilter }
    })}\n\n`);

    let streamActive = true;
    let lastAlertCheck = new Date();

    // Function to check for new alerts
    const checkForNewAlerts = async () => {
      try {
        if (!streamActive) return;

        // Get new predictive alerts since last check
        const newAlerts = await prisma.predictionAlert.findMany({
          where: {
            organizationId,
            createdAt: { gt: lastAlertCheck },
            ...(severityFilter && { 
              probability: severityFilter === 'HIGH' ? { gte: 0.85 } : 
                          severityFilter === 'MEDIUM' ? { gte: 0.7, lt: 0.85 } :
                          { lt: 0.7 }
            })
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        });

        // Send new alerts
        for (const alert of newAlerts) {
          res.write(`data: ${JSON.stringify({
            type: 'alert',
            organizationId,
            timestamp: new Date().toISOString(),
            data: alert
          })}\n\n`);
        }

        lastAlertCheck = new Date();

        // Send heartbeat every 30 seconds
        if (Date.now() % 30000 < 5000) {
          res.write(`data: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString()
          })}\n\n`);
        }

      } catch (error) {
        console.error('Error checking for new alerts:', error);
        res.write(`data: ${JSON.stringify({
          type: 'error',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        })}\n\n`);
      }
    };

    // Check for alerts every 5 seconds
    const alertInterval = setInterval(checkForNewAlerts, 5000);

    // Handle client disconnect
    req.on('close', () => {
      streamActive = false;
      if (alertInterval) {
        clearInterval(alertInterval);
      }
      console.log(`Alert stream closed for organization ${organizationId}`);
    });

    req.on('error', (error) => {
      streamActive = false;
      if (alertInterval) {
        clearInterval(alertInterval);
      }
      console.error('Alert stream error:', error);
    });

  } catch (error) {
    console.error('Error setting up alert stream:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set up alert stream',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// ENHANCED MODEL MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * Get detailed model information for organization
 * GET /api/predictive-alerts/models/info
 */
router.get('/models/info', authenticate, async (req, res): Promise<void> => {
  try {
    const organizationId = getRequestOrgId(req);

    // Get organization model configuration
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        modelVersion: true,
        modelAccuracy: true,
        lastTrainingDate: true,
        predictionEnabled: true,
        mlModelConfig: true,
        trainingSchedule: true
      }
    });

    if (!org) {
      res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
      return;
    }

    // Get model metrics
    const modelMetrics = await prisma.modelMetrics.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' }
    });

    // Get cache status
    const cacheStats = predictionService.getCacheStats();
    const isInCache = cacheStats.organizations.includes(organizationId);

    // Get recent training history
    const recentTraining = await prisma.trainingLog.findMany({
      where: { organizationId },
      orderBy: { startedAt: 'desc' },
      take: 5
    });

    // Get recent prediction accuracy
    const recentAlerts = await prisma.predictionAlert.findMany({
      where: {
        organizationId,
        isAccurate: { not: null },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
      },
      select: { isAccurate: true }
    });

    const accurateCount = recentAlerts.filter(a => a.isAccurate).length;
    const recentAccuracy = recentAlerts.length > 0 ? (accurateCount / recentAlerts.length) * 100 : null;

    res.json({
      success: true,
      data: {
        organization: org,
        modelMetrics,
        cache: {
          isInCache,
          cacheStats
        },
        recentTraining,
        recentAccuracy: {
          accuracy: recentAccuracy,
          sampleSize: recentAlerts.length,
          period: '7 days'
        }
      }
    });
  } catch (error) {
    console.error('Error getting model info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get model information'
    });
  }
});

/**
 * Test model with sample data
 * POST /api/predictive-alerts/models/test
 */
router.post('/models/test', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req, res): Promise<void> => {
  try {
    const organizationId = getRequestOrgId(req);
    const { testData, iterations = 1 } = req.body;

    if (!testData || typeof testData !== 'object') {
      res.status(400).json({
        success: false,
        message: 'Test data object is required'
      });
      return;
    }

    if (iterations < 1 || iterations > 10) {
      res.status(400).json({
        success: false,
        message: 'Iterations must be between 1 and 10'
      });
      return;
    }

    const results = [];
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      const iterationStart = Date.now();

      // Create processed features object
      const processedFeatures = {
        organizationId,
        timestamp: new Date(),
        features: testData,
        metadata: {
          totalFeatures: Object.keys(testData).length,
          lagFeatureCount: 0,
          rollingFeatureCount: 0,
          missingValues: [],
          processingTime: 0,
          testIteration: i + 1
        }
      };

      // Get prediction
      const prediction = await predictionService.predict(processedFeatures);
      const iterationTime = Date.now() - iterationStart;

      results.push({
        iteration: i + 1,
        prediction,
        iterationTime
      });
    }

    const totalTime = Date.now() - startTime;
    const avgTime = totalTime / iterations;

    res.json({
      success: true,
      data: {
        results,
        statistics: {
          iterations,
          totalTime,
          averageTime: avgTime,
          minTime: Math.min(...results.map(r => r.iterationTime)),
          maxTime: Math.max(...results.map(r => r.iterationTime))
        }
      }
    });
  } catch (error) {
    console.error('Error testing model:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test model',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get system-wide prediction statistics (Super Admin only)
 * GET /api/predictive-alerts/admin/system-stats
 */
router.get('/admin/system-stats', authenticate, authorize(['SUPER_ADMIN']), async (req, res): Promise<void> => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const since = new Date(Date.now() - (hours * 60 * 60 * 1000));

    // Get system-wide statistics
    const totalOrganizations = await prisma.organization.count({
      where: { predictionEnabled: true }
    });

    const totalPredictions = await prisma.predictionAlert.count({
      where: { createdAt: { gte: since } }
    });

    const totalFeedback = await prisma.predictionAlert.count({
      where: {
        createdAt: { gte: since },
        isAccurate: { not: null }
      }
    });

    const accuratePredictions = await prisma.predictionAlert.count({
      where: {
        createdAt: { gte: since },
        isAccurate: true
      }
    });

    const systemAccuracy = totalFeedback > 0 ? (accuratePredictions / totalFeedback) * 100 : 0;

    // Get cache statistics
    const cacheStats = predictionService.getCacheStats();

    // Get recent training activity
    const recentTraining = await prisma.trainingLog.count({
      where: {
        startedAt: { gte: since },
        status: 'COMPLETED'
      }
    });

    const failedTraining = await prisma.trainingLog.count({
      where: {
        startedAt: { gte: since },
        status: 'FAILED'
      }
    });

    // Get predictions by organization
    const predictionsByOrg = await prisma.predictionAlert.groupBy({
      by: ['organizationId'],
      where: { createdAt: { gte: since } },
      _count: { id: true }
    });

    res.json({
      success: true,
      data: {
        period: { hours, since },
        organizations: {
          total: totalOrganizations,
          withPredictions: predictionsByOrg.length
        },
        predictions: {
          total: totalPredictions,
          withFeedback: totalFeedback,
          accurate: accuratePredictions,
          systemAccuracy
        },
        training: {
          completed: recentTraining,
          failed: failedTraining,
          successRate: (recentTraining + failedTraining) > 0 ? 
            (recentTraining / (recentTraining + failedTraining)) * 100 : 0
        },
        cache: cacheStats,
        predictionsByOrganization: predictionsByOrg.map(p => ({
          organizationId: p.organizationId,
          count: p._count.id
        }))
      }
    });
  } catch (error) {
    console.error('Error getting system stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get system statistics'
    });
  }
});

export default router;