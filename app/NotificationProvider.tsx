import React, { useEffect, useRef, createContext, useContext, useState } from 'react';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { useAuth } from './context/AuthContext';
import { updatePushToken } from './api/notificationsApi';

// Set up notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Define context and types
type NotificationContextType = {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
};

const NotificationContext = createContext<NotificationContextType>({
  expoPushToken: null,
  notification: null,
});

export const useNotification = () => useContext(NotificationContext);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  
  // Use the proper subscription event emitter return type
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const { authState } = useAuth();
  
  // Register for push token when authenticated
  useEffect(() => {
    const registerForPushNotifications = async () => {
      if (authState.isAuthenticated) {
        try {
          // Check for stored temporary token from onboarding
          const tempToken = await SecureStore.getItemAsync('tempPushToken');
          
          if (tempToken) {
            // Send token to backend
            await updatePushToken(tempToken);
            setExpoPushToken(tempToken);
            // Clear temp token after sending
            await SecureStore.deleteItemAsync('tempPushToken');
          } else {
            // If no temp token, get a new one
            const { status } = await Notifications.getPermissionsAsync();
            
            if (status === 'granted') {
              const tokenData = await Notifications.getExpoPushTokenAsync({
                projectId: "72e44855-a2b8-4fb2-bacb-2a39760c6ccd"
              });
              
              // Send token to backend
              await updatePushToken(tokenData.data);
              setExpoPushToken(tokenData.data);
            }
          }
        } catch (error) {
          console.error('Error registering for push notifications:', error);
        }
      }
    };
    
    registerForPushNotifications();
  }, [authState.isAuthenticated]);
  
  // Set up notification listeners
  useEffect(() => {
    // Notification received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received in foreground:', notification);
      setNotification(notification);
    });
    
    // User interacted with notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response received:', response);
      
      // Handle notification response here
      const { data } = response.notification.request.content;
      
      if (data && data.alarmId) {
        // Navigate to alarm details
        // Navigation would be handled by the component using this context
        console.log('Navigate to alarm:', data.alarmId);
      }
    });
    
    // Clean up listeners on unmount
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);
  
  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        notification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
} 