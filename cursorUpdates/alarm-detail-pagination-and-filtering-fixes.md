# Alarm Detail Screen Pagination and Filtering Fixes

## Overview
This update addresses critical issues with the alarm detail screen including broken pagination, inefficient backend search, incorrect time filtering, and wrong time format display. Additionally, it includes custom date range filtering improvements with proper validation and ascending/descending sort functionality.

## Issues Fixed

### 1. **Pagination Issues**
- **Problem**: FlashList was not implementing proper pagination, showing only limited data regardless of filter
- **Solution**: Implemented infinite query with proper pagination using `useInfiniteQuery`
- **Impact**: Users can now load all historical data progressively

### 2. **Time Filtering Problems**
- **Problem**: Custom date range filtering was not working properly, showing only current day data
- **Solution**: Fixed backend time filtering logic and improved date parameter handling with proper endTime support
- **Impact**: Users can now properly filter alarm history by custom date ranges and predefined time periods

### 3. **Search Performance Issues**
- **Problem**: Every character typed triggered backend API calls, causing poor performance
- **Solution**: Moved search functionality to frontend, filtering already loaded data
- **Impact**: Instant search results with no network overhead

### 4. **Time Format Inconsistency**
- **Problem**: Times were displayed in 24-hour format without AM/PM
- **Solution**: Changed all time displays to 12-hour format with AM/PM
- **Impact**: More user-friendly time display throughout the application

### 5. **Incorrect Count Display**
- **Problem**: Value history count showed pagination total instead of actual alarm instances
- **Solution**: Calculate count from actual filtered alarm instances
- **Impact**: Accurate count display for specific alarm instances

### 6. **Custom Date Range Issues** ⭐ NEW
- **Problem**: Custom date filtering wasn't working, no validation for invalid date ranges
- **Solution**: Added proper endTime parameter support, date range validation, and auto-correction
- **Impact**: Users can now use custom date ranges with proper error handling and validation

### 7. **Missing Sort Functionality** ⭐ NEW
- **Problem**: No way to sort alarm history by ascending or descending order
- **Solution**: Added frontend sort controls (Newest First/Oldest First) that work on already fetched data
- **Impact**: Users can now sort alarm history without additional backend calls

## Technical Changes

### Frontend Changes

#### 1. **useAlarms.ts Hook Updates**
```typescript
// Added endTime parameter support
export interface AlarmHistoryParams {
  // ... existing parameters
  endTime?: string;  // NEW: End time for custom date ranges
}

// Updated useInfiniteQuery to handle endTime
export function useSpecificAlarmHistory(alarmId: string, params: Partial<AlarmHistoryParams> = {}) {
  const { limit = 50, status, hours, startTime, endTime, timeFilter } = params;
  
  return useInfiniteQuery({
    queryKey: ALARM_KEYS.alarmHistory({ alarmId, status, hours, startTime, endTime, timeFilter }),
    queryFn: async ({ pageParam = 1 }) => {
      // ... existing logic
      if (endTime) urlParams.append('endTime', endTime);
    },
    // ... rest of configuration
  });
}
```

#### 2. **Alarm Detail Screen ([id].tsx) Updates**
- **Custom Date Range Validation**: Added comprehensive validation for date ranges
- **Sort Functionality**: Implemented frontend sort controls (Newest First/Oldest First)
- **Error Handling**: Added error messages and auto-correction for invalid date ranges
- **Enhanced Time Filtering**: Proper startTime and endTime parameter handling

```typescript
// NEW: Sort order type and state
type SortOrder = 'desc' | 'asc';
const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
const [dateRangeError, setDateRangeError] = useState<string | null>(null);

// NEW: Date range validation
const validateDateRange = useCallback(() => {
  if (timeFilter === 'custom') {
    if (endDate <= startDate) {
      setDateRangeError('End date must be after start date');
      return false;
    }
    
    // Check if date range is too large (more than 90 days)
    const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 90) {
      setDateRangeError('Date range cannot exceed 90 days');
      return false;
    }
    
    setDateRangeError(null);
    return true;
  }
  return true;
}, [timeFilter, startDate, endDate]);

// NEW: Enhanced date parameter handling
const { startTimeParam, endTimeParam } = useMemo(() => {
  if (timeFilter === 'custom' && validateDateRange()) {
    return {
      startTimeParam: startDate.toISOString(),
      endTimeParam: endDate.toISOString()
    };
  }
  return {
    startTimeParam: undefined,
    endTimeParam: undefined
  };
}, [timeFilter, startDate, endDate, validateDateRange]);

// NEW: Frontend sort implementation
const alarmHistoryItems = useMemo(() => {
  // ... existing filtering logic
  
  // Apply frontend sort order
  const sortedItems = filteredItems.sort((a, b) => {
    const aTime = new Date(a.timestamp).getTime();
    const bTime = new Date(b.timestamp).getTime();
    
    return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
  });
  
  return sortedItems;
}, [specificAlarmData, alarmId, searchQuery, sortOrder]);
```

#### 3. **New UI Components**
- **Sort Controls**: Added "Newest First" and "Oldest First" buttons
- **Error Display**: Date range error messages with auto-correction button
- **Enhanced Validation**: Real-time validation as users change dates

```typescript
// NEW: Sort filter buttons
const renderSortFilters = () => {
  const filters: { label: string; value: SortOrder }[] = [
    { label: 'Newest First', value: 'desc' },
    { label: 'Oldest First', value: 'asc' },
  ];
  
  return (
    <View style={styles.filtersRow}>
      {filters.map((filter) => (
        <TouchableOpacity
          key={filter.value}
          style={[
            styles.filterButton,
            sortOrder === filter.value && styles.filterButtonActive,
            { backgroundColor: isDarkMode 
                ? sortOrder === filter.value ? '#10B981' : '#374151'
                : sortOrder === filter.value ? '#059669' : '#F3F4F6'
            }
          ]}
          onPress={() => handleSortOrderChange(filter.value)}
        >
          <Text style={[styles.filterButtonText, { /* styling */ }]}>
            {filter.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};
```

### Backend Changes

#### 1. **Enhanced SCADA Service**
```typescript
// Updated function signature to include endTime
export const getScadaAlarmHistory = async (
  page = 1, 
  limit = 20, 
  statusFilter = 'all',
  timeFilter?: number,
  searchQuery?: string,
  sortBy = 'timestamp',
  sortOrder = 'desc',
  alarmType?: string,
  alarmId?: string,
  startTime?: string,  
  endTime?: string     // NEW: End time parameter
) => {
  // ... existing logic
  
  // NEW: Enhanced time filtering with both start and end times
  if (startTime && endTime) {
    // Use specific date range if both start and end times are provided
    whereClause += whereClause ? " AND " : " WHERE ";
    whereClause += "created_timestamp >= $" + (params.length + 1) + " AND created_timestamp <= $" + (params.length + 2);
    params.push(new Date(startTime));
    params.push(new Date(endTime));
    
    if (DEBUG) {
      console.log(`Using custom date range filter: ${startTime} to ${endTime}`);
    }
  } else if (startTime) {
    // Backward compatibility: use only start time
    whereClause += whereClause ? " AND " : " WHERE ";
    whereClause += "created_timestamp >= $" + (params.length + 1);
    params.push(new Date(startTime));
  }
  // ... rest of the logic
};
```

#### 2. **Route Updates**
```typescript
// Updated route to handle endTime parameter
const endTime = req.query.endTime as string;

const alarmHistory = await getScadaAlarmHistory(
  page, limit, statusFilter, timeFilter, searchQuery,
  sortBy, sortOrder, alarmType, alarmId, startTime, endTime
);
```

## Performance Improvements

### 1. **Frontend Sort Performance**
- Sort operations happen on already loaded data (no backend calls)
- Instant switching between ascending and descending order
- Maintains sort preference during pagination

### 2. **Enhanced Date Filtering**
- Proper date range filtering with both start and end times
- Validation prevents unnecessary backend calls with invalid ranges
- Auto-correction feature improves user experience

### 3. **Better Error Handling**
- Real-time validation prevents invalid API calls
- User-friendly error messages with actionable solutions
- Automatic date range correction for edge cases

## User Interface Updates

### 1. **Sort Controls** ⭐ NEW
- Green-colored sort buttons (distinct from time filters)
- "Newest First" and "Oldest First" options
- Instant sorting without loading delays

### 2. **Date Range Validation** ⭐ NEW
- Error messages for invalid date ranges
- Auto-correction button for quick fixes
- Real-time validation as users change dates
- Maximum 90-day range limit with clear messaging

### 3. **Enhanced Visual Feedback**
- Loading states for pagination
- Error states for invalid date ranges
- Clear visual distinction between different filter types

## Edge Cases Handled

### 1. **Date Range Validation**
- **End before Start**: Shows error and provides auto-correction
- **Range Too Large**: Limits to 90 days with clear message
- **Invalid Dates**: Graceful handling with fallback to default ranges

### 2. **Auto-Correction Logic**
- When end date is before start date, automatically sets end date to start date + 1 hour
- Preserves user's time selections while fixing the range
- Clears error messages after correction

### 3. **Backend Compatibility**
- Maintains backward compatibility with existing API
- Graceful degradation when endTime is not provided
- Proper parameter validation and error handling

## Components Affected

1. **app/hooks/useAlarms.ts** ⭐ UPDATED
   - Added `endTime` parameter to `AlarmHistoryParams`
   - Updated query key to include endTime
   - Enhanced URL parameter handling

2. **app/(dashboard)/alarms/[id].tsx** ⭐ MAJOR UPDATES
   - Added sort order state and controls
   - Implemented date range validation
   - Added error handling and auto-correction
   - Enhanced time filtering with proper endTime support
   - Added new UI components for sort and error display

3. **backend/src/services/scadaService.ts** ⭐ UPDATED
   - Added endTime parameter support
   - Enhanced time filtering logic with date range support
   - Improved debugging and logging

4. **backend/src/routes/scadaRoutes.ts** ⭐ UPDATED
   - Added endTime parameter handling
   - Enhanced query parameter logging

## Testing Considerations

### 1. **Date Range Testing** ⭐ NEW
- Test custom date ranges work correctly with both start and end times
- Verify validation catches invalid ranges (end before start, too large)
- Test auto-correction functionality
- Check 90-day limit enforcement

### 2. **Sort Functionality Testing** ⭐ NEW
- Verify ascending and descending sort work correctly
- Test sort persistence during pagination
- Ensure sort happens on frontend (no additional API calls)
- Check sort performance with large datasets

### 3. **Edge Case Testing** ⭐ NEW
- Test with invalid date selections
- Verify auto-correction behavior
- Test maximum date range limits
- Check error message display and clearing

### 4. **Integration Testing**
- Test combination of filters (status + time + sort)
- Verify pagination works with custom date ranges
- Test search functionality with sorted results

## Future Enhancements

1. **Advanced Date Controls**: Calendar popup for easier date selection
2. **Preset Date Ranges**: Quick buttons for "Last Week", "Last Month", etc.
3. **Sort by Value**: Allow sorting by alarm values instead of just time
4. **Export Filtered Data**: Export functionality for current filtered results
5. **Saved Filter Presets**: Allow users to save and reuse filter combinations

## Migration Notes

- **Breaking Changes**: None - all changes are backward compatible
- **Data Migration**: Not required - changes are frontend/logic only
- **API Compatibility**: New endTime parameter is optional, existing calls continue to work
- **User Training**: Users should be informed about new sort controls and date range validation 