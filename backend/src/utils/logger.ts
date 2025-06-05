// Logger utility for consistent logging throughout the application

/**
 * Log an error with details
 * @param message The error message
 * @param error The error object
 */
export function logError(message: string, error?: any): void {
  console.error(`🔴 ${message}:`, error);
}

/**
 * Log a warning message
 * @param message The warning message
 */
export function logWarning(message: string): void {
  console.warn(`⚠️ ${message}`);
}

/**
 * Log an info message
 * @param message The info message
 */
export function logInfo(message: string): void {
  console.log(`ℹ️ ${message}`);
}

/**
 * Log a debug message (only in development)
 * @param message The debug message
 */
export function logDebug(message: string, data?: any): void {
  if (process.env.NODE_ENV === 'development') {
    if (data) {
      console.log(`🔍 ${message}:`, data);
    } else {
      console.log(`🔍 ${message}`);
    }
  }
}

/**
 * Log a success message
 * @param message The success message
 */
export function logSuccess(message: string): void {
  console.log(`✅ ${message}`);
} 