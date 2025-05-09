import * as SecureStore from 'expo-secure-store';

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