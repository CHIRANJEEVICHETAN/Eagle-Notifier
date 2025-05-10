import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Theme Colors
export const THEME = {
  dark: {
    primary: '#1E3A8A',
    secondary: '#2563EB',
    accent: '#3B82F6',
    background: '#0F172A',
    cardBg: '#1E293B',
    text: {
      primary: '#F8FAFC',
      secondary: '#94A3B8',
      accent: '#60A5FA'
    },
    status: {
      normal: '#1E293B',
      warning: '#B45309',
      critical: '#881337',
      success: '#065F46'
    },
    border: '#334155',
    shadow: 'rgba(0, 0, 0, 0.25)'
  },
  light: {
    primary: '#2563EB',
    secondary: '#3B82F6',
    accent: '#60A5FA',
    background: '#F8FAFC',
    cardBg: '#FFFFFF',
    text: {
      primary: '#1E293B',
      secondary: '#475569',
      accent: '#2563EB'
    },
    status: {
      normal: '#F1F5F9',
      warning: '#FDE68A',
      critical: '#FEE2E2',
      success: '#DCFCE7'
    },
    border: '#E2E8F0',
    shadow: 'rgba(0, 0, 0, 0.1)'
  }
};

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  toggleTheme: () => {},
});

const THEME_KEY = 'eagle_theme_mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');

  useEffect(() => {
    // Load saved theme preference
    const loadTheme = async () => {
      try {
        const savedTheme = await SecureStore.getItemAsync(THEME_KEY);
        if (savedTheme !== null) {
          setIsDarkMode(savedTheme === 'dark');
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      }
    };
    loadTheme();
  }, []);

  useEffect(() => {
    // Sync with system theme changes if no saved preference
    const syncWithSystem = async () => {
      try {
        const savedTheme = await SecureStore.getItemAsync(THEME_KEY);
        if (savedTheme === null && systemColorScheme) {
          setIsDarkMode(systemColorScheme === 'dark');
        }
      } catch (error) {
        console.error('Error syncing theme:', error);
      }
    };
    syncWithSystem();
  }, [systemColorScheme]);

  const toggleTheme = async () => {
    try {
      const newTheme = !isDarkMode;
      setIsDarkMode(newTheme);
      await SecureStore.setItemAsync(THEME_KEY, newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext); 