import express, { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import bcrypt from 'bcryptjs'; // Added for password hashing
import { createError } from '../middleware/errorHandler';
import { authenticate, authorize } from '../middleware/authMiddleware';
import { Router } from 'express';

const router = Router();

// Apply authentication and admin-only authorization to all admin routes
router.use(authenticate);
router.use(authorize(['ADMIN']));

/**
 * @route   GET /api/admin/users
 * @desc    Get all users (admin only)
 * @access  Private (Admin)
 */
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        // Add other non-sensitive fields if needed by the frontend
      },
      orderBy: {
        createdAt: 'desc', // Optional: order by creation date
      }
    });
    
    res.json(users);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/admin/users
 * @desc    Create a new user (admin only)
 * @access  Private (Admin)
 */
router.post('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      throw createError('Please provide name, email, password, and role', 400);
    }

    if (!['ADMIN', 'OPERATOR'].includes(role)) {
      throw createError('Invalid role specified', 400);
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw createError('User with this email already exists', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role as any, // Prisma expects enum type
      },
      select: { // Return created user without password
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(201).json(newUser);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Update user details (admin only)
 * @access  Private (Admin)
 */
router.put('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, email, role, password } = req.body;

    // Validate inputs
    if (!name && !email && !role && !password) {
      throw createError('No update data provided', 400);
    }
    if (role && !['ADMIN', 'OPERATOR'].includes(role)) {
      throw createError('Invalid role specified', 400);
    }

    const userToUpdate = await prisma.user.findUnique({
      where: { id },
    });

    if (!userToUpdate) {
      throw createError('User not found', 404);
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== userToUpdate.email) {
      const existingUserWithNewEmail = await prisma.user.findUnique({
        where: { email },
      });
      if (existingUserWithNewEmail) {
        throw createError('Email already in use by another account', 400);
      }
    }

    const dataToUpdate: any = {};
    if (name) dataToUpdate.name = name;
    if (email) dataToUpdate.email = email;
    if (role) dataToUpdate.role = role;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      dataToUpdate.password = await bcrypt.hash(password, salt);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete a user (admin only)
 * @access  Private (Admin)
 */
router.delete('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const userToDelete = await prisma.user.findUnique({
      where: { id },
    });

    if (!userToDelete) {
      throw createError('User not found', 404);
    }

    // Add any necessary checks before deletion, e.g., cannot delete the last admin, etc.
    if (userToDelete.role === 'ADMIN' && userToDelete.email === req.user?.email) {
      throw createError('Cannot delete your own admin account', 400);
    }

    await prisma.user.delete({
      where: { id },
    });

    res.status(204).send(); // No content, successful deletion
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/admin/dashboard
 * @desc    Get admin dashboard stats
 * @access  Private (Admin)
 */
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get counts of alarms by status
    const alarmCounts = await prisma.$transaction([
      prisma.alarm.count({ where: { status: 'ACTIVE' } }),
      prisma.alarm.count({ where: { status: 'ACKNOWLEDGED' } }),
      prisma.alarm.count({ where: { status: 'RESOLVED' } }),
    ]);
    
    // Get count of users by role
    const userCounts = await prisma.$transaction([
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.user.count({ where: { role: 'OPERATOR' } }),
    ]);
    
    // Get recent alarms
    const recentAlarms = await prisma.alarm.findMany({
      orderBy: { timestamp: 'desc' },
      take: 5,
    });
    
    res.json({
      alarmStats: {
        active: alarmCounts[0],
        acknowledged: alarmCounts[1],
        resolved: alarmCounts[2],
        total: alarmCounts.reduce((a: number, b: number) => a + b, 0),
      },
      userStats: {
        admins: userCounts[0],
        operators: userCounts[1],
        total: userCounts.reduce((a: number, b: number) => a + b, 0),
      },
      recentAlarms,
    });
  } catch (error) {
    next(error);
  }
});

// Get all setpoint configurations
router.get('/setpoints', async (req, res) => {
  try {
    const setpoints = await prisma.setpoint.findMany();
    res.json(setpoints);
  } catch (error) {
    console.error('Error fetching setpoints:', error);
    res.status(500).json({ error: 'Failed to fetch setpoints' });
  }
});

// Create a new setpoint configuration
router.post('/setpoints', async (req, res) => {
  try {
    const { name, type, zone, scadaField, lowDeviation, highDeviation } = req.body;
    
    const setpoint = await prisma.setpoint.create({
      data: {
        name,
        type,
        zone,
        scadaField,
        lowDeviation: parseFloat(lowDeviation),
        highDeviation: parseFloat(highDeviation)
      }
    });
    
    res.json(setpoint);
  } catch (error) {
    console.error('Error creating setpoint:', error);
    res.status(500).json({ error: 'Failed to create setpoint' });
  }
});

// Update a setpoint configuration
router.put('/setpoints/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { lowDeviation, highDeviation } = req.body;
    
    const setpoint = await prisma.setpoint.update({
      where: { id },
      data: {
        lowDeviation: parseFloat(lowDeviation),
        highDeviation: parseFloat(highDeviation)
      }
    });
    
    res.json(setpoint);
  } catch (error) {
    console.error('Error updating setpoint:', error);
    res.status(500).json({ error: 'Failed to update setpoint' });
  }
});

export default router; 