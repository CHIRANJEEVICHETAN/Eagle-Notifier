/**
 * API configuration
 */
export const apiConfig = {
  // Base URL for API calls
  apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://172.27.0.1:3000',
  
  // Default request timeout in milliseconds
  timeout: 15000,
  
  // Default headers
  defaultHeaders: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

/**
 * Error handler for API calls
 */
export const handleApiError = (error: any): string => {
  if (error.response) {
    // Server responded with a status code outside the 2xx range
    if (error.response.data && error.response.data.message) {
      return error.response.data.message;
    }
    return `Server error: ${error.response.status}`;
  } else if (error.request) {
    // The request was made but no response was received
    return 'Network error. Please check your connection.';
  } else {
    // Something happened in setting up the request
    return error.message || 'An unknown error occurred';
  }
};

export const APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0';

export const PROJECT_ID = process.env.EXPO_PUBLIC_PROJECT_ID || 'your-project-id';

export const PUSH_NOTIFICATION_ENDPOINT = process.env.EXPO_PUBLIC_PUSH_NOTIFICATION_ENDPOINT || 'Push Notification Endpoint';

// Common request timeout in milliseconds
export const REQUEST_TIMEOUT = 30000; 