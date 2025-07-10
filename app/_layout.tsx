import React, { useEffect, useState } from 'react';
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../global.css';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { NotificationProvider } from './NotificationProvider';
import { MaintenanceProvider } from './context/MaintenanceContext';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { UpdateModal } from './components/UpdateModal';

const queryClient = new QueryClient();

// Component that checks auth routes and updates
function AuthRouteChecker({ children }: { children: React.ReactNode }) {
  const { checkAuthRoute } = useAuth();
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Check for updates
  useEffect(() => {
    async function checkForUpdates() {
      try {
        // Only check for updates in production
        if (!__DEV__ && Updates.isEnabled) {
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) {
            setUpdateModalVisible(true);
          }
        }
      } catch (error) {
        console.log('Error checking for updates:', error);
      }
    }

    // Run auth check and update check when component mounts
    checkAuthRoute();
    checkForUpdates();
  }, [checkAuthRoute]);

  const handleUpdate = async () => {
    try {
      setIsDownloading(true);
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (error) {
      console.log('Error fetching or reloading update:', error);
      setIsDownloading(false);
      setUpdateModalVisible(false);
    }
  };
  
  return (
    <>
      {children}
      <UpdateModal
        visible={updateModalVisible}
        isDownloading={isDownloading}
        onUpdate={handleUpdate}
        onCancel={() => setUpdateModalVisible(false)}
      />
    </>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  return (
    <>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(dashboard)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <MaintenanceProvider>
              <NotificationProvider>
                <AuthRouteChecker>
                  <RootLayoutNav />
                </AuthRouteChecker>
              </NotificationProvider>
            </MaintenanceProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
