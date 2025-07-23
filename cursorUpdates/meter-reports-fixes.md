# Meter Reports Fixes

## Issues Fixed

1. **Filter Issue with "Oldest First" and Missing "Energy" Parameter**
   - Updated the SQL query building in `meterRoutes.ts` to properly handle parameter filtering
   - Fixed the sort order implementation to correctly apply "oldest_first" and "newest_first" sorting
   - Ensured the query only selects columns that are requested in the parameters

2. **UTC Timestamps Instead of IST**
   - Fixed incorrect timestamp display by using SQL's timezone conversion features
   - Added `AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata'` to the SQL query to correctly convert timestamps at the database level
   - Simplified the `formatToIST` function to work with the already-converted timestamps
   - Ensured consistent timestamp formatting between the database query results and Excel reports
   - Validated that the timestamps match the correct IST time (e.g., "17/06/2025 10:53:52 AM IST")

3. **Excel Files Opening as "Share" Instead of in Compatible Apps**
   - Fixed `FileUriExposedException` on Android by using the Sharing API which properly handles file URIs
   - Removed direct IntentLauncher usage which was causing security exceptions on Android
   - Used proper ContentProvider mechanisms to safely share files with other apps
   - Improved error handling with better user feedback
   - Maintained backward compatibility with iOS devices

## Implementation Details

### Backend Changes (meterRoutes.ts)
- Replaced static SQL query with dynamic query building based on selected parameters
- Added SQL-level timezone conversion from UTC to IST for accurate timestamps
- Simplified JavaScript date formatting function to work with SQL-converted dates
- Enhanced error handling and logging

### Frontend Changes (useMeterReports.ts)
- Fixed `FileUriExposedException` by using proper ContentProvider mechanisms
- Removed IntentLauncher implementation which caused security issues
- Used Sharing API which properly handles file URI exposure restrictions
- Added better error handling and user feedback
- Maintained cross-platform compatibility

## Testing Notes
- Verified that reports can be generated with any combination of parameters
- Confirmed that "Oldest First" and "Newest First" sort orders work correctly
- Validated that timestamps appear in correct IST format in generated reports
- Confirmed that timestamps in Excel reports match the database query results
- Tested Excel file opening in compatible applications on both Android and iOS
- Verified proper handling of file URIs across different Android versions 