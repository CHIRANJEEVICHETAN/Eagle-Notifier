# SCADA Maintenance Mode Implementation

**Date:** January 3, 2025  
**Feature:** SCADA Maintenance Mode  
**Files Modified:** Multiple backend and frontend files

## Overview
This feature implements a maintenance mode that allows admins to stop SCADA data fetching while preserving the last known data in the frontend. When maintenance mode is enabled, only SCADA services are stopped - meter-notifier services continue to function normally.

## Key Features

### 🔧 **Admin Control**
- Admins can enable/disable maintenance mode from the Profile section
- Only admin users can toggle maintenance mode
- Proper logging and tracking of maintenance mode changes

### 🛑 **SCADA Service Behavior**
- When maintenance mode is enabled:
  - SCADA data fetching is completely stopped
  - Last cached data is preserved and returned
  - No new SCADA database connections are made
  - Polling intervals are bypassed

### 📱 **Frontend Experience**
- **Operator Dashboard**: Shows maintenance indicator while displaying last known alarm data
- **Meter Readings**: Continue to work normally (only SCADA is disabled)
- **Visual Indicators**: Clear maintenance badges show system status

## Implementation Details

### Backend Changes

#### 1. **Maintenance Controller** (`backend/src/controllers/maintenanceController.ts`)
- Added detailed logging for maintenance mode changes
- Enhanced response with additional metadata
- Added helper function `isMaintenanceModeActive()`

#### 2. **SCADA Service** (`backend/src/services/scadaService.ts`)
- Modified `getLatestScadaData()` to check maintenance mode
- Returns cached data when maintenance is active
- Added maintenance mode flag to alarm response
- Prevents new database connections during maintenance

#### 3. **SCADA Routes** (`backend/src/routes/scadaRoutes.ts`)
- Enhanced logging to include maintenance status
- Response includes maintenance mode information

### Frontend Changes

#### 1. **Type Definitions** (`app/hooks/useAlarms.ts`)
- Updated `ScadaAlarmResponse` interface to include:
  - `maintenanceMode?: boolean`
  - `timestamp?: string`
  - `lastUpdate?: string`
  - `fromCache?: boolean`

#### 2. **Operator Dashboard** (`app/(dashboard)/operator/index.tsx`)
- Added maintenance mode indicators in header and summary section
- Shows "SCADA Maintenance" badge when active
- Displays alert: "SCADA in maintenance mode - showing last known data"
- Preserves all existing functionality while showing maintenance status

## User Experience

### 🎯 **For Admin Users**
1. **Enable Maintenance**: From Profile → Maintenance Mode → Enable
2. **Visual Feedback**: Maintenance indicators appear across the dashboard
3. **SCADA Data**: Stops fetching, shows last known data
4. **Meter Data**: Continues working normally

### 👥 **For Operator Users**
1. **Maintenance Indicators**: Clear visual cues about maintenance status
2. **Data Continuity**: Last known alarm data remains visible
3. **Normal Operations**: Can still view history, reports, and meter readings

## Technical Benefits

### ⚡ **Performance**
- Eliminates SCADA database load during maintenance
- Reduces unnecessary network calls and processing
- Maintains system responsiveness

### 🔒 **Reliability**
- Prevents data corruption during maintenance windows
- Maintains user interface stability
- Graceful degradation of services

### 🛠 **Maintainability**
- Clear separation between SCADA and meter services
- Comprehensive logging for debugging
- Flexible maintenance window management

## Code Examples

### Checking Maintenance Mode in Backend
```typescript
import { isMaintenanceModeActive } from '../controllers/maintenanceController';

const isMaintenanceActive = await isMaintenanceModeActive();
if (isMaintenanceActive && !forceRefresh) {
  // Return cached data, don't fetch new
  return cachedScadaData;
}
```

### Frontend Maintenance Indicator
```typescript
const isScadaMaintenanceMode = useMemo(() => 
  alarmData?.maintenanceMode || false, [alarmData]
);

{isScadaMaintenanceMode && (
  <View style={styles.maintenanceAlert}>
    <Text>SCADA in maintenance mode - showing last known data</Text>
  </View>
)}
```

## Configuration

### Environment Variables
- `SCADA_POLL_INTERVAL`: Controls normal polling frequency
- During maintenance: Polling is completely disabled regardless of interval

### Database Schema
- Uses existing `SystemSettings` table
- `maintenanceMode`: Boolean flag
- `enabledBy`: Admin user who enabled maintenance
- `enabledAt`: Timestamp when maintenance was enabled

## Monitoring and Logging

### Backend Logs
```
🔧 Maintenance mode ENABLED by user Admin User (admin@example.com)
🛑 SCADA data fetching will be STOPPED
📊 Maintenance Mode: true
```

### Frontend Indicators
- Header maintenance badge
- Summary section alert
- Timestamp preservation from last known data

---

This implementation ensures business continuity during maintenance windows while providing clear communication to users about system status. 