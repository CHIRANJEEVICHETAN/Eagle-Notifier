import express from 'express';
import { ModelDeploymentController } from '../controllers/modelDeploymentController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = express.Router();

/**
 * Model Deployment Routes
 * Base path: /api/model-deployment
 */

// Apply authentication middleware to all routes
router.use(authenticate);

// List all model versions for an organization
router.get(
  '/organizations/:organizationId/models',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  ModelDeploymentController.listModelVersions
);

// Get details about a specific model version
router.get(
  '/organizations/:organizationId/models/:version',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  ModelDeploymentController.getModelVersion
);

// Deploy a model version
router.post(
  '/organizations/:organizationId/deploy',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  ModelDeploymentController.deployModel
);

// Rollback to a previous model version
router.post(
  '/organizations/:organizationId/rollback',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  ModelDeploymentController.rollbackModel
);

// Delete a model version
router.delete(
  '/organizations/:organizationId/models/:version',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  ModelDeploymentController.deleteModelVersion
);

// Apply retention policy
router.post(
  '/organizations/:organizationId/retention',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  ModelDeploymentController.applyRetentionPolicy
);

// Get deployment metrics
router.get(
  '/organizations/:organizationId/metrics',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  ModelDeploymentController.getDeploymentMetrics
);

// Setup CI/CD pipeline
router.post(
  '/organizations/:organizationId/cicd',
  authorize(['SUPER_ADMIN']),
  ModelDeploymentController.setupCICDPipeline
);

export default router;