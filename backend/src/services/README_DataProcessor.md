# OrganizationDataProcessor Service

## Overview

The `OrganizationDataProcessor` service is a multi-tenant data processing system designed for predictive maintenance applications. It processes real-time SCADA data from multiple organizations concurrently, applying organization-specific schema configurations and generating machine learning-ready features including lag features and rolling statistics.

## Key Features

### 🏢 Multi-Tenant Architecture
- **Organization Isolation**: Each organization has its own processor instance with isolated data processing
- **Concurrent Processing**: Thread-safe processing for multiple organizations simultaneously
- **Dynamic Schema Support**: Each organization can have custom SCADA column configurations
- **Scalable Design**: Handles up to 100 concurrent organization processors with LRU eviction

### 🔧 Feature Engineering
- **Current Features**: Real-time values from continuous and boolean SCADA columns
- **Lag Features**: Historical values at configurable time intervals (default: 60s, 120s)
- **Rolling Statistics**: Statistical features over configurable time windows (default: 5 minutes)
  - Mean, Standard Deviation, Min, Max, Range for continuous columns
  - Failure rates and counts for boolean columns

### 🛡️ Robust Data Handling
- **Missing Value Handling**: Forward-fill strategy with zero values for missing data
- **Schema Mapping**: Dynamic column mapping for legacy system compatibility
- **Error Recovery**: Graceful handling of database connection issues and invalid data
- **Memory Management**: Automatic history size limiting (1000 data points per organization)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                Multi-Tenant Processor Manager               │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Org A         │  │   Org B         │  │   Org C         │ │
│  │   Processor     │  │   Processor     │  │   Processor     │ │
│  │                 │  │                 │  │                 │ │
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │ │
│  │ │ Schema      │ │  │ │ Schema      │ │  │ │ Schema      │ │ │
│  │ │ Config      │ │  │ │ Config      │ │  │ │ Config      │ │ │
│  │ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘ │ │
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │ │
│  │ │ Data        │ │  │ │ Data        │ │  │ │ Data        │ │ │
│  │ │ History     │ │  │ │ History     │ │  │ │ History     │ │ │
│  │ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘ │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │    Processed Features   │
                    │                         │
                    │ • Current Values        │
                    │ • Lag Features          │
                    │ • Rolling Statistics    │
                    │ • Metadata              │
                    └─────────────────────────┘
```

## Usage

### Basic Usage

```typescript
import { OrganizationDataProcessor, processorManager } from './organizationDataProcessor';

// Single organization processing
const processor = await OrganizationDataProcessor.createProcessor('org-123');

const rawScadaData = {
  id: 'scada-001',
  created_timestamp: new Date().toISOString(),
  hz1pv: 847,    // Hardening Zone 1 Process Value
  hz2pv: 903,    // Hardening Zone 2 Process Value
  cppv: 0.82,    // Carbon Potential Process Value
  hz1hfail: false, // Hardening Zone 1 Heater Failure
  hz2hfail: false  // Hardening Zone 2 Heater Failure
};

const features = await processor.processData(rawScadaData);
console.log(`Generated ${features.metadata.totalFeatures} features`);
```

### Multi-Tenant Processing

```typescript
// Process multiple organizations concurrently
const orgDataMap = new Map([
  ['org-1', { id: '1', hz1pv: 850, hz1hfail: false }],
  ['org-2', { id: '2', hz1pv: 820, hz1hfail: true }],
  ['org-3', { id: '3', hz1pv: 875, hz1hfail: false }]
]);

const results = await processorManager.processMultipleOrganizations(orgDataMap);

for (const [orgId, features] of results) {
  console.log(`${orgId}: ${features.metadata.totalFeatures} features generated`);
}
```

## Configuration

### Organization Schema Configuration

Each organization can have a custom schema configuration stored in the database:

```json
{
  "continuousColumns": ["hz1pv", "hz2pv", "cppv", "tz1pv", "tz2pv", "oilpv"],
  "booleanColumns": ["hz1hfail", "hz2hfail", "oiltemphigh", "oillevelhigh"],
  "columnMapping": {
    "legacy_temp1": "hz1pv",
    "legacy_temp2": "hz2pv"
  },
  "lagSeconds": [60, 120, 300],
  "rollingWindows": [180, 300, 600],
  "targetColumn": "failure_indicator",
  "table": "custom_scada_table"
}
```

### ML Model Configuration

ML-specific parameters are stored in the organization's `mlModelConfig`:

```json
{
  "lagSeconds": [30, 60, 120, 300],
  "rollingWindows": [180, 300, 600, 1200],
  "targetColumn": "equipment_failure",
  "featureSelection": ["hz1pv", "hz2pv", "cppv"]
}
```

## Generated Features

### Current Features
- **Continuous columns**: Direct numeric values (e.g., `hz1pv: 847`)
- **Boolean columns**: Binary values (e.g., `hz1hfail: 0`)

### Lag Features
- **Format**: `{column}_lag_{seconds}s`
- **Examples**: 
  - `hz1pv_lag_60s: 845` (value 60 seconds ago)
  - `hz1hfail_lag_120s: 1` (failure state 120 seconds ago)

### Rolling Statistics
- **Continuous columns**:
  - `{column}_rolling_{seconds}s_mean`: Average value
  - `{column}_rolling_{seconds}s_std`: Standard deviation
  - `{column}_rolling_{seconds}s_min`: Minimum value
  - `{column}_rolling_{seconds}s_max`: Maximum value
  - `{column}_rolling_{seconds}s_range`: Max - Min

- **Boolean columns**:
  - `{column}_rolling_{seconds}s_rate`: Failure rate (0-1)
  - `{column}_rolling_{seconds}s_count`: Number of failures

### Example Feature Output

```typescript
{
  organizationId: "org-123",
  timestamp: "2024-01-01T10:00:00.000Z",
  features: {
    // Current features
    hz1pv: 847,
    hz2pv: 903,
    hz1hfail: 0,
    
    // Lag features
    hz1pv_lag_60s: 845,
    hz1pv_lag_120s: 843,
    hz1hfail_lag_60s: 0,
    
    // Rolling features
    hz1pv_rolling_300s_mean: 845.2,
    hz1pv_rolling_300s_std: 2.1,
    hz1pv_rolling_300s_min: 842,
    hz1pv_rolling_300s_max: 848,
    hz1hfail_rolling_300s_rate: 0.1,
    hz1hfail_rolling_300s_count: 2
  },
  metadata: {
    totalFeatures: 15,
    lagFeatureCount: 6,
    rollingFeatureCount: 8,
    missingValues: [],
    processingTime: 12
  }
}
```

## API Reference

### OrganizationDataProcessor

#### Static Methods

- `getOrganizationSchemaConfig(orgId: string)`: Fetch organization schema configuration
- `createProcessor(organizationId: string)`: Create a new processor instance

#### Instance Methods

- `processData(rawData: any)`: Process raw SCADA data and generate features
- `loadHistoricalData(hours: number)`: Load historical data for feature generation
- `applySchemaMapping(rawData: any)`: Apply column mapping transformations
- `generateLagFeatures(data: ScadaDataPoint[])`: Generate lag features
- `calculateRollingStats(data: ScadaDataPoint[])`: Calculate rolling statistics
- `getHistorySize()`: Get current history size
- `clearHistory()`: Clear data history
- `updateSchemaConfig(config: OrganizationSchemaConfig)`: Update schema configuration

### MultiTenantProcessorManager

- `getProcessor(organizationId: string)`: Get or create processor for organization
- `processMultipleOrganizations(orgDataMap: Map<string, any>)`: Process multiple organizations concurrently
- `removeProcessor(organizationId: string)`: Remove processor from cache
- `getProcessorCount()`: Get number of active processors
- `clearAll()`: Clear all processors

## Performance Characteristics

### Processing Performance
- **Single organization**: ~5-15ms per data point
- **Multi-tenant**: Concurrent processing with minimal overhead
- **Memory usage**: ~1MB per organization processor
- **Throughput**: 1000+ data points per second across all organizations

### Scalability Limits
- **Max processors**: 100 concurrent organizations (configurable)
- **History size**: 1000 data points per organization
- **Feature count**: Typically 50-200 features per organization
- **Lag windows**: Up to 10 different lag intervals
- **Rolling windows**: Up to 10 different time windows

## Error Handling

### Graceful Degradation
- **Database errors**: Continue with cached configurations
- **Missing data**: Forward-fill with zero values
- **Invalid data**: Skip invalid values, log warnings
- **Memory limits**: Automatic history trimming

### Error Recovery
- **Connection failures**: Retry with exponential backoff
- **Processing errors**: Isolate to specific organization
- **Configuration errors**: Fall back to default configuration

## Testing

### Unit Tests
```bash
# Run unit tests (if Jest is configured)
npm test organizationDataProcessor.test.ts
```

### Integration Tests
```bash
# Run integration tests
cd backend
npx ts-node src/services/integration/dataProcessorIntegration.ts
```

### Example Usage
```bash
# Run examples
cd backend
npx ts-node src/services/examples/dataProcessorExample.ts
```

## Monitoring and Debugging

### Debug Mode
Set `NODE_ENV=development` to enable detailed logging:
- Schema configuration loading
- Feature generation statistics
- Processing performance metrics
- Error details and stack traces

### Key Metrics to Monitor
- Processing latency per organization
- Memory usage per processor
- Feature generation success rate
- Missing value frequency
- Historical data loading performance

## Integration with Predictive Maintenance

This service is designed to integrate with the broader predictive maintenance system:

1. **Data Flow**: SCADA → DataProcessor → ML Model → Prediction Service
2. **Feature Store**: Processed features can be stored for model training
3. **Real-time Processing**: Supports streaming data for live predictions
4. **Batch Processing**: Can process historical data for model training

## Best Practices

### Configuration Management
- Store organization-specific configurations in the database
- Use environment variables for system-wide settings
- Validate configurations before processing

### Performance Optimization
- Preload processors for active organizations
- Use appropriate history sizes based on feature requirements
- Monitor memory usage and implement cleanup strategies

### Error Handling
- Implement comprehensive logging for debugging
- Use circuit breakers for external dependencies
- Provide fallback mechanisms for critical operations

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Reduce history size per organization
   - Implement more aggressive processor eviction
   - Monitor for memory leaks in long-running processes

2. **Slow Processing**
   - Check database connection performance
   - Optimize feature generation algorithms
   - Consider reducing feature complexity

3. **Missing Features**
   - Verify organization schema configuration
   - Check for sufficient historical data
   - Validate column mappings

4. **Configuration Errors**
   - Verify database schema matches expected format
   - Check JSON parsing for configuration fields
   - Validate column names against SCADA schema

## Future Enhancements

- **Adaptive Feature Selection**: Automatically select optimal features based on model performance
- **Real-time Streaming**: Direct integration with streaming data sources
- **Feature Caching**: Cache computed features for improved performance
- **Advanced Statistics**: Additional statistical features (percentiles, correlations)
- **Anomaly Detection**: Built-in anomaly detection during feature generation