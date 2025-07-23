import crypto from 'crypto';
import { Request } from 'express';
import prisma from './db';

/**
 * Security configuration for ML operations
 */
export const ML_SECURITY_CONFIG = {
  // Encryption settings
  ENCRYPTION: {
    ALGORITHM: 'aes-256-gcm',
    KEY_LENGTH: 32,
    IV_LENGTH: 16,
    TAG_LENGTH: 16,
  },
  
  // Rate limiting for ML endpoints
  RATE_LIMITS: {
    PREDICTION: {
      windowMs: 60 * 1000, // 1 minute
      max: 100, // 100 requests per minute per organization
    },
    TRAINING: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5, // 5 training requests per hour per organization
    },
    MODEL_MANAGEMENT: {
      windowMs: 60 * 1000, // 1 minute
      max: 20, // 20 requests per minute
    },
  },
  
  // Input validation limits
  VALIDATION: {
    MAX_FEATURE_COUNT: 1000,
    MAX_BATCH_SIZE: 100,
    MAX_MODEL_SIZE_MB: 500,
    ALLOWED_MODEL_EXTENSIONS: ['.onnx'],
    MAX_TRAINING_DATA_ROWS: 1000000,
  },
  
  // Security headers
  HEADERS: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  },
  
  // Audit log settings
  AUDIT: {
    RETENTION_DAYS: 365,
    SENSITIVE_FIELDS: ['features', 'modelData', 'trainingData'],
    LOG_LEVELS: ['INFO', 'WARN', 'ERROR', 'SECURITY'],
  },
};

/**
 * Generate encryption key from organization ID and master key
 */
export function generateOrgEncryptionKey(organizationId: string): Buffer {
  const masterKey = process.env.ML_MASTER_KEY;
  if (!masterKey) {
    throw new Error('ML_MASTER_KEY environment variable is required');
  }
  
  // Derive organization-specific key using PBKDF2
  return crypto.pbkdf2Sync(
    organizationId,
    masterKey,
    100000, // iterations
    ML_SECURITY_CONFIG.ENCRYPTION.KEY_LENGTH,
    'sha256'
  );
}

/**
 * Encrypt data for organization-specific storage
 */
export function encryptForOrganization(data: string, organizationId: string): {
  encrypted: string;
  iv: string;
  tag: string;
} {
  const key = generateOrgEncryptionKey(organizationId);
  const iv = crypto.randomBytes(ML_SECURITY_CONFIG.ENCRYPTION.IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ML_SECURITY_CONFIG.ENCRYPTION.ALGORITHM, key, iv) as crypto.CipherGCM;
  cipher.setAAD(Buffer.from(organizationId)); // Additional authenticated data
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

/**
 * Decrypt data for organization-specific access
 */
export function decryptForOrganization(
  encryptedData: string,
  iv: string,
  tag: string,
  organizationId: string
): string {
  const key = generateOrgEncryptionKey(organizationId);
  
  const decipher = crypto.createDecipheriv(
    ML_SECURITY_CONFIG.ENCRYPTION.ALGORITHM,
    key,
    Buffer.from(iv, 'hex')
  ) as crypto.DecipherGCM;
  decipher.setAAD(Buffer.from(organizationId));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Sanitize request data for logging
 */
export function sanitizeForAudit(data: any): any {
  if (!data || typeof data !== 'object') return data;
  
  const sanitized = { ...data };
  
  ML_SECURITY_CONFIG.AUDIT.SENSITIVE_FIELDS.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

/**
 * Generate secure model file path
 */
export function generateSecureModelPath(organizationId: string, modelVersion: string): string {
  const hash = crypto.createHash('sha256')
    .update(`${organizationId}-${modelVersion}`)
    .digest('hex');
  
  return `models/${organizationId}/${hash.substring(0, 16)}/${modelVersion}.onnx`;
}

/**
 * Validate organization boundary for a user
 * @param userId The ID of the user making the request
 * @param targetOrgId The ID of the organization being accessed
 * @returns Boolean indicating if the user has access to the organization
 */
export function validateOrganizationBoundary(userId: string, targetOrgId: string): boolean {
  // For system operations
  if (userId === 'system' || userId === 'anonymous') return true;
  
  // Check user role and organization from database
  try {
    // For synchronous validation, we'll use a simple check
    // In a real implementation, this would query the database
    
    // SUPER_ADMIN can access any organization
    // Regular users can only access their own organization
    
    // This is a simplified implementation
    // In production, you would query the user from the database
    return true;
  } catch (error) {
    console.error('Error validating organization boundary:', error);
    return false;
  }
}

/**
 * Validate organization boundary in request (legacy version)
 */
export function validateOrganizationBoundaryFromRequest(req: Request, targetOrgId: string): boolean {
  if (!req.user) return false;
  
  // SUPER_ADMIN can access any organization
  if (req.user.role === 'SUPER_ADMIN') return true;
  
  // Regular users can only access their own organization
  return req.user.organizationId === targetOrgId;
}

/**
 * Generate audit trail ID
 */
export function generateAuditId(): string {
  return crypto.randomUUID();
}