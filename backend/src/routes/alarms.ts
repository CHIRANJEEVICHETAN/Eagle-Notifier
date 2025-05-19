import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { PrismaClient } from '../generated/prisma-client';
import { NotificationService } from '../services/notificationService';
import asyncHandler from 'express-async-handler';

const router = Router();
const prisma = new PrismaClient();

/**
 * Endpoint to trigger alarm notification to all users
 */
router.post('/notification', authenticate, asyncHandler(async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    console.error('Error triggering alarm notification:', error);
    res.status(500).json({ 
      message: 'Failed to trigger notification',
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false 
    });
  }
}));

export default router; 