import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../context/ThemeContext';

export default function DashboardLayout() {
  const { isDarkMode } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: isDarkMode ? '#111827' : '#F9FAFB',
        },
        headerTintColor: isDarkMode ? '#F9FAFB' : '#111827',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="screens/admin/index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="screens/admin/users/index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="screens/admin/setpoints/index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="operator/index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="alarms/history"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="alarms/[id]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="analytics/index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="notifications/index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="notifications/settings"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="profile/index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="reports/index"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
} 