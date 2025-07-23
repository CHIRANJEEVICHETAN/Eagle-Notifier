# Notification Filtering Implementation

## Overview
This update adds contextual notification filtering, allowing the app to show only relevant notifications based on the user's current section (Meter or Furnace).

## Implementation Details

### Changes Made
1. **Source Parameter Routing**
   - Added a `source` parameter to the notification routes from both Meter and Furnace sections
   - From Meter Readings screen: Added `source: 'Meter'` parameter
   - From Operator (Furnace) screen: Added `source: 'Furnace'` parameter

2. **Notification Filtering Logic**
   - Updated `notifications/index.tsx` to filter notifications based on source parameter
   - For Meter: Shows only notifications where title starts with "Meter Alert"
   - For Furnace: Shows all other notifications (that don't start with "Meter Alert")
   - When no source is specified, all notifications are shown

3. **Dynamic UI Updates**
   - Modified page title and subtitle based on source
   - Updated empty state messages to reflect the current context
   - Maintained the unread/all filter functionality alongside the source filter

## Technical Implementation
- Used Expo Router's `useLocalSearchParams` to access the source parameter
- Implemented client-side filtering based on notification title prefix
- Enhanced UX with contextually appropriate headings and empty states

## Future Improvements
- Consider adding backend filtering support if the number of notifications grows significantly
- Add support for more source types if additional notification categories are introduced
- Implement a visual indicator or tab system to let users switch between notification categories

## Affected Files
- `app/(dashboard)/notifications/index.tsx`
- `app/(dashboard)/meter-readings/index.tsx`
- `app/(dashboard)/operator/index.tsx` 