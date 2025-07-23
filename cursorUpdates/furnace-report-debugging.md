# Furnace Report Generation Debugging Guide

## Date: 2025-01-15

## Issue Summary
Two main issues remain unresolved:
1. Reports not being saved to the FurnaceReport table in the database
2. Success modal not showing - direct sharing still occurs

## Debugging Steps Added

### Frontend Debugging (app/hooks/useFurnaceReports.ts)
Added console logging for:
- Authentication headers
- Report title and file size
- Save payload size
- Error response details including status and error messages

### Backend Debugging (backend/src/routes/reportRoutes.ts)
Added console logging for:
- Request received confirmation
- User ID verification
- Request body details
- File content length and buffer size
- Database save operation status
- Enhanced error messages with stack traces

### Modal Debugging (app/(dashboard)/reports/index.tsx)
Added console logging for:
- File path after generation
- Modal visibility state changes

## Potential Issues to Check

### 1. Database Save Issues
- **Authentication**: Check if the auth token is being properly sent and validated
- **File Size**: Large files might exceed database or request size limits
- **Prisma Connection**: Ensure the database connection is active
- **Table Schema**: Verify the FurnaceReport table exists with correct columns

### 2. Modal Not Showing
- **Component State**: The success modal state might be getting overridden
- **Report Generator Modal**: Check if it's closing properly before showing success modal
- **Async Timing**: There might be a race condition between modal state changes

## Recommended Actions

### Check Backend Logs
Run the backend and monitor console output for:
```
POST /api/reports/furnace - Request received
User ID: [should show a valid UUID]
Request body keys: [should include all expected fields]
Creating furnace report in database...
Report saved successfully with ID: [UUID]
```

### Check Frontend Console
In the browser/Expo console, look for:
```
Attempting to save report to database...
Headers: {Authorization: 'Bearer ...'}
Save payload size: [number]
Report generated successfully, file path: [path]
Showing success modal...
```

### Verify Database Migration
Ensure the FurnaceReport table was created:
```bash
cd backend
npx prisma migrate status
npx prisma studio  # To view the database tables
```

### Test API Endpoint Directly
Use a tool like Postman or curl to test the save endpoint:
```bash
curl -X POST http://localhost:3000/api/reports/furnace \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Report",
    "format": "excel",
    "fileContent": "base64string",
    "fileName": "test.xlsx",
    "fileSize": 1000,
    "startDate": "2025-01-01T00:00:00Z",
    "endDate": "2025-01-15T00:00:00Z",
    "grouping": "newest_first",
    "includeThresholds": true,
    "includeStatusFields": true,
    "alarmTypes": [],
    "severityLevels": [],
    "zones": []
  }'
```

## Common Fixes

### For Database Save Issues:
1. Check request body size limits in Express:
   ```javascript
   app.use(express.json({ limit: '50mb' }));
   app.use(express.urlencoded({ limit: '50mb', extended: true }));
   ```

2. Verify Prisma client generation:
   ```bash
   cd backend
   npx prisma generate
   ```

3. Check PostgreSQL bytea column size limits

### For Modal Issues:
1. Ensure the ReportGenerator modal is properly closed before showing success modal
2. Add a small delay if needed:
   ```javascript
   setTimeout(() => setSuccessModalVisible(true), 100);
   ```

3. Check for any errors that might prevent the modal from showing

## Next Steps
1. Run the application with console open
2. Generate a report and observe the logs
3. Check both frontend and backend console outputs
4. Share the error messages or unexpected behavior from the logs
5. Verify database contents using Prisma Studio 