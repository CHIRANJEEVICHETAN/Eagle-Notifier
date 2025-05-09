import { PrismaClient } from '@prisma/client';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

const prisma = new PrismaClient();
const expo = new Expo();

// Map of severity to notification priority
const PRIORITY_MAP: Record<string, string> = {
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

/**
 * Service for handling notifications
 */
export class NotificationService {
  /**
   * Create a notification for an alarm and send push notifications to relevant users
   */
  static async createAlarmNotification(alarm: any): Promise<void> {
    try {
      // Create notification title and body based on alarm
      const title = `${alarm.severity} Alarm: ${alarm.type}`;
      const body = `${alarm.description} - Value: ${alarm.value}${alarm.unit ? ` ${alarm.unit}` : ''}`;
      
      // Get all users with notification settings
      const users = await prisma.user.findMany({
        include: {
          notificationSettings: true
        }
      });
      
      // Filter users who should receive this notification
      const eligibleUsers = users.filter((user: UserWithSettings) => {
        // Skip users without notification settings
        if (!user.notificationSettings) return false;
        
        // Only send to users with push enabled
        if (!user.notificationSettings.pushEnabled) return false;
        
        // If critical only is enabled, only send critical alarms
        if (user.notificationSettings.criticalOnly && alarm.severity !== 'CRITICAL') return false;
        
        // Check if we're in the mute hours
        if (user.notificationSettings.muteFrom !== null && user.notificationSettings.muteTo !== null) {
          const currentHour = new Date().getHours();
          const muteFrom = user.notificationSettings.muteFrom;
          const muteTo = user.notificationSettings.muteTo;
          
          // Handle different mute hour scenarios
          if (muteFrom < muteTo) {
            // Simple case: e.g., mute from 22:00 to 06:00
            if (currentHour >= muteFrom && currentHour < muteTo) return false;
          } else {
            // Overnight case: e.g., mute from 22:00 to 06:00
            if (currentHour >= muteFrom || currentHour < muteTo) return false;
          }
        }
        
        return true;
      });
      
      // For each eligible user, create a database notification
      for (const user of eligibleUsers) {
        // Create notification in database
        const notification = await prisma.notification.create({
          data: {
            userId: user.id,
            title,
            body,
            type: 'ALARM',
            priority: PRIORITY_MAP[alarm.severity] || 'MEDIUM',
            relatedAlarmId: alarm.id
          }
        });
        
        // Send push notification if token exists and is valid
        if (user.pushToken && Expo.isExpoPushToken(user.pushToken)) {
          // Create message
          const message: ExpoPushMessage = {
            to: user.pushToken,
            sound: alarm.severity === 'CRITICAL' ? 'critical.wav' : 'default',
            title,
            body,
            data: {
              notificationId: notification.id,
              alarmId: alarm.id,
              type: alarm.type,
              severity: alarm.severity
            },
            priority: alarm.severity === 'CRITICAL' ? 'high' : 'normal',
            // Use badge count for iOS
            badge: 1
          };
          
          try {
            // Send notification
            const chunks = expo.chunkPushNotifications([message]);
            for (const chunk of chunks) {
              await expo.sendPushNotificationsAsync(chunk);
            }
          } catch (error) {
            console.error('Error sending push notification:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error creating alarm notification:', error);
    }
  }
  
  /**
   * Get unread notification count for a user
   */
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      return await prisma.notification.count({
        where: {
          userId,
          isRead: false
        }
      });
    } catch (error) {
      console.error('Error getting unread notification count:', error);
      return 0;
    }
  }
  
  /**
   * Helper function to send a batch of push notifications
   */
  static async sendPushNotifications(messages: ExpoPushMessage[]): Promise<void> {
    try {
      // Split messages into chunks
      const chunks = expo.chunkPushNotifications(messages);
      
      // Send each chunk
      for (const chunk of chunks) {
        await expo.sendPushNotificationsAsync(chunk);
      }
    } catch (error) {
      console.error('Error sending push notifications:', error);
    }
  }
} 