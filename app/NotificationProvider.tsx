import React, { useEffect, useRef, createContext, useContext, useState } from 'react';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from './context/AuthContext';
import { updatePushToken } from './api/notificationsApi';
import { PROJECT_ID } from './api/config';

// Set up notification handler with non-deprecated properties
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Define context and types
type NotificationContextType = {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  notificationCount: number;
  setNotificationCount: React.Dispatch<React.SetStateAction<number>>;
  handleNotification: (notification: Notifications.Notification) => void;
};

const NotificationContext = createContext<NotificationContextType>({
  expoPushToken: null,
  notification: null,
  notificationCount: 0,
  setNotificationCount: () => {},
  handleNotification: () => {},
});

export const useNotification = () => useContext(NotificationContext);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const { authState } = useAuth();
  
  // Use the proper subscription event emitter return type
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const tokenRetryCount = useRef<number>(0);
  
  // Register for push token when authenticated
  useEffect(() => {
    if (!authState.isAuthenticated || !authState.user) {
      setExpoPushToken(null);
      setNotification(null);
      setNotificationCount(0);
      return;
    }
    const registerForPushNotifications = async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
          console.log('Notification permission not granted');
          return;
        }
        // Get Expo push token for this device
        const projectId = PROJECT_ID;
        if (!projectId) {
          console.error('Project ID is not configured in environment');
          return;
        }
        console.log(`Getting push token for project ID: ${projectId}`);
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        const token = tokenData.data;
        console.log(`Push token: ${token}`);
        setExpoPushToken(token);
        // Store token locally for future use
        await SecureStore.setItemAsync('tempPushToken', token);
      } catch (error) {
        console.error('Error getting push token:', error);
      }
    };
    registerForPushNotifications();
  }, [authState.isAuthenticated, authState.user]);

  // Set up notification listeners only if authenticated
  useEffect(() => {
    if (!authState.isAuthenticated || !authState.user) return;
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received in foreground:', notification);
      setNotification(notification);
      handleNotification(notification);
    });
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response received:', response);
      const data = response.notification.request.content.data;
      if (data && data.alarmId) {
        console.log('Navigate to alarm:', data.alarmId);
      }
    });
    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, [authState.isAuthenticated, authState.user]);

  const handleNotification = (notification: Notifications.Notification) => {
    console.log('Received notification:', {
      ...notification,
      request: {
        ...notification.request,
        content: {
          ...notification.request.content,
          data: notification.request.content.data || {}
        }
      }
    });
    setNotification(notification);
    setNotificationCount(prev => prev + 1);
  };

  // Update token on server with retry mechanism only if authenticated
  useEffect(() => {
    const updateToken = async () => {
      if (authState.isAuthenticated && authState.user && expoPushToken) {
        console.log('Updating push token:', expoPushToken);
        try {
          const result = await updatePushToken(expoPushToken);
          if (result.message === 'Failed to update push token. Will retry later.') {
            if (tokenRetryCount.current < 3) {
              tokenRetryCount.current++;
              console.log(`Token update failed, will retry later. Attempt ${tokenRetryCount.current}/3`);
              const retryDelay = Math.min(1000 * Math.pow(2, tokenRetryCount.current), 30000);
              setTimeout(updateToken, retryDelay);
            } else {
              console.log('Max token update retries reached. Giving up for now.');
              setTimeout(() => { tokenRetryCount.current = 0; }, 60000);
            }
          } else {
            tokenRetryCount.current = 0;
            console.log('Push token updated successfully');
          }
        } catch (error) {
          console.error('Failed to update push token:', error);
        }
      }
    };
    if (authState.isAuthenticated && authState.user) {
      updateToken();
    }
  }, [authState.isAuthenticated, authState.user, expoPushToken]);

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        notification,
        notificationCount,
        setNotificationCount,
        handleNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// Add default export for the NotificationProvider component
export default NotificationProvider; 