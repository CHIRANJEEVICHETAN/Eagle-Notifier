#!/usr/bin/env python3
"""
Data Preparation Script for Multi-Tenant Predictive Maintenance
Handles organization-specific SCADA data extraction and preprocessing
"""

import sys
import json
import os
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Any, Optional
import warnings
warnings.filterwarnings('ignore')

import numpy as np
import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DataPreparator:
    """Multi-tenant data preparation for predictive maintenance"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.organization_id = config['organizationId']
        self.scada_config = config.get('scadaDbConfig', {})
        self.schema_config = config.get('schemaConfig', {})
        
        logger.info(f"Initialized data preparator for organization: {self.organization_id}")
    
    def connect_to_scada_db(self) -> psycopg2.extensions.connection:
        """Connect to organization-specific SCADA database"""
        try:
            if not self.scada_config:
                raise ValueError("SCADA database configuration not found")
            
            connection = psycopg2.connect(
                host=self.scada_config.get('host', 'localhost'),
                port=self.scada_config.get('port', 5432),
                database=self.scada_config.get('database'),
                user=self.scada_config.get('user'),
                password=self.scada_config.get('password')
            )
            
            logger.info(f"Connected to SCADA database for org: {self.organization_id}")
            return connection
            
        except Exception as e:
            logger.error(f"Failed to connect to SCADA database: {e}")
            raise
    
    def extract_scada_data(self, start_date: datetime, end_date: datetime) -> pd.DataFrame:
        """Extract SCADA data for the specified date range"""
        try:
            # For demo purposes, generate synthetic data
            # In production, this would query the actual SCADA database
            logger.info(f"Extracting SCADA data from {start_date} to {end_date}")
            
            # Generate synthetic data based on schema configuration
            return self.generate_synthetic_scada_data(start_date, end_date)
            
        except Exception as e:
            logger.error(f"Error extracting SCADA data: {e}")
            raise
    
    def generate_synthetic_scada_data(self, start_date: datetime, end_date: datetime) -> pd.DataFrame:
        """Generate synthetic SCADA data for training"""
        logger.info("Generating synthetic SCADA data...")
        
        # Calculate number of data points (5-minute intervals)
        time_diff = end_date - start_date
        total_minutes = int(time_diff.total_seconds() / 60)
        n_points = total_minutes // 5  # 5-minute intervals
        
        # Generate timestamps
        timestamps = [start_date + timedelta(minutes=i*5) for i in range(n_points)]
        
        # Get column configuration
        continuous_cols = self.schema_config.get('continuousColumns', [
            'temperature', 'pressure', 'flow_rate', 'vibration', 'current', 'voltage'
        ])
        
        boolean_cols = self.schema_config.get('booleanColumns', [
            'pump_status', 'valve_open', 'alarm_active'
        ])
        
        # Generate continuous data
        data = {'timestamp': timestamps}
        
        # Simulate normal operation with occasional anomalies
        failure_probability = 0.02  # 2% chance of failure conditions
        
        for i, timestamp in enumerate(timestamps):
            # Determine if this is a failure condition
            is_failure = np.random.random() < failure_probability
            
            # Generate continuous variables
            for col in continuous_cols:
                if col == 'temperature':
                    if is_failure:
                        value = np.random.normal(95, 10)  # High temperature
                    else:
                        value = np.random.normal(75, 5)   # Normal temperature
                elif col == 'pressure':
                    if is_failure:
                        value = np.random.normal(130, 15)  # High pressure
                    else:
                        value = np.random.normal(100, 8)   # Normal pressure
                elif col == 'vibration':
                    if is_failure:
                        value = np.random.normal(8.0, 2.0)  # High vibration
                    else:
                        value = np.random.normal(2.5, 0.5)  # Low vibration
                elif col == 'current':
                    if is_failure:
                        value = np.random.normal(25, 5)    # High current
                    else:
                        value = np.random.normal(15, 2)    # Normal current
                elif col == 'voltage':
                    if is_failure:
                        value = np.random.normal(220, 10)  # Voltage drop
                    else:
                        value = np.random.normal(240, 5)   # Normal voltage
                elif col == 'flow_rate':
                    if is_failure:
                        value = np.random.normal(80, 15)   # Reduced flow
                    else:
                        value = np.random.normal(120, 10)  # Normal flow
                else:
                    # Generic continuous variable
                    if is_failure:
                        value = np.random.normal(80, 15)
                    else:
                        value = np.random.normal(50, 10)
                
                # Store value
                if col not in data:
                    data[col] = []
                data[col].append(max(0, value))  # Ensure non-negative values
            
            # Generate boolean variables
            for col in boolean_cols:
                if col == 'alarm_active':
                    value = is_failure or (np.random.random() < 0.05)  # 5% random alarms
                elif col == 'pump_status':
                    value = not is_failure and (np.random.random() < 0.9)  # Usually on
                elif col == 'valve_open':
                    value = np.random.random() < 0.7  # Usually open
                else:
                    value = np.random.random() < 0.5  # Random boolean
                
                if col not in data:
                    data[col] = []
                data[col].append(value)
        
        # Create DataFrame
        df = pd.DataFrame(data)
        
        # Add failure indicator (target variable)
        # Look ahead 5-10 minutes for failure prediction
        df['failure_indicator'] = 0
        
        # Mark failure conditions based on multiple criteria
        failure_conditions = (
            (df.get('temperature', 0) > 90) |
            (df.get('pressure', 0) > 120) |
            (df.get('vibration', 0) > 6.0) |
            (df.get('current', 0) > 20)
        )
        
        df.loc[failure_conditions, 'failure_indicator'] = 1
        
        logger.info(f"Generated {len(df)} data points with {df['failure_indicator'].sum()} failure conditions")
        logger.info(f"Failure rate: {df['failure_indicator'].mean():.2%}")
        
        return df
    
    def apply_column_mapping(self, df: pd.DataFrame) -> pd.DataFrame:
        """Apply organization-specific column mapping"""
        column_mapping = self.schema_config.get('columnMapping', {})
        
        if column_mapping:
            logger.info(f"Applying column mapping: {column_mapping}")
            df = df.rename(columns=column_mapping)
        
        return df
    
    def add_lag_features(self, df: pd.DataFrame, lag_seconds: List[int] = None) -> pd.DataFrame:
        """Add lag features for time series analysis"""
        if lag_seconds is None:
            lag_seconds = self.schema_config.get('lagSeconds', [60, 120])  # 1 and 2 minutes
        
        logger.info(f"Adding lag features: {lag_seconds} seconds")
        
        # Convert lag seconds to number of periods (5-minute intervals)
        lag_periods = [max(1, lag_sec // 300) for lag_sec in lag_seconds]
        
        # Get continuous columns
        continuous_cols = self.schema_config.get('continuousColumns', [
            'temperature', 'pressure', 'flow_rate', 'vibration', 'current', 'voltage'
        ])
        
        # Add lag features for continuous columns
        for col in continuous_cols:
            if col in df.columns:
                for i, lag in enumerate(lag_periods):
                    lag_col = f'{col}_lag_{lag_seconds[i]}s'
                    df[lag_col] = df[col].shift(lag)
        
        return df
    
    def add_rolling_features(self, df: pd.DataFrame, windows: List[int] = None) -> pd.DataFrame:
        """Add rolling statistics features"""
        if windows is None:
            windows = self.schema_config.get('rollingWindows', [5, 10])  # 5 and 10 periods
        
        logger.info(f"Adding rolling features with windows: {windows}")
        
        # Get continuous columns
        continuous_cols = self.schema_config.get('continuousColumns', [
            'temperature', 'pressure', 'flow_rate', 'vibration', 'current', 'voltage'
        ])
        
        # Add rolling features for continuous columns
        for col in continuous_cols:
            if col in df.columns:
                for window in windows:
                    # Rolling mean
                    df[f'{col}_rolling_mean_{window}'] = df[col].rolling(window=window).mean()
                    
                    # Rolling standard deviation
                    df[f'{col}_rolling_std_{window}'] = df[col].rolling(window=window).std()
                    
                    # Rolling min/max
                    df[f'{col}_rolling_min_{window}'] = df[col].rolling(window=window).min()
                    df[f'{col}_rolling_max_{window}'] = df[col].rolling(window=window).max()
        
        return df
    
    def clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean and validate data"""
        logger.info("Cleaning data...")
        
        initial_rows = len(df)
        
        # Remove rows with too many missing values
        missing_threshold = 0.5  # Remove rows with >50% missing values
        df = df.dropna(thresh=int(len(df.columns) * (1 - missing_threshold)))
        
        # Forward fill remaining missing values
        df = df.fillna(method='ffill')
        
        # Backward fill any remaining missing values
        df = df.fillna(method='bfill')
        
        # Remove any remaining rows with missing values
        df = df.dropna()
        
        # Remove duplicate timestamps
        if 'timestamp' in df.columns:
            df = df.drop_duplicates(subset=['timestamp'])
            df = df.sort_values('timestamp')
        
        final_rows = len(df)
        logger.info(f"Data cleaning: {initial_rows} -> {final_rows} rows ({final_rows/initial_rows:.1%} retained)")
        
        return df
    
    def prepare_training_data(self, start_date: datetime, end_date: datetime) -> pd.DataFrame:
        """Complete data preparation pipeline"""
        try:
            logger.info(f"Starting data preparation for org: {self.organization_id}")
            
            # Extract raw data
            df = self.extract_scada_data(start_date, end_date)
            
            # Apply column mapping
            df = self.apply_column_mapping(df)
            
            # Add lag features
            df = self.add_lag_features(df)
            
            # Add rolling features
            df = self.add_rolling_features(df)
            
            # Clean data
            df = self.clean_data(df)
            
            logger.info(f"Data preparation completed: {len(df)} samples, {len(df.columns)} features")
            logger.info(f"Feature columns: {list(df.columns)}")
            
            return df
            
        except Exception as e:
            logger.error(f"Error in data preparation: {e}")
            raise

def main():
    """Main data preparation entry point"""
    if len(sys.argv) != 2:
        print("Usage: python data_prep.py <config_path>")
        sys.exit(1)
    
    config_path = sys.argv[1]
    
    try:
        # Load configuration
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        # Initialize data preparator
        preparator = DataPreparator(config)
        
        # Get date range from config
        data_range = config.get('dataRange', {})
        start_date = datetime.fromisoformat(data_range['startDate'].replace('Z', '+00:00'))
        end_date = datetime.fromisoformat(data_range['endDate'].replace('Z', '+00:00'))
        
        # Prepare training data
        df = preparator.prepare_training_data(start_date, end_date)
        
        # Save prepared data
        output_path = config.get('outputPath', '.')
        data_file = os.path.join(output_path, 'prepared_data.csv')
        df.to_csv(data_file, index=False)
        
        # Save data summary
        summary = {
            'organizationId': preparator.organization_id,
            'dataPoints': len(df),
            'features': list(df.columns),
            'dateRange': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat()
            },
            'failureRate': float(df.get('failure_indicator', pd.Series([0])).mean()),
            'dataFile': data_file
        }
        
        summary_file = os.path.join(output_path, 'data_summary.json')
        with open(summary_file, 'w') as f:
            json.dump(summary, f, indent=2)
        
        print(json.dumps(summary, indent=2))
        
    except Exception as e:
        error_result = {
            'status': 'FAILED',
            'error': str(e)
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)

if __name__ == '__main__':
    main()