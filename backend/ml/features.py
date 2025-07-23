#!/usr/bin/env python3
"""
Feature Engineering Module for Multi-Tenant Predictive Maintenance
Configurable feature generation based on organization-specific schemas
"""

import numpy as np
import pandas as pd
import logging
from typing import Dict, List, Tuple, Any, Optional
from datetime import datetime, timedelta
from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler
from sklearn.feature_selection import SelectKBest, f_classif, mutual_info_classif
from config import OrganizationConfig, SchemaConfig

logger = logging.getLogger(__name__)

class FeatureEngineer:
    """Organization-specific feature engineering for predictive maintenance"""
    
    def __init__(self, config: OrganizationConfig):
        self.config = config
        self.organization_id = config.organization_id
        self.schema = config.schema
        self.scaler = None
        self.feature_selector = None
        
        logger.info(f"Initialized feature engineer for organization: {self.organization_id}")
    
    def create_lag_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create lag features for time series analysis"""
        logger.info(f"Creating lag features with lags: {self.schema.lag_seconds}")
        
        # Convert lag seconds to periods (assuming 5-minute intervals)
        sampling_interval = self.config.data.sampling_interval_minutes * 60  # Convert to seconds
        lag_periods = [max(1, lag_sec // sampling_interval) for lag_sec in self.schema.lag_seconds]
        
        # Create lag features for continuous columns
        for col in self.schema.continuous_columns:
            mapped_col = self.schema.get_mapped_column(col)
            if mapped_col in df.columns:
                for i, lag_period in enumerate(lag_periods):
                    lag_col = f'{mapped_col}_lag_{self.schema.lag_seconds[i]}s'
                    df[lag_col] = df[mapped_col].shift(lag_period)
                    logger.debug(f"Created lag feature: {lag_col}")
        
        return df
    
    def create_rolling_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create rolling statistical features"""
        logger.info(f"Creating rolling features with windows: {self.schema.rolling_windows}")
        
        # Create rolling features for continuous columns
        for col in self.schema.continuous_columns:
            mapped_col = self.schema.get_mapped_column(col)
            if mapped_col in df.columns:
                for window in self.schema.rolling_windows:
                    # Rolling mean
                    mean_col = f'{mapped_col}_rolling_mean_{window}'
                    df[mean_col] = df[mapped_col].rolling(window=window, min_periods=1).mean()
                    
                    # Rolling standard deviation
                    std_col = f'{mapped_col}_rolling_std_{window}'
                    df[std_col] = df[mapped_col].rolling(window=window, min_periods=1).std()
                    
                    # Rolling min and max
                    min_col = f'{mapped_col}_rolling_min_{window}'
                    max_col = f'{mapped_col}_rolling_max_{window}'
                    df[min_col] = df[mapped_col].rolling(window=window, min_periods=1).min()
                    df[max_col] = df[mapped_col].rolling(window=window, min_periods=1).max()
                    
                    # Rolling median
                    median_col = f'{mapped_col}_rolling_median_{window}'
                    df[median_col] = df[mapped_col].rolling(window=window, min_periods=1).median()
                    
                    logger.debug(f"Created rolling features for {mapped_col} with window {window}")
        
        return df
    
    def create_rate_of_change_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create rate of change features"""
        logger.info("Creating rate of change features")
        
        for col in self.schema.continuous_columns:
            mapped_col = self.schema.get_mapped_column(col)
            if mapped_col in df.columns:
                # First derivative (rate of change)
                roc_col = f'{mapped_col}_roc'
                df[roc_col] = df[mapped_col].diff()
                
                # Second derivative (acceleration)
                acc_col = f'{mapped_col}_acceleration'
                df[acc_col] = df[roc_col].diff()
                
                # Percentage change
                pct_col = f'{mapped_col}_pct_change'
                df[pct_col] = df[mapped_col].pct_change()
                
                logger.debug(f"Created rate of change features for {mapped_col}")
        
        return df
    
    def create_interaction_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create interaction features between variables"""
        logger.info("Creating interaction features")
        
        continuous_cols = [self.schema.get_mapped_column(col) for col in self.schema.continuous_columns 
                          if self.schema.get_mapped_column(col) in df.columns]
        
        # Create pairwise interactions for key variables
        key_interactions = [
            ('temperature', 'pressure'),
            ('current', 'voltage'),
            ('vibration', 'rpm'),
            ('flow_rate', 'pressure')
        ]
        
        for col1_orig, col2_orig in key_interactions:
            col1 = self.schema.get_mapped_column(col1_orig)
            col2 = self.schema.get_mapped_column(col2_orig)
            
            if col1 in df.columns and col2 in df.columns:
                # Multiplication
                mult_col = f'{col1}_{col2}_mult'
                df[mult_col] = df[col1] * df[col2]
                
                # Ratio
                ratio_col = f'{col1}_{col2}_ratio'
                df[ratio_col] = df[col1] / (df[col2] + 1e-8)  # Add small epsilon to avoid division by zero
                
                # Difference
                diff_col = f'{col1}_{col2}_diff'
                df[diff_col] = df[col1] - df[col2]
                
                logger.debug(f"Created interaction features for {col1} and {col2}")
        
        return df
    
    def create_statistical_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create statistical features across multiple variables"""
        logger.info("Creating statistical features")
        
        continuous_cols = [self.schema.get_mapped_column(col) for col in self.schema.continuous_columns 
                          if self.schema.get_mapped_column(col) in df.columns]
        
        if len(continuous_cols) >= 2:
            # Cross-variable statistics
            df['mean_all_continuous'] = df[continuous_cols].mean(axis=1)
            df['std_all_continuous'] = df[continuous_cols].std(axis=1)
            df['min_all_continuous'] = df[continuous_cols].min(axis=1)
            df['max_all_continuous'] = df[continuous_cols].max(axis=1)
            df['range_all_continuous'] = df['max_all_continuous'] - df['min_all_continuous']
            
            # Coefficient of variation
            df['cv_all_continuous'] = df['std_all_continuous'] / (df['mean_all_continuous'] + 1e-8)
            
            logger.debug("Created cross-variable statistical features")
        
        return df
    
    def create_time_based_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create time-based features"""
        logger.info("Creating time-based features")
        
        timestamp_col = self.schema.timestamp_column
        if timestamp_col in df.columns:
            # Ensure timestamp is datetime
            if not pd.api.types.is_datetime64_any_dtype(df[timestamp_col]):
                df[timestamp_col] = pd.to_datetime(df[timestamp_col])
            
            # Extract time components
            df['hour'] = df[timestamp_col].dt.hour
            df['day_of_week'] = df[timestamp_col].dt.dayofweek
            df['day_of_month'] = df[timestamp_col].dt.day
            df['month'] = df[timestamp_col].dt.month
            df['quarter'] = df[timestamp_col].dt.quarter
            
            # Cyclical encoding for time features
            df['hour_sin'] = np.sin(2 * np.pi * df['hour'] / 24)
            df['hour_cos'] = np.cos(2 * np.pi * df['hour'] / 24)
            df['day_sin'] = np.sin(2 * np.pi * df['day_of_week'] / 7)
            df['day_cos'] = np.cos(2 * np.pi * df['day_of_week'] / 7)
            df['month_sin'] = np.sin(2 * np.pi * df['month'] / 12)
            df['month_cos'] = np.cos(2 * np.pi * df['month'] / 12)
            
            # Time since start
            df['time_since_start'] = (df[timestamp_col] - df[timestamp_col].min()).dt.total_seconds()
            
            logger.debug("Created time-based features")
        
        return df
    
    def create_anomaly_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create anomaly detection features"""
        logger.info("Creating anomaly detection features")
        
        for col in self.schema.continuous_columns:
            mapped_col = self.schema.get_mapped_column(col)
            if mapped_col in df.columns:
                # Z-score based anomaly detection
                mean_val = df[mapped_col].mean()
                std_val = df[mapped_col].std()
                z_score_col = f'{mapped_col}_z_score'
                df[z_score_col] = (df[mapped_col] - mean_val) / (std_val + 1e-8)
                
                # Anomaly flags
                anomaly_col = f'{mapped_col}_anomaly'
                df[anomaly_col] = (np.abs(df[z_score_col]) > 3).astype(int)
                
                # Distance from rolling mean
                rolling_mean = df[mapped_col].rolling(window=20, min_periods=1).mean()
                distance_col = f'{mapped_col}_distance_from_mean'
                df[distance_col] = np.abs(df[mapped_col] - rolling_mean)
                
                logger.debug(f"Created anomaly features for {mapped_col}")
        
        return df
    
    def create_domain_specific_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create domain-specific features for predictive maintenance"""
        logger.info("Creating domain-specific features")
        
        # Power-related features
        current_col = self.schema.get_mapped_column('current')
        voltage_col = self.schema.get_mapped_column('voltage')
        if current_col in df.columns and voltage_col in df.columns:
            df['power'] = df[current_col] * df[voltage_col]
            df['power_factor'] = df['power'] / (df[current_col] * df[voltage_col] + 1e-8)
            logger.debug("Created power-related features")
        
        # Temperature efficiency features
        temp_col = self.schema.get_mapped_column('temperature')
        if temp_col in df.columns:
            # Temperature efficiency (inverse relationship)
            df['temp_efficiency'] = 1 / (df[temp_col] + 1e-8)
            
            # Temperature stress indicator
            normal_temp = df[temp_col].quantile(0.5)  # Median as normal
            df['temp_stress'] = np.maximum(0, df[temp_col] - normal_temp)
            logger.debug("Created temperature efficiency features")
        
        # Vibration health features
        vibration_col = self.schema.get_mapped_column('vibration')
        if vibration_col in df.columns:
            # Vibration health score (lower is better)
            max_vibration = df[vibration_col].quantile(0.95)
            df['vibration_health'] = 1 - (df[vibration_col] / (max_vibration + 1e-8))
            
            # Vibration trend
            df['vibration_trend'] = df[vibration_col].rolling(window=10).apply(
                lambda x: np.polyfit(range(len(x)), x, 1)[0] if len(x) > 1 else 0
            )
            logger.debug("Created vibration health features")
        
        # Flow efficiency features
        flow_col = self.schema.get_mapped_column('flow_rate')
        pressure_col = self.schema.get_mapped_column('pressure')
        if flow_col in df.columns and pressure_col in df.columns:
            # Flow efficiency
            df['flow_efficiency'] = df[flow_col] / (df[pressure_col] + 1e-8)
            
            # Hydraulic power
            df['hydraulic_power'] = df[flow_col] * df[pressure_col]
            logger.debug("Created flow efficiency features")
        
        return df
    
    def apply_feature_scaling(self, df: pd.DataFrame, feature_columns: List[str], 
                            scaler_type: str = 'standard') -> Tuple[pd.DataFrame, Any]:
        """Apply feature scaling to continuous features"""
        logger.info(f"Applying {scaler_type} scaling to features")
        
        # Select scaler
        if scaler_type == 'standard':
            scaler = StandardScaler()
        elif scaler_type == 'minmax':
            scaler = MinMaxScaler()
        elif scaler_type == 'robust':
            scaler = RobustScaler()
        else:
            raise ValueError(f"Unknown scaler type: {scaler_type}")
        
        # Apply scaling to feature columns
        df_scaled = df.copy()
        scaled_features = scaler.fit_transform(df[feature_columns])
        df_scaled[feature_columns] = scaled_features
        
        self.scaler = scaler
        logger.info(f"Applied {scaler_type} scaling to {len(feature_columns)} features")
        
        return df_scaled, scaler
    
    def select_features(self, df: pd.DataFrame, target_col: str, 
                       feature_columns: List[str], k: int = 50, 
                       method: str = 'f_classif') -> Tuple[pd.DataFrame, List[str]]:
        """Select top k features using statistical tests"""
        logger.info(f"Selecting top {k} features using {method}")
        
        X = df[feature_columns]
        y = df[target_col]
        
        # Remove any remaining NaN values
        mask = ~(X.isna().any(axis=1) | y.isna())
        X_clean = X[mask]
        y_clean = y[mask]
        
        # Select scoring function
        if method == 'f_classif':
            score_func = f_classif
        elif method == 'mutual_info':
            score_func = mutual_info_classif
        else:
            raise ValueError(f"Unknown feature selection method: {method}")
        
        # Apply feature selection
        selector = SelectKBest(score_func=score_func, k=min(k, len(feature_columns)))
        X_selected = selector.fit_transform(X_clean, y_clean)
        
        # Get selected feature names
        selected_features = [feature_columns[i] for i in selector.get_support(indices=True)]
        
        # Create DataFrame with selected features
        df_selected = df.copy()
        df_selected = df_selected[selected_features + [target_col, self.schema.timestamp_column]]
        
        self.feature_selector = selector
        logger.info(f"Selected {len(selected_features)} features: {selected_features[:10]}...")
        
        return df_selected, selected_features
    
    def engineer_features(self, df: pd.DataFrame, include_selection: bool = True, 
                         max_features: int = 100) -> Tuple[pd.DataFrame, List[str]]:
        """Complete feature engineering pipeline"""
        logger.info(f"Starting feature engineering for organization: {self.organization_id}")
        
        # Apply column mapping
        df = df.rename(columns=self.schema.column_mapping)
        
        # Create time-based features first
        df = self.create_time_based_features(df)
        
        # Create lag features
        df = self.create_lag_features(df)
        
        # Create rolling features
        df = self.create_rolling_features(df)
        
        # Create rate of change features
        df = self.create_rate_of_change_features(df)
        
        # Create interaction features
        df = self.create_interaction_features(df)
        
        # Create statistical features
        df = self.create_statistical_features(df)
        
        # Create anomaly features
        df = self.create_anomaly_features(df)
        
        # Create domain-specific features
        df = self.create_domain_specific_features(df)
        
        # Clean data - remove rows with too many NaN values
        initial_rows = len(df)
        df = df.dropna(thresh=int(len(df.columns) * 0.7))  # Keep rows with at least 70% non-null values
        
        # Forward fill remaining NaN values
        df = df.fillna(method='ffill').fillna(method='bfill')
        
        # Remove any remaining NaN values
        df = df.dropna()
        
        logger.info(f"Data cleaning: {initial_rows} -> {len(df)} rows")
        
        # Get feature columns (exclude target and timestamp)
        exclude_cols = {self.schema.target_column, self.schema.timestamp_column}
        feature_columns = [col for col in df.columns if col not in exclude_cols]
        
        logger.info(f"Generated {len(feature_columns)} features before selection")
        
        # Feature selection if requested
        if include_selection and len(feature_columns) > max_features:
            df, selected_features = self.select_features(
                df, self.schema.target_column, feature_columns, k=max_features
            )
            feature_columns = selected_features
        
        logger.info(f"Feature engineering completed: {len(feature_columns)} final features")
        
        return df, feature_columns
    
    def get_feature_importance(self, model, feature_names: List[str]) -> Dict[str, float]:
        """Get feature importance from trained model"""
        try:
            if hasattr(model, 'feature_importances_'):
                # Sklearn-style models
                importances = model.feature_importances_
            elif hasattr(model, 'feature_importance'):
                # LightGBM models
                importances = model.feature_importance(importance_type='gain')
            else:
                logger.warning("Model does not support feature importance")
                return {}
            
            # Create importance dictionary
            importance_dict = dict(zip(feature_names, importances))
            
            # Sort by importance
            sorted_importance = dict(sorted(importance_dict.items(), 
                                          key=lambda x: x[1], reverse=True))
            
            logger.info(f"Top 10 important features: {list(sorted_importance.keys())[:10]}")
            
            return sorted_importance
            
        except Exception as e:
            logger.error(f"Error getting feature importance: {e}")
            return {}

def create_feature_summary(df: pd.DataFrame, feature_columns: List[str], 
                          target_col: str) -> Dict[str, Any]:
    """Create a summary of engineered features"""
    summary = {
        'total_features': len(feature_columns),
        'total_samples': len(df),
        'feature_types': {},
        'missing_values': {},
        'target_distribution': {}
    }
    
    # Categorize features by type
    feature_types = {
        'lag': [col for col in feature_columns if '_lag_' in col],
        'rolling': [col for col in feature_columns if '_rolling_' in col],
        'interaction': [col for col in feature_columns if '_mult' in col or '_ratio' in col or '_diff' in col],
        'time': [col for col in feature_columns if any(time_word in col for time_word in ['hour', 'day', 'month', 'sin', 'cos'])],
        'anomaly': [col for col in feature_columns if 'anomaly' in col or 'z_score' in col],
        'domain': [col for col in feature_columns if any(domain_word in col for domain_word in ['power', 'efficiency', 'health', 'stress'])],
        'base': [col for col in feature_columns if not any(suffix in col for suffix in ['_lag_', '_rolling_', '_mult', '_ratio', '_diff', 'anomaly', 'z_score', 'hour', 'day', 'month', 'sin', 'cos', 'power', 'efficiency', 'health', 'stress'])]
    }
    
    summary['feature_types'] = {k: len(v) for k, v in feature_types.items()}
    
    # Check for missing values
    for col in feature_columns:
        missing_pct = df[col].isna().sum() / len(df) * 100
        if missing_pct > 0:
            summary['missing_values'][col] = missing_pct
    
    # Target distribution
    if target_col in df.columns:
        target_counts = df[target_col].value_counts()
        summary['target_distribution'] = target_counts.to_dict()
    
    return summary

if __name__ == '__main__':
    # Example usage
    from config import OrganizationConfig
    
    # Create sample configuration
    config = OrganizationConfig('sample_org')
    
    # Initialize feature engineer
    engineer = FeatureEngineer(config)
    
    # Create sample data
    np.random.seed(42)
    n_samples = 1000
    
    data = {
        'timestamp': pd.date_range('2024-01-01', periods=n_samples, freq='5T'),
        'temperature': np.random.normal(75, 10, n_samples),
        'pressure': np.random.normal(100, 15, n_samples),
        'vibration': np.random.normal(3, 1, n_samples),
        'current': np.random.normal(15, 3, n_samples),
        'voltage': np.random.normal(240, 10, n_samples),
        'failure_indicator': np.random.binomial(1, 0.1, n_samples)
    }
    
    df = pd.DataFrame(data)
    
    # Engineer features
    df_engineered, feature_columns = engineer.engineer_features(df)
    
    # Create summary
    summary = create_feature_summary(df_engineered, feature_columns, 'failure_indicator')
    
    print("Feature Engineering Summary:")
    print(f"Total features: {summary['total_features']}")
    print(f"Feature types: {summary['feature_types']}")
    print(f"Missing values: {len(summary['missing_values'])} features with missing data")
    print(f"Target distribution: {summary['target_distribution']}")