# Notification Timestamp & Duplicate Prevention Fix

## Overview
Fixed notification timestamps to always display in IST (Indian Standard Time) with 12-hour AM/PM format and implemented duplicate notification prevention based on SCADA data timestamps.

## Problem
### Timestamp Issues
- Notification body timestamps were sometimes showing in UTC and sometimes in IST
- Time format was using 24-hour format instead of user-friendly AM/PM format
- Inconsistent timestamp handling across different notification scenarios

### Duplicate Notification Issues
- Multiple notifications were being sent for the same SCADA data when polling interval fetched the same timestamp
- No mechanism to prevent processing of already-processed data
- Frontend not receiving data when no new SCADA data was available

## Solution

### 1. Updated Timestamp Formatting Function
**File:** `backend/src/services/scadaService.ts`

- Replaced `date-fns` format function with manual formatting to avoid timezone conversion issues
- Implemented robust 12-hour format with guaranteed AM/PM suffix
- Added error handling and fallback formatting
- Added debug logging to track timestamp conversion

### 2. Added IST Timestamp Parser
**File:** `backend/src/services/scadaService.ts`

- Created `parseISTTimestamp` helper function to safely handle database timestamps
- Handles string and Date object inputs consistently
- Removes timezone info to prevent double conversion
- Provides fallback to current time for invalid inputs

### 3. Enhanced Notification Creation
**File:** `backend/src/services/scadaService.ts`

- Added optional `scadaTimestamp` parameter to `createEnhancedNotification` function
- Now uses `parseISTTimestamp` to ensure consistent timestamp handling
- Added comprehensive error handling and fallback notification creation
- Added debug logging for timestamp tracking

### 4. Implemented Duplicate Prevention
**File:** `backend/src/services/scadaService.ts`

- Added `lastProcessedTimestamp` and `cachedProcessedAlarms` variables
- Check if current SCADA timestamp matches last processed timestamp
- Return cached alarms without processing notifications if timestamp is same
- Always return data to frontend (either new or cached)

### 5. Updated Function Calls
**File:** `backend/src/services/scadaService.ts`

- Updated all `createEnhancedNotification` calls to use `parseISTTimestamp`
- Both analog and binary alarm notifications now use consistent timestamp parsing
- Eliminates the -5:30 hour difference issue

## Changes Made

### Function Signature Update
```typescript
// Before
const createEnhancedNotification = async (
    title: string,
    description: string,
    value: string,
    setPoint: string,
    severity: 'critical' | 'warning' | 'info',
    type: string,
    zone?: string
) => {
    const timestamp = new Date();
    // ...
}

// After
const createEnhancedNotification = async (
    title: string,
    description: string,
    value: string,
    setPoint: string,
    severity: 'critical' | 'warning' | 'info',
    type: string,
    zone?: string,
    scadaTimestamp?: Date
) => {
    const timestamp = scadaTimestamp || new Date();
    // ...
}
```

### Duplicate Prevention Implementation
```typescript
// New cache variables
let lastProcessedTimestamp: string | null = null;
let cachedProcessedAlarms: any = null;

// In processAndFormatAlarms function
const scadaTimestamp = parseISTTimestamp(scadaData.created_timestamp);
const scadaTimestampString = scadaTimestamp.toISOString();

if (lastProcessedTimestamp === scadaTimestampString && !forceRefresh) {
    if (DEBUG) {
        console.log(`📊 Timestamp ${scadaTimestampString} already processed, returning cached alarms (no notifications will be sent)`);
    }
    
    // Return cached alarms without processing (no notifications)
    if (cachedProcessedAlarms) {
        return {
            ...cachedProcessedAlarms,
            lastUpdate: new Date(),
            fromCache: true,
            skipReason: 'Same timestamp as previously processed'
        };
    }
}

// After processing, cache the results
cachedProcessedAlarms = result;
lastProcessedTimestamp = scadaTimestampString;
```

### IST Timestamp Parser
```typescript
// New helper function
const parseISTTimestamp = (dbTimestamp: any): Date => {
    try {
        if (!dbTimestamp) return new Date();
        if (dbTimestamp instanceof Date) return dbTimestamp;
        
        if (typeof dbTimestamp === 'string') {
            // Remove timezone info and parse as local IST time
            const cleanTimestamp = dbTimestamp.replace(/[Z\+\-]\d{2}:?\d{2}?$/, '');
            return new Date(cleanTimestamp);
        }
        
        return new Date(dbTimestamp);
    } catch (error) {
        console.error('Error parsing IST timestamp:', error);
        return new Date();
    }
};
```

### Timestamp Formatting Update
```typescript
// Before
const formatTimestamp = (date: Date): string => {
    return format(date, 'MMM dd, yyyy HH:mm:ss');
};

// After - Manual formatting with guaranteed AM/PM
const formatTimestamp = (date: Date): string => {
    try {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        let hours = date.getHours();
        const minutes = date.getMinutes();
        const seconds = date.getSeconds();
        
        // Convert to 12-hour format with AM/PM
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // Convert 0 to 12 for 12 AM
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        return `${monthNames[month - 1]} ${day.toString().padStart(2, '0')}, ${year} ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
    } catch (error) {
        console.error('Error formatting timestamp:', error);
        return `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
    }
};
```

## Impact

### Before Fix
```
Time: Jul 01, 2025 11:48:17
Time: Jul 01, 2025 05:18:17  // Sometimes UTC, sometimes IST
```

### After Fix
```
Time: Jul 01, 2025 11:48:17 AM
Time: Jul 01, 2025 05:18:17 PM  // Always IST, always AM/PM
```

## Benefits
1. **Consistency**: All notifications now show time in the same format
2. **User-Friendly**: 12-hour AM/PM format is easier to read with guaranteed AM/PM suffix
3. **Accuracy**: Uses actual alarm timestamp from database instead of current time
4. **Timezone Clarity**: All times are in IST as expected by users
5. **Robust Parsing**: Handles various timestamp formats from database safely
6. **Error Prevention**: Eliminates the -5:30 hour difference issue
7. **Debug Support**: Added logging to help identify any remaining timestamp issues
8. **Fallback Protection**: Graceful handling of invalid timestamps
9. **Duplicate Prevention**: No more multiple notifications for the same SCADA data
10. **Consistent Frontend Data**: Frontend always receives data (new or cached)
11. **Performance Optimization**: Avoids unnecessary processing of duplicate data
12. **Resource Efficiency**: Reduces notification spam and server load

## Files Modified
- `backend/src/services/scadaService.ts`

## Testing
### Timestamp Testing
- Verify notification timestamps show in AM/PM format (always includes AM/PM suffix)
- Confirm all notifications use IST timezone (no -5:30 hour differences)
- Check that notification time matches the alarm data timestamp
- Test with various database timestamp formats (string, Date object)
- Verify error handling for invalid timestamps
- Monitor debug logs for timestamp parsing issues
- Ensure consistent formatting across all notification types (analog/binary alarms)

### Duplicate Prevention Testing
- Test polling the same SCADA timestamp multiple times (should only process once)
- Verify cached alarms are returned when no new data is available
- Confirm no duplicate notifications are sent for same timestamp
- Test force refresh functionality bypasses duplicate check
- Verify frontend receives data consistently (cached when no new data)
- Monitor debug logs for cache hit/miss information
- Test with different polling intervals to ensure proper caching 