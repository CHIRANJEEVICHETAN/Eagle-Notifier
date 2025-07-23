-- Performance optimization indexes for predictive maintenance tables


-- PredictionAlert table indexes
CREATE INDEX IF NOT EXISTS "idx_prediction_alerts_org_created" 
ON "PredictionAlert" ("organizationId", "createdAt" DESC);


CREATE INDEX IF NOT EXISTS "idx_prediction_alerts_org_resolved" 
ON "PredictionAlert" ("organizationId", "resolvedAt") 
WHERE "resolvedAt" IS NOT NULL;


CREATE INDEX IF NOT EXISTS "idx_prediction_alerts_component_probability" 
ON "PredictionAlert" ("component", "probability" DESC);


CREATE INDEX IF NOT EXISTS "idx_prediction_alerts_feedback" 
ON "PredictionAlert" ("isAccurate", "feedbackAt") 
WHERE "isAccurate" IS NOT NULL;


CREATE INDEX IF NOT EXISTS "idx_prediction_alerts_time_to_failure" 
ON "PredictionAlert" ("timeToFailure", "createdAt" DESC);


-- ModelMetrics table indexes
CREATE INDEX IF NOT EXISTS "idx_model_metrics_org_version_created" 
ON "ModelMetrics" ("organizationId", "version", "createdAt" DESC);


CREATE INDEX IF NOT EXISTS "idx_model_metrics_accuracy_created" 
ON "ModelMetrics" ("accuracy" DESC, "createdAt" DESC);


CREATE INDEX IF NOT EXISTS "idx_model_metrics_auc_precision" 
ON "ModelMetrics" ("auc" DESC, "precision" DESC);


-- TrainingLog table indexes
CREATE INDEX IF NOT EXISTS "idx_training_logs_org_status_started" 
ON "TrainingLog" ("organizationId", "status", "startedAt" DESC);


CREATE INDEX IF NOT EXISTS "idx_training_logs_status_completed" 
ON "TrainingLog" ("status", "completedAt" DESC) 
WHERE "completedAt" IS NOT NULL;


CREATE INDEX IF NOT EXISTS "idx_training_logs_version_started" 
ON "TrainingLog" ("version", "startedAt" DESC);


-- Organization table indexes for ML fields
CREATE INDEX IF NOT EXISTS "idx_organizations_prediction_enabled" 
ON "Organization" ("predictionEnabled", "lastTrainingDate" DESC) 
WHERE "predictionEnabled" = true;


CREATE INDEX IF NOT EXISTS "idx_organizations_model_version_accuracy" 
ON "Organization" ("modelVersion", "modelAccuracy" DESC) 
WHERE "modelVersion" IS NOT NULL;


-- MLAuditLog table indexes for performance monitoring
CREATE INDEX IF NOT EXISTS "idx_ml_audit_logs_org_action_timestamp" 
ON "MLAuditLog" ("organizationId", "action", "timestamp" DESC);


CREATE INDEX IF NOT EXISTS "idx_ml_audit_logs_status_duration" 
ON "MLAuditLog" ("status", "duration" DESC) 
WHERE "duration" IS NOT NULL;


CREATE INDEX IF NOT EXISTS "idx_ml_audit_logs_user_timestamp" 
ON "MLAuditLog" ("userId", "timestamp" DESC);


-- ErrorLog table indexes for ML error monitoring
CREATE INDEX IF NOT EXISTS "idx_error_logs_org_service_timestamp" 
ON "ErrorLog" ("organizationId", "serviceName", "timestamp" DESC);


CREATE INDEX IF NOT EXISTS "idx_error_logs_category_severity_timestamp" 
ON "ErrorLog" ("category", "severity", "timestamp" DESC);


CREATE INDEX IF NOT EXISTS "idx_error_logs_resolved_timestamp" 
ON "ErrorLog" ("resolved", "timestamp" DESC);


-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS "idx_prediction_alerts_active_by_org" 
ON "PredictionAlert" ("organizationId", "probability" DESC, "createdAt" DESC) 
WHERE "resolvedAt" IS NULL;


CREATE INDEX IF NOT EXISTS "idx_model_metrics_latest_by_org" 
ON "ModelMetrics" ("organizationId", "createdAt" DESC, "accuracy" DESC);


CREATE INDEX IF NOT EXISTS "idx_training_logs_recent_by_org" 
ON "TrainingLog" ("organizationId", "startedAt" DESC, "status") 
WHERE "startedAt" > '2024-12-21 00:00:00'::timestamp;


-- Partial indexes for performance-critical queries
CREATE INDEX IF NOT EXISTS "idx_prediction_alerts_high_probability" 
ON "PredictionAlert" ("organizationId", "createdAt" DESC) 
WHERE "probability" > 0.8;


CREATE INDEX IF NOT EXISTS "idx_model_metrics_high_accuracy" 
ON "ModelMetrics" ("organizationId", "version", "createdAt" DESC) 
WHERE "accuracy" > 0.8;


CREATE INDEX IF NOT EXISTS "idx_training_logs_failed" 
ON "TrainingLog" ("organizationId", "startedAt" DESC) 
WHERE "status" = 'FAILED';


-- Add comments for documentation
COMMENT ON INDEX "idx_prediction_alerts_org_created" IS 'Primary index for fetching prediction alerts by organization and time';
COMMENT ON INDEX "idx_model_metrics_org_version_created" IS 'Index for model metrics queries by organization and version';
COMMENT ON INDEX "idx_training_logs_org_status_started" IS 'Index for training log queries by organization and status';
COMMENT ON INDEX "idx_organizations_prediction_enabled" IS 'Index for finding organizations with prediction enabled';
COMMENT ON INDEX "idx_ml_audit_logs_org_action_timestamp" IS 'Index for ML audit log queries by organization and action';
COMMENT ON INDEX "idx_error_logs_org_service_timestamp" IS 'Index for error log queries by organization and service';


-- Create statistics for query planner optimization
ANALYZE "PredictionAlert";
ANALYZE "ModelMetrics";
ANALYZE "TrainingLog";
ANALYZE "MLAuditLog";
ANALYZE "ErrorLog";
ANALYZE "Organization";
