/**
 * API configuration
 */

// Debug environment variables (remove in production)
console.log('Environment variables check:', {
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_APP_VERSION: process.env.EXPO_PUBLIC_APP_VERSION,
  NODE_ENV: process.env.NODE_ENV,
});

export const apiConfig = {
  // Base URL for API calls - use production URL as fallback instead of local IP
  apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://eagle-notifier-server-eyckc9gmbvf7bqgq.centralindia-01.azurewebsites.net',
  
  // Default request timeout in milliseconds
  timeout: 15000,
  
  // Default headers
  defaultHeaders: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

// Log the final API URL being used
console.log('API Configuration:', {
  apiUrl: apiConfig.apiUrl,
  timeout: apiConfig.timeout,
});

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

export const APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION || '1.1.8';

export const PROJECT_ID = process.env.EXPO_PUBLIC_PROJECT_ID || '72e44855-a2b8-4fb2-bacb-2a39760c6ccd';

export const PUSH_NOTIFICATION_ENDPOINT = process.env.EXPO_PUBLIC_PUSH_NOTIFICATION_ENDPOINT || '/api/notifications/token';

export const SCADA_INTERVAL = process.env.EXPO_PUBLIC_SCADA_INTERVAL || '30000';

export const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';

// Common request timeout in milliseconds
export const REQUEST_TIMEOUT = 30000; 