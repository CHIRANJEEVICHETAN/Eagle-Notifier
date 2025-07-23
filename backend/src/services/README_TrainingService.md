# Training Service

The Training Service provides comprehensive ML model training, validation, deployment, and management capabilities for the predictive maintenance system. It supports organization-isolated training pipelines with automated scheduling and model version management.

## Features

### Core Functionality
- **Organization-Isolated Training**: Each organization has its own training pipeline and model artifacts
- **Python Script Integration**: Executes Python training scripts with configurable parameters
- **Model Validation**: Comprehensive validation including accuracy, performance, and health checks
- **Automated Deployment**: Seamless deployment of validated models with hot-swapping
- **Version Management**: Complete model versioning with rollback capabilities
- **Scheduled Training**: Automated weekly training with cron-like scheduling

### Key Components

#### 1. Training Pipeline
```typescript
// Train a new model for an organization
const config: TrainingConfig = {
  organizationId: 'org-123',
  dataRange: {
    startDate: new Date('2023-01-01'),
    endDate: new Date('2024-01-01')
  },
  hyperparameters: {
    numLeaves: 31,
    learningRate: 0.05,
    // ... other LightGBM parameters
  },
  validationSplit: 0.2,
  targetColumn: 'failure_indicator',
  featureColumns: ['temperature', 'pressure', 'vibration']
};

const result = await trainingService.trainModel('org-123', config);
```

#### 2. Model Validation
```typescript
// Validate a trained model
const validation = await trainingService.validateModel('org-123', '/path/to/model.onnx');

if (validation.isValid) {
  console.log(`Model accuracy: ${validation.accuracy}`);
  console.log(`Validation errors: ${validation.validationErrors.length}`);
}
```

#### 3. Model Deployment
```typescript
// Deploy a validated model
const deployment = await trainingService.deployModel('org-123', modelPath, version);
console.log(`Model deployed at: ${deployment.deploymentPath}`);
console.log(`Rollback available: ${deployment.rollbackAvailable}`);
```

#### 4. Scheduled Training
```typescript
// Schedule weekly training
const schedule: CronSchedule = {
  pattern: '0 2 * * 0', // Sunday at 2 AM
  timezone: 'UTC',
  enabled: true
};

await trainingService.scheduleTraining('org-123', schedule);
```

## Architecture

### Directory Structure
```
ml/
├── models/           # Organization-specific model storage
│   └── org-123/
│       ├── model_v1.onnx
│       └── deployed_v1/
│           └── model.onnx
├── artifacts/        # Training artifacts and logs
│   └── org-123/
│       └── v1.0.0/
│           ├── metrics.json
│           └── training_config.json
└── scripts/          # Python training scripts
    └── train_model.py
```

### Training Workflow
1. **Configuration Preparation**: Extract organization-specific settings
2. **Data Extraction**: Gather training data from organization's SCADA database
3. **Python Execution**: Run training script with isolated environment
4. **Model Validation**: Comprehensive validation checks
5. **Deployment**: Hot-swap deployment with zero downtime
6. **Logging**: Complete audit trail of training activities

## Configuration

### Environment Variables
```bash
# ML base directory (default: ./ml)
ML_BASE_PATH=/path/to/ml

# Python environment (default: python)
PYTHON_ENV=/path/to/python

# Enable debug logging
NODE_ENV=development
```

### Organization Configuration
Each organization requires:
- `mlModelConfig`: ML model configuration and parameters
- `trainingSchedule`: Automated training schedule
- `scadaDbConfig`: SCADA database connection details
- `schemaConfig`: Data schema and column mappings

## Python Integration

### Training Script Interface
The service executes Python scripts with a standardized interface:

```python
#!/usr/bin/env python3
import json
import sys

def main():
    config_path = sys.argv[1]
    
    # Load configuration
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    # Access organization-specific settings
    org_id = config['organizationId']
    features = config['featureColumns']
    hyperparams = config['hyperparameters']
    
    # Perform training...
    
    # Save results
    metrics = {
        "accuracy": 0.85,
        "precision": 0.83,
        "recall": 0.87,
        "auc": 0.89
    }
    
    with open(f"{config['outputPath']}/metrics.json", 'w') as f:
        json.dump(metrics, f)

if __name__ == "__main__":
    main()
```

## Model Validation

### Validation Criteria
- **Accuracy Threshold**: Minimum 70% accuracy
- **Precision Threshold**: Minimum 70% precision  
- **Recall Threshold**: Minimum 70% recall
- **Model Size**: Maximum 100MB
- **Health Check**: ONNX model loading and inference test

### Performance Benchmarking
- **Inference Latency**: Model prediction time
- **Memory Usage**: Model memory footprint
- **Model Size**: File size on disk

## Deployment Strategy

### Hot Model Swapping
1. Validate new model thoroughly
2. Copy model to deployment directory
3. Update organization configuration atomically
4. Hot-swap model in prediction service cache
5. Maintain previous version for rollback

### Zero-Downtime Deployment
- Models are deployed to separate directories
- Configuration updates are atomic
- Cache updates happen seamlessly
- Previous versions remain available

## Version Management

### Version Format
```
v2024-01-15T10-30-00-000Z_a1b2c3d4
```
- Timestamp: ISO format with safe characters
- Hash: Random 8-character identifier

### Rollback Process
```typescript
// Rollback to previous version
await trainingService.rollbackModel('org-123', 'v2024-01-14T10-30-00-000Z_x9y8z7w6');
```

## Monitoring and Logging

### Training Logs
All training activities are logged in the `TrainingLog` table:
- Training start/completion times
- Configuration used
- Success/failure status
- Error messages and stack traces
- Performance metrics

### Audit Trail
Complete audit trail includes:
- Model training events
- Validation results
- Deployment activities
- Rollback operations
- Schedule changes

## Error Handling

### Training Failures
- Automatic retry mechanism (up to 2 retries)
- Detailed error logging
- Notification to administrators
- Fallback to previous model version

### Validation Failures
- Detailed validation error reporting
- Performance benchmark failures
- Model health check failures
- Automatic rejection of invalid models

### Deployment Failures
- Atomic rollback on deployment failure
- Cache consistency maintenance
- Error notification and logging
- Previous version preservation

## Performance Considerations

### Resource Management
- Process isolation for training
- Memory monitoring and cleanup
- Disk space management
- CPU usage optimization

### Scalability
- Concurrent training support (different organizations)
- Queue management for training requests
- Resource allocation and limits
- Background processing

## Security

### Data Isolation
- Organization-specific directories
- Encrypted model artifacts
- Secure configuration handling
- Access control validation

### Process Security
- Sandboxed Python execution
- Resource limits and timeouts
- Input validation and sanitization
- Secure temporary file handling

## Usage Examples

### Manual Training
```typescript
import { trainingService } from './trainingService';

// Configure training
const config = {
  organizationId: 'acme-corp',
  dataRange: {
    startDate: new Date('2023-01-01'),
    endDate: new Date('2024-01-01')
  },
  hyperparameters: {
    numLeaves: 31,
    learningRate: 0.05,
    featureFraction: 0.9,
    baggingFraction: 0.8,
    baggingFreq: 5,
    minDataInLeaf: 20,
    maxDepth: -1,
    numIterations: 100,
    objective: 'binary',
    metric: 'binary_logloss',
    verbosity: -1
  },
  validationSplit: 0.2,
  targetColumn: 'failure_indicator',
  featureColumns: ['temperature', 'pressure', 'vibration', 'current']
};

// Execute training
const result = await trainingService.trainModel('acme-corp', config);
console.log(`Training completed with accuracy: ${result.accuracy}`);

// Validate model
const validation = await trainingService.validateModel('acme-corp', result.modelPath);
if (validation.isValid) {
  // Deploy model
  const deployment = await trainingService.deployModel('acme-corp', result.modelPath, result.version);
  console.log(`Model deployed successfully: ${deployment.version}`);
}
```

### Scheduled Training Setup
```typescript
// Set up weekly training schedule
const schedule = {
  pattern: '0 2 * * 0', // Every Sunday at 2 AM
  timezone: 'America/New_York',
  enabled: true
};

await trainingService.scheduleTraining('acme-corp', schedule);
console.log('Weekly training scheduled');
```

### Training History and Monitoring
```typescript
// Get training history
const history = await trainingService.getTrainingHistory('acme-corp');
console.log(`Found ${history.length} training runs`);

// Cancel active training if needed
await trainingService.cancelTraining('acme-corp');
```

## Integration Points

### Prediction Service
- Model loading and caching
- Hot model swapping
- Health monitoring
- Performance metrics

### Model Cache Service  
- Cache invalidation on deployment
- Memory management
- Performance optimization
- Model preloading

### Database Integration
- Training logs and audit trail
- Model metrics storage
- Organization configuration
- Version tracking

## Best Practices

### Training Configuration
- Use appropriate validation splits (20-30%)
- Configure hyperparameters based on data size
- Set reasonable training timeouts
- Monitor resource usage

### Model Management
- Regular model retraining (weekly recommended)
- Performance monitoring and alerting
- Rollback testing and procedures
- Version cleanup and retention

### Operational Excellence
- Monitor training success rates
- Set up alerting for failures
- Regular backup of model artifacts
- Performance benchmarking and optimization

This service provides a robust foundation for ML model lifecycle management in the predictive maintenance system, ensuring reliable, scalable, and secure model training and deployment across multiple organizations.