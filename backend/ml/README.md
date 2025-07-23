# ML Training Environment

This directory contains the comprehensive machine learning training environment for the Eagle Notifier predictive maintenance system, supporting multi-tenant, organization-specific model training and deployment.

## Directory Structure

```
ml/
├── config.py                          # Configuration management
├── features.py                        # Feature engineering
├── requirements.txt                   # Python dependencies
├── README.md                          # This file
├── artifacts/                         # Training artifacts
│   └── {org_id}/
│       └── {version}/
│           ├── training_logs/
│           ├── validation_plots/
│           └── hyperparameter_results/
├── models/                            # Trained models
│   └── {org_id}/
│       ├── current/
│       │   ├── model.onnx
│       │   ├── scaler.pkl
│       │   └── metadata.json
│       └── versions/
│           └── {version}/
└── scripts/                           # Training scripts
    ├── data_prep.py                   # Data preparation
    ├── train_model.py                 # Model training
    ├── validate_model.py              # Model validation
    ├── hyperparameter_tuning.py      # Hyperparameter optimization
    └── convert_to_onnx.py            # Model conversion
```

## Setup

1. Create Python virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Core Components

### Configuration Management (`config.py`)
- Organization-specific schema configurations
- Training parameter management
- Default configurations for different industry types
- Configuration validation and serialization

### Feature Engineering (`features.py`)
- Configurable feature generation based on organization schemas
- Lag features, rolling statistics, interaction features
- Domain-specific features for predictive maintenance
- Automated feature selection and scaling

### Training Scripts (`scripts/`)
- **data_prep.py**: Multi-tenant data extraction and preprocessing
- **train_model.py**: Organization-scoped model training
- **validate_model.py**: Comprehensive model validation
- **hyperparameter_tuning.py**: Automated hyperparameter optimization
- **convert_to_onnx.py**: Model conversion for deployment

## Usage

### Automated Training (via Backend Service)
The training scripts are automatically managed by the TrainingService in the backend:

```typescript
// Backend integration
const trainingService = new TrainingService();
await trainingService.trainModel(organizationId);
```

### Manual Training Pipeline
```bash
# 1. Prepare data
python scripts/data_prep.py config/org_config.json

# 2. Optimize hyperparameters
python scripts/hyperparameter_tuning.py tuning_config.json prepared_data.csv

# 3. Train model
python scripts/train_model.py training_config.json

# 4. Validate model
python scripts/validate_model.py validation_config.json test_data.csv

# 5. Convert to ONNX
python scripts/convert_to_onnx.py conversion_config.json model.pkl sample_data.csv
```

### Programmatic Usage
```python
from config import OrganizationConfig
from features import FeatureEngineer

# Load configuration
config = OrganizationConfig.load_from_file('config/manufacturing_org.json')

# Engineer features
engineer = FeatureEngineer(config)
df_engineered, feature_cols = engineer.engineer_features(raw_data)
```

## Organization Isolation

Each organization maintains complete isolation:
- **Data Processing**: Organization-specific SCADA schema configurations
- **Model Storage**: `models/{organizationId}/` directory structure
- **Training Artifacts**: `artifacts/{organizationId}/{version}/` organization
- **Configuration**: Separate configuration files per organization
- **Feature Engineering**: Schema-aware feature generation

## Supported Features

### Model Types
- LightGBM (primary)
- Random Forest
- Extensible architecture for additional models

### Feature Engineering
- Lag features (configurable time windows)
- Rolling statistics (mean, std, min, max, median)
- Rate of change and acceleration features
- Interaction features between key variables
- Time-based cyclical features
- Anomaly detection features
- Domain-specific predictive maintenance features

### Hyperparameter Optimization
- Grid search
- Random search
- Bayesian optimization (Optuna)
- Cross-validation with stratified folds

### Model Validation
- Performance metrics (accuracy, precision, recall, AUC)
- Latency testing
- Robustness testing (noise, missing data)
- Visualization (ROC curves, confusion matrices)
- Threshold validation

## Configuration Examples

### Manufacturing Organization
```json
{
  "organizationId": "manufacturing_org_1",
  "schemaConfig": {
    "continuousColumns": ["temperature", "pressure", "vibration", "current"],
    "booleanColumns": ["pump_status", "alarm_active"],
    "lagSeconds": [60, 120, 300],
    "rollingWindows": [5, 10, 20]
  }
}
```

### Power Generation Organization
```json
{
  "organizationId": "power_gen_org_1",
  "schemaConfig": {
    "continuousColumns": ["generator_temp", "turbine_speed", "power_output"],
    "lagSeconds": [30, 60, 180],
    "rollingWindows": [3, 6, 12]
  }
}
```

## Performance and Scalability

- **Parallel Processing**: Multi-threaded feature engineering and training
- **Memory Optimization**: Efficient data loading and processing
- **Model Caching**: Intelligent caching of trained models
- **Batch Processing**: Support for large-scale data processing
- **Feature Selection**: Automated dimensionality reduction

## Security

- **Data Isolation**: Complete separation of organization data
- **Model Isolation**: Organization-specific model storage
- **Input Validation**: Comprehensive validation of all inputs
- **Audit Logging**: Complete logging of all ML operations
- **Error Handling**: Secure error handling without information leakage

For detailed documentation, see `cursorUpdates/ml/task15_python_ml_training_environment.md`.