#!/usr/bin/env python3
"""
Hyperparameter Tuning Script for Predictive Maintenance Models
Automated hyperparameter optimization using various search strategies
"""

import sys
import json
import os
import logging
import traceback
from datetime import datetime
from typing import Dict, List, Tuple, Any, Optional
import warnings
warnings.filterwarnings('ignore')

import numpy as np
import pandas as pd
from sklearn.model_selection import (
    train_test_split, cross_val_score, StratifiedKFold,
    GridSearchCV, RandomizedSearchCV
)
from sklearn.metrics import accuracy_score, precision_score, recall_score, roc_auc_score
from sklearn.ensemble import RandomForestClassifier
import lightgbm as lgb
from scipy.stats import uniform, randint
import optuna
import pickle

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class HyperparameterTuner:
    """Automated hyperparameter tuning for predictive maintenance models"""
    
    def __init__(self, config_path: str):
        self.config = self.load_config(config_path)
        self.organization_id = self.config['organizationId']
        self.output_path = self.config['outputPath']
        
        # Tuning configuration
        self.model_type = self.config.get('modelType', 'lightgbm')
        self.search_method = self.config.get('searchMethod', 'optuna')  # 'grid', 'random', 'optuna'
        self.n_trials = self.config.get('nTrials', 100)
        self.cv_folds = self.config.get('cvFolds', 5)
        self.scoring_metric = self.config.get('scoringMetric', 'roc_auc')
        self.random_state = self.config.get('randomState', 42)
        
        logger.info(f"Initialized hyperparameter tuner for org: {self.organization_id}")
        logger.info(f"Model: {self.model_type}, Search: {self.search_method}, Trials: {self.n_trials}")
    
    def load_config(self, config_path: str) -> Dict[str, Any]:
        """Load tuning configuration"""
        with open(config_path, 'r') as f:
            return json.load(f)
    
    def load_training_data(self, data_path: str) -> Tuple[np.ndarray, np.ndarray, List[str]]:
        """Load training data for hyperparameter tuning"""
        logger.info(f"Loading training data from: {data_path}")
        
        if data_path.endswith('.csv'):
            df = pd.read_csv(data_path)
            
            # Get feature columns and target
            target_col = self.config.get('targetColumn', 'failure_indicator')
            feature_cols = [col for col in df.columns if col not in [target_col, 'timestamp']]
            
            X = df[feature_cols].values
            y = df[target_col].values
            
            # Handle NaN values
            X = np.nan_to_num(X, nan=0.0)
            
            logger.info(f"Loaded {len(X)} training samples with {len(feature_cols)} features")
            logger.info(f"Class distribution: {np.bincount(y.astype(int))}")
            
            return X, y, feature_cols
        else:
            raise ValueError(f"Unsupported data format: {data_path}")
    
    def get_lightgbm_search_space(self) -> Dict[str, Any]:
        """Define LightGBM hyperparameter search space"""
        if self.search_method == 'grid':
            # Grid search space (smaller for computational efficiency)
            return {
                'num_leaves': [15, 31, 63],
                'learning_rate': [0.01, 0.05, 0.1],
                'feature_fraction': [0.8, 0.9, 1.0],
                'bagging_fraction': [0.8, 0.9, 1.0],
                'bagging_freq': [0, 5, 10],
                'min_data_in_leaf': [10, 20, 50],
                'max_depth': [-1, 5, 10],
                'reg_alpha': [0, 0.1, 1],
                'reg_lambda': [0, 0.1, 1]
            }
        elif self.search_method == 'random':
            # Random search space
            return {
                'num_leaves': randint(10, 100),
                'learning_rate': uniform(0.01, 0.2),
                'feature_fraction': uniform(0.6, 0.4),
                'bagging_fraction': uniform(0.6, 0.4),
                'bagging_freq': randint(0, 20),
                'min_data_in_leaf': randint(5, 100),
                'max_depth': randint(-1, 20),
                'reg_alpha': uniform(0, 2),
                'reg_lambda': uniform(0, 2)
            }
        else:  # optuna
            return {
                'num_leaves': (10, 100),
                'learning_rate': (0.01, 0.3),
                'feature_fraction': (0.6, 1.0),
                'bagging_fraction': (0.6, 1.0),
                'bagging_freq': (0, 20),
                'min_data_in_leaf': (5, 100),
                'max_depth': (-1, 20),
                'reg_alpha': (0, 2),
                'reg_lambda': (0, 2),
                'min_split_gain': (0, 1),
                'subsample_for_bin': (50000, 300000)
            }
    
    def get_random_forest_search_space(self) -> Dict[str, Any]:
        """Define Random Forest hyperparameter search space"""
        if self.search_method == 'grid':
            return {
                'n_estimators': [50, 100, 200],
                'max_depth': [5, 10, 20, None],
                'min_samples_split': [2, 5, 10],
                'min_samples_leaf': [1, 2, 4],
                'max_features': ['sqrt', 'log2', None],
                'bootstrap': [True, False]
            }
        elif self.search_method == 'random':
            return {
                'n_estimators': randint(50, 300),
                'max_depth': [5, 10, 20, None],
                'min_samples_split': randint(2, 20),
                'min_samples_leaf': randint(1, 10),
                'max_features': ['sqrt', 'log2', None],
                'bootstrap': [True, False]
            }
        else:  # optuna
            return {
                'n_estimators': (50, 300),
                'max_depth': (5, 30),
                'min_samples_split': (2, 20),
                'min_samples_leaf': (1, 10),
                'max_features': ['sqrt', 'log2', None],
                'bootstrap': [True, False]
            }
    
    def create_lgb_model(self, params: Dict[str, Any]) -> lgb.LGBMClassifier:
        """Create LightGBM model with given parameters"""
        # Base parameters
        base_params = {
            'objective': 'binary',
            'metric': 'binary_logloss',
            'boosting_type': 'gbdt',
            'verbosity': -1,
            'random_state': self.random_state,
            'n_estimators': 100
        }
        
        # Update with tuned parameters
        base_params.update(params)
        
        return lgb.LGBMClassifier(**base_params)
    
    def create_rf_model(self, params: Dict[str, Any]) -> RandomForestClassifier:
        """Create Random Forest model with given parameters"""
        base_params = {
            'random_state': self.random_state,
            'n_jobs': -1
        }
        
        base_params.update(params)
        return RandomForestClassifier(**base_params)
    
    def evaluate_model(self, model: Any, X: np.ndarray, y: np.ndarray) -> float:
        """Evaluate model using cross-validation"""
        cv = StratifiedKFold(n_splits=self.cv_folds, shuffle=True, random_state=self.random_state)
        
        scores = cross_val_score(model, X, y, cv=cv, scoring=self.scoring_metric, n_jobs=-1)
        return np.mean(scores)
    
    def grid_search_tuning(self, X: np.ndarray, y: np.ndarray) -> Tuple[Dict[str, Any], float]:
        """Perform grid search hyperparameter tuning"""
        logger.info("Starting grid search hyperparameter tuning...")
        
        if self.model_type == 'lightgbm':
            param_grid = self.get_lightgbm_search_space()
            base_model = lgb.LGBMClassifier(
                objective='binary',
                metric='binary_logloss',
                boosting_type='gbdt',
                verbosity=-1,
                random_state=self.random_state,
                n_estimators=100
            )
        else:  # random_forest
            param_grid = self.get_random_forest_search_space()
            base_model = RandomForestClassifier(random_state=self.random_state, n_jobs=-1)
        
        # Perform grid search
        cv = StratifiedKFold(n_splits=self.cv_folds, shuffle=True, random_state=self.random_state)
        grid_search = GridSearchCV(
            base_model,
            param_grid,
            cv=cv,
            scoring=self.scoring_metric,
            n_jobs=-1,
            verbose=1
        )
        
        grid_search.fit(X, y)
        
        logger.info(f"Grid search completed. Best score: {grid_search.best_score_:.4f}")
        
        return grid_search.best_params_, grid_search.best_score_
    
    def random_search_tuning(self, X: np.ndarray, y: np.ndarray) -> Tuple[Dict[str, Any], float]:
        """Perform random search hyperparameter tuning"""
        logger.info("Starting random search hyperparameter tuning...")
        
        if self.model_type == 'lightgbm':
            param_distributions = self.get_lightgbm_search_space()
            base_model = lgb.LGBMClassifier(
                objective='binary',
                metric='binary_logloss',
                boosting_type='gbdt',
                verbosity=-1,
                random_state=self.random_state,
                n_estimators=100
            )
        else:  # random_forest
            param_distributions = self.get_random_forest_search_space()
            base_model = RandomForestClassifier(random_state=self.random_state, n_jobs=-1)
        
        # Perform random search
        cv = StratifiedKFold(n_splits=self.cv_folds, shuffle=True, random_state=self.random_state)
        random_search = RandomizedSearchCV(
            base_model,
            param_distributions,
            n_iter=self.n_trials,
            cv=cv,
            scoring=self.scoring_metric,
            n_jobs=-1,
            verbose=1,
            random_state=self.random_state
        )
        
        random_search.fit(X, y)
        
        logger.info(f"Random search completed. Best score: {random_search.best_score_:.4f}")
        
        return random_search.best_params_, random_search.best_score_
    
    def optuna_objective(self, trial: optuna.Trial, X: np.ndarray, y: np.ndarray) -> float:
        """Optuna objective function"""
        if self.model_type == 'lightgbm':
            search_space = self.get_lightgbm_search_space()
            
            params = {}
            for param_name, param_range in search_space.items():
                if isinstance(param_range, tuple):
                    if param_name in ['learning_rate', 'feature_fraction', 'bagging_fraction', 'reg_alpha', 'reg_lambda', 'min_split_gain']:
                        params[param_name] = trial.suggest_float(param_name, param_range[0], param_range[1])
                    else:
                        params[param_name] = trial.suggest_int(param_name, param_range[0], param_range[1])
            
            model = self.create_lgb_model(params)
            
        else:  # random_forest
            search_space = self.get_random_forest_search_space()
            
            params = {}
            for param_name, param_range in search_space.items():
                if isinstance(param_range, tuple):
                    params[param_name] = trial.suggest_int(param_name, param_range[0], param_range[1])
                elif isinstance(param_range, list):
                    params[param_name] = trial.suggest_categorical(param_name, param_range)
            
            model = self.create_rf_model(params)
        
        # Evaluate model
        score = self.evaluate_model(model, X, y)
        return score
    
    def optuna_tuning(self, X: np.ndarray, y: np.ndarray) -> Tuple[Dict[str, Any], float]:
        """Perform Optuna hyperparameter tuning"""
        logger.info("Starting Optuna hyperparameter tuning...")
        
        # Create study
        study = optuna.create_study(
            direction='maximize',
            sampler=optuna.samplers.TPESampler(seed=self.random_state)
        )
        
        # Optimize
        study.optimize(
            lambda trial: self.optuna_objective(trial, X, y),
            n_trials=self.n_trials,
            show_progress_bar=True
        )
        
        logger.info(f"Optuna optimization completed. Best score: {study.best_value:.4f}")
        logger.info(f"Best parameters: {study.best_params}")
        
        return study.best_params, study.best_value
    
    def validate_best_model(self, best_params: Dict[str, Any], X: np.ndarray, y: np.ndarray) -> Dict[str, float]:
        """Validate the best model with comprehensive metrics"""
        logger.info("Validating best model...")
        
        # Create model with best parameters
        if self.model_type == 'lightgbm':
            model = self.create_lgb_model(best_params)
        else:
            model = self.create_rf_model(best_params)
        
        # Split data for validation
        X_train, X_val, y_train, y_val = train_test_split(
            X, y, test_size=0.2, random_state=self.random_state, stratify=y
        )
        
        # Train model
        model.fit(X_train, y_train)
        
        # Make predictions
        y_pred = model.predict(X_val)
        y_pred_proba = model.predict_proba(X_val)[:, 1]
        
        # Calculate metrics
        validation_metrics = {
            'accuracy': float(accuracy_score(y_val, y_pred)),
            'precision': float(precision_score(y_val, y_pred, zero_division=0)),
            'recall': float(recall_score(y_val, y_pred, zero_division=0)),
            'roc_auc': float(roc_auc_score(y_val, y_pred_proba)),
            'validation_samples': int(len(X_val)),
            'positive_class_ratio': float(np.mean(y_val))
        }
        
        logger.info(f"Validation metrics: {validation_metrics}")
        
        return validation_metrics
    
    def save_tuning_results(self, best_params: Dict[str, Any], best_score: float, 
                           validation_metrics: Dict[str, float], feature_names: List[str]) -> str:
        """Save hyperparameter tuning results"""
        results = {
            'organizationId': self.organization_id,
            'modelType': self.model_type,
            'searchMethod': self.search_method,
            'nTrials': self.n_trials,
            'cvFolds': self.cv_folds,
            'scoringMetric': self.scoring_metric,
            'bestParams': best_params,
            'bestCvScore': float(best_score),
            'validationMetrics': validation_metrics,
            'featureNames': feature_names,
            'tuningTimestamp': datetime.now().isoformat(),
            'status': 'SUCCESS'
        }
        
        # Save results
        results_path = os.path.join(self.output_path, 'hyperparameter_tuning_results.json')
        with open(results_path, 'w') as f:
            json.dump(results, f, indent=2)
        
        logger.info(f"Tuning results saved to: {results_path}")
        
        return results_path
    
    def run_tuning(self, data_path: str) -> Dict[str, Any]:
        """Run complete hyperparameter tuning pipeline"""
        try:
            logger.info(f"Starting hyperparameter tuning for organization: {self.organization_id}")
            
            # Load training data
            X, y, feature_names = self.load_training_data(data_path)
            
            # Perform hyperparameter tuning based on search method
            if self.search_method == 'grid':
                best_params, best_score = self.grid_search_tuning(X, y)
            elif self.search_method == 'random':
                best_params, best_score = self.random_search_tuning(X, y)
            elif self.search_method == 'optuna':
                best_params, best_score = self.optuna_tuning(X, y)
            else:
                raise ValueError(f"Unknown search method: {self.search_method}")
            
            # Validate best model
            validation_metrics = self.validate_best_model(best_params, X, y)
            
            # Save results
            results_path = self.save_tuning_results(best_params, best_score, validation_metrics, feature_names)
            
            # Compile final result
            result = {
                'organizationId': self.organization_id,
                'modelType': self.model_type,
                'searchMethod': self.search_method,
                'bestParams': best_params,
                'bestCvScore': float(best_score),
                'validationMetrics': validation_metrics,
                'resultsPath': results_path,
                'status': 'SUCCESS'
            }
            
            logger.info("Hyperparameter tuning completed successfully")
            
            return result
            
        except Exception as e:
            logger.error(f"Hyperparameter tuning failed: {e}")
            logger.error(traceback.format_exc())
            
            error_result = {
                'organizationId': self.organization_id,
                'modelType': self.model_type,
                'status': 'FAILED',
                'error': str(e),
                'traceback': traceback.format_exc(),
                'tuningTimestamp': datetime.now().isoformat()
            }
            
            # Save error results
            error_path = os.path.join(self.output_path, 'hyperparameter_tuning_error.json')
            with open(error_path, 'w') as f:
                json.dump(error_result, f, indent=2)
            
            raise

def main():
    """Main hyperparameter tuning script entry point"""
    if len(sys.argv) != 3:
        print("Usage: python hyperparameter_tuning.py <config_path> <data_path>")
        sys.exit(1)
    
    config_path = sys.argv[1]
    data_path = sys.argv[2]
    
    try:
        tuner = HyperparameterTuner(config_path)
        result = tuner.run_tuning(data_path)
        
        print(json.dumps(result, indent=2))
        sys.exit(0)
        
    except Exception as e:
        error_result = {
            'status': 'FAILED',
            'error': str(e),
            'traceback': traceback.format_exc()
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)

if __name__ == '__main__':
    main()