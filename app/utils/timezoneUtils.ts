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
  // Format directly without timezone specification since we already converted to IST
  const hours = istDate.getHours().toString().padStart(2, '0');
  const minutes = istDate.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * Format timestamp in IST as HH:MM AM/PM (12-hour format)
 * 
 * @param dateString - UTC timestamp string from database
 * @returns Formatted timestamp string in IST with AM/PM
 */
export const formatTimestampIST = (dateString: string): string => {
  const istDate = convertToIST(dateString);
  // Format directly without timezone specification since we already converted to IST
  let hours = istDate.getHours();
  const minutes = istDate.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  // Convert to 12-hour format
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  const formattedHours = hours.toString().padStart(2, '0');
  
  return `${formattedHours}:${minutes} ${ampm}`;
};

/**
 * Format full date and time in IST
 * 
 * @param dateString - UTC timestamp string from database
 * @returns Formatted date and time string in IST
 */
export const formatFullTimestampIST = (dateString: string): string => {
  const istDate = convertToIST(dateString);
  
  // Format date manually to ensure consistency
  const day = istDate.getDate().toString().padStart(2, '0');
  const month = (istDate.getMonth() + 1).toString().padStart(2, '0');
  const year = istDate.getFullYear();
  const dateStr = `${day}/${month}/${year}`;
  
  // Format time in 12-hour format
  let hours = istDate.getHours();
  const minutes = istDate.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  const formattedHours = hours.toString().padStart(2, '0');
  const timeStr = `${formattedHours}:${minutes} ${ampm}`;
  
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

/**
 * Debug function to test timezone conversion
 * Use this to verify the conversion is working correctly
 */
export const debugTimezoneConversion = (utcDateString: string): void => {
  console.log('=== Timezone Conversion Debug ===');
  console.log('Input UTC string:', utcDateString);
  
  const istDate = convertToIST(utcDateString);
  console.log('Converted IST Date object:', istDate);
  console.log('IST Hours:', istDate.getHours());
  console.log('IST Minutes:', istDate.getMinutes());
  
  console.log('Formatted Time (24h):', formatTimeIST(utcDateString));
  console.log('Formatted Time (12h):', formatTimestampIST(utcDateString));
  console.log('Formatted Full:', formatFullTimestampIST(utcDateString));
  console.log('===================================');
}; 