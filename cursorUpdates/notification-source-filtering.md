# Notification Source Filtering Implementation

## Overview
This update enhances the notification filtering system by moving the source-based filtering (Meter vs. Furnace) from client-side to server-side. This improves performance and ensures proper filtering when there are many notifications in the database.

## Problem Addressed
Previously, the application was fetching all notifications and then filtering them on the client side based on whether they were Meter or Furnace related. With a large number of notifications (344+), this approach was inefficient and caused the "No meter notifications" message to appear even when meter notifications existed.

## Implementation Details

### Changes Made

1. **Backend API Enhancement**
   - Added `source` parameter support to the notifications endpoint
   - Implemented Prisma query filtering based on the source parameter:
     - For "Meter" source: Filter notifications where title contains "Meter"
     - For "Furnace" source: Filter notifications where title does NOT contain "Meter"
   - Added detailed logging for debugging filter issues
   - Fixed filtering logic to use `contains` instead of `startsWith` for more robust matching

2. **API Client Update**
   - Modified `fetchNotifications` function to accept and pass the `source` parameter to the backend

3. **Hooks Update**
   - Enhanced `useNotifications` hook to accept a `source` parameter
   - Added `source` to the query key to ensure proper caching and invalidation

4. **UI Component Update**
   - Updated the notifications screen to pass the source parameter to the hook
   - Removed client-side filtering since it's now handled by the backend

## Benefits
- Improved performance by reducing the amount of data transferred
- More accurate filtering results
- Better user experience with appropriate empty state messages
- Reduced client-side processing

## Technical Notes
- The filtering is based on the notification title containing "Meter" for meter notifications
- This approach is more robust than using `startsWith` which might miss some notifications
- The implementation supports both "all" and "unread" filter modes combined with source filtering 