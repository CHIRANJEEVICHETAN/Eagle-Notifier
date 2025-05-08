import express, { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { createError } from '../middleware/errorHandler';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = express.Router();

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
      },
    });
    
    res.json(users);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/admin/users/:id/role
 * @desc    Update user role (admin only)
 * @access  Private (Admin)
 */
router.patch('/users/:id/role', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    if (!role || !['ADMIN', 'OPERATOR'].includes(role)) {
      throw createError('Invalid role', 400);
    }
    
    const user = await prisma.user.findUnique({
      where: { id },
    });
    
    if (!user) {
      throw createError('User not found', 404);
    }
    
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        role: role as any,
      },
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

export default router; 