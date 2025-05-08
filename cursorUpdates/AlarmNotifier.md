# Eagle Notifier - Alarm Implementation

This document provides details on the implementation of the Eagle Notifier application's alarm system, designed to monitor industrial equipment and notify users of critical conditions.

## Implementation Details

### Frontend Components
- **AlarmCard**: Displays individual alarms with severity-based styling, action buttons for acknowledging/resolving, and detailed information about the alarm condition.
- **AlarmCountSummary**: Shows counts of active alarms grouped by severity with visual indicators for quick assessment of system status.
- **Dashboard**: Main screen displaying active alarms, responsive to different device sizes with pull-to-refresh functionality.

### State Management
- **Zustand Store**: Implemented for efficient alarm state management with actions for updating alarm status.
- **React Query**: Used for data fetching with caching, optimistic updates, and automatic refetching.
- **Context API**: Authentication and theming implemented with React Context.

### API Layer
- **Mock Service Layer**: Temporary mock implementation for alarm data to facilitate development.
- **REST Endpoints**: Designed for fetching active alarms, updating status, and retrieving alarm history.

### Backend Implementation
- **Express Server**: Basic implementation with routes for authentication and alarm management.
- **Prisma Schema**: Complete database schema for users, alarms, and alarm history with appropriate relations.
- **Error Handling**: Centralized error handling middleware for consistent API responses.

### Authentication & Security
- **JWT Authentication**: Token-based authentication for secure API access.
- **Role-Based Access**: Different user roles (operator, maintenance, admin, compliance, iot-manager) with specific permissions.
- **Secure Storage**: User credentials and tokens stored using Expo SecureStore.

### UI/UX Features
- **Theme Support**: Dark/light mode with system preference detection.
- **Responsive Design**: Adapts to different screen sizes using NativeWind (Tailwind CSS for React Native).
- **Status Indicators**: Clear visual differentiation of alarm severity (critical, warning, info).
- **Real-time Updates**: Automatic refresh of alarm data at configurable intervals.

## Affected Components/Hooks
- `app/components/AlarmCard.tsx`
- `app/components/AlarmCountSummary.tsx`
- `app/hooks/useAlarms.ts`
- `app/api/alarmService.ts`
- `app/store/useAlarmStore.ts`
- `app/index.tsx` (Dashboard)
- `app/context/ThemeContext.tsx`
- `app/context/AuthContext.tsx`
- `app/types/alarm.ts`
- `app/types/auth.ts`
- `backend/src/index.ts`
- `backend/prisma/schema.prisma`

## Styling/Navigation Changes
- Used NativeWind for consistent styling across the application.
- Implemented responsive layouts that adapt to different screen sizes.
- Created severity-based color schemes for clear visual differentiation.
- Added proper icons from Ionicons for different alarm types and actions.

## Performance Optimizations
- Memoized calculation of derived values with `useMemo` and callbacks with `useCallback`.
- Implemented optimistic updates for immediate UI feedback when changing alarm status.
- Configured React Query with appropriate caching strategies:
  - More frequent refetching for active alarms (30s)
  - Less frequent for historical data (60s)
  - Stale time thresholds to prevent unnecessary refetches
- Used FlatList with performance optimizations for rendering large alarm lists.

## Next Steps
1. Complete backend integration with Prisma and a PostgreSQL database.
2. Implement additional screens:
   - Alarm details view
   - Alarm history/logs
   - User management (for admins)
3. Add push notifications for new alarms.
4. Implement real-time updates using WebSockets.
5. Add form validation for user inputs.
6. Create comprehensive test suite for components and API endpoints.
7. Add analytics for alarm trends and system performance. 