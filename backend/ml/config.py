#!/usr/bin/env python3
"""
Configuration Management for Multi-Tenant ML Training
Handles organization-specific schema configurations and training parameters
"""

import os
import json
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

@dataclass
class ScadaDbConfig:
    """SCADA database connection configuration"""
    host: str
    port: int
    database: str
    user: str
    password: str
    ssl_mode: str = 'prefer'
    connection_timeout: int = 30

@dataclass
class SchemaConfig:
    """Organization-specific SCADA schema configuration"""
    continuous_columns: List[str]
    boolean_columns: List[str]
    column_mapping: Dict[str, str]
    lag_seconds: List[int]
    rolling_windows: List[int]
    target_column: str
    timestamp_column: str = 'timestamp'
    
    def get_mapped_column(self, original_name: str) -> str:
        """Get mapped column name or return original if no mapping exists"""
        return self.column_mapping.get(original_name, original_name)
    
    def get_all_feature_columns(self) -> List[str]:
        """Get all feature columns including lag and rolling features"""
        features = []
        
        # Base continuous columns
        for col in self.continuous_columns:
            mapped_col = self.get_mapped_column(col)
            features.append(mapped_col)
            
            # Add lag features
            for lag_sec in self.lag_seconds:
                features.append(f'{mapped_col}_lag_{lag_sec}s')
            
            # Add rolling features
            for window in self.rolling_windows:
                features.extend([
                    f'{mapped_col}_rolling_mean_{window}',
                    f'{mapped_col}_rolling_std_{window}',
                    f'{mapped_col}_rolling_min_{window}',
                    f'{mapped_col}_rolling_max_{window}'
                ])
        
        # Boolean columns
        for col in self.boolean_columns:
            mapped_col = self.get_mapped_column(col)
            features.append(mapped_col)
        
        return features

@dataclass
class TrainingConfig:
    """ML model training configuration"""
    model_type: str = 'lightgbm'
    validation_split: float = 0.2
    test_split: float = 0.1
    random_state: int = 42
    cross_validation_folds: int = 5
    early_stopping_rounds: int = 10
    
    # LightGBM specific parameters
    lgb_params: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.lgb_params is None:
            self.lgb_params = {
                'objective': 'binary',
                'metric': 'binary_logloss',
                'boosting_type': 'gbdt',
                'num_leaves': 31,
                'learning_rate': 0.05,
                'feature_fraction': 0.9,
                'bagging_fraction': 0.8,
                'bagging_freq': 5,
                'min_data_in_leaf': 20,
                'max_depth': -1,
                'verbosity': -1,
                'num_iterations': 100
            }

@dataclass
class DataConfig:
    """Data extraction and processing configuration"""
    start_date: datetime
    end_date: datetime
    min_samples: int = 1000
    max_samples: int = 100000
    sampling_interval_minutes: int = 5
    failure_lookback_minutes: int = 10
    failure_lookahead_minutes: int = 5
    
    def get_date_range_days(self) -> int:
        """Get the number of days in the date range"""
        return (self.end_date - self.start_date).days

@dataclass
class ModelConfig:
    """Model deployment and versioning configuration"""
    version: str
    model_name: str
    description: str
    performance_threshold: float = 0.8
    confidence_threshold: float = 0.85
    max_prediction_latency_ms: int = 100
    model_format: str = 'onnx'
    
class OrganizationConfig:
    """Complete configuration for an organization's ML pipeline"""
    
    def __init__(self, organization_id: str, config_dict: Dict[str, Any] = None):
        self.organization_id = organization_id
        self.config_dict = config_dict or {}
        
        # Initialize configurations
        self.scada_db = self._init_scada_db_config()
        self.schema = self._init_schema_config()
        self.training = self._init_training_config()
        self.data = self._init_data_config()
        self.model = self._init_model_config()
        
        logger.info(f"Initialized configuration for organization: {organization_id}")
    
    def _init_scada_db_config(self) -> ScadaDbConfig:
        """Initialize SCADA database configuration"""
        db_config = self.config_dict.get('scadaDbConfig', {})
        
        # Use environment variables as fallback
        return ScadaDbConfig(
            host=db_config.get('host', os.getenv('SCADA_DB_HOST', 'localhost')),
            port=db_config.get('port', int(os.getenv('SCADA_DB_PORT', '5432'))),
            database=db_config.get('database', os.getenv('SCADA_DB_NAME', 'scada')),
            user=db_config.get('user', os.getenv('SCADA_DB_USER', 'postgres')),
            password=db_config.get('password', os.getenv('SCADA_DB_PASSWORD', '')),
            ssl_mode=db_config.get('sslMode', 'prefer'),
            connection_timeout=db_config.get('connectionTimeout', 30)
        )
    
    def _init_schema_config(self) -> SchemaConfig:
        """Initialize schema configuration with defaults"""
        schema_config = self.config_dict.get('schemaConfig', {})
        
        return SchemaConfig(
            continuous_columns=schema_config.get('continuousColumns', [
                'temperature', 'pressure', 'flow_rate', 'vibration', 
                'current', 'voltage', 'rpm', 'power_consumption'
            ]),
            boolean_columns=schema_config.get('booleanColumns', [
                'pump_status', 'valve_open', 'alarm_active', 'maintenance_mode'
            ]),
            column_mapping=schema_config.get('columnMapping', {}),
            lag_seconds=schema_config.get('lagSeconds', [60, 120, 300]),  # 1, 2, 5 minutes
            rolling_windows=schema_config.get('rollingWindows', [5, 10, 20]),  # 5, 10, 20 periods
            target_column=schema_config.get('targetColumn', 'failure_indicator'),
            timestamp_column=schema_config.get('timestampColumn', 'timestamp')
        )
    
    def _init_training_config(self) -> TrainingConfig:
        """Initialize training configuration"""
        training_config = self.config_dict.get('trainingConfig', {})
        
        config = TrainingConfig(
            model_type=training_config.get('modelType', 'lightgbm'),
            validation_split=training_config.get('validationSplit', 0.2),
            test_split=training_config.get('testSplit', 0.1),
            random_state=training_config.get('randomState', 42),
            cross_validation_folds=training_config.get('crossValidationFolds', 5),
            early_stopping_rounds=training_config.get('earlyStoppingRounds', 10)
        )
        
        # Override LightGBM parameters if provided
        if 'lgbParams' in training_config:
            config.lgb_params.update(training_config['lgbParams'])
        
        return config
    
    def _init_data_config(self) -> DataConfig:
        """Initialize data configuration"""
        data_config = self.config_dict.get('dataConfig', {})
        
        # Default to last 365 days if not specified
        end_date = datetime.now()
        start_date = end_date - timedelta(days=365)
        
        if 'startDate' in data_config:
            start_date = datetime.fromisoformat(data_config['startDate'].replace('Z', '+00:00'))
        if 'endDate' in data_config:
            end_date = datetime.fromisoformat(data_config['endDate'].replace('Z', '+00:00'))
        
        return DataConfig(
            start_date=start_date,
            end_date=end_date,
            min_samples=data_config.get('minSamples', 1000),
            max_samples=data_config.get('maxSamples', 100000),
            sampling_interval_minutes=data_config.get('samplingIntervalMinutes', 5),
            failure_lookback_minutes=data_config.get('failureLookbackMinutes', 10),
            failure_lookahead_minutes=data_config.get('failureLookaheadMinutes', 5)
        )
    
    def _init_model_config(self) -> ModelConfig:
        """Initialize model configuration"""
        model_config = self.config_dict.get('modelConfig', {})
        
        return ModelConfig(
            version=model_config.get('version', f'v{datetime.now().strftime("%Y%m%d_%H%M%S")}'),
            model_name=model_config.get('modelName', f'predictive_model_{self.organization_id}'),
            description=model_config.get('description', f'Predictive maintenance model for {self.organization_id}'),
            performance_threshold=model_config.get('performanceThreshold', 0.8),
            confidence_threshold=model_config.get('confidenceThreshold', 0.85),
            max_prediction_latency_ms=model_config.get('maxPredictionLatencyMs', 100),
            model_format=model_config.get('modelFormat', 'onnx')
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary"""
        return {
            'organizationId': self.organization_id,
            'scadaDbConfig': asdict(self.scada_db),
            'schemaConfig': asdict(self.schema),
            'trainingConfig': asdict(self.training),
            'dataConfig': {
                **asdict(self.data),
                'start_date': self.data.start_date.isoformat(),
                'end_date': self.data.end_date.isoformat()
            },
            'modelConfig': asdict(self.model)
        }
    
    def save_to_file(self, file_path: str) -> None:
        """Save configuration to JSON file"""
        with open(file_path, 'w') as f:
            json.dump(self.to_dict(), f, indent=2, default=str)
        logger.info(f"Configuration saved to {file_path}")
    
    @classmethod
    def load_from_file(cls, file_path: str) -> 'OrganizationConfig':
        """Load configuration from JSON file"""
        with open(file_path, 'r') as f:
            config_dict = json.load(f)
        
        organization_id = config_dict.get('organizationId')
        if not organization_id:
            raise ValueError("organizationId is required in configuration")
        
        return cls(organization_id, config_dict)
    
    def validate(self) -> List[str]:
        """Validate configuration and return list of errors"""
        errors = []
        
        # Validate SCADA DB config
        if not self.scada_db.host:
            errors.append("SCADA database host is required")
        if not self.scada_db.database:
            errors.append("SCADA database name is required")
        if not self.scada_db.user:
            errors.append("SCADA database user is required")
        
        # Validate schema config
        if not self.schema.continuous_columns and not self.schema.boolean_columns:
            errors.append("At least one continuous or boolean column must be specified")
        if not self.schema.target_column:
            errors.append("Target column is required")
        
        # Validate data config
        if self.data.start_date >= self.data.end_date:
            errors.append("Start date must be before end date")
        if self.data.min_samples <= 0:
            errors.append("Minimum samples must be positive")
        
        # Validate training config
        if not 0 < self.training.validation_split < 1:
            errors.append("Validation split must be between 0 and 1")
        if not 0 < self.training.test_split < 1:
            errors.append("Test split must be between 0 and 1")
        if (self.training.validation_split + self.training.test_split) >= 1:
            errors.append("Validation and test splits combined must be less than 1")
        
        return errors

class ConfigManager:
    """Manages configurations for multiple organizations"""
    
    def __init__(self, config_dir: str = 'configs'):
        self.config_dir = config_dir
        os.makedirs(config_dir, exist_ok=True)
        logger.info(f"Initialized config manager with directory: {config_dir}")
    
    def get_config_path(self, organization_id: str) -> str:
        """Get configuration file path for organization"""
        return os.path.join(self.config_dir, f'{organization_id}_config.json')
    
    def load_config(self, organization_id: str) -> OrganizationConfig:
        """Load configuration for organization"""
        config_path = self.get_config_path(organization_id)
        
        if os.path.exists(config_path):
            return OrganizationConfig.load_from_file(config_path)
        else:
            logger.warning(f"Configuration file not found for {organization_id}, using defaults")
            return OrganizationConfig(organization_id)
    
    def save_config(self, config: OrganizationConfig) -> None:
        """Save configuration for organization"""
        config_path = self.get_config_path(config.organization_id)
        config.save_to_file(config_path)
    
    def list_organizations(self) -> List[str]:
        """List all organizations with configurations"""
        organizations = []
        for filename in os.listdir(self.config_dir):
            if filename.endswith('_config.json'):
                org_id = filename.replace('_config.json', '')
                organizations.append(org_id)
        return organizations
    
    def create_default_config(self, organization_id: str, overrides: Dict[str, Any] = None) -> OrganizationConfig:
        """Create default configuration for organization"""
        config_dict = overrides or {}
        config = OrganizationConfig(organization_id, config_dict)
        
        # Validate configuration
        errors = config.validate()
        if errors:
            logger.warning(f"Configuration validation warnings for {organization_id}: {errors}")
        
        # Save configuration
        self.save_config(config)
        
        return config

# Default configurations for different organization types
DEFAULT_CONFIGS = {
    'manufacturing': {
        'schemaConfig': {
            'continuousColumns': [
                'temperature', 'pressure', 'flow_rate', 'vibration',
                'current', 'voltage', 'rpm', 'power_consumption'
            ],
            'booleanColumns': [
                'pump_status', 'valve_open', 'alarm_active', 'maintenance_mode'
            ],
            'lagSeconds': [60, 120, 300],
            'rollingWindows': [5, 10, 20]
        },
        'trainingConfig': {
            'lgbParams': {
                'num_leaves': 31,
                'learning_rate': 0.05,
                'num_iterations': 200
            }
        }
    },
    'power_generation': {
        'schemaConfig': {
            'continuousColumns': [
                'generator_temp', 'turbine_speed', 'power_output', 'fuel_flow',
                'exhaust_temp', 'oil_pressure', 'coolant_temp'
            ],
            'booleanColumns': [
                'generator_online', 'turbine_running', 'fault_detected'
            ],
            'lagSeconds': [30, 60, 180],
            'rollingWindows': [3, 6, 12]
        }
    },
    'water_treatment': {
        'schemaConfig': {
            'continuousColumns': [
                'ph_level', 'turbidity', 'chlorine_level', 'flow_rate',
                'pressure', 'temperature', 'conductivity'
            ],
            'booleanColumns': [
                'pump_running', 'filter_active', 'chemical_feed_on'
            ],
            'lagSeconds': [120, 300, 600],
            'rollingWindows': [10, 20, 40]
        }
    }
}

def get_default_config_for_type(organization_type: str) -> Dict[str, Any]:
    """Get default configuration for organization type"""
    return DEFAULT_CONFIGS.get(organization_type, DEFAULT_CONFIGS['manufacturing'])

if __name__ == '__main__':
    # Example usage
    config_manager = ConfigManager()
    
    # Create a sample configuration
    sample_config = config_manager.create_default_config(
        'sample_org',
        get_default_config_for_type('manufacturing')
    )
    
    print("Sample configuration created:")
    print(json.dumps(sample_config.to_dict(), indent=2, default=str))