import * as SecureStore from 'expo-secure-store';
import { LoginCredentials, AuthResponse, RegisterData } from '../types/auth';
import { apiConfig } from './config';

// Token storage key
const TOKEN_KEY = 'auth_token';

/**
 * Get auth header with bearer token
 */
export const getAuthHeader = async (): Promise<{ Authorization: string } | {}> => {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch (error) {
    console.error('Error getting auth token:', error);
    return {};
  }
};

/**
 * Save auth token to secure storage
 */
export const saveAuthToken = async (token: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (error) {
    console.error('Error saving auth token:', error);
  }
};

/**
 * Clear auth token from secure storage
 */
export const clearAuthToken = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (error) {
    console.error('Error clearing auth token:', error);
  }
};

/**
 * Get auth and org headers
 */
export const getOrgHeaders = async (organizationId?: string): Promise<{ [key: string]: string }> => {
  try {
  const headers = await getAuthHeader();
  if (organizationId) {
    (headers as any)['x-organization-id'] = organizationId;
    }
    return headers;
  } catch (error) {
    console.error('Error getting auth/org headers:', error);
    return {};
  }
};



/**
 * Login API call
 */
export const loginApi = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  const response = await fetch(`${apiConfig.apiUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Login failed');
  }

  return await response.json();
};

/**
 * Register API call
 */
export const registerApi = async (data: RegisterData): Promise<AuthResponse> => {
  const response = await fetch(`${apiConfig.apiUrl}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Registration failed');
  }

  return await response.json();
}; 