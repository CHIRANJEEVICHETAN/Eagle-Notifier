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
        
        // Token will be updated by the other useEffect that watches for 
        // expoPushToken and authState.user changes
      } catch (error) {
        console.error('Error getting push token:', error);
        // We'll try again when component remounts or auth state changes
      }
    };
    
    registerForPushNotifications();
  }, []);
  
  // Set up notification listeners
  useEffect(() => {
    // Notification received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received in foreground:', notification);
      setNotification(notification);
      handleNotification(notification);
    });
    
    // User interacted with notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response received:', response);
      
      // Handle notification response here
      // Use data property instead of deprecated dataString
      const data = response.notification.request.content.data;
      
      if (data && data.alarmId) {
        // Navigate to alarm details
        // Navigation would be handled by the component using this context
        console.log('Navigate to alarm:', data.alarmId);
      }
    });
    
    // Clean up listeners on unmount
    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);
  
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

  // Update token on server with retry mechanism
  useEffect(() => {
    const updateToken = async () => {
      if (authState.user && expoPushToken) {
        console.log('Updating push token:', expoPushToken);
        try {
          const result = await updatePushToken(expoPushToken);
          
          if (result.message === 'Failed to update push token. Will retry later.') {
            // Only retry a limited number of times to avoid infinite loops
            if (tokenRetryCount.current < 3) {
              tokenRetryCount.current++;
              console.log(`Token update failed, will retry later. Attempt ${tokenRetryCount.current}/3`);
              
              // Set a retry timer after exponential backoff
              const retryDelay = Math.min(1000 * Math.pow(2, tokenRetryCount.current), 30000);
              setTimeout(updateToken, retryDelay);
            } else {
              console.log('Max token update retries reached. Giving up for now.');
              // Reset counter for future attempts when app state changes
              setTimeout(() => {
                tokenRetryCount.current = 0;
              }, 60000); // Reset after 1 minute
            }
          } else {
            // Success - reset retry counter
            tokenRetryCount.current = 0;
            console.log('Push token updated successfully');
          }
        } catch (error) {
          console.error('Failed to update push token:', error);
        }
      }
    };
    
    updateToken();
  }, [authState.user, expoPushToken]);

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