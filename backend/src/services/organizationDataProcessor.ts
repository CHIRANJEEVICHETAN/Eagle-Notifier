import { getClientWithRetry } from '../config/scadaDb';
import prisma from '../config/db';

const DEBUG = process.env.NODE_ENV === 'development';

// Core interfaces for the data processor
export interface ScadaDataPoint {
  id: string;
  timestamp: Date;
  organizationId: string;
  [key: string]: any; // Dynamic properties based on org schema
}

export interface OrganizationSchemaConfig {
  continuousColumns: string[];
  booleanColumns: string[];
  columnMapping: Record<string, string>;
  lagSeconds: number[];
  rollingWindows: number[];
  targetColumn: string;
  table?: string;
}

export interface LagFeatures {
  [key: string]: number; // e.g., "hz1pv_lag_60s": 150.5
}

export interface RollingFeatures {
  [key: string]: number; // e.g., "hz1pv_rolling_300s_mean": 148.2
}

export interface ProcessedFeatures {
  organizationId: string;
  timestamp: Date;
  features: Record<string, number>;
  metadata: FeatureMetadata;
}

export interface FeatureMetadata {
  totalFeatures: number;
  lagFeatureCount: number;
  rollingFeatureCount: number;
  missingValues: string[];
  processingTime: number;
}

/**
 * Multi-tenant data processor that handles organization-specific SCADA data processing
 * with configurable feature engineering for ML model input preparation.
 */
export class OrganizationDataProcessor {
  private organizationId: string;
  private schemaConfig: OrganizationSchemaConfig;
  private history: ScadaDataPoint[] = [];
  private readonly maxHistorySize = 1000; // Keep last 1000 data points for feature generation
  private readonly processingLock = new Map<string, Promise<ProcessedFeatures>>();

  constructor(organizationId: string, schemaConfig: OrganizationSchemaConfig) {
    this.organizationId = organizationId;
    this.schemaConfig = schemaConfig;
  }

  /**
   * Get organization schema configuration from database
   */
  static async getOrganizationSchemaConfig(orgId: string): Promise<OrganizationSchemaConfig> {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          schemaConfig: true,
          scadaDbConfig: true,
          mlModelConfig: true
        }
      });

      if (!org) {
        throw new Error(`Organization not found: ${orgId}`);
      }

      // Parse schema config
      const schemaConfig = typeof org.schemaConfig === 'string'
        ? JSON.parse(org.schemaConfig)
        : org.schemaConfig;

      // Parse ML model config for feature engineering parameters
      const mlModelConfig = typeof org.mlModelConfig === 'string'
        ? JSON.parse(org.mlModelConfig)
        : org.mlModelConfig;

      // Parse SCADA DB config to get table name
      const scadaDbConfig = typeof org.scadaDbConfig === 'string'
        ? JSON.parse(org.scadaDbConfig)
        : org.scadaDbConfig;

      // Build comprehensive schema config with defaults
      return {
        continuousColumns: schemaConfig.continuousColumns || [
          'hz1sv', 'hz1pv', 'hz2sv', 'hz2pv', 'cpsv', 'cppv',
          'tz1sv', 'tz1pv', 'tz2sv', 'tz2pv', 'oilpv'
        ],
        booleanColumns: schemaConfig.booleanColumns || [
          'oiltemphigh', 'oillevelhigh', 'oillevellow',
          'hz1hfail', 'hz2hfail', 'hardconfail', 'hardcontraip',
          'oilconfail', 'oilcontraip', 'hz1fanfail', 'hz2fanfail',
          'hz1fantrip', 'hz2fantrip', 'tempconfail', 'tempcontraip',
          'tz1fanfail', 'tz2fanfail', 'tz1fantrip', 'tz2fantrip'
        ],
        columnMapping: schemaConfig.columnMapping || {},
        lagSeconds: mlModelConfig?.lagSeconds || [60, 120], // Default 60s and 120s lag
        rollingWindows: mlModelConfig?.rollingWindows || [300], // Default 5-minute rolling window
        targetColumn: mlModelConfig?.targetColumn || 'failure_indicator',
        table: scadaDbConfig.table || 'jk2'
      };
    } catch (error) {
      console.error('Error fetching organization schema config:', error);
      // Return default configuration for backward compatibility
      return {
        continuousColumns: [
          'hz1sv', 'hz1pv', 'hz2sv', 'hz2pv', 'cpsv', 'cppv',
          'tz1sv', 'tz1pv', 'tz2sv', 'tz2pv', 'oilpv'
        ],
        booleanColumns: [
          'oiltemphigh', 'oillevelhigh', 'oillevellow',
          'hz1hfail', 'hz2hfail', 'hardconfail', 'hardcontraip',
          'oilconfail', 'oilcontraip', 'hz1fanfail', 'hz2fanfail',
          'hz1fantrip', 'hz2fantrip', 'tempconfail', 'tempcontraip',
          'tz1fanfail', 'tz2fanfail', 'tz1fantrip', 'tz2fantrip'
        ],
        columnMapping: {},
        lagSeconds: [60, 120],
        rollingWindows: [300],
        targetColumn: 'failure_indicator',
        table: 'jk2'
      };
    }
  }

  /**
   * Create a new processor instance for an organization
   */
  static async createProcessor(organizationId: string): Promise<OrganizationDataProcessor> {
    const schemaConfig = await OrganizationDataProcessor.getOrganizationSchemaConfig(organizationId);
    return new OrganizationDataProcessor(organizationId, schemaConfig);
  }

  /**
   * Apply schema mapping to raw SCADA data
   */
  applySchemaMapping(rawData: any): ScadaDataPoint {
    const mappedData: ScadaDataPoint = {
      id: rawData.id || '',
      timestamp: new Date(rawData.created_timestamp || rawData.timestamp || Date.now()),
      organizationId: this.organizationId
    };

    // Apply column mapping if configured
    for (const [rawColumn, mappedColumn] of Object.entries(this.schemaConfig.columnMapping)) {
      if (rawData[rawColumn] !== undefined) {
        mappedData[mappedColumn] = rawData[rawColumn];
      }
    }

    // Copy unmapped columns directly
    for (const column of [...this.schemaConfig.continuousColumns, ...this.schemaConfig.booleanColumns]) {
      if (rawData[column] !== undefined && !Object.values(this.schemaConfig.columnMapping).includes(column)) {
        mappedData[column] = rawData[column];
      }
    }

    return mappedData;
  }

  /**
   * Generate lag features for specified time windows
   */
  generateLagFeatures(data: ScadaDataPoint[]): LagFeatures {
    const lagFeatures: LagFeatures = {};

    if (data.length === 0) {
      return lagFeatures;
    }

    const currentData = data[data.length - 1];
    const currentTime = currentData.timestamp.getTime();

    for (const lagSeconds of this.schemaConfig.lagSeconds) {
      const targetTime = currentTime - (lagSeconds * 1000);

      // Find the closest data point to the target lag time
      let closestPoint: ScadaDataPoint | null = null;
      let minTimeDiff = Infinity;

      for (const point of data) {
        const timeDiff = Math.abs(point.timestamp.getTime() - targetTime);
        if (timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          closestPoint = point;
        }
      }

      if (closestPoint) {
        // Generate lag features for continuous columns
        for (const column of this.schemaConfig.continuousColumns) {
          if (closestPoint[column] !== undefined && closestPoint[column] !== null) {
            const featureName = `${column}_lag_${lagSeconds}s`;
            lagFeatures[featureName] = parseFloat(closestPoint[column]) || 0;
          }
        }

        // Generate lag features for boolean columns
        for (const column of this.schemaConfig.booleanColumns) {
          if (closestPoint[column] !== undefined && closestPoint[column] !== null) {
            const featureName = `${column}_lag_${lagSeconds}s`;
            lagFeatures[featureName] = closestPoint[column] ? 1 : 0;
          }
        }
      }
    }

    return lagFeatures;
  }

  /**
   * Calculate rolling statistics for specified time windows
   */
  calculateRollingStats(data: ScadaDataPoint[]): RollingFeatures {
    const rollingFeatures: RollingFeatures = {};

    if (data.length === 0) {
      return rollingFeatures;
    }

    const currentTime = data[data.length - 1].timestamp.getTime();

    for (const windowSeconds of this.schemaConfig.rollingWindows) {
      const windowStart = currentTime - (windowSeconds * 1000);

      // Filter data points within the rolling window
      const windowData = data.filter(point =>
        point.timestamp.getTime() >= windowStart && point.timestamp.getTime() <= currentTime
      );

      if (windowData.length === 0) continue;

      // Calculate rolling statistics for continuous columns
      for (const column of this.schemaConfig.continuousColumns) {
        const values = windowData
          .map(point => parseFloat(point[column]))
          .filter(val => !isNaN(val));

        if (values.length > 0) {
          const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
          const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
          const std = Math.sqrt(variance);
          const min = Math.min(...values);
          const max = Math.max(...values);

          rollingFeatures[`${column}_rolling_${windowSeconds}s_mean`] = mean;
          rollingFeatures[`${column}_rolling_${windowSeconds}s_std`] = std;
          rollingFeatures[`${column}_rolling_${windowSeconds}s_min`] = min;
          rollingFeatures[`${column}_rolling_${windowSeconds}s_max`] = max;
          rollingFeatures[`${column}_rolling_${windowSeconds}s_range`] = max - min;
        }
      }

      // Calculate rolling statistics for boolean columns (failure rates)
      for (const column of this.schemaConfig.booleanColumns) {
        const values: number[] = windowData
          .map(point => point[column] ? 1 : 0)
          .filter(val => val !== undefined && val !== null);

        if (values.length > 0) {
          const failureRate = values.reduce((sum: number, val: number) => sum + val, 0) / values.length;
          const failureCount = values.reduce((sum: number, val: number) => sum + val, 0);

          rollingFeatures[`${column}_rolling_${windowSeconds}s_rate`] = failureRate;
          rollingFeatures[`${column}_rolling_${windowSeconds}s_count`] = failureCount;
        }
      }
    }

    return rollingFeatures;
  }

  /**
   * Process raw SCADA data and generate ML-ready features
   * Thread-safe implementation using processing locks
   */
  async processData(rawData: any): Promise<ProcessedFeatures> {
    const startTime = Date.now();
    const lockKey = `${this.organizationId}_${Date.now()}`;

    // Check if there's already a processing operation in progress for this org
    const existingLock = this.processingLock.get(this.organizationId);
    if (existingLock) {
      if (DEBUG) {
        console.log(`⏳ Waiting for existing processing to complete for org ${this.organizationId}`);
      }
      await existingLock;
    }

    // Create a new processing promise
    const processingPromise = this._processDataInternal(rawData, startTime);
    this.processingLock.set(this.organizationId, processingPromise);

    try {
      const result = await processingPromise;
      return result;
    } finally {
      // Clean up the lock
      this.processingLock.delete(this.organizationId);
    }
  }

  /**
   * Internal processing method
   */
  private async _processDataInternal(rawData: any, startTime: number): Promise<ProcessedFeatures> {
    try {
      // Apply schema mapping
      const mappedData = this.applySchemaMapping(rawData);

      // Add to history and maintain size limit
      this.history.push(mappedData);
      if (this.history.length > this.maxHistorySize) {
        this.history = this.history.slice(-this.maxHistorySize);
      }

      // Sort history by timestamp to ensure proper ordering
      this.history.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Generate current features (latest values)
      const currentFeatures: Record<string, number> = {};
      const missingValues: string[] = [];

      // Process continuous columns
      for (const column of this.schemaConfig.continuousColumns) {
        if (mappedData[column] !== undefined && mappedData[column] !== null) {
          const value = parseFloat(mappedData[column]);
          if (!isNaN(value)) {
            currentFeatures[column] = value;
          } else {
            missingValues.push(column);
            currentFeatures[column] = 0; // Forward fill with 0
          }
        } else {
          missingValues.push(column);
          currentFeatures[column] = 0; // Forward fill with 0
        }
      }

      // Process boolean columns
      for (const column of this.schemaConfig.booleanColumns) {
        if (mappedData[column] !== undefined && mappedData[column] !== null) {
          currentFeatures[column] = mappedData[column] ? 1 : 0;
        } else {
          missingValues.push(column);
          currentFeatures[column] = 0; // Forward fill with 0
        }
      }

      // Generate lag features
      const lagFeatures = this.generateLagFeatures(this.history);

      // Generate rolling statistics
      const rollingFeatures = this.calculateRollingStats(this.history);

      // Combine all features
      const allFeatures = {
        ...currentFeatures,
        ...lagFeatures,
        ...rollingFeatures
      };

      const processingTime = Date.now() - startTime;

      const result: ProcessedFeatures = {
        organizationId: this.organizationId,
        timestamp: mappedData.timestamp,
        features: allFeatures,
        metadata: {
          totalFeatures: Object.keys(allFeatures).length,
          lagFeatureCount: Object.keys(lagFeatures).length,
          rollingFeatureCount: Object.keys(rollingFeatures).length,
          missingValues,
          processingTime
        }
      };

      if (DEBUG) {
        console.log(`✅ Processed features for org ${this.organizationId}:`);
        console.log(`  - Total features: ${result.metadata.totalFeatures}`);
        console.log(`  - Lag features: ${result.metadata.lagFeatureCount}`);
        console.log(`  - Rolling features: ${result.metadata.rollingFeatureCount}`);
        console.log(`  - Missing values: ${result.metadata.missingValues.length}`);
        console.log(`  - Processing time: ${result.metadata.processingTime}ms`);
      }

      return result;
    } catch (error) {
      console.error(`Error processing data for organization ${this.organizationId}:`, error);
      throw error;
    }
  }

  /**
   * Load historical data to initialize the processor
   */
  async loadHistoricalData(hours: number = 24): Promise<void> {
    try {
      const client = await getClientWithRetry(this.organizationId);

      try {
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - (hours * 60 * 60 * 1000));

        // Build query for historical data
        const allColumns = [...this.schemaConfig.continuousColumns, ...this.schemaConfig.booleanColumns, 'id', 'created_timestamp'];
        const uniqueColumns = Array.from(new Set(allColumns));
        const columnList = uniqueColumns.join(', ');

        const query = `
          SELECT ${columnList}
          FROM ${this.schemaConfig.table}
          WHERE created_timestamp >= $1 AND created_timestamp <= $2
          ORDER BY created_timestamp ASC
        `;

        const result = await client.query(query, [startTime, endTime]);

        // Process historical data
        this.history = result.rows.map(row => this.applySchemaMapping(row));

        if (DEBUG) {
          console.log(`📊 Loaded ${this.history.length} historical data points for org ${this.organizationId}`);
        }
      } finally {
        client.release(true);
      }
    } catch (error) {
      console.error(`Error loading historical data for organization ${this.organizationId}:`, error);
      // Continue with empty history - processor will still work with real-time data
      this.history = [];
    }
  }

  /**
   * Get current history size
   */
  getHistorySize(): number {
    return this.history.length;
  }

  /**
   * Clear history (useful for testing or memory management)
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get the latest processed data point
   */
  getLatestDataPoint(): ScadaDataPoint | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  /**
   * Get the latest processed features (for streaming endpoints)
   */
  async getLatestProcessedData(): Promise<ProcessedFeatures | null> {
    try {
      const latestDataPoint = this.getLatestDataPoint();
      if (!latestDataPoint) {
        return null;
      }

      // Convert the latest data point to the format expected by processData
      const rawData = {
        id: latestDataPoint.id,
        created_timestamp: latestDataPoint.timestamp.toISOString(),
        ...latestDataPoint.values
      };

      // Process the data to generate features
      return await this.processData(rawData);
    } catch (error) {
      console.error(`Error getting latest processed data for org ${this.organizationId}:`, error);
      return null;
    }
  }

  /**
   * Update schema configuration (useful for dynamic reconfiguration)
   */
  updateSchemaConfig(newConfig: OrganizationSchemaConfig): void {
    this.schemaConfig = newConfig;
    if (DEBUG) {
      console.log(`🔄 Updated schema config for org ${this.organizationId}`);
    }
  }
}

/**
 * Multi-tenant processor manager for handling multiple organizations concurrently
 */
export class MultiTenantProcessorManager {
  private processors = new Map<string, OrganizationDataProcessor>();
  private readonly maxProcessors = 100; // Limit concurrent processors

  /**
   * Get or create a processor for an organization
   */
  async getProcessor(organizationId: string): Promise<OrganizationDataProcessor> {
    let processor = this.processors.get(organizationId);

    if (!processor) {
      // Check if we've hit the limit
      if (this.processors.size >= this.maxProcessors) {
        // Remove the oldest processor (simple LRU)
        const oldestKey = this.processors.keys().next().value;
        if (oldestKey) {
          this.processors.delete(oldestKey);
          if (DEBUG) {
            console.log(`🗑️ Removed processor for org ${oldestKey} due to limit`);
          }
        }
      }

      processor = await OrganizationDataProcessor.createProcessor(organizationId);
      await processor.loadHistoricalData(); // Load 24 hours of historical data
      this.processors.set(organizationId, processor);

      if (DEBUG) {
        console.log(`✨ Created new processor for org ${organizationId}`);
      }
    }

    return processor;
  }

  /**
   * Process data for multiple organizations concurrently
   */
  async processMultipleOrganizations(
    orgDataMap: Map<string, any>
  ): Promise<Map<string, ProcessedFeatures>> {
    const results = new Map<string, ProcessedFeatures>();
    const processingPromises: Promise<void>[] = [];

    const orgEntries = Array.from(orgDataMap.entries());
    for (const [orgId, rawData] of orgEntries) {
      const promise = this.getProcessor(orgId)
        .then(processor => processor.processData(rawData))
        .then(result => {
          results.set(orgId, result);
        })
        .catch(error => {
          console.error(`Error processing data for org ${orgId}:`, error);
        });

      processingPromises.push(promise);
    }

    await Promise.all(processingPromises);
    return results;
  }

  /**
   * Remove a processor (useful for cleanup or when org is deleted)
   */
  removeProcessor(organizationId: string): void {
    this.processors.delete(organizationId);
    if (DEBUG) {
      console.log(`🗑️ Removed processor for org ${organizationId}`);
    }
  }

  /**
   * Get current processor count
   */
  getProcessorCount(): number {
    return this.processors.size;
  }

  /**
   * Clear all processors
   */
  clearAll(): void {
    this.processors.clear();
    if (DEBUG) {
      console.log('🗑️ Cleared all processors');
    }
  }
}

// Export singleton instance for global use
export const processorManager = new MultiTenantProcessorManager();