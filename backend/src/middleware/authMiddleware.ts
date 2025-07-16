import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createError } from './errorHandler';
import prisma from '../config/db';

// Extend Express Request to include user information
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
 * Authentication middleware to protect routes
 * This will verify the JWT token and attach the user to the request object
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError('Authentication required. Please login.', 401);
    }
    
    // Extract the token (remove 'Bearer ' prefix)
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      throw createError('Authentication token missing', 401);
    }
    
    try {
      if (!process.env.JWT_SECRET) {
        throw createError('JWT_SECRET environment variable is required', 500);
      }
      
      // Verify the token
      const decoded = jwt.verify(
        token, 
        process.env.JWT_SECRET
      ) as { id: string; email: string; role: string };
      
      // Look up user in DB to get organizationId
      const dbUser = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, email: true, role: true, organizationId: true }
      });
      if (!dbUser) {
        throw createError('User not found', 401);
      }
      
      // Attach user info to the request
      req.user = {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        organizationId: dbUser.organizationId ?? null,
      };
      
      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw createError('Authentication token expired', 401);
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw createError('Invalid authentication token', 401);
      } else {
        throw error;
      }
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Role-based access control middleware
 * This will check if the user has the required role
 */
export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }
      
      if (!roles.includes(req.user.role)) {
        throw createError('Unauthorized access. You do not have permission to perform this action.', 403);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}; 

export function getRequestOrgId(req: Request): string {
  // If SUPER_ADMIN, allow specifying org via query/body
  if (req.user?.role === 'SUPER_ADMIN') {
    const orgId = req.query.organizationId || req.body.organizationId || req.user.organizationId;
    if (typeof orgId === 'string' && orgId) return orgId;
    throw createError('organizationId is required for SUPER_ADMIN actions', 400);
  }
  // For regular users, require org from user context
  if (typeof req.user?.organizationId === 'string' && req.user.organizationId) {
    return req.user.organizationId;
  }
  throw createError('Organization context missing. Please contact support.', 400);
} 