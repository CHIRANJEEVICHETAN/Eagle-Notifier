import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { User, AuthState, LoginCredentials, AuthResponse } from '../types/auth';

// Mock API call - replace with actual API implementation
const loginApi = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Mock response - replace with actual API call
  if (credentials.email === 'admin@example.com' && credentials.password === 'password') {
    return {
      user: {
        id: '1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      token: 'mock-jwt-token',
    };
  }
  
  if (credentials.email === 'operator@example.com' && credentials.password === 'password') {
    return {
      user: {
        id: '2',
        email: 'operator@example.com',
        name: 'Operator User',
        role: 'operator',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      token: 'mock-jwt-token',
    };
  }
  
  throw new Error('Invalid credentials');
};

interface AuthContextProps {
  authState: AuthState;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

const TOKEN_KEY = 'eagle_auth_token';
const USER_KEY = 'eagle_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  // Load user from storage on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        const userJson = await SecureStore.getItemAsync(USER_KEY);
        
        if (token && userJson) {
          const user = JSON.parse(userJson) as User;
          setAuthState({
            user,
            isLoading: false,
            isAuthenticated: true,
            error: null,
          });
        } else {
          setAuthState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        setAuthState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          error: 'Failed to load user data',
        });
      }
    };
    
    loadUser();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    setAuthState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));
    
    try {
      const { user, token } = await loginApi(credentials);
      
      // Save to secure storage
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      
      setAuthState({
        user,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      });
      
      // Navigate to home
      router.replace('/');
    } catch (error) {
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  };

  const logout = async () => {
    setAuthState(prev => ({
      ...prev,
      isLoading: true,
    }));
    
    try {
      // Remove from secure storage
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
      
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      });
      
      // Navigate to login
      router.replace('/(auth)/login');
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to logout',
      }));
    }
  };

  const clearError = () => {
    setAuthState(prev => ({ ...prev, error: null }));
  };

  return (
    <AuthContext.Provider value={{ authState, login, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextProps => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 