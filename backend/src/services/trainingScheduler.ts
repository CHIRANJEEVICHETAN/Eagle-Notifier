import cron from 'node-cron';
import prisma from '../config/db';
import { trainingService, TrainingConfig, CronSchedule } from './trainingService';
import { NotificationService } from './notificationService';
import { modelCacheService } from './modelCacheService';

const DEBUG = process.env.NODE_ENV === 'development';

export interface ScheduledTrainingConfig {
  organizationId: string;
  schedule: CronSchedule;
  trainingConfig: Partial<TrainingConfig>;
  retryAttempts: number;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
}

export interface TrainingJobStatus {
  organizationId: string;
  status: 'SCHEDULED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'RETRYING';
  lastRun?: Date;
  nextRun?: Date;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  lastResult?: any;
}

/**
 * Automated Training Scheduler Service
 * Manages weekly training schedules and retry mechanisms
 */
export class TrainingScheduler {
  private scheduledJobs = new Map<string, any>();
  private jobStatuses = new Map<string, TrainingJobStatus>();
  private retryTimeouts = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.initializeScheduler();
  }

  /**
   * Initialize scheduler and load existing schedules
   */
  private async initializeScheduler(): Promise<void> {
    try {
      if (DEBUG) {
        console.log('🕐 Initializing Training Scheduler...');
      }

      // Load existing scheduled training configurations
      await this.loadExistingSchedules();

      // Start monitoring service
      this.startMonitoringService();

      if (DEBUG) {
        console.log(`✅ Training Scheduler initialized with ${this.scheduledJobs.size} active schedules`);
      }
    } catch (error) {
      console.error('❌ Error initializing Training Scheduler:', error);
    }
  }

  /**
   * Load existing training schedules from database
   */
  private async loadExistingSchedules(): Promise<void> {
    try {
      const organizations = await prisma.organization.findMany({
        where: {
          predictionEnabled: true,
          trainingSchedule: {
            not: 'null'
          }
        },
        select: {
          id: true,
          name: true,
          trainingSchedule: true,
          mlModelConfig: true
        }
      });

      for (const org of organizations) {
        if (org.trainingSchedule) {
          const schedule = typeof org.trainingSchedule === 'string' 
            ? JSON.parse(org.trainingSchedule) 
            : org.trainingSchedule;

          if (schedule.enabled) {
            await this.scheduleTraining({
              organizationId: org.id,
              schedule,
              trainingConfig: {
                organizationId: org.id,
                dataRange: {
                  startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Last 365 days
                  endDate: new Date()
                },
                hyperparameters: this.getDefaultHyperparameters(),
                validationSplit: 0.2,
                targetColumn: 'failure_indicator',
                featureColumns: this.extractFeatureColumns(org.mlModelConfig),
                modelName: `scheduled_${new Date().toISOString().split('T')[0]}`,
                description: 'Automated weekly training'
              },
              retryAttempts: 3,
              notifyOnSuccess: true,
              notifyOnFailure: true
            });

            if (DEBUG) {
              console.log(`📅 Loaded schedule for organization: ${org.name} (${org.id})`);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading existing schedules:', error);
    }
  }

  /**
   * Schedule training for an organization
   */
  async scheduleTraining(config: ScheduledTrainingConfig): Promise<void> {
    try {
      const { organizationId, schedule } = config;

      // Cancel existing schedule if any
      await this.cancelSchedule(organizationId);

      if (!schedule.enabled) {
        if (DEBUG) {
          console.log(`⏸️ Training schedule disabled for org: ${organizationId}`);
        }
        return;
      }

      // Validate cron pattern
      if (!cron.validate(schedule.pattern)) {
        throw new Error(`Invalid cron pattern: ${schedule.pattern}`);
      }

      // Create scheduled task
      const task = cron.schedule(schedule.pattern, async () => {
        await this.executeScheduledTraining(config);
      }, {
        timezone: schedule.timezone || 'UTC'
      });

      // Store the task
      this.scheduledJobs.set(organizationId, task);

      // Initialize job status
      const nextRun = this.calculateNextRun(schedule.pattern, schedule.timezone);
      this.jobStatuses.set(organizationId, {
        organizationId,
        status: 'SCHEDULED',
        nextRun: nextRun || undefined,
        attempts: 0,
        maxAttempts: config.retryAttempts
      });

      // Update database
      await prisma.organization.update({
        where: { id: organizationId },
        data: { 
          trainingSchedule: schedule as any 
        }
      });

      if (DEBUG) {
        console.log(`⏰ Scheduled training for org ${organizationId}:`);
        console.log(`   Pattern: ${schedule.pattern}`);
        console.log(`   Timezone: ${schedule.timezone || 'UTC'}`);
        console.log(`   Next run: ${nextRun?.toISOString()}`);
      }

    } catch (error) {
      console.error(`Error scheduling training for org ${config.organizationId}:`, error);
      throw error;
    }
  }

  /**
   * Execute scheduled training with retry mechanism
   */
  private async executeScheduledTraining(config: ScheduledTrainingConfig): Promise<void> {
    const { organizationId } = config;
    
    try {
      // Update status to running
      const status = this.jobStatuses.get(organizationId);
      if (status) {
        status.status = 'RUNNING';
        status.lastRun = new Date();
        status.attempts += 1;
      }

      if (DEBUG) {
        console.log(`🚀 Executing scheduled training for org: ${organizationId}`);
      }

      // Get organization details
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          id: true,
          name: true,
          mlModelConfig: true,
          schemaConfig: true,
          scadaDbConfig: true
        }
      });

      if (!org) {
        throw new Error(`Organization not found: ${organizationId}`);
      }

      // Build complete training configuration
      const trainingConfig: TrainingConfig = {
        ...config.trainingConfig,
        organizationId,
        dataRange: config.trainingConfig.dataRange || {
          startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          endDate: new Date()
        },
        featureColumns: config.trainingConfig.featureColumns || 
                       this.extractFeatureColumns(org.mlModelConfig, org.schemaConfig)
      } as TrainingConfig;

      // Execute training
      const trainingResult = await trainingService.trainModel(organizationId, trainingConfig);

      // Validate model
      const validation = await trainingService.validateModel(organizationId, trainingResult.modelPath);

      // Deploy if validation passes
      if (validation.isValid && validation.accuracy >= 0.75) {
        const deployment = await trainingService.deployModel(
          organizationId, 
          trainingResult.modelPath, 
          trainingResult.version
        );

        // Update status to success
        if (status) {
          status.status = 'SUCCESS';
          status.lastResult = {
            trainingResult,
            validation,
            deployment
          };
          status.attempts = 0; // Reset attempts on success
        }

        // Send success notification
        if (config.notifyOnSuccess) {
          await this.sendTrainingNotification(organizationId, 'SUCCESS', {
            version: trainingResult.version,
            accuracy: validation.accuracy,
            deployedAt: deployment.deployedAt
          });
        }

        if (DEBUG) {
          console.log(`✅ Scheduled training completed successfully for org: ${organizationId}`);
          console.log(`   Version: ${trainingResult.version}`);
          console.log(`   Accuracy: ${validation.accuracy.toFixed(3)}`);
        }

      } else {
        throw new Error(`Model validation failed: accuracy ${validation.accuracy.toFixed(3)} < 0.75`);
      }

    } catch (error) {
      console.error(`❌ Scheduled training failed for org ${organizationId}:`, error);

      const status = this.jobStatuses.get(organizationId);
      if (status) {
        status.lastError = error instanceof Error ? error.message : String(error);

        // Check if we should retry
        if (status.attempts < status.maxAttempts) {
          status.status = 'RETRYING';
          await this.scheduleRetry(config, status.attempts);
        } else {
          status.status = 'FAILED';
          
          // Send failure notification
          if (config.notifyOnFailure) {
            await this.sendTrainingNotification(organizationId, 'FAILED', {
              error: status.lastError,
              attempts: status.attempts
            });
          }
        }
      }

      // Log training failure
      await this.logTrainingFailure(organizationId, error);
    }
  }

  /**
   * Schedule retry for failed training
   */
  private async scheduleRetry(config: ScheduledTrainingConfig, attempt: number): Promise<void> {
    const { organizationId } = config;
    
    // Exponential backoff: 5min, 15min, 45min
    const delayMinutes = 5 * Math.pow(3, attempt - 1);
    const delayMs = delayMinutes * 60 * 1000;

    if (DEBUG) {
      console.log(`🔄 Scheduling retry ${attempt} for org ${organizationId} in ${delayMinutes} minutes`);
    }

    // Clear existing retry timeout
    const existingTimeout = this.retryTimeouts.get(organizationId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule retry
    const timeout = setTimeout(async () => {
      await this.executeScheduledTraining(config);
      this.retryTimeouts.delete(organizationId);
    }, delayMs);

    this.retryTimeouts.set(organizationId, timeout);
  }

  /**
   * Cancel scheduled training for an organization
   */
  async cancelSchedule(organizationId: string): Promise<void> {
    try {
      // Cancel cron job
      const existingTask = this.scheduledJobs.get(organizationId);
      if (existingTask) {
        existingTask.stop();
        existingTask.destroy();
        this.scheduledJobs.delete(organizationId);
      }

      // Cancel retry timeout
      const existingTimeout = this.retryTimeouts.get(organizationId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        this.retryTimeouts.delete(organizationId);
      }

      // Remove status
      this.jobStatuses.delete(organizationId);

      if (DEBUG) {
        console.log(`🛑 Cancelled training schedule for org: ${organizationId}`);
      }

    } catch (error) {
      console.error(`Error cancelling schedule for org ${organizationId}:`, error);
    }
  }

  /**
   * Get training job status
   */
  getJobStatus(organizationId: string): TrainingJobStatus | undefined {
    return this.jobStatuses.get(organizationId);
  }

  /**
   * Get all job statuses
   */
  getAllJobStatuses(): TrainingJobStatus[] {
    return Array.from(this.jobStatuses.values());
  }

  /**
   * Send training notification
   */
  private async sendTrainingNotification(
    organizationId: string, 
    status: 'SUCCESS' | 'FAILED', 
    details: any
  ): Promise<void> {
    try {
      const title = status === 'SUCCESS' 
        ? '✅ Model Training Completed' 
        : '❌ Model Training Failed';

      const body = status === 'SUCCESS'
        ? `New predictive model deployed (v${details.version}) with ${(details.accuracy * 100).toFixed(1)}% accuracy`
        : `Training failed after ${details.attempts} attempts: ${details.error}`;

      await NotificationService.createNotification({
        title,
        body,
        severity: status === 'SUCCESS' ? 'INFO' : 'WARNING',
        type: 'SYSTEM',
        organizationId,
        metadata: {
          trainingStatus: status,
          ...details
        }
      });

    } catch (error) {
      console.error('Error sending training notification:', error);
    }
  }

  /**
   * Log training failure
   */
  private async logTrainingFailure(organizationId: string, error: any): Promise<void> {
    try {
      await prisma.trainingLog.create({
        data: {
          organizationId,
          status: 'FAILED',
          version: `failed_${Date.now()}`,
          startedAt: new Date(),
          completedAt: new Date(),
          config: { type: 'scheduled_training' },
          errorMessage: error instanceof Error ? error.message : String(error)
        }
      });
    } catch (logError) {
      console.error('Error logging training failure:', logError);
    }
  }

  /**
   * Start monitoring service for job health
   */
  private startMonitoringService(): void {
    // Check job health every 30 minutes
    setInterval(async () => {
      await this.monitorJobHealth();
    }, 30 * 60 * 1000);

    if (DEBUG) {
      console.log('📊 Training job monitoring service started');
    }
  }

  /**
   * Monitor job health and detect stuck jobs
   */
  private async monitorJobHealth(): Promise<void> {
    try {
      const now = new Date();
      
      for (const [orgId, status] of this.jobStatuses.entries()) {
        // Check for stuck running jobs (running for more than 2 hours)
        if (status.status === 'RUNNING' && status.lastRun) {
          const runningTime = now.getTime() - status.lastRun.getTime();
          const maxRunningTime = 2 * 60 * 60 * 1000; // 2 hours
          
          if (runningTime > maxRunningTime) {
            console.warn(`⚠️ Training job stuck for org ${orgId}, running for ${Math.round(runningTime / 60000)} minutes`);
            
            // Reset status and send alert
            status.status = 'FAILED';
            status.lastError = 'Training job timeout - exceeded 2 hours';
            
            await this.sendTrainingNotification(orgId, 'FAILED', {
              error: 'Training timeout',
              runningTime: Math.round(runningTime / 60000)
            });
          }
        }
      }
    } catch (error) {
      console.error('Error monitoring job health:', error);
    }
  }

  /**
   * Calculate next run time for cron pattern
   */
  private calculateNextRun(pattern: string, timezone?: string): Date | null {
    try {
      // Simple calculation for weekly pattern "0 2 * * 0" (Sunday at 2 AM)
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      nextWeek.setHours(2, 0, 0, 0);
      
      // Find next Sunday
      const dayOfWeek = nextWeek.getDay();
      const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      nextWeek.setDate(nextWeek.getDate() + daysUntilSunday);
      
      return nextWeek;
    } catch (error) {
      console.error('Error calculating next run:', error);
      return null;
    }
  }

  /**
   * Get default hyperparameters
   */
  private getDefaultHyperparameters() {
    return {
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
    };
  }

  /**
   * Extract feature columns from configuration
   */
  private extractFeatureColumns(mlModelConfig: any, schemaConfig?: any): string[] {
    const config = typeof mlModelConfig === 'string' ? JSON.parse(mlModelConfig) : mlModelConfig;
    const schema = typeof schemaConfig === 'string' ? JSON.parse(schemaConfig) : schemaConfig;
    
    return config?.features || schema?.continuousColumns || [
      'temperature', 'pressure', 'flow_rate', 'vibration', 'current', 'voltage'
    ];
  }

  /**
   * Shutdown scheduler gracefully
   */
  async shutdown(): Promise<void> {
    if (DEBUG) {
      console.log('🛑 Shutting down Training Scheduler...');
    }

    // Stop all cron jobs
    for (const [orgId, task] of this.scheduledJobs.entries()) {
      task.stop();
      task.destroy();
      if (DEBUG) {
        console.log(`   Stopped schedule for org: ${orgId}`);
      }
    }

    // Clear all retry timeouts
    for (const [orgId, timeout] of this.retryTimeouts.entries()) {
      clearTimeout(timeout);
      if (DEBUG) {
        console.log(`   Cleared retry timeout for org: ${orgId}`);
      }
    }

    // Clear maps
    this.scheduledJobs.clear();
    this.jobStatuses.clear();
    this.retryTimeouts.clear();

    if (DEBUG) {
      console.log('✅ Training Scheduler shutdown complete');
    }
  }
}

// Export singleton instance
export const trainingScheduler = new TrainingScheduler();