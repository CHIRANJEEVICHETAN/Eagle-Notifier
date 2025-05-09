// API Configuration
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api';

export const APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0';

export const PROJECT_ID = process.env.EXPO_PUBLIC_PROJECT_ID || 'your-project-id';

export const PUSH_NOTIFICATION_ENDPOINT = process.env.EXPO_PUBLIC_PUSH_NOTIFICATION_ENDPOINT || 'Push Notification Endpoint';

// Common request timeout in milliseconds
export const REQUEST_TIMEOUT = 30000; 