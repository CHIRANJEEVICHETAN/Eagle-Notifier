# Furnace Report UI and Functionality Fixes

## Date: 2025-01-15

## Overview
Fixed UI styling issues and report opening functionality for the furnace reports screen to match the meter readings reports implementation.

## Issues Addressed

### 1. UI Styling - Report Items Going Off Screen
- **Problem**: Open and Share buttons were extending beyond the screen on the right side
- **Solution**: Updated styles to match the meter readings reports layout
- **Changes**:
  - Added `flexWrap: 'wrap'` to report items
  - Set `flex: 1` and `minWidth: 200` for reportItemLeft
  - Added `marginRight: 8` to reportInfo
  - Changed from icon-only buttons to icon+text buttons
  - Added `paddingTop: 8` to reportActions

### 2. Report Opening Functionality
- **Problem**: Reports weren't opening properly when clicking the Open button
- **Solution**: Updated the `openReport` function to match the working implementation from meter reports
- **Changes**:
  - Properly retrieve report metadata from cached reports
  - Use `FileSystem.getContentUriAsync()` for Android to get proper content URI
  - Add proper MIME type and UTI for iOS sharing
  - Improved error handling with specific error messages

## Affected Components

### Frontend Components
- **`app/(dashboard)/reports/index.tsx`**:
  - Updated report item layout styles
  - Changed action buttons to include text labels
  - Added new styles: `reportActionButton` and `reportActionText`
  - Better responsive layout with flex wrapping

### Frontend Hooks
- **`app/hooks/useFurnaceReports.ts`**:
  - Updated `openReport` function implementation
  - Better file handling with content URIs for Android
  - Proper MIME type detection based on format
  - Enhanced error messages for debugging

## Style Changes Detail

### Before:
```javascript
reportItem: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  // ... other styles
},
reportItemLeft: {
  flexDirection: 'row',
  alignItems: 'center',
},
```

### After:
```javascript
reportItem: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap', // Added to prevent overflow
  // ... other styles
},
reportItemLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1, // Added for responsive width
  minWidth: 200, // Minimum width before wrapping
},
```

## Functionality Improvements

### Report Opening Flow:
1. Download report file from API using arraybuffer response type
2. Find report metadata from cached reports list
3. Convert arraybuffer to base64 string
4. Write file to document directory
5. For Android: Get content URI and use IntentLauncher
6. For iOS: Use Sharing with proper UTI
7. Fallback to sharing if IntentLauncher fails

### Key Improvements:
- Uses `FileSystem.getContentUriAsync()` for proper Android file access
- Includes proper MIME types for Excel and PDF files
- Better error handling with descriptive messages
- Proper file naming using original filename from metadata

## UI/UX Enhancements
- Report action buttons now show both icon and text for clarity
- Better responsive layout that wraps when needed
- Consistent spacing and alignment
- Matches the design pattern of meter readings reports 