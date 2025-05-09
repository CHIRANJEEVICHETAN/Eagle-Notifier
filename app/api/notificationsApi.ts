import axios from 'axios';
import { API_URL } from '../api/config';
import { Notification, NotificationResponse, NotificationSettings } from '../types/notification';
import { getAuthHeader } from '../api/auth';

/**
 * Fetch notifications with pagination
 */
export const fetchNotifications = async (
  page: number = 1,
  limit: number = 20,
  filter: 'all' | 'unread' = 'all'
): Promise<NotificationResponse> => {
  try {
    const headers = await getAuthHeader();
    const response = await axios.get(
      `${API_URL}/notifications?page=${page}&limit=${limit}&filter=${filter}`,
      { headers }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
};

/**
 * Mark a notification as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<Notification> => {
  try {
    const headers = await getAuthHeader();
    const response = await axios.patch(
      `${API_URL}/notifications/${notificationId}/read`,
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
export const markAllNotificationsAsRead = async (): Promise<{ message: string }> => {
  try {
    const headers = await getAuthHeader();
    const response = await axios.patch(
      `${API_URL}/notifications/mark-all-read`,
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
export const deleteNotification = async (notificationId: string): Promise<{ message: string }> => {
  try {
    const headers = await getAuthHeader();
    const response = await axios.delete(
      `${API_URL}/notifications/${notificationId}`,
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
  settings: Partial<NotificationSettings>
): Promise<NotificationSettings> => {
  try {
    const headers = await getAuthHeader();
    const response = await axios.put(
      `${API_URL}/notifications/settings`,
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
export const updatePushToken = async (pushToken: string): Promise<{ message: string }> => {
  try {
    const headers = await getAuthHeader();
    const response = await axios.put(
      `${API_URL}/notifications/push-token`,
      { pushToken },
      { headers }
    );
    return response.data;
  } catch (error) {
    console.error('Error updating push token:', error);
    throw error;
  }
};

/**
 * Send test notification (development only)
 */
export const sendTestNotification = async (): Promise<{ message: string; notification: Notification }> => {
  try {
    const headers = await getAuthHeader();
    const response = await axios.post(
      `${API_URL}/notifications/send-test`,
      {},
      { headers }
    );
    return response.data;
  } catch (error) {
    console.error('Error sending test notification:', error);
    throw error;
  }
}; 