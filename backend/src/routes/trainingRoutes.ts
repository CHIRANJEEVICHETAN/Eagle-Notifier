import express from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { trainingService } from '../services/trainingService';
import { trainingScheduler } from '../services/trainingScheduler';
import { trainingMonitor } from '../services/trainingMonitor';

const router = express.Router();

/**
 * Get training history for organization
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    
    if (!organizationId) {
      res.status(400).json({ error: 'Organization ID required' });
      return;
    }

    const history = await trainingService.getTrainingHistory(organizationId);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error getting training history:', error);
    res.status(500).json({ 
      error: 'Failed to get training history',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Trigger manual training
 */
router.post('/train', authenticate, async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    const userRole = req.user?.role;
    
    if (!organizationId) {
      res.status(400).json({ error: 'Organization ID required' });
      return;
    }

    // Only admins can trigger manual training
    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const {
      modelName,
      description,
      dataRangeDays = 365,
      hyperparameters
    } = req.body;

    // Build training configuration
    const config = {
      organizationId,
      dataRange: {
        startDate: new Date(Date.now() - dataRangeDays * 24 * 60 * 60 * 1000),
        endDate: new Date()
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
      validationSplit: 0.2,
      targetColumn: 'failure_indicator',
      featureColumns: [
        'temperature', 'pressure', 'flow_rate', 'vibration', 'current', 'voltage'
      ],
      modelName: modelName || `manual_${new Date().toISOString().split('T')[0]}`,
      description: description || 'Manual training triggered by admin'
    };

    // Start training (async)
    const trainingPromise = trainingService.trainModel(organizationId, config);
    
    res.json({
      success: true,
      message: 'Training started',
      data: {
        organizationId,
        config: {
          modelName: config.modelName,
          description: config.description,
          dataRangeDays
        }
      }
    });

    // Handle training completion in background
    trainingPromise
      .then(async (result) => {
        console.log(`✅ Manual training completed for org ${organizationId}:`, result.version);
        
        // Validate and deploy if successful
        const validation = await trainingService.validateModel(organizationId, result.modelPath);
        if (validation.isValid && validation.accuracy >= 0.75) {
          await trainingService.deployModel(organizationId, result.modelPath, result.version);
          console.log(`🚀 Model deployed for org ${organizationId}: ${result.version}`);
        }
      })
      .catch((error) => {
        console.error(`❌ Manual training failed for org ${organizationId}:`, error);
      });

  } catch (error) {
    console.error('Error starting training:', error);
    res.status(500).json({ 
      error: 'Failed to start training',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get training schedule
 */
router.get('/schedule', authenticate, async (req, res): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    
    if (!organizationId) {
      res.status(400).json({ error: 'Organization ID required' });
      return;
    }

    const jobStatus = trainingScheduler.getJobStatus(organizationId);
    
    res.json({
      success: true,
      data: jobStatus || {
        organizationId,
        status: 'NOT_SCHEDULED',
        attempts: 0,
        maxAttempts: 0
      }
    });
  } catch (error) {
    console.error('Error getting training schedule:', error);
    res.status(500).json({ 
      error: 'Failed to get training schedule',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Configure training schedule (Admin only)
 */
router.post('/schedule', authenticate, async (req, res): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    const userRole = req.user?.role;
    
    if (!organizationId) {
      res.status(400).json({ error: 'Organization ID required' });
      return;
    }

    // Only admins can configure schedules
    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const {
      pattern = '0 2 * * 0', // Default: Sunday at 2 AM
      timezone = 'UTC',
      enabled = true,
      retryAttempts = 3,
      notifyOnSuccess = true,
      notifyOnFailure = true
    } = req.body;

    // Validate cron pattern
    const cron = require('node-cron');
    if (!cron.validate(pattern)) {
      res.status(400).json({ error: 'Invalid cron pattern' });
      return;
    }

    const scheduleConfig = {
      organizationId,
      schedule: {
        pattern,
        timezone,
        enabled
      },
      trainingConfig: {
        organizationId,
        dataRange: {
          startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          endDate: new Date()
        },
        hyperparameters: {
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
        validationSplit: 0.2,
        targetColumn: 'failure_indicator',
        featureColumns: [
          'temperature', 'pressure', 'flow_rate', 'vibration', 'current', 'voltage'
        ],
        modelName: `scheduled_${new Date().toISOString().split('T')[0]}`,
        description: 'Automated weekly training'
      },
      retryAttempts,
      notifyOnSuccess,
      notifyOnFailure
    };

    await trainingScheduler.scheduleTraining(scheduleConfig);
    
    res.json({
      success: true,
      message: enabled ? 'Training schedule configured' : 'Training schedule disabled',
      data: {
        organizationId,
        schedule: {
          pattern,
          timezone,
          enabled
        },
        retryAttempts,
        notifications: {
          onSuccess: notifyOnSuccess,
          onFailure: notifyOnFailure
        }
      }
    });
  } catch (error) {
    console.error('Error configuring training schedule:', error);
    res.status(500).json({ 
      error: 'Failed to configure training schedule',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Cancel training schedule
 */
router.delete('/schedule', authenticate, async (req, res): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    const userRole = req.user?.role;
    
    if (!organizationId) {
      res.status(400).json({ error: 'Organization ID required' });
      return;
    }

    // Only admins can cancel schedules
    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    await trainingScheduler.cancelSchedule(organizationId);
    
    res.json({
      success: true,
      message: 'Training schedule cancelled',
      data: { organizationId }
    });
  } catch (error) {
    console.error('Error cancelling training schedule:', error);
    res.status(500).json({ 
      error: 'Failed to cancel training schedule',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get training metrics
 */
router.get('/metrics', authenticate, async (req, res): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    
    if (!organizationId) {
      res.status(400).json({ error: 'Organization ID required' });
      return;
    }

    const metrics = await trainingMonitor.getOrganizationMetrics(organizationId);
    
    if (!metrics) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error getting training metrics:', error);
    res.status(500).json({ 
      error: 'Failed to get training metrics',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get system-wide training metrics (Super Admin only)
 */
router.get('/system-metrics', authenticate, async (req, res): Promise<void> => {
  try {
    const userRole = req.user?.role;
    
    // Only super admins can view system metrics
    if (userRole !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Super Admin access required' });
      return;
    }

    const systemMetrics = await trainingMonitor.getSystemMetrics();
    
    res.json({
      success: true,
      data: systemMetrics
    });
  } catch (error) {
    console.error('Error getting system training metrics:', error);
    res.status(500).json({ 
      error: 'Failed to get system training metrics',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Rollback to previous model version
 */
router.post('/rollback', authenticate, async (req, res): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    const userRole = req.user?.role;
    
    if (!organizationId) {
      res.status(400).json({ error: 'Organization ID required' });
      return;
    }

    // Only admins can rollback models
    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { targetVersion } = req.body;
    
    if (!targetVersion) {
      res.status(400).json({ error: 'Target version required' });
      return;
    }

    await trainingService.rollbackModel(organizationId, targetVersion);
    
    res.json({
      success: true,
      message: 'Model rollback completed',
      data: {
        organizationId,
        targetVersion
      }
    });
  } catch (error) {
    console.error('Error rolling back model:', error);
    res.status(500).json({ 
      error: 'Failed to rollback model',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Cancel active training
 */
router.post('/cancel', authenticate, async (req, res): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    const userRole = req.user?.role;
    
    if (!organizationId) {
      res.status(400).json({ error: 'Organization ID required' });
      return;
    }

    // Only admins can cancel training
    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    await trainingService.cancelTraining(organizationId);
    
    res.json({
      success: true,
      message: 'Training cancelled',
      data: { organizationId }
    });
  } catch (error) {
    console.error('Error cancelling training:', error);
    res.status(500).json({ 
      error: 'Failed to cancel training',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;