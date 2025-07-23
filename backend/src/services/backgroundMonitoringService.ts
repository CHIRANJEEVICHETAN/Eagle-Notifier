import { processAndFormatAlarms } from './scadaService';
import prisma from '../config/db';
import { isMaintenanceModeActive } from '../controllers/maintenanceController';
import { PredictiveAlertController, OrganizationContext } from './predictiveAlertController';
import { PredictionService } from './predictionService';
import { OrganizationDataProcessor } from './organizationDataProcessor';

const DEBUG = process.env.NODE_ENV === 'development';

// Monitoring interval in milliseconds (default: 30 seconds)
const MONITORING_INTERVAL = parseInt(process.env.SCADA_MONITORING_INTERVAL || '30000');

// Track monitoring status for each organization
interface MonitoringStatus {
  orgId: string;
  orgName: string;
  lastCheck: Date;
  isActive: boolean;
  errorCount: number;
  lastError?: string;
}

const monitoringStatus = new Map<string, MonitoringStatus>();

/**
 * Background monitoring service for all organizations
 * This service runs continuously and monitors SCADA data for all organizations
 */
export class BackgroundMonitoringService {
  private static isRunning = false;
  private static intervalId: NodeJS.Timeout | null = null;

  /**
   * Start the background monitoring service
   */
  static async start(): Promise<void> {
    if (this.isRunning) {
      console.log('🔄 Background monitoring service is already running');
      return;
    }

    console.log('🚀 Starting background monitoring service for all organizations...');
    this.isRunning = true;

    // Initial monitoring cycle
    await this.monitorAllOrganizations();

    // Set up continuous monitoring
    this.intervalId = setInterval(async () => {
      try {
        await this.monitorAllOrganizations();
      } catch (error) {
        console.error('🔴 Error in background monitoring cycle:', error);
      }
    }, MONITORING_INTERVAL);

    console.log(`✅ Background monitoring service started (interval: ${MONITORING_INTERVAL}ms)`);
  }

  /**
   * Stop the background monitoring service
   */
  static stop(): void {
    if (!this.isRunning) {
      console.log('🔄 Background monitoring service is not running');
      return;
    }

    console.log('🛑 Stopping background monitoring service...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('✅ Background monitoring service stopped');
  }

  /**
   * Get monitoring status for all organizations
   */
  static getMonitoringStatus(): MonitoringStatus[] {
    return Array.from(monitoringStatus.values());
  }

  /**
   * Monitor all organizations
   */
  private static async monitorAllOrganizations(): Promise<void> {
    try {
      // Get all active organizations
      const organizations = await prisma.organization.findMany({
        select: {
          id: true,
          name: true,
          scadaDbConfig: true,
          schemaConfig: true
        }
      });

      if (DEBUG) {
        console.log(`📊 Monitoring ${organizations.length} organizations`);
      }

      // Monitor each organization
      const monitoringPromises = organizations.map(org => 
        this.monitorOrganization(org.id, org.name)
      );

      // Wait for all monitoring to complete
      await Promise.allSettled(monitoringPromises);

      if (DEBUG) {
        console.log(`✅ Completed monitoring cycle for ${organizations.length} organizations`);
      }
    } catch (error) {
      console.error('🔴 Error monitoring organizations:', error);
    }
  }

  /**
   * Monitor a specific organization with hybrid alert processing
   */
  private static async monitorOrganization(orgId: string, orgName: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Check if maintenance mode is active
      const isMaintenanceActive = await isMaintenanceModeActive(orgId);
      if (isMaintenanceActive) {
        if (DEBUG) {
          console.log(`🔧 Skipping monitoring for ${orgName} (maintenance mode active)`);
        }
        this.updateMonitoringStatus(orgId, orgName, true, null);
        return;
      }

      // Get organization configuration for predictive alerts
      const organization = await prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          id: true,
          name: true,
          scadaDbConfig: true,
          schemaConfig: true,
          mlModelConfig: true,
          predictionEnabled: true
        }
      });

      if (!organization) {
        throw new Error(`Organization not found: ${orgId}`);
      }

      // Process traditional rule-based alarms
      const result = await processAndFormatAlarms(orgId, false);
      
      // Process predictive alerts if enabled for this organization
      let predictionResult = null;
      if (organization.predictionEnabled && organization.mlModelConfig) {
        try {
          predictionResult = await this.processPredictiveAlerts(organization);
        } catch (predError) {
          console.error(`⚠️ Predictive alert processing failed for ${orgName}:`, predError);
          // Continue with rule-based alerts even if predictive fails
        }
      }

      const processingTime = Date.now() - startTime;
      
      if (DEBUG) {
        const predMsg = predictionResult ? ` + predictive analysis` : '';
        console.log(`📊 ${orgName}: Processed ${result.analogAlarms.length} analog + ${result.binaryAlarms.length} binary alarms${predMsg} (${processingTime}ms)`);
      }

      // Update monitoring status
      this.updateMonitoringStatus(orgId, orgName, true, null);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`🔴 Error monitoring organization ${orgName} (${orgId}):`, errorMessage);
      
      // Update monitoring status with error
      this.updateMonitoringStatus(orgId, orgName, false, errorMessage);
    }
  }

  /**
   * Process predictive alerts for an organization
   */
  private static async processPredictiveAlerts(organization: any): Promise<any> {
    try {
      // Initialize services if needed
      const predictionService = new PredictionService();
      const dataProcessor = new OrganizationDataProcessor(
        organization.id,
        organization.schemaConfig || {}
      );

      // Get latest SCADA data for the organization
      const latestData = await this.getLatestScadaData(organization.id);
      if (!latestData || latestData.length === 0) {
        if (DEBUG) {
          console.log(`📊 No recent SCADA data for predictive analysis: ${organization.name}`);
        }
        return null;
      }

      // Process data for ML features
      const processedFeatures = await dataProcessor.processData(latestData);
      
      // Get prediction from ML model
      const predictionResult = await predictionService.predict(processedFeatures);

      // Create organization context for alert processing
      const orgContext: OrganizationContext = {
        organizationId: organization.id,
        scadaConfig: organization.scadaDbConfig,
        schemaConfig: organization.schemaConfig,
        modelConfig: organization.mlModelConfig
      };

      // Generate and broadcast predictive alerts
      const alerts = await PredictiveAlertController.analyzeData(
        latestData,
        orgContext,
        predictionResult
      );

      if (DEBUG && alerts.length > 0) {
        console.log(`🤖 Generated ${alerts.length} predictive alerts for ${organization.name}`);
      }

      return predictionResult;
    } catch (error) {
      console.error(`❌ Error processing predictive alerts for ${organization.name}:`, error);
      throw error;
    }
  }

  /**
   * Get latest SCADA data for predictive analysis
   */
  private static async getLatestScadaData(organizationId: string): Promise<any[]> {
    try {
      // This would typically fetch from the organization's SCADA database
      // For now, we'll return a placeholder that would be replaced with actual SCADA data fetching
      // The actual implementation would use the organization's SCADA connection
      
      if (DEBUG) {
        console.log(`📊 Fetching latest SCADA data for organization ${organizationId}`);
      }

      // Placeholder - in real implementation, this would fetch from SCADA DB
      // using the organization's scadaDbConfig
      return [];
    } catch (error) {
      console.error(`❌ Error fetching SCADA data for organization ${organizationId}:`, error);
      return [];
    }
  }

  /**
   * Update monitoring status for an organization
   */
  private static updateMonitoringStatus(
    orgId: string, 
    orgName: string, 
    isActive: boolean, 
    error?: string | null
  ): void {
    const existing = monitoringStatus.get(orgId);
    
    if (existing) {
      existing.lastCheck = new Date();
      existing.isActive = isActive;
      if (error) {
        existing.errorCount++;
        existing.lastError = error;
      } else {
        existing.errorCount = 0;
        existing.lastError = undefined;
      }
    } else {
      monitoringStatus.set(orgId, {
        orgId,
        orgName,
        lastCheck: new Date(),
        isActive,
        errorCount: error ? 1 : 0,
        lastError: error || undefined
      });
    }
  }

  /**
   * Get health status of the monitoring service
   */
  static getHealthStatus(): {
    isRunning: boolean;
    monitoringInterval: number;
    totalOrganizations: number;
    activeOrganizations: number;
    errorOrganizations: number;
    lastUpdate: Date;
  } {
    const statuses = this.getMonitoringStatus();
    const activeCount = statuses.filter(s => s.isActive).length;
    const errorCount = statuses.filter(s => s.errorCount > 0).length;
    const lastUpdate = statuses.length > 0 
      ? new Date(Math.max(...statuses.map(s => s.lastCheck.getTime())))
      : new Date();

    return {
      isRunning: this.isRunning,
      monitoringInterval: MONITORING_INTERVAL,
      totalOrganizations: statuses.length,
      activeOrganizations: activeCount,
      errorOrganizations: errorCount,
      lastUpdate
    };
  }

  /**
   * Force a monitoring cycle for all organizations
   */
  static async forceMonitoringCycle(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Background monitoring service is not running');
    }

    console.log('🔄 Forcing monitoring cycle for all organizations...');
    await this.monitorAllOrganizations();
    console.log('✅ Forced monitoring cycle completed');
  }

  /**
   * Force monitoring for a specific organization
   */
  static async forceMonitorOrganization(orgId: string): Promise<void> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true }
    });

    if (!org) {
      throw new Error(`Organization not found: ${orgId}`);
    }

    console.log(`🔄 Forcing monitoring for organization: ${org.name}`);
    await this.monitorOrganization(org.id, org.name);
    console.log(`✅ Forced monitoring completed for: ${org.name}`);
  }
}

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down background monitoring service...');
  BackgroundMonitoringService.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down background monitoring service...');
  BackgroundMonitoringService.stop();
  process.exit(0);
});

export default BackgroundMonitoringService; 