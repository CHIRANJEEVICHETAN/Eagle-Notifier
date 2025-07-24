import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Request type to include user
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

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
    req.user = decoded as {
      id: string;
      email: string;
      role: string;
      organizationId?: string | null;
    };
    next();
  } catch (error) {
    return res.status(401).json({ 
      message: 'Invalid token',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}; 