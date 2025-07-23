# Prisma Query Parameter Fix

## Overview
Fixed critical Prisma `$queryRaw` parameter mismatch errors that were causing the application to crash when fetching setpoint configurations and other database queries.

## Issues Identified and Fixed

### 1. **Setpoint Configuration Query Error**
**Problem**: The `getSetpointConfigs` function was using `$1` parameter placeholder but not passing the parameter to the query, causing a parameter mismatch error.

**Error Message**:
```
Invalid `prisma.$queryRaw()` invocation:
Your raw query had an incorrect number of parameters. Expected: `1`, actual: `0`.
```

**Root Cause**:
```typescript
// BEFORE: Using $1 placeholder without passing parameter
const setpoints = await prisma.$queryRaw<PrismaSetpoint[]>`
  SELECT id, name, type, zone, "scadaField",
  "lowDeviation", "highDeviation",
  "createdAt", "updatedAt"
  FROM "Setpoint"
  WHERE "organizationId" = $1
`;
```

**Fix**: Used template literal interpolation instead of parameterized query
```typescript
// AFTER: Using template literal interpolation
const setpoints = await prisma.$queryRaw<PrismaSetpoint[]>`
  SELECT id, name, type, zone, "scadaField",
  "lowDeviation", "highDeviation",
  "createdAt", "updatedAt"
  FROM "Setpoint"
  WHERE "organizationId" = ${orgId}
`;
```

### 2. **Notification Query Hardcoded User ID**
**Problem**: The notifications route had a hardcoded user ID in the raw query, which is a security risk and poor practice.

**Root Cause**:
```typescript
// BEFORE: Hardcoded user ID
const rawQueryResult = await prisma.$queryRaw<
  Array<{ count: number }>
>`SELECT COUNT(*) FROM "Notification" WHERE title LIKE 'Meter%' and "userId" = 'f0f5cc12-0a48-4436-8784-1f87eb5756b8';`;
```

**Fix**: Used dynamic user ID from request context
```typescript
// AFTER: Dynamic user ID
const rawQueryResult = await prisma.$queryRaw<
  Array<{ count: number }>
>`SELECT COUNT(*) FROM "Notification" WHERE title LIKE 'Meter%' and "userId" = ${userId};`;
```

## Technical Details

### Prisma Query Methods
There are two main ways to use `prisma.$queryRaw`:

1. **Template Literal Interpolation** (Recommended for simple cases):
   ```typescript
   const result = await prisma.$queryRaw`
     SELECT * FROM "Table" WHERE "column" = ${value}
   `;
   ```

2. **Parameterized Queries** (For complex queries with multiple parameters):
   ```typescript
   const result = await prisma.$queryRaw`
     SELECT * FROM "Table" WHERE "column1" = $1 AND "column2" = $2
   `, [value1, value2];
   ```

### Why the Error Occurred
The error occurred because:
- The query used `$1` placeholder expecting 1 parameter
- But no parameters were passed to the `$queryRaw` function
- Prisma's parameter validation caught this mismatch

## Affected Components

### Backend Services
- **scadaService.ts**: Fixed setpoint configuration query
- **notifications.ts**: Fixed hardcoded user ID in debug query

### Database Operations
- **Setpoint fetching**: Now properly filters by organization
- **Notification counting**: Now uses dynamic user ID

## Security Improvements

### 1. **SQL Injection Prevention**
- Template literal interpolation is safe for simple queries
- Parameters are properly escaped by Prisma
- No risk of SQL injection with the current implementation

### 2. **Dynamic User Context**
- Removed hardcoded user IDs
- All queries now use dynamic user context
- Better security and maintainability

## Performance Impact
- **Positive**: Queries now execute successfully without errors
- **Positive**: Proper organization filtering reduces result sets
- **Neutral**: No significant performance change

## Testing Scenarios

### Before Fix
1. SCADA service processes alarms
2. Tries to fetch setpoint configurations
3. **Result**: Application crashes with parameter mismatch error ❌

### After Fix
1. SCADA service processes alarms
2. Fetches setpoint configurations for specific organization
3. **Result**: Successful query execution with proper filtering ✅

## Implementation Details

### Setpoint Configuration Changes
- Fixed parameter passing in `getSetpointConfigs` function
- Maintained organization-level filtering
- Enhanced error logging with organization context

### Notification Query Changes
- Removed hardcoded user ID
- Used dynamic user ID from request context
- Maintained existing functionality

## Monitoring and Logging
- Enhanced error logging with organization context
- Better debugging information for query failures
- Improved error messages for parameter issues

## Future Considerations
- Consider using Prisma's type-safe query builders instead of raw queries
- Implement query parameter validation
- Add query performance monitoring
- Consider implementing query result caching for frequently accessed data

## Best Practices
1. **Use template literals** for simple parameter interpolation
2. **Use parameterized queries** for complex queries with multiple parameters
3. **Always validate parameters** before using them in queries
4. **Avoid hardcoded values** in database queries
5. **Use organization filtering** for multi-tenant applications 