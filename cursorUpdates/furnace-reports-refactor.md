# Furnace Reports System Refactor

## Overview
Comprehensive refactoring of the furnace (alarm) report generation system to improve efficiency, user experience, and maintainability. The system now fetches only required data, uses proper column names, supports database storage, and provides a modern UI similar to meter reports.

## Implementation Details

### 1. Database Schema Changes

#### New FurnaceReport Model
Added `FurnaceReport` model to `backend/prisma/schema.prisma`:
- `id`: Unique identifier
- `userId`: Reference to the user who created the report
- `title`: Human-readable report title
- `format`: Report format (excel/pdf)
- `fileContent`: Binary content stored as Bytes
- `fileName`: Original filename
- `fileSize`: File size in bytes
- `startDate` & `endDate`: Report date range
- `grouping`: Sort order (newest_first/oldest_first)
- `includeThresholds`: Whether to include threshold values
- `includeStatusFields`: Whether to include status fields
- `alarmTypes[]`: Array of included alarm types
- `severityLevels[]`: Array of included severity levels  
- `zones[]`: Array of included zones
- `metadata`: Additional JSON metadata

#### User Model Update
- Added `furnaceReports` relation to User model

### 2. Backend Changes

#### Report Routes Enhancement (`backend/src/routes/reportRoutes.ts`)
**New Endpoints:**
- `GET /api/reports/furnace` - Get saved furnace reports for user
- `POST /api/reports/furnace` - Save new furnace report to database
- `GET /api/reports/furnace/:id` - Download specific furnace report file
- `GET /api/reports/setpoints` - Get setpoint configurations for thresholds

**Key Features:**
- Reports saved as base64 in database
- User-specific report access
- File download with proper headers
- Integration with Prisma for database operations

#### Required Columns Optimization
**SCADA Data Columns (from jk2 table):**
```sql
hz1sv, hz1pv, hz2sv, hz2pv, cpsv, cppv, 
tz1sv, tz1pv, tz2sv, tz2pv, oilpv,
oiltemphigh, oillevelhigh, oillevellow,
hz1hfail, hz2hfail, hardconfail, hardcontraip,
oilconfail, oilcontraip, hz1fanfail, hz2fanfail,
hz1fantrip, hz2fantrip, tempconfail, tempcontraip,
tz1fanfail, tz2fanfail, tz1fantrip, tz2fantrip,
id, created_timestamp
```

### 3. Frontend Changes

#### New Hook: `useFurnaceReports.ts`
**Features:**
- Database-backed report management
- Generate, open, and share reports
- Loading states and error handling
- Integration with alarm data fetching
- File operations with base64 encoding/decoding

**Methods:**
- `generateReport()` - Creates and saves reports
- `openReport()` - Downloads and opens reports
- `shareReport()` - Downloads and shares reports
- `refetchReports()` - Refreshes report list

#### Excel Report Service Updates (`app/services/ExcelReportService.ts`)
**Column Grouping Changes:**
- Removed: `CHRONOLOGICAL`
- Added: `NEWEST_FIRST`, `OLDEST_FIRST`
- Enhanced sorting with chronological ordering

**Descriptive Column Names:**
- `hz1sv` → "Hardening Zone 1 Set Value"
- `hz1pv` → "Hardening Zone 1 Present Value"
- `hz2sv` → "Hardening Zone 2 Set Value"
- `hz2pv` → "Hardening Zone 2 Present Value"
- `cpsv` → "Carbon Potential Set Value"
- `cppv` → "Carbon Potential Present Value"
- `tz1sv` → "Tempering Zone 1 Set Value"
- `tz1pv` → "Tempering Zone 1 Present Value"
- `tz2sv` → "Tempering Zone 2 Set Value"
- `tz2pv` → "Tempering Zone 2 Present Value"
- `oilpv` → "Oil Temperature Present Value"
- Status fields with descriptive names

**Conditional Inclusion:**
- Threshold values included only if `includeThresholds` is true
- Status fields included only if `includeStatusFields` is true

#### Reports UI Overhaul (`app/(dashboard)/reports/index.tsx`)
**New Features:**
- Database-backed report listing
- Loading and error states
- Success modal after report generation
- Open and share actions for saved reports
- File size display
- Responsive design improvements

**UI Components:**
- Loading spinner during data fetch
- Error state with retry functionality
- Success modal with action buttons
- Report cards with metadata display

### 4. Styling & Navigation Changes

#### Enhanced Styles
**New Style Components:**
- `loadingContainer` & `loadingText` - Loading state indicators
- `errorContainer`, `errorTitle`, `errorMessage` - Error handling UI
- `retryButton` & `retryButtonText` - Retry functionality
- Modal styles: `overlay`, `modalContent`, `modalHeader`, etc.
- Responsive report action buttons

#### Theme Integration
- Dark/light mode support for all new components
- Consistent color scheme with app theme
- Proper contrast ratios for accessibility

### 5. Performance Optimizations

#### Data Fetching
- Only required columns fetched from SCADA database
- Setpoint data fetched from primary database for thresholds
- Efficient query building with filters
- Proper error handling and retry logic

#### File Operations
- Base64 encoding for database storage
- Temporary file creation for sharing
- Memory-efficient file handling
- Proper cleanup of temporary files

#### UI Performance
- Memoized theme calculations
- Optimized re-renders with useCallback
- Efficient list rendering
- Loading states to prevent blocking UI

### 6. Error Handling & User Experience

#### Robust Error Management
- Comprehensive try-catch blocks
- User-friendly error messages
- Automatic retry mechanisms
- Graceful degradation

#### User Feedback
- Success notifications
- Progress indicators
- Clear action buttons
- Helpful error descriptions

## Technical Specifications

### File Formats Supported
- Excel (.xlsx) - Fully implemented
- PDF - Framework ready for future implementation

### Sorting Options
- Newest First (default)
- Oldest First
- By Type (temperature, carbon, oil, etc.)
- By Zone (zone1, zone2)

### Filter Capabilities
- Date range filtering
- Alarm type filtering
- Severity level filtering
- Zone-based filtering
- Status field inclusion toggle
- Threshold value inclusion toggle

### Database Integration
- Secure user-based access
- Binary file storage
- Metadata tracking
- Query optimization
- Foreign key relationships

## Migration Notes

### Database Migrations
1. Run `npx prisma generate` to update Prisma client
2. Existing migration file: `20250624095352_furnace_reports`
3. FurnaceReport table automatically created

### Backward Compatibility
- Legacy report functionality maintained
- Gradual migration to new system
- Existing exports still functional
- No breaking changes to API

## Future Enhancements

### Planned Features
1. PDF report generation
2. Custom report templates
3. Scheduled report generation
4. Email delivery of reports
5. Advanced filtering options
6. Report comparison tools
7. Dashboard integration
8. Export to other formats

### Performance Improvements
1. Report caching mechanisms
2. Background report generation
3. Incremental data loading
4. Data compression
5. CDN integration for large files

## Testing Considerations

### Key Test Areas
1. Report generation with various filters
2. File upload/download operations
3. Database storage and retrieval
4. Error handling scenarios
5. UI responsiveness
6. Cross-platform compatibility
7. Performance under load

### Security Testing
1. User access controls
2. File content validation
3. SQL injection prevention
4. XSS protection
5. File size limits
6. Rate limiting

## Dependencies

### New Dependencies
- Enhanced Prisma integration
- File system operations
- Base64 encoding/decoding
- React Query for data management

### Updated Dependencies
- Excel generation libraries
- Date manipulation utilities
- UI component libraries
- Theme management

## Summary

This comprehensive refactor transforms the furnace report system from a basic file-based approach to a robust, database-backed solution with modern UI/UX. The system now provides better performance, enhanced user experience, and a solid foundation for future enhancements while maintaining backward compatibility and security best practices. 