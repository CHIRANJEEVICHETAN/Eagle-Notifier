/**
 * API routes for error handling and monitoring
 */

import express, { Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware';
import { ErrorLogger } from '../services/errorHandling/errorLogger';
import { CircuitBreakerManager } from '../services/errorHandling/circuitBreaker';
import { enhancedPredictionService } from '../services/errorHandling/enhancedPredictionService';

const router = express.Router();
const errorLogger = ErrorLogger.getInstance();
const circuitBreakerManager = CircuitBreakerManager.getInstance();

/**
 * Get error metrics for organization
 */
router.get('/metrics/:organizationId', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { organizationId } = req.params;
    const { hours = 24 } = req.query;
    
    // Check if user has access to this organization
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.organizationId !== organizationId) {
      res.status(403).json({ error: 'Access denied to organization data' });
      return;
    }

    const metrics = await errorLogger.getErrorMetrics(organizationId, Number(hours));
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error getting error metrics:', error);
    res.status(500).json({ 
      error: 'Failed to get error metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get system-wide error metrics (Super Admin only)
 */
router.get('/metrics/system/overview', authenticate, authorize(['SUPER_ADMIN']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { hours = 24 } = req.query;
    
    // Get metrics for all organizations
    const organizations = await import('../config/db').then(db => 
      db.default.organization.findMany({
        select: { id: true, name: true }
      })
    );

    const systemMetrics = {
      totalOrganizations: organizations.length,
      timeRange: {
        hours: Number(hours)
      },
      organizationMetrics: [] as any[]
    };

    for (const org of organizations) {
      try {
        const metrics = await errorLogger.getErrorMetrics(org.id, Number(hours));
        systemMetrics.organizationMetrics.push({
          orgId: org.id,
          organizationName: org.name,
          ...metrics
        });
      } catch (error) {
        console.error(`Error getting metrics for org ${org.id}:`, error);
      }
    }

    res.json({
      success: true,
      data: systemMetrics
    });
  } catch (error) {
    console.error('Error getting system error metrics:', error);
    res.status(500).json({ 
      error: 'Failed to get system error metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get circuit breaker status for organization
 */
router.get('/circuit-breakers/:organizationId', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { organizationId } = req.params;
    
    // Check if user has access to this organization
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.organizationId !== organizationId) {
      res.status(403).json({ error: 'Access denied to organization data' });
      return;
    }

    const circuitBreakers = circuitBreakerManager.getCircuitBreakersForOrganization(organizationId);
    const circuitBreakerStats = circuitBreakers.map(cb => ({
      name: cb.name,
      organizationId: cb.organizationId,
      stats: cb.getStats()
    }));

    res.json({
      success: true,
      data: {
        organizationId,
        circuitBreakers: circuitBreakerStats,
        summary: {
          total: circuitBreakers.length,
          open: circuitBreakers.filter(cb => cb.getStats().state === 'OPEN').length,
          halfOpen: circuitBreakers.filter(cb => cb.getStats().state === 'HALF_OPEN').length,
          closed: circuitBreakers.filter(cb => cb.getStats().state === 'CLOSED').length
        }
      }
    });
  } catch (error) {
    console.error('Error getting circuit breaker status:', error);
    res.status(500).json({ 
      error: 'Failed to get circuit breaker status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get system-wide circuit breaker status (Super Admin only)
 */
router.get('/circuit-breakers/system/overview', authenticate, authorize(['SUPER_ADMIN']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const systemStats = circuitBreakerManager.getSystemStats();
    const allCircuitBreakers = circuitBreakerManager.getAllCircuitBreakers();
    
    const circuitBreakerDetails = Array.from(allCircuitBreakers.entries()).map(([key, cb]) => ({
      key,
      name: cb.name,
      organizationId: cb.organizationId,
      stats: cb.getStats()
    }));

    res.json({
      success: true,
      data: {
        systemStats,
        circuitBreakers: circuitBreakerDetails
      }
    });
  } catch (error) {
    console.error('Error getting system circuit breaker status:', error);
    res.status(500).json({ 
      error: 'Failed to get system circuit breaker status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Reset circuit breaker for organization (Admin/Super Admin only)
 */
router.post('/circuit-breakers/:organizationId/reset', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { organizationId } = req.params;
    const { serviceName } = req.body;
    
    // Check if user has access to this organization
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.organizationId !== organizationId) {
      res.status(403).json({ error: 'Access denied to organization data' });
      return;
    }

    if (serviceName) {
      // Reset specific service circuit breaker
      const circuitBreaker = circuitBreakerManager.getCircuitBreaker(serviceName, organizationId);
      circuitBreaker.reset();
      
      res.json({
        success: true,
        message: `Circuit breaker reset for ${serviceName} in organization ${organizationId}`
      });
    } else {
      // Reset all circuit breakers for organization
      circuitBreakerManager.resetOrganizationCircuitBreakers(organizationId);
      
      res.json({
        success: true,
        message: `All circuit breakers reset for organization ${organizationId}`
      });
    }
  } catch (error) {
    console.error('Error resetting circuit breaker:', error);
    res.status(500).json({ 
      error: 'Failed to reset circuit breaker',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get service health status
 */
router.get('/health/:organizationId', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { organizationId } = req.params;
    
    // Check if user has access to this organization
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.organizationId !== organizationId) {
      res.status(403).json({ error: 'Access denied to organization data' });
      return;
    }

    const serviceHealth = enhancedPredictionService.getServiceHealth();
    const organizationCircuitBreakers = circuitBreakerManager.getCircuitBreakersForOrganization(organizationId);
    
    // Filter health data for this organization
    const organizationHealth = {
      organizationId,
      overall: serviceHealth.overall,
      circuitBreakers: Object.fromEntries(
        Object.entries(serviceHealth.circuitBreakers).filter(([key]) => 
          key.includes(organizationId)
        )
      ),
      errorRates: Object.fromEntries(
        Object.entries(serviceHealth.errorRates).filter(([key]) => 
          key.includes(organizationId)
        )
      ),
      services: {
        prediction: organizationCircuitBreakers.find(cb => cb.name === 'Prediction')?.getStats().state || 'UNKNOWN',
        modelLoad: organizationCircuitBreakers.find(cb => cb.name === 'ModelLoad')?.getStats().state || 'UNKNOWN'
      }
    };

    res.json({
      success: true,
      data: organizationHealth
    });
  } catch (error) {
    console.error('Error getting service health:', error);
    res.status(500).json({ 
      error: 'Failed to get service health',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get system-wide service health (Super Admin only)
 */
router.get('/health/system/overview', authenticate, authorize(['SUPER_ADMIN']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const serviceHealth = enhancedPredictionService.getServiceHealth();
    
    res.json({
      success: true,
      data: serviceHealth
    });
  } catch (error) {
    console.error('Error getting system service health:', error);
    res.status(500).json({ 
      error: 'Failed to get system service health',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Mark error as resolved
 */
router.post('/errors/:correlationId/resolve', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { correlationId } = req.params;
    const { resolutionNotes } = req.body;
    
    if (!req.user?.id) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }
    
    await errorLogger.resolveError(
      correlationId,
      req.user.id,
      resolutionNotes
    );

    res.json({
      success: true,
      message: 'Error marked as resolved'
    });
  } catch (error) {
    console.error('Error resolving error:', error);
    res.status(500).json({ 
      error: 'Failed to resolve error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get error logs for organization
 */
router.get('/logs/:organizationId', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { organizationId } = req.params;
    const { 
      page = 1, 
      limit = 50, 
      severity, 
      category, 
      serviceName,
      resolved 
    } = req.query;
    
    // Check if user has access to this organization
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.organizationId !== organizationId) {
      res.status(403).json({ error: 'Access denied to organization data' });
      return;
    }

    const prisma = await import('../config/db').then(db => db.default);
    
    const where: any = {
      organizationId
    };
    
    if (severity) where.severity = severity;
    if (category) where.category = category;
    if (serviceName) where.serviceName = serviceName;
    if (resolved !== undefined) where.resolved = resolved === 'true';

    const [logs, total] = await Promise.all([
      prisma.errorLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit)
      }),
      prisma.errorLog.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error getting error logs:', error);
    res.status(500).json({ 
      error: 'Failed to get error logs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Test error handling (Development only)
 */
if (process.env.NODE_ENV === 'development') {
  router.post('/test/error/:organizationId', authenticate, authorize(['SUPER_ADMIN']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const { errorType = 'model', severity = 'MEDIUM' } = req.body;
      
      // Create a test error
      const { ModelPredictionError } = await import('../services/errorHandling/errorTypes');
      const testError = new ModelPredictionError(organizationId, 'test-v1', 10, new Error('Test error'));
      
      await errorLogger.logError(testError);
      
      res.json({
        success: true,
        message: 'Test error logged successfully',
        correlationId: testError.correlationId
      });
    } catch (error) {
      console.error('Error creating test error:', error);
      res.status(500).json({ 
        error: 'Failed to create test error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

export default router;