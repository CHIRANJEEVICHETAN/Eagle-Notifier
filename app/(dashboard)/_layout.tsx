import React, { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAlarmStore } from '../store/useAlarmStore';
import { useMeterReportStore } from '../store/useMeterReportStore';

export default function DashboardLayout() {
  const { isDarkMode } = useTheme();
  const { organizationId } = useAuth();
  const prevOrgId = useRef<string | null>(null);

  useEffect(() => {
    if (prevOrgId.current && prevOrgId.current !== organizationId) {
      useAlarmStore.getState().resetStore();
      useMeterReportStore.getState().resetStore();
    }
    prevOrgId.current = organizationId;
  }, [organizationId]);

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
      }}>
      <Stack.Screen
        name="screens/admin/index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="screens/admin/meter-limits/index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="screens/admin/meter-limits/[id]"
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
        name="meter-readings/index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="meter-readings/History"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="meter-readings/Reports"
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