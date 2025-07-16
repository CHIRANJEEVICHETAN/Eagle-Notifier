import axios from 'axios';
import { apiConfig } from './config';
import { Notification, NotificationResponse, NotificationSettings } from '../types/notification';
import { getAuthHeader, getOrgHeaders } from './auth';

/**
 * Fetch notifications with pagination
 */
export const fetchNotifications = async (
  page: number = 1,
  limit: number = 20,
  filter: 'all' | 'unread' = 'all',
  source?: string,
  organizationId?: string
): Promise<NotificationResponse> => {
  try {
    const headers = await getOrgHeaders(organizationId);
    let url = `${apiConfig.apiUrl}/api/notifications?page=${page}&limit=${limit}&filter=${filter}`;
    
    // Add source parameter if provided
    if (source) {
      url += `&source=${source}`;
    }
    
    const response = await axios.get(url, { headers });
    return response.data;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
};

/**
 * Mark a notification as read
 */
export const markNotificationAsRead = async (notificationId: string, organizationId?: string): Promise<Notification> => {
  try {
    const headers = await getOrgHeaders(organizationId);
    const response = await axios.patch(
      `${apiConfig.apiUrl}/api/notifications/${notificationId}/read`,
      {},
      { headers }
    );
    return response.data;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async (organizationId?: string): Promise<{ message: string }> => {
  try {
    const headers = await getOrgHeaders(organizationId);
    const response = await axios.patch(
      `${apiConfig.apiUrl}/api/notifications/mark-all-read`,
      {},
      { headers }
    );
    return response.data;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (notificationId: string, organizationId?: string): Promise<{ message: string }> => {
  try {
    const headers = await getOrgHeaders(organizationId);
    const response = await axios.delete(
      `${apiConfig.apiUrl}/api/notifications/${notificationId}`,
      { headers }
    );
    return response.data;
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

/**
 * Update notification settings
 */
export const updateNotificationSettings = async (
  settings: Partial<NotificationSettings>,
  organizationId?: string
): Promise<NotificationSettings> => {
  try {
    const headers = await getOrgHeaders(organizationId);
    const response = await axios.put(
      `${apiConfig.apiUrl}/api/notifications/settings`,
      settings,
      { headers }
    );
    return response.data;
  } catch (error) {
    console.error('Error updating notification settings:', error);
    throw error;
  }
};

/**
 * Update push token
 */
export const updatePushToken = async (pushToken: string, organizationId?: string): Promise<{ message: string }> => {
  try {
    const headers = await getOrgHeaders(organizationId);
    
    // Check if API URL is configured properly
    if (!apiConfig.apiUrl) {
      console.warn('API URL not configured properly');
      return { message: 'API configuration missing' };
    }
    
    // Set timeout to prevent hanging requests
    const response = await axios.put(
      `${apiConfig.apiUrl}/api/notifications/push-token`,
      { pushToken },
      { 
        headers,
        timeout: 10000 // 10 second timeout
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error updating push token:', error);
    
    // Return a friendly message instead of throwing
    return { 
      message: 'Failed to update push token. Will retry later.' 
    };
  }
};

/**
 * Send test notification (development only)
 */
export const sendTestNotification = async (organizationId?: string): Promise<{ message: string; notification: Notification }> => {
  try {
    const headers = await getOrgHeaders(organizationId);
    const response = await axios.post(
      `${apiConfig.apiUrl}/api/notifications/send-test`,
      {},
      { headers }
    );
    return response.data;
  } catch (error) {
    console.error('Error sending test notification:', error);
    throw error;
  }
};

/**
 * Fetch unread notification count
 */
export const fetchUnreadCount = async (organizationId?: string): Promise<number> => {
  try {
    const headers = await getOrgHeaders(organizationId);
    const response = await axios.get(
      `${apiConfig.apiUrl}/api/notifications/unread-count`,
      { headers }
    );
    
    console.log('📊 Unread count response:', response.data);
    return response.data.count;
  } catch (error) {
    console.error('❌ Error fetching unread count:', error);
    return 0; // Default to 0 on error
  }
}; 