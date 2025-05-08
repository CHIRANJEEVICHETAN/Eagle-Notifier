import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../context/ThemeContext';

export default function AuthLayout() {
  const { isDarkMode } = useTheme();
  
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: isDarkMode ? '#111827' : '#FFFFFF',
        },
      }}
    />
  );
} 