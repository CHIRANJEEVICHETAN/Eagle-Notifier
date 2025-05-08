import express, { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { createError } from '../middleware/errorHandler';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = express.Router();

// Apply authentication middleware to all alarm routes
router.use(authenticate);

/**
 * @route   GET /api/alarms
 * @desc    Get all alarms
 * @access  Private
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alarms = await prisma.alarm.findMany({
      orderBy: {
        timestamp: 'desc',
      },
    });
    
    res.json(alarms);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/alarms/active
 * @desc    Get all active alarms
 * @access  Private
 */
router.get('/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activeAlarms = await prisma.alarm.findMany({
      where: {
        status: 'ACTIVE',
      },
      orderBy: {
        timestamp: 'desc',
      },
    });
    
    res.json(activeAlarms);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/alarms/:id
 * @desc    Get alarm by ID
 * @access  Private
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const alarm = await prisma.alarm.findUnique({
      where: { id },
    });
    
    if (!alarm) {
      throw createError('Alarm not found', 404);
    }
    
    res.json(alarm);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/alarms
 * @desc    Create a new alarm
 * @access  Private (Admin only)
 */
router.post('/', authorize(['ADMIN']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      description,
      type,
      zone,
      severity,
      value,
      setPoint,
      unit,
      lowLimit,
      highLimit,
    } = req.body;
    
    // Validate required fields
    if (!description || !type || !severity || value === undefined || setPoint === undefined) {
      throw createError('Missing required fields', 400);
    }
    
    // Create alarm
    const alarm = await prisma.alarm.create({
      data: {
        description,
        type,
        zone,
        severity,
        value: String(value),
        setPoint: String(setPoint),
        unit,
        lowLimit,
        highLimit,
      },
    });
    
    res.status(201).json(alarm);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/alarms/:id/status
 * @desc    Update alarm status
 * @access  Private
 */
router.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || !['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'].includes(status)) {
      throw createError('Invalid status', 400);
    }
    
    // Get the alarm
    const alarm = await prisma.alarm.findUnique({
      where: { id },
    });
    
    if (!alarm) {
      throw createError('Alarm not found', 404);
    }
    
    // Update alarm status
    const updatedAlarm = await prisma.alarm.update({
      where: { id },
      data: {
        status: status as any,
        ...(status === 'ACKNOWLEDGED' && {
          acknowledgedById: req.user?.id,
          acknowledgedAt: new Date(),
        }),
        ...(status === 'RESOLVED' && {
          resolvedAt: new Date(),
        }),
      },
    });
    
    // Create history entry
    await prisma.alarmHistory.create({
      data: {
        alarmId: id,
        description: alarm.description,
        type: alarm.type,
        severity: alarm.severity,
        status: status as any,
        value: alarm.value,
        setPoint: alarm.setPoint,
        acknowledgedById: status === 'ACKNOWLEDGED' ? req.user?.id : null,
        acknowledgedAt: status === 'ACKNOWLEDGED' ? new Date() : null,
        resolvedAt: status === 'RESOLVED' ? new Date() : null,
      },
    });
    
    res.json(updatedAlarm);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/alarms/history
 * @desc    Get alarm history
 * @access  Private
 */
router.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get query parameters
    const { hours = '24' } = req.query;
    const hoursAgo = parseInt(hours as string, 10) || 24;
    
    // Calculate time threshold
    const timeThreshold = new Date();
    timeThreshold.setHours(timeThreshold.getHours() - hoursAgo);
    
    // Get alarm history
    const history = await prisma.alarmHistory.findMany({
      where: {
        timestamp: {
          gte: timeThreshold,
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });
    
    res.json(history);
  } catch (error) {
    next(error);
  }
});

export default router; 