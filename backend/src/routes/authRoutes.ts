import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import prisma from '../config/db';
import { createError } from '../middleware/errorHandler';
import { authenticate } from '../middleware/authMiddleware';
import multer from 'multer';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Public routes (no authentication required)
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, role = 'OPERATOR', organizationId } = req.body;
    
    // Validate inputs
    if (!name || !email || !password) {
      throw createError('Please provide name, email, and password', 400);
    }
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    
    if (existingUser) {
      throw createError('User with this email already exists', 400);
    }
    
    // Validate role
    if (role !== 'OPERATOR' && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      throw createError('Invalid role', 400);
    }
    
    // Only SUPER_ADMIN can create users for any org
    let orgIdToUse = organizationId;
    if (role !== 'SUPER_ADMIN') {
      if (!organizationId) {
        throw createError('organizationId is required for non-superAdmin users', 400);
      }
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role as any,
        organizationId: orgIdToUse,
      },
    });
    
    // Generate JWT
    if (!process.env.JWT_SECRET) {
      throw createError('JWT_SECRET environment variable is required', 500);
    }
    
    const expiresIn = process.env.JWT_EXPIRES_IN || '1d';
    
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, organizationId: user.organizationId },
      process.env.JWT_SECRET as string,
      { expiresIn } as SignOptions
    );
    
    // Return user info (except password) and token
    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    
    // Validate inputs
    if (!email && !password) {
      throw createError('Email and password are required', 400);
    }
    
    if (!email) {
      throw createError('Email is required', 400);
    }
    
    if (!password) {
      throw createError('Password is required', 400);
    }
    
    // Check if user exists with the provided email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        organization: true
      }
    });
    
    if (!user) {
      // Email doesn't exist in our database
      throw createError('No account found with this email address', 401);
    }
    
    // Check if user's organization is enabled (skip for SUPER_ADMIN)
    if (user.role !== 'SUPER_ADMIN' && user.organization && !user.organization.isEnabled) {
      throw createError('Your organization is currently disabled. Please contact your administrator.', 403);
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      // Password doesn't match
      throw createError('Incorrect password', 401);
    }
    
    // Generate JWT
    if (!process.env.JWT_SECRET) {
      throw createError('JWT_SECRET environment variable is required', 500);
    }
    
    const expiresIn = process.env.JWT_EXPIRES_IN || '1d';
    const refreshExpiresIn = '7d'; // Refresh tokens last longer
    
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, organizationId: user.organizationId },
      process.env.JWT_SECRET as string,
      { expiresIn } as SignOptions
    );
    
    // Generate refresh token
    const refreshToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, organizationId: user.organizationId },
      process.env.JWT_SECRET as string,
      { expiresIn: refreshExpiresIn } as SignOptions
    );
    
    // Log successful login
    console.log(`User ${user.email} (${user.id}) logged in successfully`);
    
    // Return user info (except password) and token
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        pushToken: user.pushToken,
      },
      token,
      refreshToken,
    });
  } catch (error) {
    console.log('Login error:', error);
    next(error);
  }
});

router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw createError('Refresh token is required', 400);
    }
    
    if (!process.env.JWT_SECRET) {
      throw createError('JWT_SECRET environment variable is required', 500);
    }
    
    try {
      // Verify the refresh token
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_SECRET
      ) as { id: string; email: string; role: string };
      
      // Find the user
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });
      
      if (!user) {
        throw createError('User not found', 404);
      }
      
      // Generate new tokens
      const expiresIn = process.env.JWT_EXPIRES_IN || '1d';
      const refreshExpiresIn = '7d';
      
      // Generate new access token
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, organizationId: user.organizationId },
        process.env.JWT_SECRET as string,
        { expiresIn } as SignOptions
      );
      
      // Generate new refresh token
      const newRefreshToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role, organizationId: user.organizationId },
        process.env.JWT_SECRET as string,
        { expiresIn: refreshExpiresIn } as SignOptions
      );
      
      // Return the new tokens
      res.json({
        token,
        refreshToken: newRefreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          pushToken: user.pushToken,
        }
      });
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw createError('Refresh token expired', 401);
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw createError('Invalid refresh token', 401);
      } else {
        throw error;
      }
    }
  } catch (error) {
    next(error);
  }
});

// Apply authentication middleware for protected routes
router.use(authenticate);

// Protected routes (authentication required)
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !req.user.id) {
      throw createError('Authentication required', 401);
    }
    
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    
    if (!user) {
      throw createError('User not found', 404);
    }
    
    // Return user info (except password)
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    next(error);
  }
});

router.put('/change-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !req.user.id) {
      throw createError('Authentication required', 401);
    }

    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      throw createError('Current password and new password are required', 400);
    }

    // Password strength validation
    if (newPassword.length < 6) {
      throw createError('New password must be at least 6 characters long', 400);
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      throw createError('User not found', 404);
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw createError('Current password is incorrect', 401);
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update user password
    await prisma.user.update({
      where: { id: req.user.id },
      data: { 
        password: hashedPassword,
        updatedAt: new Date() 
      },
    });

    res.json({ 
      message: 'Password updated successfully',
      success: true 
    });
  } catch (error) {
    next(error);
  }
});

router.put('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !req.user.id) {
      throw createError('Authentication required', 401);
    }

    const { name, email, avatar } = req.body;
    const updateData: any = {};

    // Validate input - at least one field should be provided
    if (!name && !email && !avatar) {
      throw createError('At least one field (name, email, or avatar) is required', 400);
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      throw createError('User not found', 404);
    }

    // Update name if provided
    if (name) {
      if (name.trim().length < 2) {
        throw createError('Name must be at least 2 characters long', 400);
      }
      updateData.name = name.trim();
    }

    // Update email if provided
    if (email) {
      // Simple email validation
      if (!/\S+@\S+\.\S+/.test(email)) {
        throw createError('Please provide a valid email address', 400);
      }

      // Check if email is already in use by another user
      if (email !== user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email },
        });

        if (existingUser) {
          throw createError('Email is already in use by another account', 400);
        }
      }

      updateData.email = email;
    }

    // Update avatar if provided
    if (avatar) {
      // Basic validation for base64 string
      if (!avatar.startsWith('data:image/')) {
        throw createError('Avatar must be a valid base64 encoded image', 400);
      }
      
      // Check avatar size - limit to reasonable size (e.g., 2MB)
      // Base64 encoding increases size by ~33%, so 2MB is ~1.5MB original
      const base64Data = avatar.split(',')[1];
      if (base64Data && base64Data.length > 2 * 1024 * 1024) {
        throw createError('Avatar image is too large. Maximum size is 2MB.', 400);
      }
      
      updateData.avatar = avatar;
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        pushToken: true,
      },
    });

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/avatar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !req.user.id) {
      throw createError('Authentication required', 401);
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      throw createError('User not found', 404);
    }

    // Update user to remove avatar
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { 
        avatar: null,
        updatedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        pushToken: true,
      },
    });

    res.json({
      message: 'Avatar removed successfully',
      user: updatedUser
    });
  } catch (error) {
    next(error);
  }
});

// Get user profile
const getProfile: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        pushToken: true,
      }
    });

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({ message: 'Profile retrieved successfully', user });
  } catch (error) {
    next(error);
  }
};

router.get('/profile', authenticate, getProfile);

export default router; 