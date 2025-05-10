import { Alert } from 'react-native';
import axios, { AxiosError } from 'axios';

/**
 * Type definitions for error handling
 */
export type ErrorType = 
  | 'network'
  | 'auth'
  | 'server'
  | 'validation'
  | 'client'
  | 'unknown';

/**
 * Determine the type of error based on the axios error
 */
export const getErrorType = (error: any): ErrorType => {
  if (!error) return 'unknown';
  
  if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
    return 'network';
  }
  
  if (error.response) {
    const status = error.response.status;
    
    if (status === 401 || status === 403) {
      return 'auth';
    }
    
    if (status >= 500) {
      return 'server';
    }
    
    if (status === 400 || status === 422) {
      return 'validation';
    }
    
    return 'client';
  }
  
  return 'unknown';
};

/**
 * Get user-friendly error message based on the error
 */
export const getUserFriendlyErrorMessage = (error: any): string => {
  if (!error) return 'An unknown error occurred';
  
  // If error is AxiosError
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    
    // Handle network errors
    if (axiosError.code === 'ERR_NETWORK') {
      return 'Cannot connect to server. Please check your network connection.';
    }
    
    if (axiosError.code === 'ECONNABORTED') {
      return 'The request timed out. Please try again.';
    }
    
    // Handle response errors
    if (axiosError.response) {
      const status = axiosError.response.status;
      const data = axiosError.response.data as any;
      
      // Try to get specific error message from response
      const serverErrorMessage = data?.error?.message || data?.message;
      
      switch (status) {
        case 400:
          return serverErrorMessage || 'Invalid request. Please check your input.';
        case 401:
          if (serverErrorMessage === 'Invalid credentials') {
            return 'Your email or password is incorrect. Please try again.';
          }
          return 'Authentication required. Please log in again.';
        case 403:
          return 'You don\'t have permission to access this resource.';
        case 404:
          return 'The requested resource was not found.';
        case 422:
          return serverErrorMessage || 'Invalid information provided. Please verify your details.';
        case 429:
          return 'Too many requests. Please try again later.';
        case 500:
        case 502:
        case 503:
        case 504:
          return 'The server encountered an error. Please try again later.';
        default:
          return serverErrorMessage || `Error ${status}: Please try again later.`;
      }
    }
    
    // Handle request errors (no response)
    if (axiosError.request) {
      return 'No response from server. Please try again later.';
    }
  }
  
  // Handle general errors
  return error.message || 'An unexpected error occurred. Please try again.';
};

/**
 * Show an alert with error message
 */
export const showErrorAlert = (
  error: any, 
  title = 'Error', 
  defaultMessage = 'An error occurred'
): void => {
  const message = getUserFriendlyErrorMessage(error) || defaultMessage;
  
  Alert.alert(
    title,
    message,
    [{ text: 'OK' }]
  );
};

/**
 * Log error with consistent formatting
 */
export const logError = (
  context: string,
  error: any,
  additionalInfo: Record<string, any> = {}
): void => {
  console.error(`[${context}] Error:`, error);
  
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    if (axiosError.response) {
      console.error(`[${context}] Response status:`, axiosError.response.status);
      console.error(`[${context}] Response data:`, axiosError.response.data);
    }
    if (axiosError.config) {
      console.error(`[${context}] Request URL:`, axiosError.config.url);
      console.error(`[${context}] Request method:`, axiosError.config.method);
    }
  }
  
  if (Object.keys(additionalInfo).length > 0) {
    console.error(`[${context}] Additional info:`, additionalInfo);
  }
}; 