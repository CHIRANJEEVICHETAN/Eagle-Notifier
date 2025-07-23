# Meter Readings Feature Implementation

## Overview
Added a new Meter Readings feature to Eagle Notifier that allows users to:
- Monitor electrical parameters in real-time (voltage, current, frequency, power factor, energy, power)
- View historical data through interactive charts with multiple parameters
- View recent readings in a tabular format with limit violation highlighting
- Configure parameter limits and receive notifications when values exceed thresholds (admin only)

## Implementation Details

### Frontend Components

1. **Onboarding Screen** (`app/onboarding.tsx`)
   - Added user selection between "Furnace Notifier" and "Meter Notifier"
   - Stores selection in SecureStore for persistent user preference
   - Visual design matches app theme with light/dark mode support
   - Smooth transition to appropriate dashboard based on selection

2. **Auth Flow** (`app/context/AuthContext.tsx`)
   - Modified authentication flow to check for app type selection
   - Added onboarding step after login if no app type is selected
   - Routes users to appropriate dashboard based on selection
   - Maintains selection across app restarts

3. **Meter Readings Dashboard** (`app/(dashboard)/meter-readings/index.tsx`)
   - Real-time display of electrical parameters in grid layout with parameter-specific icons
   - Multi-parameter chart visualization for historical data with color-coded lines
   - Timeframe selection (1h, 6h, 24h) with active state indication
   - Recent readings table with limit violation highlighting in red
   - Admin-specific parameter configuration options
   - Matching UI patterns from operator dashboard for consistency

4. **Admin Configuration**
   - **Parameter Limits List** (`app/(dashboard)/screens/admin/meter-limits/index.tsx`)
     - Overview of all configurable parameters grouped by category
     - Visual indication of current limits
     - Easy navigation to individual parameter configuration
   
   - **Parameter Limit Editor** (`app/(dashboard)/screens/admin/meter-limits/[id].tsx`)
     - Role-specific access control for admin users
     - Parameter limit configuration interface for high and low thresholds
     - Form validation and error handling
     - Visual feedback during loading/saving

5. **Layout** (`app/(dashboard)/meter-readings/_layout.tsx`)
   - Consistent navigation structure
   - Theme-aware styling
   - Bottom tab navigation matching operator dashboard

### API Integration

1. **Data Hooks** (`app/hooks/useMeterReadings.ts`)
   - Custom React Query hooks for data fetching
   - Stale time configuration for performance optimization
   - Proper error handling and loading states
   - Consistent typing for meter reading and limit data

2. **API Services** (`app/api/meterApi.ts`)
   - Structured API calls for meter data
   - Type definitions for meter readings and limits
   - Error handling and logging

### Backend Components

1. **Meter Routes** (`backend/src/routes/meterRoutes.ts`)
   - Enhanced existing endpoint for receiving meter readings
   - Added `/api/meter/latest` endpoint for fetching most recent reading
   - Added `/api/meter/history` endpoint for historical data with time range filtering
   - Added `/api/meter/limits` endpoints for fetching and updating parameter limits
   - Implemented threshold violation checks with notification triggers

2. **Database Integration**
   - Utilized existing `MeterLimit` model in Prisma schema
   - Migration for adding meter limit table (`20250614085502_meter_readings`)
   - Connected to SCADA database for meter readings data
   - Proper error handling and connection management

3. **Notification System**
   - Integrated with existing notification service for threshold-based alerts
   - Parameter-specific alert messages with relevant context
   - Consistent formatting with other notifications in the app

## Chart Improvements

### Parameter Visualization Enhancements
- Fixed issue with chart lines crossing the y-axis boundary
- Implemented custom scaling for each parameter type to prevent line overlapping:
  - Voltage (typically 120-240V): Scale factor 0.05
  - Current (typically 0-20A): Scale factor 0.5
  - Frequency (typically 50-60Hz): Scale factor 0.15
  - Power Factor (0-1): Scale factor 8
  - Power (kW): Scale factor 1
- Added boundary checks to ensure lines stay within the chart area
- Increased number of y-axis labels for better scale indication
- Improved collision detection for the touch interaction

### Real Data Visualization
- Modified chart to use actual timestamps from API data rather than mock time labels
- Ensured time labels accurately reflect the data points being displayed
- Format time labels appropriately based on selected timeframe:
  - 1-hour view: HH:MM format
  - 6-hour view: HH:MM format
  - 24-hour view: HH:00 format
- Improved x-axis label distribution to prevent overcrowding
- Added validation to prevent drawing invalid line segments

### UI Improvements
- Added 5px padding from y-axis to prevent chart lines from touching the axis
- Enhanced the tooltip positioning to ensure visibility
- Optimized chart rendering for better performance
- Improved visibility of parameter legends and grid lines

## Styling and Theme Integration

- Consistent with existing UI patterns
- Full dark/light mode support with theme-specific colors
- Parameter-specific icons and colors
- Responsive layouts adapting to different screen sizes
- Accessibility considerations (contrast, touch targets)
- Visual feedback for limit violations

## Performance Optimizations

- Query caching and invalidation with React Query
- Stale time configuration to prevent unnecessary refetches
- Background auto-refresh (every 3 minutes) for live data
- Manual refresh control with visual feedback
- Proper client release back to connection pool
- Data structure optimizations for charts
- Efficient rendering of table data with virtualization where needed

## Security Measures

- Role-based access control for admin features
- Proper validation of input parameters
- Error handling to prevent information disclosure
- Authentication token management
- Prevention of unauthorized limit changes

## Navigation Structure

Updated app navigation flow:
- Login → Onboarding (if no selection) → Dashboard (Furnace or Meter based on selection)
- Bottom tab navigation consistent with operator dashboard
- Admin-only screens properly protected with role checks
- Smooth transitions between screens

## Testing

- Tested for proper data rendering and updates
- Verified limit violation highlighting
- Confirmed notification triggering when limits are exceeded
- Validated admin configuration workflow
- Ensured consistent experience across light and dark themes

## Future Enhancements

1. Offline data caching for better performance
2. Customizable dashboard widgets for personalized monitoring
3. Advanced analytics and export options for reporting
4. Customizable notifications preferences per parameter
5. Historical data comparison between time periods
6. Data trend analysis and predictive warnings 