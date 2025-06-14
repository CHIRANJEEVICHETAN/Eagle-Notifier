import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { router, useSegments } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { User, AuthState, LoginCredentials, AuthResponse } from '../types/auth';
import axios from 'axios';
import { Alert } from 'react-native';
import { apiConfig } from '../api/config';

// Token storage keys
const AUTH_TOKEN_KEY = 'eagle_auth_token';
const REFRESH_TOKEN_KEY = 'eagle_refresh_token';
const USER_KEY = 'eagle_user';
const ONBOARDING_KEY = 'hasSeenOnboarding';
const SELECTED_APP_KEY = 'selected_app_type';

// Add error type to handle different kinds of errors
export type ErrorType = 'error' | 'warning' | 'info';

interface AuthContextProps {
  authState: AuthState;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  updateUser: (userData: Partial<User>) => void;
  checkAuthRoute: () => void;
  hasSeenOnboarding: boolean | null;
  refreshAuthToken: () => Promise<string | null>;
  selectedAppType: string | null;
  setSelectedAppType: (type: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
    errorType: 'error', // Add default error type
  });
  
  // Track if the user has seen onboarding
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  
  // Track selected app type (furnace or meter)
  const [selectedAppType, setSelectedAppTypeState] = useState<string | null>(null);
  
  // Navigation state
  const segments = useSegments();
  const isNavigatingRef = useRef(false);
  
  // Check onboarding status and app type selection
  useEffect(() => {
    const checkUserPreferences = async () => {
      const onboardingValue = await SecureStore.getItemAsync(ONBOARDING_KEY);
      setHasSeenOnboarding(onboardingValue === 'true');
      
      const appType = await SecureStore.getItemAsync(SELECTED_APP_KEY);
      setSelectedAppTypeState(appType);
    };
    checkUserPreferences();
  }, []);

  // Update selected app type
  const setSelectedAppType = async (type: string) => {
    await SecureStore.setItemAsync(SELECTED_APP_KEY, type);
    setSelectedAppTypeState(type);
  };

  // Update user data
  const updateUser = useCallback((userData: Partial<User>) => {
    setAuthState(prev => ({
      ...prev,
      user: prev.user ? { ...prev.user, ...userData } : null,
    }));
  }, []);

  // Safe navigation helper - remove all throttling
  const navigateTo = useCallback((path: string) => {
    router.replace(path as any);
  }, []);

  // Authentication route checking - simplified and updated to include onboarding
  const checkAuthRoute = useCallback(() => {
    const { isAuthenticated, isLoading } = authState;
    
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inDashboardGroup = segments[0] === '(dashboard)';
    const isOnboarding = segments[0] === 'onboarding';

    // If not authenticated, redirect to login
    if (!isAuthenticated && !inAuthGroup) {
      navigateTo('/');
      return;
    }

    // If authenticated but in auth group, always go to onboarding
    if (isAuthenticated && inAuthGroup) {
      navigateTo('/onboarding');
      return;
    }
    
    // If authenticated and on onboarding screen but already selected app type
    if (isAuthenticated && isOnboarding && selectedAppType) {
      routeUserByAppType(selectedAppType);
      return;
    }
  }, [authState.isAuthenticated, authState.isLoading, segments, navigateTo, selectedAppType]);

  // Only check routes on initial load and auth state changes, not on every navigation
  useEffect(() => {
    // Only run on mount and when auth state changes
    if (!authState.isLoading) {
      checkAuthRoute();
    }
  }, [authState.isAuthenticated, authState.isLoading, checkAuthRoute]);

  // Token refresh function
  const refreshAuthToken = async (): Promise<string | null> => {
    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      
      if (!refreshToken) {
        console.log('No refresh token found in storage');
        return null;
      }

      // Call refresh token endpoint
      const response = await axios.post(`${apiConfig.apiUrl}/api/auth/refresh`, {
        refreshToken
      });

      const { token: newToken, refreshToken: newRefreshToken, user } = response.data;
      
      // Save new tokens and user data
      await Promise.all([
        SecureStore.setItemAsync(AUTH_TOKEN_KEY, newToken),
        SecureStore.setItemAsync(REFRESH_TOKEN_KEY, newRefreshToken || refreshToken),
        SecureStore.setItemAsync(USER_KEY, JSON.stringify(user))
      ]);
      
      // Update auth state with new user data
      setAuthState(prev => ({
        ...prev,
        user,
        isAuthenticated: true,
        error: null,
        errorType: 'error'
      }));
      
      // Update axios headers
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      return newToken;
    } catch (error: any) {
      console.error('Token refresh failed:', error);
      
      // Clear auth state and storage on refresh failure
      await Promise.all([
        SecureStore.deleteItemAsync(AUTH_TOKEN_KEY),
        SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.deleteItemAsync(USER_KEY)
      ]);
      
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: 'Session expired. Please log in again.',
        errorType: 'error'
      });
      
      return null;
    }
  };

  // Setup axios interceptor for token handling
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        // Skip token handling for auth endpoints
        const isAuthRequest = 
          originalRequest.url?.includes('/api/auth/login') ||
          originalRequest.url?.includes('/api/auth/register') ||
          originalRequest.url?.includes('/api/auth/refresh');
          
        // If error is 401 (Unauthorized) and not an auth request
        if (error.response?.status === 401 && !isAuthRequest && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            console.log('Attempting to refresh token after 401 error');
            
            // Attempt token refresh
            const newToken = await refreshAuthToken();
            if (newToken) {
              console.log('Token refreshed successfully, retrying request');
              originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
              return axios(originalRequest);
            }
            
            // If token refresh fails, logout and show message
            console.log('Token refresh failed, logging out user');
            await logout();
            
            // Show user-friendly message
            Alert.alert(
              "Session Expired",
              "Your session has expired. Please log in again.",
              [{ text: "OK" }]
            );
          } catch (refreshError: any) {
            console.error('Error during token refresh:', refreshError);
            
            // Handle specific refresh errors
            let errorMessage = 'Your session has expired. Please log in again.';
            
            if (refreshError.response) {
              const status = refreshError.response.status;
              if (status >= 500) {
                errorMessage = 'Server error occurred. Please try again later.';
              }
            } else if (refreshError.code === 'ERR_NETWORK') {
              errorMessage = 'Network error. Please check your connection and try again.';
            }
            
            // Perform logout anyway
            await logout();
            
            // Show appropriate error
            Alert.alert(
              "Authentication Error",
              errorMessage,
              [{ text: "OK" }]
            );
          }
        } else if (error.response) {
          // Handle other common error statuses
          const status = error.response.status;
          
          if (status === 403) {
            console.error('Forbidden access detected in request to:', originalRequest.url);
            
            // Check if user is authenticated but doesn't have permission
            if (authState.isAuthenticated) {
              Alert.alert(
                "Access Denied",
                "You don't have permission to access this resource.",
                [{ text: "OK" }]
              );
            }
          } else if (status === 429) {
            console.error('Rate limit exceeded for request to:', originalRequest.url);
            Alert.alert(
              "Too Many Requests",
              "Please slow down and try again later.",
              [{ text: "OK" }]
            );
          } else if (status >= 500) {
            console.error('Server error in request to:', originalRequest.url);
            // Only show server error alerts for non-background operations
            if (!isAuthRequest && !originalRequest.url?.includes('background')) {
              Alert.alert(
                "Server Error",
                "The server encountered an error. Please try again later.",
                [{ text: "OK" }]
              );
            }
          }
        }
        
        return Promise.reject(error);
      }
    );
    
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [authState.isAuthenticated]); // Add isAuthenticated dependency to re-init interceptor when auth state changes

  // Load user from storage on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
        const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        const userJson = await SecureStore.getItemAsync(USER_KEY);
        const appType = await SecureStore.getItemAsync(SELECTED_APP_KEY);
        
        // Set selected app type
        setSelectedAppTypeState(appType);
        
        if (token && userJson) {
          const user = JSON.parse(userJson) as User;
          
          // Set axios default headers
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          setAuthState({
            user,
            isLoading: false,
            isAuthenticated: true,
            error: null,
            errorType: 'error',
          });
          
          // Try to register push token if we previously failed
          // This handles cases where login succeeded but token registration failed
          const tempPushToken = await SecureStore.getItemAsync('tempPushToken');
          if (tempPushToken) {
            retryPushTokenRegistration(token, tempPushToken, user);
          }
          
          // Always navigate to onboarding after initial app load
          router.replace('/onboarding');
        } else {
          setAuthState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Failed to load user data:', error);
        setAuthState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          error: 'Failed to load user data',
          errorType: 'error',
        });
      }
    };
    
    loadUser();
  }, []);

  // Helper function to retry push token registration
  const retryPushTokenRegistration = async (token: string, pushToken: string, user: User) => {
    console.log('Retrying push token registration on app start');
    
    // Check if token is already registered for this user
    if (user.pushToken === pushToken) {
      console.log('Push token already registered for this user, cleaning up');
      await SecureStore.deleteItemAsync('tempPushToken');
      await SecureStore.setItemAsync('pushTokenRegistered', 'true');
      return;
    }
    
    // Check if we've already tried recently (to avoid frequent retries)
    const lastAttempt = await SecureStore.getItemAsync('lastPushTokenRetry');
    if (lastAttempt) {
      const lastAttemptTime = parseInt(lastAttempt, 10);
      const now = Date.now();
      const timeSinceLastAttempt = now - lastAttemptTime;
      
      // If we tried less than 5 minutes ago, postpone retry
      if (timeSinceLastAttempt < 5 * 60 * 1000) {
        console.log(`Last push token registration attempt was ${Math.floor(timeSinceLastAttempt / 1000)}s ago, postponing retry`);
        return;
      }
    }
    
    // Update last attempt time
    await SecureStore.setItemAsync('lastPushTokenRetry', Date.now().toString());
    
    // Retry push token registration with exponential backoff
    const registerPushToken = async (retryCount = 0, maxRetries = 3): Promise<boolean> => {
      try {
        await axios.put(
          `${apiConfig.apiUrl}/api/notifications/push-token`,
          { pushToken },
          { 
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000 // 10 second timeout
          }
        );
        console.log('Push token registered successfully on retry');
        return true;
      } catch (error: any) {
        console.error(`Error updating push token on retry (attempt ${retryCount + 1}/${maxRetries}):`, error);
        
        // Check if it's a 409 Conflict (token already registered)
        if (error.response?.status === 409) {
          console.log('Push token already registered on server');
          return true; // Consider it a success
        }
        
        // For network errors, retry after a delay with exponential backoff
        if (error.code === 'ERR_NETWORK' && retryCount < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10s delay
          console.log(`Retrying push token registration in ${delay/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return registerPushToken(retryCount + 1, maxRetries);
        }
        
        console.error('Failed to update push token after retries');
        return false;
      }
    };
    
    try {
      const success = await registerPushToken();
      
      if (success) {
        // Update user object with push token
        user.pushToken = pushToken;
        
        // Update in storage
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
        
        // Update in state
        setAuthState(prev => ({
          ...prev,
          user: { ...prev.user!, pushToken }
        }));
        
        // Remove temporary token and update registration flag
        await SecureStore.deleteItemAsync('tempPushToken');
        await SecureStore.setItemAsync('pushTokenRegistered', 'true');
      } else {
        // Keep the token for next app start and update flag
        await SecureStore.setItemAsync('pushTokenRegistered', 'false');
        console.log('Will try to register push token on next app start');
      }
    } catch (error) {
      console.error('Unexpected error during push token retry:', error);
    }
  };

  // Route user based on selected app type
  const routeUserByAppType = (appType: string) => {
    if (appType === 'furnace') {
      router.replace({
        pathname: '/(dashboard)/operator'
      });
    } else if (appType === 'meter') {
      router.replace({
        pathname: '/(dashboard)/meterReadings/index'
      });
    } else {
      // Default to onboarding if app type is invalid
      router.replace('/onboarding');
    }
  };

  // Route user based on role
  const routeUserByRole = (role: string) => {
    // Check if user has selected app type
    if (!selectedAppType) {
      router.replace('/onboarding');
    } else {
      routeUserByAppType(selectedAppType);
    }
  };

  const login = async (credentials: LoginCredentials) => {
    setAuthState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      errorType: 'error',
    }));
    
    try {
      console.log(`Attempting to connect to API at: ${apiConfig.apiUrl}/api/auth/login`);
      
      const response = await axios.post(`${apiConfig.apiUrl}/api/auth/login`, credentials);
      const { user, token, refreshToken } = response.data;
      
      console.log('Login successful - User role:', user.role);
      
      // Set axios default headers
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Save to secure storage
      await Promise.all([
        SecureStore.setItemAsync(AUTH_TOKEN_KEY, token),
        refreshToken ? SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken) : Promise.resolve(),
        SecureStore.setItemAsync(USER_KEY, JSON.stringify(user))
      ]);
      
      // Update auth state
      await new Promise<void>((resolve) => {
        setAuthState({
          user,
          isLoading: false,
          isAuthenticated: true,
          error: null,
          errorType: 'error',
        });
        // Ensure state is updated before proceeding
        setTimeout(resolve, 0);
      });
      
      // Handle push token registration after auth state is updated
      const tempPushToken = await SecureStore.getItemAsync('tempPushToken');
      if (tempPushToken) {
        try {
          const tokenAlreadyRegistered = user.pushToken === tempPushToken;
          if (!tokenAlreadyRegistered) {
            console.log('Getting push token for project ID:', process.env.EXPO_PUBLIC_PROJECT_ID);
            console.log('Push token:', tempPushToken);
            console.log('Updating push token:', tempPushToken);
            
            // Call API to register push token with retry logic
            const registerPushToken = async (retryCount = 0, maxRetries = 3): Promise<boolean> => {
              try {
                await axios.put(
                  `${apiConfig.apiUrl}/api/notifications/push-token`,
                  { pushToken: tempPushToken },
                  { 
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 10000 // 10 second timeout
                  }
                );
                console.log('Push token registered successfully');
                return true;
              } catch (error: any) {
                console.error(`Error updating push token (attempt ${retryCount + 1}/${maxRetries}):`, error);
                
                // For network errors, retry after a delay
                if (error.code === 'ERR_NETWORK' && retryCount < maxRetries) {
                  console.log(`Retrying push token registration in ${(retryCount + 1) * 2}s...`);
                  await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
                  return registerPushToken(retryCount + 1, maxRetries);
                }
                
                // Check if it's a 409 Conflict (token already registered)
                if (error.response?.status === 409) {
                  console.log('Push token already registered on server');
                  return true; // Consider it a success
                }
                
                // For other errors, or if we've exhausted retries
                console.error('Failed to update push token:', error);
                return false;
              }
            };
            
            // Try to register push token with retries
            const registrationSuccess = await registerPushToken();
            
            if (registrationSuccess) {
              // Update user object with push token
              user.pushToken = tempPushToken;
              
              // Store a flag indicating successful registration
              await SecureStore.setItemAsync('pushTokenRegistered', 'true');
              await SecureStore.deleteItemAsync('tempPushToken');
            } else {
              // Store the token for later registration
              console.log('Storing push token for later registration attempt');
              // We'll keep the tempPushToken for later retry
              
              // Store a flag indicating registration is needed
              await SecureStore.setItemAsync('pushTokenRegistered', 'false');
            }
          }
        } catch (pushTokenError) {
          console.error('Push token registration error:', pushTokenError);
        }
      }
      
      // Always navigate to onboarding after login
      router.replace('/onboarding');
      
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Detailed error logging for API connection issues
      if (error.code === 'ERR_NETWORK') {
        console.error('Network error - API server might be down or unreachable');
        console.error(`Attempted to connect to: ${apiConfig.apiUrl}/api/auth/login`);
      }
      
      if (error.response) {
        console.error('Response error:', error.response.status, error.response.data);
      }
      
      // Default error message
      let errorMessage = 'An error occurred while logging in';
      let errorType: ErrorType = 'error';
      
      // User-friendly error messages based on error type
      if (error.response) {
        // Server responded with an error
        const status = error.response.status;
        
        switch (status) {
          case 400:
            errorMessage = 'Please check your login details and try again';
            break;
          case 401:
            // Check for specific error message from server
            if (error.response.data?.error?.message === 'Invalid credentials') {
              errorMessage = 'Your email or password is incorrect. Please try again.';
            } else {
              errorMessage = 'Authentication failed. Please check your credentials.';
            }
            break;
          case 403:
            errorMessage = 'Your account is not authorized to access this application.';
            break;
          case 404:
            errorMessage = 'Login service is currently unavailable. Please try again later.';
            errorType = 'warning';
            break;
          case 422:
            errorMessage = 'Invalid information provided. Please verify your details.';
            break;
          case 429:
            errorMessage = 'Too many login attempts. Please try again later.';
            errorType = 'warning';
            break;
          case 500:
            errorMessage = 'The server encountered an error. Please try again later.';
            errorType = 'warning';
            break;
          case 502:
          case 503:
          case 504:
            errorMessage = 'Service is currently unavailable. Please try again later.';
            errorType = 'warning';
            break;
          default:
            // Try to get error message from response if available
            if (error.response.data?.error?.message) {
              errorMessage = error.response.data.error.message;
            } else if (error.response.data?.message) {
              errorMessage = error.response.data.message;
            }
        }
      } else if (error.request) {
        // Request was made but no response received
        if (error.code === 'ERR_NETWORK') {
          errorMessage = 'Cannot connect to server. Please check your network connection.';
          errorType = 'warning';
        } else if (error.code === 'ECONNABORTED') {
          errorMessage = 'The request timed out. Please try again.';
          errorType = 'warning';
        } else {
          errorMessage = 'No response from server. Please try again later.';
          errorType = 'warning';
        }
      } else {
        // Something happened in setting up the request
        errorMessage = error.message || 'An unexpected error occurred. Please try again.';
      }
      
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: errorMessage,
        errorType: errorType,
      });
    }
  };

  const logout = async () => {
    try {
      setAuthState(prev => ({
        ...prev,
        isLoading: true,
      }));
      
      // Get user's push token from storage or user object
      const user = authState.user;
      const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      const userPushToken = user?.pushToken || await SecureStore.getItemAsync('tempPushToken');
      
      // Unregister push token if available
      if (userPushToken && token) {
        try {
          console.log('Attempting to unregister push token');
          
          // Try to unregister with timeout and retry
          const unregisterPushToken = async (retryCount = 0, maxRetries = 2): Promise<boolean> => {
            try {
              await axios.put(
                `${apiConfig.apiUrl}/api/notifications/push-token`, 
                { pushToken: null },
                { 
                  headers: { Authorization: `Bearer ${token}` },
                  timeout: 5000 // 5 second timeout - faster for logout
                }
              );
              console.log('Push token unregistered successfully');
              return true;
            } catch (error: any) {
              console.error(`Error unregistering push token (attempt ${retryCount + 1}/${maxRetries}):`, error);
              
              // Only retry network errors once with a short delay
              if (error.code === 'ERR_NETWORK' && retryCount < maxRetries) {
                console.log(`Retrying push token unregistration in 1s...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                return unregisterPushToken(retryCount + 1, maxRetries);
              }
              
              return false;
            }
          };
          
          // Try to unregister but don't wait too long
          await Promise.race([
            unregisterPushToken(),
            new Promise<boolean>((resolve) => setTimeout(() => {
              console.log('Push token unregistration timed out globally');
              resolve(false);
            }, 6000)) // Global timeout slightly longer than the axios timeout
          ]);
          
          // Whether success or failure, continue with logout
        } catch (error) {
          console.error('Error unregistering push token:', error);
          // Continue with logout despite errors
        }
      }
      
      // Remove from secure storage
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
      await SecureStore.deleteItemAsync('tempPushToken');
      
      // Keep app selection for next login
      // await SecureStore.deleteItemAsync(SELECTED_APP_KEY);
      
      // Clear axios headers
      delete axios.defaults.headers.common['Authorization'];
      
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
        errorType: 'error',
      });
      
      // Navigation will be handled by checkAuthRoute effect
      // No need to explicitly navigate here
    } catch (error) {
      console.error('Logout error:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to logout',
        errorType: 'error',
      }));
    }
  };

  const clearError = () => {
    setAuthState(prev => ({ ...prev, error: null }));
  };

  return (
    <AuthContext.Provider value={{ 
      authState, 
      login, 
      logout, 
      clearError, 
      updateUser, 
      checkAuthRoute, 
      hasSeenOnboarding, 
      refreshAuthToken,
      selectedAppType,
      setSelectedAppType
    }}>
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