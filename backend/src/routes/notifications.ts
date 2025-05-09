import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../middleware/auth';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

const router = Router();
const prisma = new PrismaClient();
const expo = new Expo();

// Get notifications with pagination
router.get('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const filter = req.query.filter as string || 'all';
    
    // Build filter conditions
    const where: any = { userId };
    if (filter === 'unread') {
      where.isRead = false;
    }
    
    // Get total count for pagination
    const total = await prisma.notification.count({ where });
    
    // Get notifications with pagination
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        relatedAlarm: {
          select: {
            id: true,
            type: true,
            severity: true,
            status: true,
            value: true,
            unit: true,
          }
        }
      }
    });
    
    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;
    
    return res.status(200).json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch notifications',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Mark notification as read
router.patch('/:id/read', verifyToken, async (req: Request, res: Response) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user?.id;
    
    // Check if notification exists and belongs to user
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId }
    });
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    // Update notification
    const updatedNotification = await prisma.notification.update({
      where: { id: notificationId },
      data: { 
        isRead: true,
        readAt: new Date()
      }
    });
    
    return res.status(200).json(updatedNotification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({ 
      message: 'Failed to update notification',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Mark all notifications as read
router.patch('/mark-all-read', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    // Update all unread notifications
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { 
        isRead: true,
        readAt: new Date()
      }
    });
    
    return res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return res.status(500).json({ 
      message: 'Failed to update notifications',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete a notification
router.delete('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user?.id;
    
    // Check if notification exists and belongs to user
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId }
    });
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    // Delete notification
    await prisma.notification.delete({
      where: { id: notificationId }
    });
    
    return res.status(200).json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return res.status(500).json({ 
      message: 'Failed to delete notification',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update notification settings
router.put('/settings', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { 
      pushEnabled, 
      emailEnabled, 
      criticalOnly,
      muteFrom,
      muteTo
    } = req.body;
    
    // Find existing settings
    const existingSettings = await prisma.notificationSettings.findUnique({
      where: { userId }
    });
    
    let settings;
    
    if (existingSettings) {
      // Update existing settings
      settings = await prisma.notificationSettings.update({
        where: { userId },
        data: {
          pushEnabled: pushEnabled !== undefined ? pushEnabled : existingSettings.pushEnabled,
          emailEnabled: emailEnabled !== undefined ? emailEnabled : existingSettings.emailEnabled,
          criticalOnly: criticalOnly !== undefined ? criticalOnly : existingSettings.criticalOnly,
          muteFrom: muteFrom !== undefined ? muteFrom : existingSettings.muteFrom,
          muteTo: muteTo !== undefined ? muteTo : existingSettings.muteTo,
        }
      });
    } else {
      // Create new settings
      settings = await prisma.notificationSettings.create({
        data: {
          userId,
          pushEnabled: pushEnabled !== undefined ? pushEnabled : true,
          emailEnabled: emailEnabled !== undefined ? emailEnabled : false,
          criticalOnly: criticalOnly !== undefined ? criticalOnly : false,
          muteFrom,
          muteTo,
        }
      });
    }
    
    return res.status(200).json(settings);
  } catch (error) {
    console.error('Error updating notification settings:', error);
    return res.status(500).json({ 
      message: 'Failed to update notification settings',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update push token
router.put('/push-token', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { pushToken } = req.body;
    
    if (!pushToken) {
      return res.status(400).json({ message: 'Push token is required' });
    }
    
    // Update user with push token
    await prisma.user.update({
      where: { id: userId },
      data: { pushToken }
    });
    
    return res.status(200).json({ message: 'Push token updated successfully' });
  } catch (error) {
    console.error('Error updating push token:', error);
    return res.status(500).json({ 
      message: 'Failed to update push token',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Send a test notification (dev-only)
router.post('/send-test', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    // Get user with push token
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true, name: true }
    });
    
    if (!user?.pushToken) {
      return res.status(400).json({ message: 'No push token found for user' });
    }
    
    // Create a notification in the database
    const notification = await prisma.notification.create({
      data: {
        userId,
        title: 'Test Notification',
        body: 'This is a test notification',
        type: 'INFO',
        priority: 'MEDIUM',
      }
    });
    
    // Send push notification if token is valid
    if (Expo.isExpoPushToken(user.pushToken)) {
      const messages: ExpoPushMessage[] = [
        {
          to: user.pushToken,
          sound: 'default',
          title: 'Test Notification',
          body: 'This is a test notification',
          data: { notificationId: notification.id },
        }
      ];
      
      const chunks = expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        await expo.sendPushNotificationsAsync(chunk);
      }
    }
    
    return res.status(200).json({ 
      message: 'Test notification sent',
      notification
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    return res.status(500).json({ 
      message: 'Failed to send test notification',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 