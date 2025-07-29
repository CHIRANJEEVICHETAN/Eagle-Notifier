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
 * Convert database timestamp to IST (Indian Standard Time)
 * Handles timezone conversion consistently across all environments
 * 
 * @param dateString - Timestamp string from database (can be UTC or IST)
 * @returns Date object in IST
 */
export const convertToIST = (dateString: string): Date => {
  try {
    // Check if the string has timezone information (Z, +, -)
    const hasTimezone = dateString.includes('Z') || dateString.includes('+') || dateString.includes('-');
    
    if (hasTimezone) {
      // If it has timezone info, it's likely UTC (from toISOString())
      // Parse as UTC and convert to IST
      const utcDate = new Date(dateString);
      
      if (isNaN(utcDate.getTime())) {
        console.error('Invalid UTC date string:', dateString);
        return new Date();
      }
      
      // Convert UTC to IST by adding 5:30 hours
      const istDate = new Date(utcDate.getTime() + (5 * 60 + 30) * 60 * 1000);
      return istDate;
    } else {
      // If no timezone info, it's likely already in IST format from database
      // Parse it directly as local time (IST)
      const cleanTimestamp = dateString.replace(' ', 'T');
      const istDate = new Date(cleanTimestamp);
      
      if (isNaN(istDate.getTime())) {
        console.error('Invalid IST date string:', dateString);
        return new Date();
      }
      
      return istDate;
    }
  } catch (error) {
    console.error('Error converting to IST:', error, 'Input:', dateString);
    return new Date(); // Return current date as fallback
  }
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
 * Format timestamp in IST as HH:MM:SS AM/PM (12-hour format with seconds)
 * 
 * @param dateString - UTC timestamp string from database
 * @returns Formatted timestamp string in IST with seconds and AM/PM
 */
export const formatTimestampWithSecondsIST = (dateString: string): string => {
  const istDate = convertToIST(dateString);
  // Format directly without timezone specification since we already converted to IST
  let hours = istDate.getHours();
  const minutes = istDate.getMinutes().toString().padStart(2, '0');
  const seconds = istDate.getSeconds().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  // Convert to 12-hour format
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  const formattedHours = hours.toString().padStart(2, '0');
  
  return `${formattedHours}:${minutes}:${seconds} ${ampm}`;
};

/**
 * Format full date and time in IST as "Month Day, Year HH:MM:SS AM/PM"
 * 
 * @param dateString - UTC timestamp string from database
 * @returns Formatted date and time string in IST
 */
export const formatFullDateTimeIST = (dateString: string): string => {
  const istDate = convertToIST(dateString);
  
  // Format date using month name, day, and year
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const month = monthNames[istDate.getMonth()];
  const day = istDate.getDate();
  const year = istDate.getFullYear();
  
  // Format time with seconds
  let hours = istDate.getHours();
  const minutes = istDate.getMinutes().toString().padStart(2, '0');
  const seconds = istDate.getSeconds().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  const formattedHours = hours.toString().padStart(2, '0');
  
  return `${month} ${day}, ${year} ${formattedHours}:${minutes}:${seconds} ${ampm}`;
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
export const debugTimezoneConversion = (dateString: string): void => {
  console.log('=== Timezone Conversion Debug ===');
  console.log('Input string:', dateString);
  console.log('Has timezone info:', dateString.includes('Z') || dateString.includes('+') || dateString.includes('-'));
  
  const date = new Date(dateString);
  console.log('Initial Date object:', date);
  console.log('Initial Hours (local):', date.getHours());
  console.log('Initial Hours (UTC):', date.getUTCHours());
  
  const istDate = convertToIST(dateString);
  console.log('Converted IST Date object:', istDate);
  console.log('IST Hours:', istDate.getHours());
  console.log('IST Minutes:', istDate.getMinutes());
  console.log('IST Seconds:', istDate.getSeconds());
  
  console.log('Formatted Time (24h):', formatTimeIST(dateString));
  console.log('Formatted Time (12h):', formatTimestampIST(dateString));
  console.log('Formatted Full:', formatFullDateTimeIST(dateString));

  // Check for potential timezone offset issues
  const currentIST = new Date();
  const timeDiff = Math.abs(currentIST.getTime() - date.getTime());
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  console.log('Hours difference from current time:', hoursDiff);
  
  console.log('===================================');
}; 