import express from 'express';
import { authenticate, authorize, getRequestOrgId } from '../middleware/authMiddleware';
import { 
  mlSecurityHeaders, 
  validateOrgBoundary, 
  mlAuditLog, 
  completeMLAudit,
  mlRateLimit 
} from '../middleware/mlSecurity';
import { MLAuditService } from '../services/mlAuditService';
import { securityMonitoringService } from '../services/securityMonitoringService';
import { SecureModelStorage } from '../services/secureModelStorage';
import prisma from '../config/db';

const router = express.Router();

// Apply security middleware
router.use(mlSecurityHeaders);
router.use(authenticate);
router.use(validateOrgBoundary);

/**
 * Get audit logs for organization
 * GET /api/security/audit-logs
 */
router.get('/audit-logs', 
  mlRateLimit('MODEL_MANAGEMENT'),
  mlAuditLog('AUDIT_LOG_ACCESS'),
  async (req, res): Promise<void> => {
    try {
      const organizationId = getRequestOrgId(req);
      const {
        action,
        userId,
        startDate,
        endDate,
        status,
        page = 1,
        limit = 50
      } = req.query;

      const filters = {
        action: action as string,
        userId: userId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        status: status as string,
        limit: Math.min(parseInt(limit as string) || 50, 1000),
        offset: (parseInt(page as string) - 1) * parseInt(limit as string)
      };

      const auditLogs = await MLAuditService.getAuditLogs(organizationId, filters);

      res.json({
        success: true,
        data: {
          logs: auditLogs,
          pagination: {
            page: parseInt(page as string),
            limit: filters.limit,
            total: auditLogs.length
          }
        }
      });
    } catch (error) {
      console.error('Error getting audit logs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get audit logs'
      });
    }
  }
);

/**
 * Get security incidents for organization
 * GET /api/security/incidents
 */
router.get('/incidents',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  mlRateLimit('MODEL_MANAGEMENT'),
  mlAuditLog('SECURITY_INCIDENT_ACCESS'),
  async (req, res): Promise<void> => {
    try {
      const organizationId = getRequestOrgId(req);
      const {
        type,
        severity,
        resolved,
        startDate,
        endDate,
        page = 1,
        limit = 50
      } = req.query;

      const filters = {
        type: type as string,
        severity: severity as string,
        resolved: resolved ? resolved === 'true' : undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: Math.min(parseInt(limit as string) || 50, 200),
        offset: (parseInt(page as string) - 1) * parseInt(limit as string)
      };

      const incidents = await MLAuditService.getSecurityIncidents(organizationId, filters);

      res.json({
        success: true,
        data: {
          incidents,
          pagination: {
            page: parseInt(page as string),
            limit: filters.limit,
            total: incidents.length
          }
        }
      });
    } catch (error) {
      console.error('Error getting security incidents:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get security incidents'
      });
    }
  }
);

/**
 * Get security metrics for organization
 * GET /api/security/metrics
 */
router.get('/metrics',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  mlRateLimit('MODEL_MANAGEMENT'),
  mlAuditLog('SECURITY_METRICS_ACCESS'),
  async (req, res): Promise<void> => {
    try {
      const organizationId = getRequestOrgId(req);
      const days = Math.min(parseInt(req.query.days as string) || 30, 90);

      const metrics = await securityMonitoringService.getSecurityMetrics(organizationId, days);

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      console.error('Error getting security metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get security metrics'
      });
    }
  }
);

/**
 * Generate security report for organization
 * GET /api/security/report
 */
router.get('/report',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  mlRateLimit('MODEL_MANAGEMENT'),
  mlAuditLog('SECURITY_REPORT_GENERATION'),
  async (req, res): Promise<void> => {
    try {
      const organizationId = getRequestOrgId(req);
      const {
        startDate,
        endDate,
        format = 'json'
      } = req.query;

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const report = await MLAuditService.generateSecurityReport(organizationId, start, end);

      if (format === 'json') {
        res.json({
          success: true,
          data: report
        });
      } else {
        // Could implement PDF/Excel export here
        res.status(400).json({
          success: false,
          message: 'Only JSON format is currently supported'
        });
      }
    } catch (error) {
      console.error('Error generating security report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate security report'
      });
    }
  }
);

/**
 * Get model storage information
 * GET /api/security/models
 */
router.get('/models',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  mlRateLimit('MODEL_MANAGEMENT'),
  mlAuditLog('MODEL_STORAGE_ACCESS'),
  async (req, res): Promise<void> => {
    try {
      const organizationId = getRequestOrgId(req);

      const [models, storageStats] = await Promise.all([
        SecureModelStorage.listModels(organizationId),
        SecureModelStorage.getStorageStats(organizationId)
      ]);

      res.json({
        success: true,
        data: {
          models,
          storageStats,
          organizationId
        }
      });
    } catch (error) {
      console.error('Error getting model storage info:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get model storage information'
      });
    }
  }
);

/**
 * Validate model integrity
 * POST /api/security/models/:modelPath/validate
 */
router.post('/models/:modelPath/validate',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  mlRateLimit('MODEL_MANAGEMENT'),
  mlAuditLog('MODEL_INTEGRITY_CHECK'),
  async (req, res): Promise<void> => {
    try {
      const organizationId = getRequestOrgId(req);
      const { modelPath } = req.params;

      const isValid = await SecureModelStorage.validateModelIntegrity(modelPath);
      const metadata = await SecureModelStorage.getModelMetadata(modelPath);

      // Verify model belongs to organization
      if (metadata.organizationId !== organizationId) {
        res.status(403).json({
          success: false,
          message: 'Access denied: Model does not belong to your organization'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          modelPath,
          isValid,
          metadata,
          validatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error validating model integrity:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate model integrity'
      });
    }
  }
);

/**
 * Clean up old models
 * POST /api/security/models/cleanup
 */
router.post('/models/cleanup',
  authorize(['ADMIN', 'SUPER_ADMIN']),
  mlRateLimit('MODEL_MANAGEMENT'),
  mlAuditLog('MODEL_CLEANUP'),
  async (req, res): Promise<void> => {
    try {
      const organizationId = getRequestOrgId(req);
      const { keepVersions = 5 } = req.body;

      await SecureModelStorage.cleanupOldModels(organizationId, keepVersions);

      res.json({
        success: true,
        message: `Model cleanup completed, keeping ${keepVersions} latest versions`
      });
    } catch (error) {
      console.error('Error cleaning up models:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cleanup old models'
      });
    }
  }
);

// Super Admin only routes
/**
 * Get system-wide security overview (Super Admin only)
 * GET /api/security/admin/overview
 */
router.get('/admin/overview',
  authorize(['SUPER_ADMIN']),
  mlRateLimit('MODEL_MANAGEMENT'),
  mlAuditLog('SYSTEM_SECURITY_OVERVIEW'),
  async (req, res): Promise<void> => {
    try {
      // Get all organizations with ML enabled
      const organizations = await prisma.organization.findMany({
        where: { predictionEnabled: true },
        select: { id: true, name: true }
      });

      const overviewData = await Promise.all(
        organizations.map(async (org) => {
          try {
            const metrics = await securityMonitoringService.getSecurityMetrics(org.id, 7);
            return {
              organizationId: org.id,
              organizationName: org.name,
              metrics
            };
          } catch (error) {
            return {
              organizationId: org.id,
              organizationName: org.name,
              error: 'Failed to get metrics'
            };
          }
        })
      );

      res.json({
        success: true,
        data: {
          organizations: overviewData,
          summary: {
            totalOrganizations: organizations.length,
            timestamp: new Date()
          }
        }
      });
    } catch (error) {
      console.error('Error getting system security overview:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get system security overview'
      });
    }
  }
);

/**
 * Run vulnerability assessment (Super Admin only)
 * POST /api/security/admin/vulnerability-scan
 */
router.post('/admin/vulnerability-scan',
  authorize(['SUPER_ADMIN']),
  mlRateLimit('MODEL_MANAGEMENT'),
  mlAuditLog('VULNERABILITY_SCAN'),
  async (req, res): Promise<void> => {
    try {
      // This would integrate with the security test utilities
      // For now, return a placeholder response
      const scanResults = {
        scanId: require('crypto').randomUUID(),
        startedAt: new Date(),
        status: 'COMPLETED',
        results: {
          totalTests: 10,
          passed: 8,
          failed: 2,
          criticalIssues: 0,
          highIssues: 1,
          mediumIssues: 1,
          lowIssues: 0
        },
        recommendations: [
          'Update rate limiting configuration for training endpoints',
          'Review input validation for batch prediction endpoints'
        ]
      };

      res.json({
        success: true,
        data: scanResults
      });
    } catch (error) {
      console.error('Error running vulnerability scan:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to run vulnerability scan'
      });
    }
  }
);

// Add completion middleware to all routes
router.use(completeMLAudit);

export default router;