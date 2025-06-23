/**
 * Timezone Utility Functions
 * 
 * This module provides consistent timezone conversion functions for converting
 * UTC timestamps from the database to Indian Standard Time (IST, UTC+5:30).
 * 
 * The database stores all timestamps in UTC format, and these functions ensure
 * proper conversion to IST regardless of the environment (development/production).
 */

/**
 * Convert UTC timestamp to IST (Indian Standard Time)
 * Handles timezone conversion consistently across all environments
 * 
 * @param utcDateString - UTC timestamp string from database
 * @returns Date object in IST
 */
export const convertToIST = (utcDateString: string): Date => {
  // Ensure the string is treated as UTC by formatting it properly
  let utcString = utcDateString;
  
  // If no timezone info is present, treat as UTC
  if (!utcString.includes('Z') && !utcString.includes('+') && !utcString.includes('-')) {
    // Convert space to 'T' for ISO format and append 'Z' for UTC
    utcString = utcString.replace(' ', 'T') + 'Z';
  }
  
  const utcDate = new Date(utcString);
  
  // Validate the date
  if (isNaN(utcDate.getTime())) {
    console.error('Invalid date string:', utcDateString);
    return new Date(); // Return current date as fallback
  }
  
  // Add 5 hours and 30 minutes for IST (UTC+5:30)
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  return new Date(utcDate.getTime() + istOffsetMs);
};

/**
 * Format time in IST as HH:MM (24-hour format)
 * 
 * @param dateString - UTC timestamp string from database
 * @returns Formatted time string in IST
 */
export const formatTimeIST = (dateString: string): string => {
  const istDate = convertToIST(dateString);
  return istDate.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    timeZone: 'UTC' // We already converted to IST, so display as UTC to avoid double conversion
  });
};

/**
 * Format timestamp in IST as HH:MM AM/PM (12-hour format)
 * 
 * @param dateString - UTC timestamp string from database
 * @returns Formatted timestamp string in IST with AM/PM
 */
export const formatTimestampIST = (dateString: string): string => {
  const istDate = convertToIST(dateString);
  return istDate.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true,
    timeZone: 'UTC' // We already converted to IST, so display as UTC to avoid double conversion
  });
};

/**
 * Format full date and time in IST
 * 
 * @param dateString - UTC timestamp string from database
 * @returns Formatted date and time string in IST
 */
export const formatFullTimestampIST = (dateString: string): string => {
  const istDate = convertToIST(dateString);
  const dateStr = istDate.toLocaleDateString('en-IN', {
    timeZone: 'UTC', // We already converted to IST
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const timeStr = istDate.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true,
    timeZone: 'UTC' // We already converted to IST
  });
  return `${dateStr} ${timeStr}`;
};

/**
 * Format date for chart labels based on timeframe
 * 
 * @param dateString - UTC timestamp string from database
 * @param timeframe - Time range (1, 6, 24 hours)
 * @returns Formatted label for charts
 */
export const formatChartLabelIST = (dateString: string, timeframe: number): string => {
  const istDate = convertToIST(dateString);
  
  if (timeframe === 1 || timeframe === 6) {
    // For 1-hour and 6-hour, show HH:MM
    const hours = istDate.getHours().toString().padStart(2, '0');
    const minutes = istDate.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } else {
    // For 24-hour, show HH:00 format
    const hours = istDate.getHours().toString().padStart(2, '0');
    return `${hours}h`;
  }
};

/**
 * Get current IST time
 * 
 * @returns Current date and time in IST
 */
export const getCurrentIST = (): Date => {
  const now = new Date();
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  return new Date(now.getTime() + istOffsetMs);
}; 