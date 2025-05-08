import { Request, Response, NextFunction } from 'express';

// Define an interface for API errors
export interface ApiError extends Error {
  statusCode?: number;
  details?: any;
}

/**
 * Global error handler middleware
 * This will catch any errors thrown in the application and return a formatted response
 */
export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log the error for debugging
  console.error(`[ERROR] ${err.message}`);
  console.error(err.stack);
  
  // Set default status code to 500 (Internal Server Error) if not specified
  const statusCode = err.statusCode || 500;
  
  // Create the error response
  const errorResponse = {
    error: {
      message: err.message || 'An unexpected error occurred',
      // Only include stack trace in development
      ...(process.env.NODE_ENV !== 'production' && { 
        stack: err.stack,
        details: err.details 
      }),
    },
  };
  
  // Send the response
  res.status(statusCode).json(errorResponse);
};

/**
 * Error creator utility to easily create and throw API errors
 */
export const createError = (message: string, statusCode: number, details?: any): ApiError => {
  const error: ApiError = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}; 