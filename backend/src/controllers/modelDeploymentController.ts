import { Request, Response } from 'express';
import { modelDeploymentService } from '../services/modelDeploymentService';
import { validateOrganizationBoundary } from '../config/security';
import { MLAuditService } from '../services/mlAuditService';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request to include user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        organizationId?: string | null;
      };
    }
  }
}

/**
 * Controller for model deployment operations
 */
export class ModelDeploymentController {
  /**
   * List all model versions for an organization
   */
  static async listModelVersions(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    try {
      const { organizationId } = req.params;
      const userId = req.user?.id || 'anonymous';

      // Validate organization boundary
      if (!validateOrganizationBoundary(userId, organizationId)) {
        res.status(403).json({ error: 'Access denied: Organization boundary violation' });
        return;
      }

      // Log access
      await MLAuditService.logMLOperation({
        auditId: requestId,
        organizationId,
        userId,
        action: 'MODEL_LIST',
        resource: `models/${organizationId}`,
        timestamp: new Date(),
        status: 'STARTED'
      });

      const models = await modelDeploymentService.listModelVersions(organizationId);

      // Update audit log
      await MLAuditService.updateMLOperation(requestId, {
        status: 'COMPLETED',
        responseData: { count: models.length },
        completedAt: new Date()
      });

      res.json({
        success: true,
        models
      });
    } catch (error) {
      console.error('Error listing model versions:', error);

      // Update audit log
      await MLAuditService.updateMLOperation(requestId, {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date()
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get details about a specific model version
   */
  static async getModelVersion(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    try {
      const { organizationId, version } = req.params;
      const userId = req.user?.id || 'anonymous';

      // Validate organization boundary
      if (!validateOrganizationBoundary(userId, organizationId)) {
        res.status(403).json({ error: 'Access denied: Organization boundary violation' });
        return;
      }

      // Log access
      await MLAuditService.logMLOperation({
        auditId: requestId,
        organizationId,
        userId,
        action: 'MODEL_GET',
        resource: `model/${organizationId}/${version}`,
        timestamp: new Date(),
        status: 'STARTED'
      });

      const model = await modelDeploymentService.getModelVersion(organizationId, version);

      if (!model) {
        // Update audit log
        await MLAuditService.updateMLOperation(requestId, {
          status: 'FAILED',
          errorMessage: `Model version ${version} not found`,
          completedAt: new Date()
        });

        res.status(404).json({
          success: false,
          error: `Model version ${version} not found`
        });
        return;
      }

      // Update audit log
      await MLAuditService.updateMLOperation(requestId, {
        status: 'COMPLETED',
        responseData: { version: model.version },
        completedAt: new Date()
      });

      res.json({
        success: true,
        model
      });
    } catch (error) {
      console.error('Error getting model version:', error);

      // Update audit log
      await MLAuditService.updateMLOperation(requestId, {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date()
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Deploy a model version
   */
  static async deployModel(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    try {
      const { organizationId } = req.params;
      const { version, options } = req.body;
      const userId = req.user?.id || 'anonymous';

      // Validate required fields
      if (!version) {
        res.status(400).json({
          success: false,
          error: 'Model version is required'
        });
        return;
      }

      // Validate organization boundary
      if (!validateOrganizationBoundary(userId, organizationId)) {
        res.status(403).json({ error: 'Access denied: Organization boundary violation' });
        return;
      }

      // Log deployment request
      await MLAuditService.logMLOperation({
        auditId: requestId,
        organizationId,
        userId,
        action: 'MODEL_DEPLOY',
        resource: `model/${organizationId}/${version}`,
        timestamp: new Date(),
        status: 'STARTED',
        requestData: { options }
      });

      // Deploy model
      const deploymentResult = await modelDeploymentService.deployModel(organizationId, version, {
        ...options,
        deployedBy: userId
      });

      // Update audit log
      await MLAuditService.updateMLOperation(requestId, {
        status: deploymentResult.success ? 'COMPLETED' : 'FAILED',
        responseData: deploymentResult,
        errorMessage: deploymentResult.errors?.join(', '),
        completedAt: new Date()
      });

      if (deploymentResult.success) {
        res.json({
          success: true,
          deployment: deploymentResult
        });
      } else {
        res.status(400).json({
          success: false,
          error: deploymentResult.errors?.join(', ') || 'Deployment failed',
          deployment: deploymentResult
        });
      }
    } catch (error) {
      console.error('Error deploying model:', error);

      // Update audit log
      await MLAuditService.updateMLOperation(requestId, {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date()
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Rollback to a previous model version
   */
  static async rollbackModel(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    try {
      const { organizationId } = req.params;
      const { version, options } = req.body;
      const userId = req.user?.id || 'anonymous';

      // Validate required fields
      if (!version) {
        res.status(400).json({
          success: false,
          error: 'Target model version is required'
        });
        return;
      }

      // Validate organization boundary
      if (!validateOrganizationBoundary(userId, organizationId)) {
        res.status(403).json({ error: 'Access denied: Organization boundary violation' });
        return;
      }

      // Log rollback request
      await MLAuditService.logMLOperation({
        auditId: requestId,
        organizationId,
        userId,
        action: 'MODEL_ROLLBACK',
        resource: `model/${organizationId}/${version}`,
        timestamp: new Date(),
        status: 'STARTED',
        requestData: { options }
      });

      // Rollback model
      const rollbackResult = await modelDeploymentService.rollbackModel(organizationId, version, {
        ...options,
        deployedBy: userId
      });

      // Update audit log
      await MLAuditService.updateMLOperation(requestId, {
        status: rollbackResult.success ? 'COMPLETED' : 'FAILED',
        responseData: rollbackResult,
        errorMessage: rollbackResult.errors?.join(', '),
        completedAt: new Date()
      });

      if (rollbackResult.success) {
        res.json({
          success: true,
          rollback: rollbackResult
        });
      } else {
        res.status(400).json({
          success: false,
          error: rollbackResult.errors?.join(', ') || 'Rollback failed',
          rollback: rollbackResult
        });
      }
    } catch (error) {
      console.error('Error rolling back model:', error);

      // Update audit log
      await MLAuditService.updateMLOperation(requestId, {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date()
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Delete a model version
   */
  static async deleteModelVersion(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    try {
      const { organizationId, version } = req.params;
      const userId = req.user?.id || 'anonymous';

      // Validate organization boundary
      if (!validateOrganizationBoundary(userId, organizationId)) {
        res.status(403).json({ error: 'Access denied: Organization boundary violation' });
        return;
      }

      // Log deletion request
      await MLAuditService.logMLOperation({
        auditId: requestId,
        organizationId,
        userId,
        action: 'MODEL_DELETE',
        resource: `model/${organizationId}/${version}`,
        timestamp: new Date(),
        status: 'STARTED'
      });

      // Delete model version
      const result = await modelDeploymentService.deleteModelVersion(organizationId, version, userId);

      // Update audit log
      await MLAuditService.updateMLOperation(requestId, {
        status: result ? 'COMPLETED' : 'FAILED',
        completedAt: new Date()
      });

      if (result) {
        res.json({
          success: true,
          message: `Model version ${version} deleted successfully`
        });
      } else {
        res.status(400).json({
          success: false,
          error: `Failed to delete model version ${version}`
        });
      }
    } catch (error) {
      console.error('Error deleting model version:', error);

      // Update audit log
      await MLAuditService.updateMLOperation(requestId, {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date()
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Apply retention policy to clean up old model versions
   */
  static async applyRetentionPolicy(req: Request, res: Response): Promise<void> {
    const requestId = uuidv4();
    try {
      const { organizationId } = req.params;
      const { policy } = req.body;
      const userId = req.user?.id || 'anonymous';

      // Validate organization boundary
      if (!validateOrganizationBoundary(userId, organizationId)) {
        res.status(403).json({ error: 'Access denied: Organization boundary violation' });
        return;
      }

      // Log retention policy request
      await MLAuditService.logMLOperation({
        auditId: requestId,
        organizationId,
        userId,
        action: 'MODEL_RETENTION',
        resource: `models/${organizationId}`,
        timestamp: new Date(),
        status: 'STARTED',
        requestData: { policy }
      });

      // Apply retention policy
      const deletedCount = await modelDeploymentService.applyRetentionPolicy(organizationId, policy);

      // Update audit log
      await MLAuditService.updateMLOperation(requestId, {
        status: 'COMPLETED',
        responseData: { deletedCount },
        completedAt: new Date()
      });

      res.json({
        success: true,
        deletedCount
      });
    } catch (error) {
      console.error('Error applying retention policy:', error);

      // Update audit log
      await MLAuditService.updateMLOperation(requestId, {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date()
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get deployment metrics for an organization
   */
  static async getDeploymentMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId } = req.params;
      const userId = req.user?.id || 'anonymous';

      // Validate organization boundary
      if (!validateOrganizationBoundary(userId, organizationId)) {
        res.status(403).json({ error: 'Access denied: Organization boundary violation' });
        return;
      }

      // Get deployment metrics
      const metrics = await modelDeploymentService.getDeploymentMetrics(organizationId);

      res.json({
        success: true,
        metrics
      });
    } catch (error) {
      console.error('Error getting deployment metrics:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Setup CI/CD pipeline for model deployment
   */
  static async setupCICDPipeline(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId } = req.params;
      const { config } = req.body;
      const userId = req.user?.id || 'anonymous';

      // Validate required fields
      if (!config) {
        res.status(400).json({
          success: false,
          error: 'CI/CD configuration is required'
        });
        return;
      }

      // Validate organization boundary
      if (!validateOrganizationBoundary(userId, organizationId)) {
        res.status(403).json({ error: 'Access denied: Organization boundary violation' });
        return;
      }

      // Setup CI/CD pipeline
      const result = await modelDeploymentService.setupCICDPipeline(organizationId, config);

      if (result) {
        res.json({
          success: true,
          message: 'CI/CD pipeline configured successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Failed to configure CI/CD pipeline'
        });
      }
    } catch (error) {
      console.error('Error setting up CI/CD pipeline:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}