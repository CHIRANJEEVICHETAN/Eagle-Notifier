import React, { useEffect } from 'react';
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../global.css';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { NotificationProvider } from './NotificationProvider';

const queryClient = new QueryClient();

// Component that checks auth routes
function AuthRouteChecker({ children }: { children: React.ReactNode }) {
  const { checkAuthRoute } = useAuth();
  
  // Run auth check when component mounts
  useEffect(() => {
    checkAuthRoute();
  }, [checkAuthRoute]);
  
  return <>{children}</>;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  return (
    <>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(dashboard)" options={{ headerShown: false }} />
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
            <NotificationProvider>
              <AuthRouteChecker>
                <RootLayoutNav />
              </AuthRouteChecker>
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
