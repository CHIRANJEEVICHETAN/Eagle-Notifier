# Real-Time Analytics Implementation

## Overview
Implemented real-time SCADA data fetching for the analytics page, replacing mock data with live data from the `jk2` table. Updated time filters from hours/days to seconds/minutes to match the 1-second data frequency from SCADA machines.

## Implementation Details

### Backend Changes

#### 1. New Analytics Endpoint (`/api/scada/analytics`)
- **File**: `backend/src/routes/scadaRoutes.ts`
- **Purpose**: Fetch historical SCADA data for analytics charts
- **Parameters**: 
  - `timeFilter`: Supports `10s`, `15s`, `20s`, `1m`, `2m`
- **Response**: Structured data with `analogData`, `binaryData`, and `timeLabels`

#### 2. Analytics Service Function
- **File**: `backend/src/services/scadaService.ts`
- **Function**: `getScadaAnalyticsData(timeFilter: string)`
- **Features**:
  - Parses time filters (seconds/minutes to milliseconds)
  - Queries `jk2` table with time-based filtering
  - Samples data points optimally based on filter duration
  - Formats timestamps according to duration (HH:mm:ss for <1min, HH:mm for >=1min)
  - Maps SCADA fields to chart data structures

#### 3. Data Mapping
- **Analog Data**: Maps SCADA process values (PV) to chart data
  - `hz1pv` → Hardening Zone 1 Temperature
  - `hz2pv` → Hardening Zone 2 Temperature
  - `cppv` → Carbon Potential
  - `oilpv` → Oil Temperature
  - `tz1pv` → Tempering Zone 1 Temperature
  - `tz2pv` → Tempering Zone 2 Temperature

- **Binary Data**: Maps SCADA boolean flags to chart data
  - `oillevelhigh/oillevellow` → Oil Level Alarms
  - `hz1hfail/hz2hfail` → Heater Failures
  - `hardconfail/oilconfail/tempconfail` → Conveyor Failures
  - `hz1fanfail/hz2fanfail/tz1fanfail/tz2fanfail` → Fan Failures

### Frontend Changes

#### 4. Updated Time Filters
- **File**: `app/(dashboard)/analytics/index.tsx`
- **Previous**: `'1h' | '12h' | '24h' | '7d' | 'custom'`
- **Current**: `'10s' | '15s' | '20s' | '1m' | '2m'`
- **Removed**: Custom date picker functionality
- **Default**: `'20s'` (20 seconds)

#### 5. Real-Time Data Hook
- **File**: `app/hooks/useAlarms.ts`
- **Hook**: `useAnalyticsData(timeFilter: string)`
- **Features**:
  - Refetches every 5 seconds for real-time updates
  - Considers data stale after 3 seconds
  - Automatic retry logic with exponential backoff

#### 6. Updated UI Components
- **Loading States**: "Loading real-time data..." message
- **Error Handling**: Improved error states with retry functionality
- **Empty States**: Handles cases where no data is available
- **Header**: Updated subtitle to "Real-time Alarm Trends & Patterns"

## Recent Improvements (Data Fetching & UI Enhancements)

### Backend Enhancements:
- **Better Error Handling**: Added validation for time filter parsing with proper error messages
- **Fallback Data Strategy**: When no data exists in the selected time range, falls back to latest available data
- **Null/Undefined Safety**: Proper handling of null or undefined values in both analog and binary data
- **Enhanced Logging**: Detailed debug information including sample data points and value validation
- **Distinct Colors**: Fixed binary alarm color scheme to ensure each alarm has a unique color

### Frontend Enhancements:
- **Pull-to-Refresh**: Added RefreshControl to ScrollView for manual data refresh
- **Dynamic Y-Axis**: Chart now scales Y-axis based on actual data range with 10% padding
- **Edge Case Handling**: Prevents chart lines from appearing on x-axis by adding value padding
- **Improved Error States**: More specific error messages showing selected time range
- **Better Empty States**: Contextual messages with refresh buttons for better user experience

### Data Quality Improvements:
- **Value Validation**: Backend validates all numeric and boolean values before sending
- **Graceful Degradation**: System handles missing data gracefully without crashes
- **Time Range Validation**: Proper parsing of seconds (s) and minutes (m) filters
- **Debug Information**: Enhanced logging for troubleshooting data availability issues

### Color Scheme Updates:
#### Analog Alarms:
- Hardening Zone 1: Golden Yellow (#FFC107)
- Hardening Zone 2: Orange (#FF9800)
- Carbon Potential: Red (#F44336)
- Oil Temperature: Pink (#E91E63)
- Tempering Zone 1: Light Blue (#2196F3)
- Tempering Zone 2: Teal (#009688)

#### Binary Alarms (All Distinct):
- Oil Level High: Red-Pink (#FF6384)
- Oil Level Low: Light Red-Pink (#FF8C94)
- HZ1 Heater Failure: Blue (#36A2EB)
- HZ2 Heater Failure: Teal (#4BC0C0)
- Hardening Conveyor: Yellow (#FFCE56)
- Oil Conveyor: Purple (#9966FF)
- HZ1 Fan Failure: Orange (#FF9F40)
- HZ2 Fan Failure: Green (#4CAF50)
- Tempering Conveyor: Pink (#E91E63)
- TZ1 Fan Failure: Light Blue (#2196F3)
- TZ2 Fan Failure: Cyan (#00BCD4)

### Affected Components

#### Core Components Modified:
1. **AnalyticsScreen** (`app/(dashboard)/analytics/index.tsx`)
   - Replaced mock data generation with real-time hook
   - Updated time range selector to seconds/minutes
   - Removed custom date functionality
   - Added proper error/loading/empty states
   - Added pull-to-refresh functionality
   - Implemented dynamic Y-axis scaling

2. **useAlarms Hook** (`app/hooks/useAlarms.ts`)
   - Added `useAnalyticsData` hook for real-time fetching
   - 5-second refresh interval for live updates

3. **SCADA Routes** (`backend/src/routes/scadaRoutes.ts`)
   - Added `/analytics` endpoint with time filter support

4. **SCADA Service** (`backend/src/services/scadaService.ts`)
   - Added `getScadaAnalyticsData` function
   - Optimized data sampling based on time range
   - Dynamic time label formatting
   - Fallback data strategy
   - Enhanced error handling and validation

### Styling/Navigation Changes

#### Updated Styles:
- Removed unused custom date container styles
- Added proper retry button styling
- Maintained existing UI/UX design patterns
- Added RefreshControl styling

#### Navigation:
- No navigation changes
- Maintained existing back button functionality
- Kept existing toggle between analog/binary views

### Performance Optimizations

#### Data Sampling:
- **10s filter**: 10 data points
- **15s filter**: 15 data points  
- **20s filter**: 20 data points
- **1m filter**: 20 data points
- **2m filter**: 24 data points

#### Caching Strategy:
- 3-second stale time for rapid updates
- 5-second refetch interval for real-time feel
- Automatic retry with exponential backoff
- Pull-to-refresh for manual updates

#### Query Optimization:
- Time-based WHERE clauses for efficient filtering
- ASC ordering for chronological data
- Proper indexing on `created_timestamp` column
- Fallback queries when no data in time range

## Database Schema Usage

### Primary Table: `jk2`
- **Timestamp**: `created_timestamp` (for time filtering)
- **Analog Values**: `hz1pv`, `hz2pv`, `cppv`, `oilpv`, `tz1pv`, `tz2pv`
- **Binary Values**: `oiltemphigh`, `oillevelhigh`, `oillevellow`, `hz1hfail`, `hz2hfail`, `hardconfail`, `oilconfail`, `hz1fanfail`, `hz2fanfail`, `tempconfail`, `tz1fanfail`, `tz2fanfail`

### Query Pattern:
```sql
SELECT analog_fields, binary_fields, id, created_timestamp
FROM jk2 
WHERE created_timestamp >= $1 AND created_timestamp <= $2
ORDER BY created_timestamp ASC
```

### Fallback Query (when no data in range):
```sql
SELECT analog_fields, binary_fields, id, created_timestamp
FROM jk2
ORDER BY created_timestamp DESC
LIMIT 10
```

## Key Features

### Real-Time Updates:
- Automatic data refresh every 5 seconds
- Live data from SCADA machines
- Proper handling of high-frequency data (1-second intervals)
- Pull-to-refresh functionality for manual updates

### Dynamic Time Filtering:
- Seconds-based filtering for recent data analysis
- Optimized data point sampling
- Context-aware time label formatting
- Fallback to latest data when time range has no data

### Enhanced Error Handling:
- Network failure recovery
- Empty data state handling
- User-friendly error messages with retry options
- Proper null/undefined value handling
- Improved debugging and logging

### Improved Chart Rendering:
- Dynamic Y-axis scaling based on actual data
- 10% padding to prevent lines from touching chart edges
- Distinct colors for all analog and binary alarms
- Better tooltip visibility with edge case handling

### Maintained UI/UX:
- Preserved existing chart interactions
- Kept touch-based tooltips
- Maintained analog/binary view toggle
- Consistent theming and styling
- Pull-to-refresh with loading indicators

## Resolved Issues:
1. **"No Data Available" Problem**: Fixed by adding fallback to latest data when time range is empty
2. **Filter-Specific Data Issues**: Improved time parsing and validation for all filter types
3. **Chart Line Visibility**: Dynamic Y-axis prevents lines from overlapping with x-axis
4. **Color Consistency**: Each alarm now has a distinct, easily identifiable color
5. **Manual Refresh**: Pull-to-refresh provides immediate data updates on demand

## Testing Considerations

### Backend Testing:
- Verify `/api/scada/analytics` endpoint with different time filters
- Test data sampling with various row counts
- Validate time range calculations
- Check proper SCADA database connectivity
- Test fallback data strategy when no data in range

### Frontend Testing:
- Test real-time data updates every 5 seconds
- Verify proper loading/error state transitions
- Test time filter switching
- Validate chart rendering with live data
- Test touch interactions with real data points
- Test pull-to-refresh functionality

### Performance Testing:
- Monitor query performance with time-based filtering
- Verify proper data sampling reduces payload size
- Test memory usage with continuous updates
- Validate network usage with 5-second intervals
- Test chart rendering performance with dynamic scaling

## Migration Notes

### Removed Features:
- Custom date range picker
- Mock data generation (`generateDynamicData` function)
- Date/time picker imports and dependencies
- Manual data refresh functionality (replaced with pull-to-refresh)
- Fixed Y-axis range (replaced with dynamic scaling)

### Added Dependencies:
- Real-time query hook with React Query
- Enhanced error boundary handling
- Automatic retry mechanisms
- RefreshControl component
- Dynamic chart scaling algorithms

This implementation provides a seamless transition from mock data to real-time SCADA data while maintaining the existing user experience and adding enhanced real-time capabilities with improved reliability and user feedback.

## Latest Fixes (Chart Visibility & Performance)

### Line Visibility Issues Fixed:
- **HZ1 Temperature Overlap**: Changed color from Golden Yellow to **Bright Red (#FF1744)** for maximum visibility
- **TZ1 Temperature Invisible**: Changed color from Light Blue to **Bright Green (#00E676)** for high contrast
- **Line Thickness**: Increased from 2px to 3px with shadow effects for better visibility
- **Data Points**: Enlarged from 8px to 10px with border outlines for clarity
- **Y-axis Scaling**: Improved algorithm with minimum 20-unit padding and smart range detection

### Filter Switching Performance:
- **Instant Response**: Reduced stale time from 3000ms to 500ms
- **Cache Invalidation**: Added immediate cache clearing when filter changes
- **Visual Feedback**: Loading indicators on active filter buttons
- **Prevent Double-clicks**: Disabled buttons during loading

### Chart Rendering Improvements:
- **Smart Y-axis**: Handles mixed value ranges (0.31% to 870°C) intelligently
- **Minimum Padding**: Ensures values never appear exactly on chart edges
- **Range Detection**: Adds artificial range for similar values to prevent flat lines
- **Edge Case Handling**: Proper scaling for small data ranges

### Updated Color Scheme (Analog):
- **HZ1 Temperature**: Bright Red (#FF1744) - Maximum visibility
- **HZ2 Temperature**: Bright Orange (#FF9800) - Distinct from HZ1
- **Carbon Potential**: Purple (#9C27B0) - Easily distinguishable 
- **Oil Temperature**: Brown (#795548) - Distinct color
- **TZ1 Temperature**: Bright Green (#00E676) - High contrast with HZ1
- **TZ2 Temperature**: Blue (#2196F3) - Distinct from TZ1

### Specific Data Handling:
- **Temperature Range**: 398°C (TZ) to 870°C (HZ) properly scaled
- **Carbon Potential**: 0.31% no longer appears on x-axis
- **Mixed Units**: Celsius and percentage values displayed with appropriate scaling
- **Real-time Updates**: 5-second refresh maintains with instant filter switching 