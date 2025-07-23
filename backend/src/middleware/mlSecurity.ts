import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { createError } from './errorHandler';
import { ML_SECURITY_CONFIG, validateOrganizationBoundary, sanitizeForAudit } from '../config/security';
import { MLAuditService } from '../services/mlAuditService';
import { getRequestOrgId } from './authMiddleware';

/**
 * ML-specific security headers middleware
 */
export const mlSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Apply security headers
  Object.entries(ML_SECURITY_CONFIG.HEADERS).forEach(([header, value]) => {
    res.setHeader(header, value);
  });
  
  // Add ML-specific headers
  res.setHeader('X-ML-API-Version', '1.0');
  res.setHeader('X-Organization-Scoped', 'true');
  
  next();
};

/**
 * Organization boundary validation middleware
 */
export const validateOrgBoundary = (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestedOrgId = getRequestOrgId(req);
    
    // Validate that user can access this organization
    if (!validateOrganizationBoundary(req, requestedOrgId)) {
      throw createError('Access denied: Organization boundary violation', 403);
    }
    
    // Store validated org ID for downstream use
    req.validatedOrgId = requestedOrgId;
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Input validation middleware for ML endpoints
 */
export const validateMLInput = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { body, query } = req;
    
    // Validate feature count
    if (body.features && Array.isArray(body.features)) {
      if (body.features.length > ML_SECURITY_CONFIG.VALIDATION.MAX_FEATURE_COUNT) {
        throw createError(
          `Too many features: ${body.features.length}. Maximum allowed: ${ML_SECURITY_CONFIG.VALIDATION.MAX_FEATURE_COUNT}`,
          400
        );
      }
    }
    
    // Validate batch size
    if (body.batch && Array.isArray(body.batch)) {
      if (body.batch.length > ML_SECURITY_CONFIG.VALIDATION.MAX_BATCH_SIZE) {
        throw createError(
          `Batch size too large: ${body.batch.length}. Maximum allowed: ${ML_SECURITY_CONFIG.VALIDATION.MAX_BATCH_SIZE}`,
          400
        );
      }
    }
    
    // Validate training data size
    if (body.trainingData && Array.isArray(body.trainingData)) {
      if (body.trainingData.length > ML_SECURITY_CONFIG.VALIDATION.MAX_TRAINING_DATA_ROWS) {
        throw createError(
          `Training data too large: ${body.trainingData.length} rows. Maximum allowed: ${ML_SECURITY_CONFIG.VALIDATION.MAX_TRAINING_DATA_ROWS}`,
          400
        );
      }
    }
    
    // Sanitize input data
    req.body = sanitizeInput(body);
    req.query = sanitizeInput(query);
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * ML audit logging middleware
 */
export const mlAuditLog = (action: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const crypto = require('crypto');
    const auditId = req.headers['x-audit-id'] as string || crypto.randomUUID();
    const startTime = Date.now();
    
    try {
      // Log request start
      await MLAuditService.logMLOperation({
        auditId,
        organizationId: req.validatedOrgId || 'unknown',
        userId: req.user?.id || 'anonymous',
        action,
        resource: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestData: sanitizeForAudit(req.body),
        timestamp: new Date(),
        status: 'STARTED',
      });
      
      // Store audit context
      req.auditContext = {
        auditId,
        action,
        startTime,
      };
      
      // Override res.json to capture response
      const originalJson = res.json;
      res.json = function(data: any) {
        req.responseData = sanitizeForAudit(data);
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      console.error('Audit logging failed:', error);
      next(); // Continue even if audit fails
    }
  };
};

/**
 * ML audit completion middleware
 */
export const completeMLAudit = async (req: Request, res: Response, next: NextFunction) => {
  if (req.auditContext) {
    const duration = Date.now() - req.auditContext.startTime;
    
    try {
      await MLAuditService.updateMLOperation(req.auditContext.auditId, {
        status: res.statusCode >= 400 ? 'FAILED' : 'COMPLETED',
        responseData: req.responseData,
        duration,
        statusCode: res.statusCode,
        completedAt: new Date(),
      });
    } catch (error) {
      console.error('Audit completion failed:', error);
    }
  }
  
  next();
};

/**
 * Rate limiting for ML endpoints
 */
export const mlRateLimit = (type: 'PREDICTION' | 'TRAINING' | 'MODEL_MANAGEMENT') => {
  const config = ML_SECURITY_CONFIG.RATE_LIMITS[type];
  
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    keyGenerator: (req: Request) => {
      // Rate limit per organization
      return `ml-${type.toLowerCase()}-${req.validatedOrgId || req.ip}`;
    },
    message: {
      error: `Too many ${type.toLowerCase()} requests`,
      retryAfter: Math.ceil(config.windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

/**
 * Model access control middleware
 */
export const validateModelAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { modelId, organizationId } = req.params;
    const requestOrgId = req.validatedOrgId;
    
    // Ensure model belongs to the requesting organization
    if (organizationId && organizationId !== requestOrgId) {
      throw createError('Access denied: Model does not belong to your organization', 403);
    }
    
    // Additional model-specific validation can be added here
    // e.g., check if model exists, is active, etc.
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Threat detection middleware
 */
export const threatDetection = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPatterns = [
    /\.\.\//g, // Path traversal
    /<script/gi, // XSS attempts
    /union\s+select/gi, // SQL injection
    /exec\s*\(/gi, // Code execution
    /eval\s*\(/gi, // Code evaluation
  ];
  
  const requestString = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params,
  });
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestString)) {
      // Log security incident
      MLAuditService.logSecurityIncident({
        organizationId: req.validatedOrgId || 'unknown',
        userId: req.user?.id || 'anonymous',
        type: 'SUSPICIOUS_PATTERN',
        pattern: pattern.source,
        request: sanitizeForAudit(req.body),
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date(),
      });
      
      throw createError('Request blocked: Suspicious pattern detected', 400);
    }
  }
  
  next();
};

/**
 * Sanitize input data
 */
function sanitizeInput(data: any): any {
  if (typeof data === 'string') {
    return data.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeInput);
  }
  
  if (data && typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return data;
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      validatedOrgId?: string;
      auditContext?: {
        auditId: string;
        action: string;
        startTime: number;
      };
      responseData?: any;
    }
  }
}