import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import prisma from '../config/db';

const expo = new Expo();

// Define NotificationPriority type to match what Prisma expects
type NotificationPriority = 'HIGH' | 'MEDIUM' | 'LOW';

// Map of severity to notification priority
const PRIORITY_MAP: Record<string, NotificationPriority> = {
  'CRITICAL': 'HIGH',
  'WARNING': 'MEDIUM',
  'INFO': 'LOW'
};

// User type with notification settings
type UserWithSettings = {
  id: string;
  pushToken: string | null;
  notificationSettings: {
    pushEnabled: boolean;
    criticalOnly: boolean;
    muteFrom: number | null;
    muteTo: number | null;
  } | null;
};

interface CreateNotificationParams {
  title: string;
  body: string;
  severity?: 'CRITICAL' | 'WARNING' | 'INFO';
  type?: 'ALARM' | 'SYSTEM' | 'MAINTENANCE' | 'INFO';
  metadata?: Record<string, unknown>;
}

// Helper function for database operations with retry
async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;
      console.error(`Database operation failed (attempt ${attempt}/${maxRetries}):`, error);
      
      // If this is a connection error, wait before retrying
      if (error instanceof Error && 
          (error.message?.includes('connection') || 
           error.message?.includes('Too many database connections'))) {
        const delay = Math.min(100 * Math.pow(2, attempt), 1000); // Exponential backoff capped at 1 second
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Non-connection error, don't retry
        break;
      }
    }
  }
  
  throw lastError;
}

/**
 * Service for handling notifications
 */
export class NotificationService {
  /**
   * Create and send notifications to all eligible users
   */
  static async createNotification(data: CreateNotificationParams): Promise<void> {
    try {
      console.log('🔔 Creating notification:', {
        title: data.title,
        body: data.body,
        severity: data.severity || 'INFO',
        type: data.type || 'INFO',
        metadata: data.metadata
      });
      
      // Get all users with notification settings and push tokens with retry logic
      const users = await withRetry(() => prisma.user.findMany({
        where: {
          pushToken: { not: null } // Only get users with push tokens
        },
        include: {
          notificationSettings: true
        }
      }));
      
      console.log(`📱 Found ${users.length} users with push tokens`);
      
      // Filter users who should receive this notification
      const eligibleUsers = users.filter((user: UserWithSettings) => {
        if (!user.notificationSettings) {
          console.log(`ℹ️ User ${user.id} has no notification settings, using defaults`);
          // Use default settings
          return true;
        }
        if (!user.notificationSettings.pushEnabled) {
          console.log(`🔕 User ${user.id} has disabled push notifications`);
          return false;
        }
        if (user.notificationSettings.criticalOnly && data.severity !== 'CRITICAL') {
          console.log(`⚡ User ${user.id} only wants critical notifications`);
          return false;
        }
        
        // Check mute hours
        if (user.notificationSettings.muteFrom !== null && user.notificationSettings.muteTo !== null) {
          const currentHour = new Date().getHours();
          const muteFrom = user.notificationSettings.muteFrom;
          const muteTo = user.notificationSettings.muteTo;
          
          if (muteFrom < muteTo) {
            if (currentHour >= muteFrom && currentHour < muteTo) {
              console.log(`🌙 User ${user.id} has muted notifications for current hour`);
              return false;
            }
          } else {
            if (currentHour >= muteFrom || currentHour < muteTo) {
              console.log(`🌙 User ${user.id} has muted notifications for current hour`);
              return false;
            }
          }
        }
        
        return true;
      });
      
      console.log(`✅ Found ${eligibleUsers.length} eligible users for notification`);
      
      // Prepare messages for batch sending
      const messages: ExpoPushMessage[] = [];
      
      // For each eligible user, create a notification and prepare push message
      for (const user of eligibleUsers) {
        try {
          // Create notification in database with retry logic
          const notification = await withRetry(() => prisma.notification.create({
            data: {
              userId: user.id,
              title: data.title,
              body: data.body,
              type: data.type || 'INFO',
              priority: PRIORITY_MAP[data.severity || 'INFO']
            }
          }));
          
          console.log(`📝 Created notification in database for user ${user.id}`);
          
          // Add push message to batch if token exists and is valid
          if (user.pushToken && Expo.isExpoPushToken(user.pushToken)) {
            messages.push({
              to: user.pushToken,
              sound: data.severity === 'CRITICAL' ? 'critical.wav' : 'default',
              title: data.title,
              body: data.body,
              data: { 
                notificationId: notification.id,
                type: data.type,
                severity: data.severity
              },
              priority: data.severity === 'CRITICAL' ? 'high' : 'normal',
              badge: 1
            });
            console.log(`📬 Prepared push message for user ${user.id}`);
          }
        } catch (error) {
          console.error(`❌ Error creating notification for user ${user.id}:`, error);
        }
      }
      
      // Send push notifications in batches
      if (messages.length > 0) {
        try {
          console.log(`🚀 Sending ${messages.length} push notifications...`);
          const chunks = expo.chunkPushNotifications(messages);
          
          for (const chunk of chunks) {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            console.log('📨 Push notification result:', ticketChunk);
          }
          
          console.log('✅ Successfully sent all push notifications');
        } catch (error) {
          console.error('❌ Error sending push notifications:', error);
        }
      } else {
        console.log('ℹ️ No push notifications to send');
      }
      
    } catch (error) {
      console.error('❌ Error in createNotification:', error);
    }
  }
  
  /**
   * Get unread notification count for a user
   */
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      return await withRetry(() => prisma.notification.count({
        where: {
          userId,
          isRead: false
        }
      }));
    } catch (error) {
      console.error('Error getting unread notification count:', error);
      return 0;
    }
  }
} 