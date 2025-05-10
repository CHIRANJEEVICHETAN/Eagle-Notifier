import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

type ThemeType = 'light' | 'dark' | 'system';

interface ThemeContextProps {
  theme: ThemeType;
  isDarkMode: boolean;
  setTheme: (theme: ThemeType) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

const THEME_KEY = 'eagle_theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const colorScheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeType>('system');
  const [isLoading, setIsLoading] = useState(true);
  
  // Load theme from storage on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await SecureStore.getItemAsync(THEME_KEY);
        if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')) {
          setThemeState(savedTheme as ThemeType);
        }
      } catch (error) {
        console.error('Failed to load theme preference', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTheme();
  }, []);
  
  const setTheme = useCallback(async (newTheme: ThemeType) => {
    setThemeState(newTheme);
    try {
      await SecureStore.setItemAsync(THEME_KEY, newTheme);
    } catch (error) {
      console.error('Failed to save theme preference', error);
    }
  }, []);
  
  const isDarkMode = useCallback(() => {
    if (theme === 'system') {
      return colorScheme === 'dark';
    }
    return theme === 'dark';
  }, [theme, colorScheme]);

  const toggleTheme = useCallback(() => {
    const nextTheme: ThemeType = isDarkMode() ? 'light' : 'dark';
    setTheme(nextTheme);
  }, [isDarkMode, setTheme]);

  const value = {
    theme,
    isDarkMode: isDarkMode(),
    setTheme,
    toggleTheme,
  };

  // If still loading theme preference, render nothing or a loading indicator
  if (isLoading) {
    return null; // Or return a loading spinner
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextProps => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}; 