import express, { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import prisma from '../config/db';
import { createError } from '../middleware/errorHandler';

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, role = 'OPERATOR' } = req.body;
    
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
    if (role !== 'OPERATOR' && role !== 'ADMIN') {
      throw createError('Invalid role', 400);
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
      },
    });
    
    // Generate JWT
    if (!process.env.JWT_SECRET) {
      throw createError('JWT_SECRET environment variable is required', 500);
    }
    
    const expiresIn = process.env.JWT_EXPIRES_IN || '1d';
    
    // @ts-ignore - Bypassing type checking for JWT sign
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn }
    );
    
    // Return user info (except password) and token
    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    
    // Validate inputs
    if (!email || !password) {
      throw createError('Please provide email and password', 400);
    }
    
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });
    
    if (!user) {
      throw createError('Invalid credentials', 401);
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      throw createError('Invalid credentials', 401);
    }
    
    // Generate JWT
    if (!process.env.JWT_SECRET) {
      throw createError('JWT_SECRET environment variable is required', 500);
    }
    
    const expiresIn = process.env.JWT_EXPIRES_IN || '1d';
    
    // @ts-ignore
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn }
    );
    
    // Return user info (except password) and token
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
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
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    next(error);
  }
});

export default router; 