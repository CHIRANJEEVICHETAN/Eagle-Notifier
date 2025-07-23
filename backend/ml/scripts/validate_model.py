#!/usr/bin/env python3
"""
Model Validation Script for Predictive Maintenance
Comprehensive validation of trained models before deployment
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
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, roc_curve, precision_recall_curve,
    confusion_matrix, classification_report
)
from sklearn.model_selection import cross_val_score, StratifiedKFold
import matplotlib.pyplot as plt
import seaborn as sns
import onnxruntime as ort
import pickle

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ModelValidator:
    """Comprehensive model validation for predictive maintenance"""
    
    def __init__(self, config_path: str):
        self.config = self.load_config(config_path)
        self.organization_id = self.config['organizationId']
        self.version = self.config['version']
        self.model_path = self.config['modelPath']
        self.output_path = self.config['outputPath']
        
        # Performance thresholds
        self.min_accuracy = self.config.get('minAccuracy', 0.8)
        self.min_precision = self.config.get('minPrecision', 0.75)
        self.min_recall = self.config.get('minRecall', 0.7)
        self.min_auc = self.config.get('minAuc', 0.8)
        self.max_latency_ms = self.config.get('maxLatencyMs', 100)
        
        logger.info(f"Initialized validator for org: {self.organization_id}, version: {self.version}")
    
    def load_config(self, config_path: str) -> Dict[str, Any]:
        """Load validation configuration"""
        with open(config_path, 'r') as f:
            return json.load(f)
    
    def load_test_data(self, data_path: str) -> Tuple[np.ndarray, np.ndarray, List[str]]:
        """Load test data for validation"""
        logger.info(f"Loading test data from: {data_path}")
        
        if data_path.endswith('.csv'):
            df = pd.read_csv(data_path)
            
            # Get feature columns and target
            target_col = self.config.get('targetColumn', 'failure_indicator')
            feature_cols = [col for col in df.columns if col not in [target_col, 'timestamp']]
            
            X = df[feature_cols].values
            y = df[target_col].values
            
            # Handle NaN values
            X = np.nan_to_num(X, nan=0.0)
            
            logger.info(f"Loaded {len(X)} test samples with {len(feature_cols)} features")
            return X, y, feature_cols
        else:
            raise ValueError(f"Unsupported data format: {data_path}")
    
    def load_model(self) -> Tuple[Any, str]:
        """Load the trained model"""
        logger.info(f"Loading model from: {self.model_path}")
        
        try:
            if self.model_path.endswith('.onnx'):
                # Load ONNX model
                session = ort.InferenceSession(self.model_path)
                model_type = 'onnx'
                logger.info("Loaded ONNX model")
                return session, model_type
            elif self.model_path.endswith('.pkl'):
                # Load pickle model
                with open(self.model_path, 'rb') as f:
                    model = pickle.load(f)
                model_type = 'sklearn'
                logger.info("Loaded sklearn model")
                return model, model_type
            else:
                raise ValueError(f"Unsupported model format: {self.model_path}")
                
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise
    
    def predict_with_model(self, model: Any, model_type: str, X: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Make predictions with the model"""
        if model_type == 'onnx':
            # ONNX model prediction
            input_name = model.get_inputs()[0].name
            X_input = X.astype(np.float32)
            
            # Get probabilities
            result = model.run(None, {input_name: X_input})
            
            if len(result) == 2:  # Binary classification with probabilities
                y_pred_proba = result[1][:, 1]  # Probability of positive class
            else:
                y_pred_proba = result[0]
            
            y_pred = (y_pred_proba > 0.5).astype(int)
            
        elif model_type == 'sklearn':
            # Sklearn model prediction
            if hasattr(model, 'predict_proba'):
                y_pred_proba = model.predict_proba(X)[:, 1]
            else:
                y_pred_proba = model.predict(X)
            
            y_pred = (y_pred_proba > 0.5).astype(int)
        
        else:
            raise ValueError(f"Unknown model type: {model_type}")
        
        return y_pred, y_pred_proba
    
    def calculate_performance_metrics(self, y_true: np.ndarray, y_pred: np.ndarray, 
                                    y_pred_proba: np.ndarray) -> Dict[str, float]:
        """Calculate comprehensive performance metrics"""
        logger.info("Calculating performance metrics...")
        
        metrics = {
            'accuracy': float(accuracy_score(y_true, y_pred)),
            'precision': float(precision_score(y_true, y_pred, zero_division=0)),
            'recall': float(recall_score(y_true, y_pred, zero_division=0)),
            'f1_score': float(f1_score(y_true, y_pred, zero_division=0)),
            'auc_roc': float(roc_auc_score(y_true, y_pred_proba)),
            'specificity': 0.0,
            'npv': 0.0,  # Negative Predictive Value
            'false_positive_rate': 0.0,
            'false_negative_rate': 0.0
        }
        
        # Calculate confusion matrix metrics
        tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
        
        if (tn + fp) > 0:
            metrics['specificity'] = float(tn / (tn + fp))
            metrics['false_positive_rate'] = float(fp / (tn + fp))
        
        if (tn + fn) > 0:
            metrics['npv'] = float(tn / (tn + fn))
        
        if (fn + tp) > 0:
            metrics['false_negative_rate'] = float(fn / (fn + tp))
        
        # Additional metrics
        metrics['true_positives'] = int(tp)
        metrics['true_negatives'] = int(tn)
        metrics['false_positives'] = int(fp)
        metrics['false_negatives'] = int(fn)
        
        logger.info(f"Performance metrics calculated: Accuracy={metrics['accuracy']:.3f}, "
                   f"Precision={metrics['precision']:.3f}, Recall={metrics['recall']:.3f}, "
                   f"AUC={metrics['auc_roc']:.3f}")
        
        return metrics
    
    def validate_performance_thresholds(self, metrics: Dict[str, float]) -> Dict[str, bool]:
        """Validate model performance against thresholds"""
        logger.info("Validating performance thresholds...")
        
        validations = {
            'accuracy_pass': metrics['accuracy'] >= self.min_accuracy,
            'precision_pass': metrics['precision'] >= self.min_precision,
            'recall_pass': metrics['recall'] >= self.min_recall,
            'auc_pass': metrics['auc_roc'] >= self.min_auc
        }
        
        # Overall validation
        validations['overall_pass'] = all(validations.values())
        
        # Log validation results
        for check, passed in validations.items():
            status = "PASS" if passed else "FAIL"
            logger.info(f"{check}: {status}")
        
        return validations
    
    def measure_prediction_latency(self, model: Any, model_type: str, X: np.ndarray, 
                                 num_iterations: int = 100) -> Dict[str, float]:
        """Measure model prediction latency"""
        logger.info(f"Measuring prediction latency over {num_iterations} iterations...")
        
        import time
        
        # Warm up
        for _ in range(10):
            self.predict_with_model(model, model_type, X[:1])
        
        # Measure latency
        latencies = []
        for _ in range(num_iterations):
            start_time = time.time()
            self.predict_with_model(model, model_type, X[:1])
            end_time = time.time()
            latencies.append((end_time - start_time) * 1000)  # Convert to milliseconds
        
        latency_stats = {
            'mean_latency_ms': float(np.mean(latencies)),
            'median_latency_ms': float(np.median(latencies)),
            'p95_latency_ms': float(np.percentile(latencies, 95)),
            'p99_latency_ms': float(np.percentile(latencies, 99)),
            'max_latency_ms': float(np.max(latencies)),
            'min_latency_ms': float(np.min(latencies)),
            'latency_pass': float(np.mean(latencies)) <= self.max_latency_ms
        }
        
        logger.info(f"Latency stats: Mean={latency_stats['mean_latency_ms']:.2f}ms, "
                   f"P95={latency_stats['p95_latency_ms']:.2f}ms")
        
        return latency_stats
    
    def validate_model_robustness(self, model: Any, model_type: str, X: np.ndarray, 
                                y: np.ndarray) -> Dict[str, Any]:
        """Test model robustness with various data perturbations"""
        logger.info("Testing model robustness...")
        
        robustness_results = {}
        
        # Original predictions
        y_pred_orig, y_pred_proba_orig = self.predict_with_model(model, model_type, X)
        orig_accuracy = accuracy_score(y, y_pred_orig)
        
        # Test with noise
        noise_levels = [0.01, 0.05, 0.1]
        for noise_level in noise_levels:
            X_noisy = X + np.random.normal(0, noise_level * np.std(X, axis=0), X.shape)
            y_pred_noisy, _ = self.predict_with_model(model, model_type, X_noisy)
            noisy_accuracy = accuracy_score(y, y_pred_noisy)
            
            robustness_results[f'noise_{noise_level}_accuracy'] = float(noisy_accuracy)
            robustness_results[f'noise_{noise_level}_degradation'] = float(orig_accuracy - noisy_accuracy)
        
        # Test with missing values (set random features to 0)
        missing_ratios = [0.05, 0.1, 0.2]
        for missing_ratio in missing_ratios:
            X_missing = X.copy()
            mask = np.random.random(X.shape) < missing_ratio
            X_missing[mask] = 0
            
            y_pred_missing, _ = self.predict_with_model(model, model_type, X_missing)
            missing_accuracy = accuracy_score(y, y_pred_missing)
            
            robustness_results[f'missing_{missing_ratio}_accuracy'] = float(missing_accuracy)
            robustness_results[f'missing_{missing_ratio}_degradation'] = float(orig_accuracy - missing_accuracy)
        
        # Overall robustness score (average degradation)
        degradations = [v for k, v in robustness_results.items() if 'degradation' in k]
        robustness_results['avg_degradation'] = float(np.mean(degradations))
        robustness_results['robustness_pass'] = robustness_results['avg_degradation'] < 0.1  # Less than 10% degradation
        
        logger.info(f"Robustness test completed. Average degradation: {robustness_results['avg_degradation']:.3f}")
        
        return robustness_results
    
    def create_validation_plots(self, y_true: np.ndarray, y_pred: np.ndarray, 
                              y_pred_proba: np.ndarray) -> Dict[str, str]:
        """Create validation plots"""
        logger.info("Creating validation plots...")
        
        plot_paths = {}
        
        # Set up the plotting style
        plt.style.use('default')
        fig_size = (12, 8)
        
        # 1. Confusion Matrix
        plt.figure(figsize=(8, 6))
        cm = confusion_matrix(y_true, y_pred)
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                   xticklabels=['Normal', 'Failure'], 
                   yticklabels=['Normal', 'Failure'])
        plt.title('Confusion Matrix')
        plt.ylabel('True Label')
        plt.xlabel('Predicted Label')
        
        cm_path = os.path.join(self.output_path, 'confusion_matrix.png')
        plt.savefig(cm_path, dpi=300, bbox_inches='tight')
        plt.close()
        plot_paths['confusion_matrix'] = cm_path
        
        # 2. ROC Curve
        plt.figure(figsize=(8, 6))
        fpr, tpr, _ = roc_curve(y_true, y_pred_proba)
        auc_score = roc_auc_score(y_true, y_pred_proba)
        
        plt.plot(fpr, tpr, color='darkorange', lw=2, 
                label=f'ROC curve (AUC = {auc_score:.3f})')
        plt.plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--')
        plt.xlim([0.0, 1.0])
        plt.ylim([0.0, 1.05])
        plt.xlabel('False Positive Rate')
        plt.ylabel('True Positive Rate')
        plt.title('Receiver Operating Characteristic (ROC) Curve')
        plt.legend(loc="lower right")
        
        roc_path = os.path.join(self.output_path, 'roc_curve.png')
        plt.savefig(roc_path, dpi=300, bbox_inches='tight')
        plt.close()
        plot_paths['roc_curve'] = roc_path
        
        # 3. Precision-Recall Curve
        plt.figure(figsize=(8, 6))
        precision, recall, _ = precision_recall_curve(y_true, y_pred_proba)
        
        plt.plot(recall, precision, color='blue', lw=2)
        plt.xlabel('Recall')
        plt.ylabel('Precision')
        plt.title('Precision-Recall Curve')
        plt.grid(True)
        
        pr_path = os.path.join(self.output_path, 'precision_recall_curve.png')
        plt.savefig(pr_path, dpi=300, bbox_inches='tight')
        plt.close()
        plot_paths['precision_recall_curve'] = pr_path
        
        # 4. Prediction Distribution
        plt.figure(figsize=(10, 6))
        
        # Separate predictions by true class
        normal_probs = y_pred_proba[y_true == 0]
        failure_probs = y_pred_proba[y_true == 1]
        
        plt.hist(normal_probs, bins=50, alpha=0.7, label='Normal', color='blue')
        plt.hist(failure_probs, bins=50, alpha=0.7, label='Failure', color='red')
        plt.axvline(x=0.5, color='black', linestyle='--', label='Decision Threshold')
        plt.xlabel('Predicted Probability')
        plt.ylabel('Frequency')
        plt.title('Distribution of Predicted Probabilities')
        plt.legend()
        
        dist_path = os.path.join(self.output_path, 'prediction_distribution.png')
        plt.savefig(dist_path, dpi=300, bbox_inches='tight')
        plt.close()
        plot_paths['prediction_distribution'] = dist_path
        
        logger.info(f"Created {len(plot_paths)} validation plots")
        return plot_paths
    
    def run_validation(self, test_data_path: str) -> Dict[str, Any]:
        """Run complete model validation pipeline"""
        try:
            logger.info(f"Starting model validation for organization: {self.organization_id}")
            
            # Load test data
            X_test, y_test, feature_names = self.load_test_data(test_data_path)
            
            # Load model
            model, model_type = self.load_model()
            
            # Make predictions
            y_pred, y_pred_proba = self.predict_with_model(model, model_type, X_test)
            
            # Calculate performance metrics
            performance_metrics = self.calculate_performance_metrics(y_test, y_pred, y_pred_proba)
            
            # Validate against thresholds
            threshold_validations = self.validate_performance_thresholds(performance_metrics)
            
            # Measure latency
            latency_stats = self.measure_prediction_latency(model, model_type, X_test)
            
            # Test robustness
            robustness_results = self.validate_model_robustness(model, model_type, X_test, y_test)
            
            # Create plots
            plot_paths = self.create_validation_plots(y_test, y_pred, y_pred_proba)
            
            # Compile validation result
            validation_result = {
                'organizationId': self.organization_id,
                'version': self.version,
                'modelPath': self.model_path,
                'validationTimestamp': datetime.now().isoformat(),
                'testSamples': int(len(X_test)),
                'features': len(feature_names),
                'featureNames': feature_names,
                'performanceMetrics': performance_metrics,
                'thresholdValidations': threshold_validations,
                'latencyStats': latency_stats,
                'robustnessResults': robustness_results,
                'plotPaths': plot_paths,
                'overallValidation': {
                    'performancePass': threshold_validations['overall_pass'],
                    'latencyPass': latency_stats['latency_pass'],
                    'robustnessPass': robustness_results['robustness_pass'],
                    'overallPass': (threshold_validations['overall_pass'] and 
                                  latency_stats['latency_pass'] and 
                                  robustness_results['robustness_pass'])
                },
                'status': 'SUCCESS'
            }
            
            # Save validation report
            report_path = os.path.join(self.output_path, 'validation_report.json')
            with open(report_path, 'w') as f:
                json.dump(validation_result, f, indent=2)
            
            logger.info(f"Model validation completed. Overall pass: {validation_result['overallValidation']['overallPass']}")
            
            return validation_result
            
        except Exception as e:
            logger.error(f"Model validation failed: {e}")
            logger.error(traceback.format_exc())
            
            error_result = {
                'organizationId': self.organization_id,
                'version': self.version,
                'status': 'FAILED',
                'error': str(e),
                'traceback': traceback.format_exc(),
                'validationTimestamp': datetime.now().isoformat()
            }
            
            # Save error report
            report_path = os.path.join(self.output_path, 'validation_report.json')
            with open(report_path, 'w') as f:
                json.dump(error_result, f, indent=2)
            
            raise

def main():
    """Main validation script entry point"""
    if len(sys.argv) != 3:
        print("Usage: python validate_model.py <config_path> <test_data_path>")
        sys.exit(1)
    
    config_path = sys.argv[1]
    test_data_path = sys.argv[2]
    
    try:
        validator = ModelValidator(config_path)
        result = validator.run_validation(test_data_path)
        
        print(json.dumps(result, indent=2))
        
        # Exit with appropriate code
        if result['overallValidation']['overallPass']:
            sys.exit(0)
        else:
            sys.exit(1)
            
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