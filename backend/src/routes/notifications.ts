import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { getRequestOrgId } from '../middleware/authMiddleware';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { NotificationService } from '../services/notificationService';
import prisma from '../config/db';

const router = Router();
const expo = new Expo();

// Helper to handle Express route handler type issues
type RouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RouteHandler => 
  async (req, res, next): Promise<void> => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };

// Get unread notifications count
router.get('/unread-count', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'User not authenticated' });
    return;
  }
  
  console.log(`📊 Fetching unread count for user: ${userId}`);
  
  // Count unread notifications for the user
  const count = await prisma.notification.count({
    where: { 
      userId,
      isRead: false 
    }
  });
  
  console.log(`📊 Unread count for user ${userId}: ${count}`);
  
  res.status(200).json({ count });
}));

// Get notifications with pagination
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'User not authenticated' });
    return;
  }
  
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;
  const filter = req.query.filter as string || 'all';
  const source = req.query.source as string;
  
  console.log(`🔍 Notifications request - Page: ${page}, Limit: ${limit}, Filter: ${filter}, Source: ${source}, UserId: ${userId}`);
  
  // Debug query to check if there are any meter notifications for this user
  if (source === 'Meter') {
    const debugCount = await prisma.notification.count({
      where: {
        userId,
        title: { contains: 'Meter' }
      }
    });
    console.log(`🔍 DEBUG: Found ${debugCount} meter notifications for user ${userId}`);

    // Use parameterized query to avoid type errors and SQL injection
    const rawQueryResult = await prisma.$queryRaw<
      Array<{ count: number }>
    >`SELECT COUNT(*) FROM "Notification" WHERE title LIKE 'Meter%' and "userId" = 'f0f5cc12-0a48-4436-8784-1f87eb5756b8';`;
    const rawCount = rawQueryResult[0]?.count ?? 0;
    console.log(`🔍 DEBUG: Raw query result: ${rawCount}`);
  }
  
  // Build filter conditions
  const where: any = { userId };
  if (filter === 'unread') {
    where.isRead = false;
  }
  
  // Add source filtering if provided
  if (source === 'Meter') {
    console.log('📱 Applying Meter filter');
    where.title = { contains: 'Meter' };
  } else if (source === 'Furnace') {
    console.log('🔥 Applying Furnace filter');
    where.NOT = { title: { contains: 'Meter' } };
  }
  
  console.log('🔍 Query where clause:', JSON.stringify(where));
  
  // Get total count for pagination
  const total = await prisma.notification.count({ where });
  console.log(`📊 Total matching notifications: ${total}`);
  
  // Get notifications with pagination
  const notifications = await prisma.notification.findMany({
    where: { ...where, organizationId: getRequestOrgId(req) },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit
  });
  
  console.log(`📬 Retrieved notifications: ${notifications.length}`);
  
  // Calculate pagination info
  const totalPages = Math.ceil(total / limit);
  const hasMore = page < totalPages;
  
  res.status(200).json({
    notifications,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore
    }
  });
}));

// Mark notification as read
router.patch('/:id/read', authenticate, asyncHandler(async (req, res) => {
  const notificationId = req.params.id;
  const userId = req.user?.id;
  
  if (!userId) {
    res.status(401).json({ message: 'User not authenticated' });
    return;
  }
  
  // Check if notification exists and belongs to user
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId, organizationId: getRequestOrgId(req) }
  });
  
  if (!notification) {
    res.status(404).json({ message: 'Notification not found' });
    return;
  }
  
  // Update notification
  const updatedNotification = await prisma.notification.update({
    where: { id: notificationId },
    data: { 
      isRead: true,
      readAt: new Date()
    }
  });
  
  res.status(200).json(updatedNotification);
}));

// Mark all notifications as read
router.patch('/mark-all-read', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  
  if (!userId) {
    res.status(401).json({ message: 'User not authenticated' });
    return;
  }
  
  // Update all unread notifications
  await prisma.notification.updateMany({
    where: { userId, isRead: false, organizationId: getRequestOrgId(req) },
    data: { 
      isRead: true,
      readAt: new Date()
    }
  });
  
  res.status(200).json({ message: 'All notifications marked as read' });
}));

// Delete a notification
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const notificationId = req.params.id;
  const userId = req.user?.id;
  
  if (!userId) {
    res.status(401).json({ message: 'User not authenticated' });
    return;
  }
  
  // Check if notification exists and belongs to user
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId, organizationId: getRequestOrgId(req) }
  });
  
  if (!notification) {
    res.status(404).json({ message: 'Notification not found' });
    return;
  }
  
  // Delete notification
  await prisma.notification.delete({
    where: { id: notificationId }
  });
  
  res.status(200).json({ message: 'Notification deleted' });
}));

// Get notification settings
router.get('/settings', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'User not authenticated' });
    return;
  }
  const organizationId = getRequestOrgId(req);
  // Get user's notification settings for this org
  const settings = await prisma.notificationSettings.findUnique({
    where: { userId_organizationId: { userId, organizationId } }
  });
  // If no settings exist, return default settings
  if (!settings) {
    const defaultSettings = {
      pushEnabled: true,
      emailEnabled: false,
      criticalOnly: false,
      muteFrom: null,
      muteTo: null
    };
    res.status(200).json(defaultSettings);
    return;
  }
  res.status(200).json(settings);
}));

// Update notification settings
router.put('/settings', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'User not authenticated' });
    return;
  }
  const organizationId = getRequestOrgId(req);
  const { pushEnabled, emailEnabled, criticalOnly, muteFrom, muteTo } = req.body;
  // Find existing settings
  const existingSettings = await prisma.notificationSettings.findUnique({
    where: { userId_organizationId: { userId, organizationId } }
  });
  let settings;
  if (existingSettings) {
    // Update existing settings
    settings = await prisma.notificationSettings.update({
      where: { userId_organizationId: { userId, organizationId } },
      data: {
        pushEnabled: pushEnabled !== undefined ? pushEnabled : existingSettings.pushEnabled,
        emailEnabled: emailEnabled !== undefined ? emailEnabled : existingSettings.emailEnabled,
        criticalOnly: criticalOnly !== undefined ? criticalOnly : existingSettings.criticalOnly,
        muteFrom: muteFrom !== undefined ? muteFrom : existingSettings.muteFrom,
        muteTo: muteTo !== undefined ? muteTo : existingSettings.muteTo,
      }
    });
  } else {
    // Create new settings with org
    settings = await prisma.notificationSettings.create({
      data: {
        user: { connect: { id: userId } },
        organization: { connect: { id: organizationId } },
        pushEnabled: pushEnabled !== undefined ? pushEnabled : true,
        emailEnabled: emailEnabled !== undefined ? emailEnabled : false,
        criticalOnly: criticalOnly !== undefined ? criticalOnly : false,
        muteFrom,
        muteTo,
      }
    });
  }
  res.status(200).json(settings);
}));

// Update push token
router.put('/push-token', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'User not authenticated' });
    return;
  }
  
  const { pushToken } = req.body;
  
  // Log the request for debugging
  console.log(`Attempting to update push token for user ${userId}:`, pushToken === null ? 'null (unregister request)' : pushToken ? pushToken.substring(0, 10) + '...' : 'undefined');
  
  // Handle special case: null pushToken means user wants to unregister
  if (pushToken === null) {
    try {
      // Remove the push token from the user
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { pushToken: null }
      });
      
      console.log(`Successfully unregistered push token for user ${userId}`);
      
      res.status(200).json({ 
        message: 'Push token unregistered successfully',
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          pushToken: updatedUser.pushToken
        }
      });
      return;
    } catch (error) {
      console.error('Error unregistering push token in database:', error);
      res.status(500).json({ message: 'Failed to unregister push token' });
      return;
    }
  }
  
  // Validate non-null push token (for registration case)
  if (!pushToken) {
    res.status(400).json({ message: 'Push token is required for registration' });
    return;
  }
  
  // Check if token is a valid Expo push token
  if (!Expo.isExpoPushToken(pushToken)) {
    console.warn(`Invalid push token format: ${pushToken.substring(0, 10)}...`);
    res.status(400).json({ message: 'Invalid push token format' });
    return;
  }
  
  // Check if another user already has this token
  try {
    const existingUserWithToken = await prisma.user.findFirst({
      where: { 
        pushToken,
        id: { not: userId } // Not the current user
      }
    });
    
    if (existingUserWithToken) {
      // Token already registered to another user
      console.log(`Push token already registered to another user: ${existingUserWithToken.id}`);
      res.status(409).json({ 
        message: 'Push token already registered to another user',
        conflict: true
      });
      return;
    }
  } catch (dbError) {
    console.error('Database error when checking for existing token:', dbError);
    res.status(500).json({ message: 'Error checking token uniqueness' });
    return;
  }
  
  try {
    // Update user with push token
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { pushToken }
    });
    
    console.log(`Successfully updated push token for user ${userId}`);
    
    res.status(200).json({ 
      message: 'Push token updated successfully',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        pushToken: updatedUser.pushToken
      }
    });
  } catch (error) {
    console.error('Error updating push token in database:', error);
    res.status(500).json({ message: 'Failed to update push token' });
  }
}));

// Send notification to all users
router.post('/send', authenticate, asyncHandler(async (req, res) => {
  const { title, body, severity, type } = req.body;
  
  // Validate input
  if (!title || !body) {
    res.status(400).json({ message: 'Title and body are required' });
    return;
  }
  
  // SUPER_ADMIN users are always excluded from notifications by NotificationService
  // No need to filter here; enforced centrally
  try {
    await NotificationService.createNotification({
      title,
      body,
      severity,
      type,
      organizationId: getRequestOrgId(req)
    });
    
    res.status(200).json({ 
      message: 'Notification sent successfully'
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ message: 'Failed to send notification' });
  }
}));

// Update send-test route to use new notification service
router.post('/send-test', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'User not authenticated' });
    return;
  }
  
  try {
    await NotificationService.createNotification({
      title: 'Test Notification',
      body: 'This is a test notification',
      type: 'INFO',
      severity: 'INFO',
      organizationId: getRequestOrgId(req)
    });
    
    res.status(200).json({ 
      message: 'Test notification sent successfully'
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ message: 'Failed to send test notification' });
  }
}));

export default router; 