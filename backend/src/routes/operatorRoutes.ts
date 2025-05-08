import express, { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { createError } from '../middleware/errorHandler';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = express.Router();

// Apply authentication and operator authorization to all operator routes
router.use(authenticate);
router.use(authorize(['OPERATOR', 'ADMIN'])); // Allow both operators and admins

/**
 * @route   GET /api/operator/dashboard
 * @desc    Get operator dashboard stats
 * @access  Private (Operator/Admin)
 */
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get active alarms
    const activeAlarms = await prisma.alarm.findMany({
      where: {
        status: 'ACTIVE',
      },
      orderBy: {
        severity: 'desc',
      },
    });
    
    // Get acknowledged alarms for this operator
    const acknowledgedAlarms = await prisma.alarm.findMany({
      where: {
        status: 'ACKNOWLEDGED',
        acknowledgedById: req.user?.id,
      },
      orderBy: {
        acknowledgedAt: 'desc',
      },
    });
    
    // Get alarm counts
    const alarmCounts = {
      active: activeAlarms.length,
      acknowledged: acknowledgedAlarms.length,
      highSeverity: activeAlarms.filter((alarm: any) => alarm.severity === 'CRITICAL').length,
      mediumSeverity: activeAlarms.filter((alarm: any) => alarm.severity === 'WARNING').length,
      lowSeverity: activeAlarms.filter((alarm: any) => alarm.severity === 'INFO').length,
    };
    
    res.json({
      alarmCounts,
      activeAlarms,
      acknowledgedAlarms,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/operator/alarms/assigned
 * @desc    Get alarms assigned to the operator
 * @access  Private (Operator/Admin)
 */
router.get('/alarms/assigned', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const assignedAlarms = await prisma.alarm.findMany({
      where: {
        acknowledgedById: req.user?.id,
      },
      orderBy: {
        acknowledgedAt: 'desc',
      },
    });
    
    res.json(assignedAlarms);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/operator/notes/:alarmId
 * @desc    Add notes to an alarm
 * @access  Private (Operator/Admin)
 */
router.post('/notes/:alarmId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { alarmId } = req.params;
    const { notes } = req.body;
    
    if (!notes) {
      throw createError('Notes are required', 400);
    }
    
    // Check if alarm exists
    const alarm = await prisma.alarm.findUnique({
      where: { id: alarmId },
    });
    
    if (!alarm) {
      throw createError('Alarm not found', 404);
    }
    
    // Update alarm with notes
    const updatedAlarm = await prisma.alarm.update({
      where: { id: alarmId },
      data: {
        notes,
      },
    });
    
    res.json(updatedAlarm);
  } catch (error) {
    next(error);
  }
});

export default router; 