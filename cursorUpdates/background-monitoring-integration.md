# Background Monitoring Service Integration

## Overview
The Eagle Notifier system now uses a centralized background monitoring service that replaces the previous polling-based SCADA monitoring approach. This service provides better error handling, monitoring status tracking, and administrative control.

## Key Changes Made

### 1. Server Integration (`backend/server.ts`)
- **Removed**: Old polling logic with `setInterval` and manual error handling
- **Added**: BackgroundMonitoringService import and integration
- **Enhanced**: Graceful shutdown handling for the monitoring service
- **Improved**: Better logging with emojis and structured messages

### 2. Background Monitoring Service (`backend/src/services/backgroundMonitoringService.ts`)
- **Centralized Monitoring**: Single service that monitors all organizations
- **Status Tracking**: Real-time monitoring status for each organization
- **Error Handling**: Comprehensive error tracking and recovery
- **Administrative Control**: Methods to force monitoring cycles
- **Health Monitoring**: Service health status and metrics

### 3. Admin API Endpoints (`backend/src/routes/adminRoutes.ts`)
- **GET `/api/admin/monitoring/status`**: Get monitoring service health and organization status
- **POST `/api/admin/monitoring/force-cycle`**: Force monitoring cycle for all organizations
- **POST `/api/admin/monitoring/force-org/:orgId`**: Force monitoring for specific organization

## Environment Variables

```bash
# Monitoring interval (default: 30 seconds)
SCADA_MONITORING_INTERVAL=30000

# Legacy support (fallback order)
SCADA_POLL_INTERVAL=30000
EXPO_PUBLIC_SCADA_INTERVAL=30000
```

## Service Features

### 1. Multi-Organization Monitoring
- Automatically monitors all organizations in the system
- Respects maintenance mode settings per organization
- Parallel processing for better performance

### 2. Status Tracking
```typescript
interface MonitoringStatus {
  orgId: string;
  orgName: string;
  lastCheck: Date;
  isActive: boolean;
  errorCount: number;
  lastError?: string;
}
```

### 3. Health Monitoring
```typescript
interface HealthStatus {
  isRunning: boolean;
  monitoringInterval: number;
  totalOrganizations: number;
  activeOrganizations: number;
  errorOrganizations: number;
  lastUpdate: Date;
}
```

### 4. Error Handling
- Tracks consecutive errors per organization
- Graceful degradation when SCADA connections fail
- Automatic retry logic with exponential backoff
- Detailed error logging and reporting

## API Usage Examples

### Get Monitoring Status
```bash
GET /api/admin/monitoring/status
Authorization: Bearer <super-admin-token>

Response:
{
  "health": {
    "isRunning": true,
    "monitoringInterval": 30000,
    "totalOrganizations": 3,
    "activeOrganizations": 2,
    "errorOrganizations": 1,
    "lastUpdate": "2025-01-20T10:30:00.000Z"
  },
  "organizations": [
    {
      "orgId": "org-1",
      "orgName": "Factory A",
      "lastCheck": "2025-01-20T10:30:00.000Z",
      "isActive": true,
      "errorCount": 0
    }
  ]
}
```

### Force Monitoring Cycle
```bash
POST /api/admin/monitoring/force-cycle
Authorization: Bearer <super-admin-token>

Response:
{
  "message": "Monitoring cycle forced successfully"
}
```

### Force Organization Monitoring
```bash
POST /api/admin/monitoring/force-org/org-1
Authorization: Bearer <super-admin-token>

Response:
{
  "message": "Monitoring forced for organization org-1"
}
```

## Benefits

### 1. Improved Reliability
- Centralized error handling and recovery
- Better connection management
- Automatic retry mechanisms

### 2. Enhanced Monitoring
- Real-time status tracking
- Detailed health metrics
- Organization-specific error tracking

### 3. Administrative Control
- Force monitoring cycles when needed
- Organization-specific monitoring control
- Service health monitoring

### 4. Better Performance
- Parallel organization processing
- Optimized connection pooling
- Reduced resource usage

## Migration Notes

### From Old Polling System
- **Removed**: Manual `setInterval` polling in `server.ts`
- **Replaced**: With centralized `BackgroundMonitoringService`
- **Enhanced**: Error handling and status tracking
- **Added**: Administrative control endpoints

### Backward Compatibility
- Environment variables maintain backward compatibility
- Existing SCADA service functions remain unchanged
- API endpoints for alarm processing unchanged

## Troubleshooting

### Common Issues

1. **Service Not Starting**
   - Check database connections
   - Verify environment variables
   - Review server logs for initialization errors

2. **Organization Monitoring Failures**
   - Check SCADA database connectivity
   - Verify organization configuration
   - Review error logs for specific issues

3. **High Error Counts**
   - Check network connectivity
   - Verify SCADA database credentials
   - Review organization schema configuration

### Debug Mode
Enable debug logging by setting:
```bash
NODE_ENV=development
```

## Future Enhancements

1. **WebSocket Notifications**: Real-time monitoring status updates
2. **Metrics Dashboard**: Visual monitoring status interface
3. **Alert Thresholds**: Configurable error thresholds and alerts
4. **Performance Optimization**: Connection pooling and caching improvements 