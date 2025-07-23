# Enhanced Alert Controller for Predictive Maintenance

## Overview

The Enhanced Alert Controller (`PredictiveAlertController`) extends the existing Eagle Notifier alert system to support predictive maintenance alerts alongside traditional rule-based alerts. It provides hybrid alert generation, organization-scoped deduplication, and seamless integration with the existing notification broadcasting system.

## Key Features

### 🤖 Hybrid Alert Generation
- **Rule-based Alerts**: Traditional threshold-based alerts from SCADA data
- **Predictive Alerts**: ML-powered failure prediction alerts
- **Combined Processing**: Unified alert processing pipeline

### 🏢 Multi-Tenant Architecture
- **Organization Isolation**: Complete data and alert isolation between organizations
- **Scoped Processing**: All alerts are organization-scoped
- **Custom Configurations**: Per-organization thresholds and settings

### 🔄 Alert Deduplication
- **Time-based Windows**: 5-minute deduplication window
- **Component-level**: Prevents duplicate alerts for same component
- **Organization-scoped**: Deduplication isolated per organization

### 📡 Notification Integration
- **Existing System**: Uses current NotificationService
- **WebSocket Broadcasting**: Real-time alert delivery
- **Mobile App Ready**: Compatible with existing mobile app workflow

### 📊 Feedback & Analytics
- **Accuracy Tracking**: User feedback on prediction accuracy
- **Performance Metrics**: Alert statistics and trends
- **Model Improvement**: Feedback loop for ML model enhancement

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   SCADA Data    │    │  Prediction      │    │  Enhanced       │
│   (Real-time)   │───▶│  Service         │───▶│  Alert          │
│                 │    │  (ML Models)     │    │  Controller     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Mobile App    │◀───│  Notification    │◀───│  Alert          │
│   (Users)       │    │  Service         │    │  Broadcasting   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Core Components

### 1. PredictiveAlertController Class

Main controller class that orchestrates predictive alert processing.

```typescript
export class PredictiveAlertController {
  // Main analysis method
  static async analyzeData(
    rawData: any, 
    orgContext: OrganizationContext,
    predictionResult?: PredictionResult
  ): Promise<Alert[]>

  // Generate predictive alerts from ML predictions
  static async generatePredictiveAlerts(
    prediction: PredictionResult,
    orgContext: OrganizationContext
  ): Promise<Alert[]>

  // Organization-scoped alert deduplication
  private static deduplicateAlerts(
    alerts: Alert[], 
    organizationId: string
  ): Alert[]

  // Broadcast alerts via existing notification system
  private static async broadcastAlerts(
    alerts: Alert[], 
    organizationId: string
  ): Promise<void>
}
```

### 2. Alert Interface

Unified alert structure supporting both rule-based and predictive alerts.

```typescript
interface Alert {
  id: string;
  organizationId: string;
  type: 'CRITICAL' | 'WARNING' | 'PREDICTIVE';
  component: string;
  message: string;
  confidence?: number;        // For predictive alerts
  timeToFailure?: number;     // For predictive alerts
  timestamp: Date;
  metadata: AlertMetadata;
}
```

### 3. Organization Context

Context object containing organization-specific configurations.

```typescript
interface OrganizationContext {
  organizationId: string;
  scadaConfig: any;          // SCADA connection config
  schemaConfig: any;         // Data schema mapping
  modelConfig?: any;         // ML model configuration
}
```

## Configuration

### Alert Thresholds

```typescript
// Default thresholds (configurable per organization)
const PREDICTIVE_THRESHOLD = 0.85;     // 85% failure probability
const CONFIDENCE_THRESHOLD = 0.7;      // 70% confidence minimum
const DEDUPLICATION_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
```

### Alert Severity Mapping

```typescript
// Probability-based severity assignment
if (probability >= 0.95) {
  alertType = 'CRITICAL';
  severity = 'CRITICAL';
} else if (probability >= 0.90) {
  alertType = 'WARNING';
  severity = 'WARNING';
} else {
  alertType = 'PREDICTIVE';
  severity = 'WARNING';
}
```

## API Endpoints

### Get Alert Statistics
```
GET /api/predictive-alerts/statistics?hours=24
```

### Get Predictive Alerts
```
GET /api/predictive-alerts?page=1&limit=20
```

### Provide Alert Feedback
```
POST /api/predictive-alerts/:alertId/feedback
{
  "isAccurate": true
}
```

### Get Alert Details
```
GET /api/predictive-alerts/:alertId
```

### Get Component Alerts
```
GET /api/predictive-alerts/component/:component?hours=24
```

### Get Alert Trends
```
GET /api/predictive-alerts/trends/summary?days=7
```

## Integration with Background Monitoring

The Enhanced Alert Controller integrates with the existing background monitoring service:

```typescript
// In backgroundMonitoringService.ts
import { PredictiveAlertController, OrganizationContext } from './predictiveAlertController';

// Enhanced monitoring with predictive alerts
private static async monitorOrganization(orgId: string, orgName: string): Promise<void> {
  // ... existing rule-based processing ...
  
  // Process predictive alerts if enabled
  if (organization.predictionEnabled && organization.mlModelConfig) {
    const predictionResult = await this.processPredictiveAlerts(organization);
    
    // Generate and broadcast predictive alerts
    const orgContext: OrganizationContext = {
      organizationId: organization.id,
      scadaConfig: organization.scadaDbConfig,
      schemaConfig: organization.schemaConfig,
      modelConfig: organization.mlModelConfig
    };

    const alerts = await PredictiveAlertController.analyzeData(
      latestData,
      orgContext,
      predictionResult
    );
  }
}
```

## Database Schema

### PredictionAlert Table

```sql
CREATE TABLE PredictionAlert (
  id              VARCHAR PRIMARY KEY,
  organizationId  VARCHAR NOT NULL,
  type            VARCHAR NOT NULL,
  component       VARCHAR NOT NULL,
  probability     FLOAT NOT NULL,
  confidence      FLOAT NOT NULL,
  timeToFailure   INTEGER NOT NULL,
  modelVersion    VARCHAR NOT NULL,
  isAccurate      BOOLEAN NULL,
  feedbackAt      TIMESTAMP NULL,
  feedbackBy      VARCHAR NULL,
  createdAt       TIMESTAMP DEFAULT NOW(),
  resolvedAt      TIMESTAMP NULL,
  
  INDEX idx_org_created (organizationId, createdAt),
  INDEX idx_component (component),
  FOREIGN KEY (organizationId) REFERENCES Organization(id)
);
```

## Usage Examples

### Basic Predictive Alert Generation

```typescript
import { PredictiveAlertController } from './predictiveAlertController';

// Organization context
const orgContext = {
  organizationId: 'org-123',
  scadaConfig: { /* SCADA config */ },
  schemaConfig: { /* Schema config */ },
  modelConfig: { /* Model config */ }
};

// Prediction result from ML model
const predictionResult = {
  organizationId: 'org-123',
  probability: 0.92,
  confidence: 0.88,
  predictedComponent: 'Motor A',
  timeToFailure: 7,
  // ... other fields
};

// Generate and broadcast alerts
const alerts = await PredictiveAlertController.analyzeData(
  scadaData,
  orgContext,
  predictionResult
);
```

### Alert Feedback Processing

```typescript
// Process user feedback on alert accuracy
await PredictiveAlertController.processAlertFeedback(
  'alert-123',
  'org-123',
  true, // isAccurate
  'user-456'
);
```

### Get Alert Statistics

```typescript
// Get organization alert statistics
const stats = await PredictiveAlertController.getAlertStatistics('org-123', 24);
console.log(`Accuracy: ${stats.accuracy}%`);
console.log(`Total alerts: ${stats.totalAlerts}`);
```

## Error Handling

The Enhanced Alert Controller implements comprehensive error handling:

### Graceful Degradation
- **Model Failures**: Falls back to rule-based alerts only
- **Database Errors**: Continues processing, logs errors
- **Network Issues**: Retries with exponential backoff

### Circuit Breaker Pattern
- **Failure Detection**: Monitors consecutive failures
- **Service Protection**: Prevents cascade failures
- **Automatic Recovery**: Resumes when service recovers

### Logging and Monitoring
- **Structured Logging**: JSON-formatted logs with context
- **Performance Metrics**: Processing time tracking
- **Error Tracking**: Detailed error reporting

## Performance Considerations

### Memory Management
- **Alert Cache**: LRU cache with automatic cleanup
- **Deduplication**: Time-based cache expiration
- **Memory Monitoring**: Tracks cache size and usage

### Scalability
- **Organization Isolation**: Independent processing per org
- **Async Processing**: Non-blocking alert generation
- **Batch Operations**: Efficient database operations

### Optimization
- **Database Indexing**: Optimized queries for alert retrieval
- **Caching Strategy**: Reduces database load
- **Connection Pooling**: Efficient database connections

## Testing

### Unit Tests
- Alert generation logic
- Deduplication algorithms
- Error handling scenarios
- Organization isolation

### Integration Tests
- End-to-end alert workflow
- Database operations
- Notification system integration
- Multi-tenant scenarios

### Performance Tests
- Concurrent organization processing
- Memory usage under load
- Alert processing latency
- Database query performance

## Deployment

### Environment Variables
```bash
# Alert thresholds
PREDICTIVE_ALERT_THRESHOLD=0.85
CONFIDENCE_THRESHOLD=0.7
DEDUPLICATION_WINDOW_MS=300000

# Performance settings
MAX_ALERTS_PER_BATCH=100
ALERT_CACHE_SIZE=1000
ALERT_PROCESSING_TIMEOUT=5000
```

### Database Migrations
```bash
# Run Prisma migrations to add PredictionAlert table
npx prisma migrate deploy
```

### Monitoring Setup
- **Alert Processing Metrics**: Track processing time and success rate
- **Error Rate Monitoring**: Monitor failure rates and error types
- **Performance Dashboards**: Real-time performance visualization

## Troubleshooting

### Common Issues

1. **Alerts Not Generated**
   - Check prediction thresholds
   - Verify model confidence levels
   - Confirm organization configuration

2. **Duplicate Alerts**
   - Review deduplication window settings
   - Check alert cache functionality
   - Verify component naming consistency

3. **Performance Issues**
   - Monitor database query performance
   - Check alert cache hit rates
   - Review concurrent processing limits

### Debug Mode
```bash
# Enable debug logging
NODE_ENV=development DEBUG=predictive-alerts:*
```

## Future Enhancements

### Planned Features
- **Advanced Deduplication**: ML-based similarity detection
- **Alert Prioritization**: Dynamic priority assignment
- **Batch Processing**: Bulk alert operations
- **Real-time Dashboards**: Live alert monitoring

### Integration Opportunities
- **External Systems**: Third-party monitoring tools
- **Mobile Enhancements**: Rich push notifications
- **Analytics Platform**: Advanced reporting and insights
- **Automation**: Automated response actions

## Support

For technical support or questions about the Enhanced Alert Controller:

1. **Documentation**: Check this README and inline code comments
2. **Examples**: Review the example files in `/examples/`
3. **Logs**: Check application logs for error details
4. **Testing**: Run the test suite to verify functionality

---

*This Enhanced Alert Controller is part of the Eagle Notifier predictive maintenance system, providing intelligent, organization-scoped alert processing with seamless integration into existing workflows.*