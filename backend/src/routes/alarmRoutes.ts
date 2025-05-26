import express, { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { createError } from '../middleware/errorHandler';
import { authenticate, authorize } from '../middleware/authMiddleware';
import { Router } from 'express';
import { NotificationService } from '../services/notificationService';

const router = Router();

// Apply authentication middleware to all alarm routes
router.use(authenticate);

/**
 * @route   GET /api/alarms
 * @desc    Get all alarms with user details
 * @access  Private
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alarms = await prisma.alarm.findMany({
      orderBy: {
        timestamp: 'desc',
      },
      include: {
        acknowledgedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    
    res.json(alarms);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/alarms/active
 * @desc    Get all active alarms with user details
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
      include: {
        acknowledgedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
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
    
    // Create notification for new alarm
    await NotificationService.createNotification({
      title: `${alarm.severity} Alarm: ${alarm.description}`,
      body: `${alarm.description} - Value: ${alarm.value}${alarm.unit ? ` ${alarm.unit}` : ''}`,
      severity: alarm.severity,
      type: 'ALARM'
    });
    
    res.status(201).json(alarm);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/alarms/:id/status
 * @desc    Update alarm status with user information
 * @access  Private
 */
router.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, resolutionMessage } = req.body;
    const userId = req.user?.id;
    
    if (!status || !['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'].includes(status)) {
      throw createError('Invalid status', 400);
    }
    
    if (!userId) {
      throw createError('User not authenticated', 401);
    }
    
    // Get the alarm
    const alarm = await prisma.alarm.findUnique({
      where: { id },
      include: {
        acknowledgedBy: true,
        resolvedBy: true,
      },
    });
    
    if (!alarm) {
      throw createError('Alarm not found', 404);
    }
    
    // Validate resolution message when resolving
    if (status === 'RESOLVED' && !resolutionMessage?.trim()) {
      throw createError('Resolution message is required when resolving an alarm', 400);
    }
    
    // Update alarm status with user information
    const updatedAlarm = await prisma.alarm.update({
      where: { id },
      data: {
        status: status as any,
        ...(status === 'ACKNOWLEDGED' && {
          acknowledgedById: userId,
          acknowledgedAt: new Date(),
        }),
        ...(status === 'RESOLVED' && {
          resolvedById: userId,
          resolvedAt: new Date(),
          resolutionMessage: resolutionMessage?.trim(),
        }),
      },
      include: {
        acknowledgedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    
    // Create history entry with user information
    await prisma.alarmHistory.create({
      data: {
        alarmId: id,
        description: alarm.description,
        type: alarm.type,
        severity: alarm.severity,
        status: status as any,
        value: alarm.value,
        setPoint: alarm.setPoint,
        acknowledgedById: status === 'ACKNOWLEDGED' ? userId : alarm.acknowledgedById,
        acknowledgedAt: status === 'ACKNOWLEDGED' ? new Date() : alarm.acknowledgedAt,
        resolvedById: status === 'RESOLVED' ? userId : alarm.resolvedById,
        resolvedAt: status === 'RESOLVED' ? new Date() : alarm.resolvedAt,
        resolutionMessage: status === 'RESOLVED' ? resolutionMessage?.trim() : alarm.resolutionMessage,
      },
    });
    
    // Send notification with user information
    await NotificationService.createNotification({
      title: status === 'RESOLVED' 
        ? `${alarm.description} - Resolved by ${updatedAlarm.resolvedBy?.name}` 
        : `${alarm.severity} Alarm: ${alarm.description}`,
      body: status === 'RESOLVED' && resolutionMessage
        ? `${alarm.description} resolved by ${updatedAlarm.resolvedBy?.name}: ${resolutionMessage}`
        : status === 'ACKNOWLEDGED'
        ? `${alarm.description} acknowledged by ${updatedAlarm.acknowledgedBy?.name}`
        : `${alarm.description} - Value: ${alarm.value}${alarm.unit ? ` ${alarm.unit}` : ''}`,
      severity: alarm.severity,
      type: status === 'RESOLVED' ? 'INFO' : 'ALARM'
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

/**
 * Endpoint to trigger alarm notification to all users
 */
router.post('/notification', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  const {
    type,
    description,
    value,
    unit,
    severity,
    details,
    alarmId
  } = req.body;

  // Construct alarm object for notification service
  const alarm = {
    id: alarmId || `temp-${Date.now()}`,
    type,
    description,
    value: value.toString(),
    unit,
    severity: severity || 'INFO',
    details,
    createdAt: new Date().toISOString()
  };

  // Use notification service to create and send notifications
  await NotificationService.createNotification({
    title: `${alarm.severity} Alarm: ${alarm.description}`,
    body: `${alarm.description} - Value: ${alarm.value}${alarm.unit ? ` ${alarm.unit}` : ''}`,
    severity: alarm.severity,
    type: 'ALARM'
  });

  res.status(200).json({ 
    message: 'Notification has been triggered successfully',
    success: true
  });
});

export default router; 