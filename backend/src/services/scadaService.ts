import { getClientWithRetry } from '../config/scadaDb';
import { NotificationService } from './notificationService';
import prisma from '../config/db';
import { format } from 'date-fns';
import { AlarmStatus } from './../generated/prisma-client';
import { isMaintenanceModeActive } from '../controllers/maintenanceController';

const DEBUG = process.env.NODE_ENV === 'development';

// Helper function to safely parse IST timestamp from database
const parseISTTimestamp = (dbTimestamp: any): Date => {
    try {
        if (!dbTimestamp) {
            console.warn('⚠️ No timestamp provided, using current time');
            return new Date();
        }
        
        // If it's already a Date object, use it directly
        if (dbTimestamp instanceof Date) {
            return dbTimestamp;
        }
        
        // If it's a string, parse it carefully
        if (typeof dbTimestamp === 'string') {
            // Database timestamps are in IST format like "2025-07-01 11:48:17.527"
            // We need to parse this as local time (IST) not UTC
            
            // Remove any timezone info and treat as local
            const cleanTimestamp = dbTimestamp.replace(/[Z\+\-]\d{2}:?\d{2}?$/, '');
            
            // Parse as local time (which will be IST since database is in IST)
            const date = new Date(cleanTimestamp);
            
            if (isNaN(date.getTime())) {
                console.error('🔴 Invalid timestamp format:', dbTimestamp);
                return new Date();
            }
            
            if (DEBUG) {
                console.log(`🕐 Parsed IST timestamp: ${cleanTimestamp} -> ${date.toISOString()}`);
            }
            
            return date;
        }
        
        // Fallback: try to convert to Date
        const date = new Date(dbTimestamp);
        if (isNaN(date.getTime())) {
            console.error('🔴 Cannot parse timestamp:', dbTimestamp);
            return new Date();
        }
        
        return date;
    } catch (error) {
        console.error('🔴 Error parsing IST timestamp:', error, 'Input:', dbTimestamp);
        return new Date();
    }
};

// Define SCADA polling interval from environment or use default (30 seconds)
export const SCADA_POLLING_INTERVAL = parseInt(
  process.env.SCADA_POLL_INTERVAL || process.env.EXPO_PUBLIC_SCADA_INTERVAL ||  
  '30000'
); // Default 30 seconds

// Cache for last fetch time to respect polling interval
let lastFetchTime = 0;
let cachedScadaData: any = null;

// Keep track of consecutive errors for backoff strategy
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;

// Cache for processed alarms to prevent duplicate notifications
let lastProcessedTimestamp: string | null = null;
let cachedProcessedAlarms: any = null;

// Add schema config cache for invalidation
let lastSchemaConfigHash: string | null = null;
let schemaConfigCache: any = null;

// Helper function to create a hash of schema config for change detection
const createSchemaConfigHash = (schemaConfig: OrganizationSchemaConfig): string => {
    const configString = JSON.stringify({
        columns: schemaConfig.columns,
        table: schemaConfig.table,
        columnConfigs: schemaConfig.columnConfigs
    });
    return Buffer.from(configString).toString('base64');
};

// Function to clear schema config cache (useful for testing or manual invalidation)
export const clearSchemaConfigCache = () => {
    lastSchemaConfigHash = null;
    schemaConfigCache = null;
    cachedProcessedAlarms = null;
    lastProcessedTimestamp = null;
    if (DEBUG) console.log('🧹 Schema config cache cleared');
};

// Function to force refresh schema config for a specific organization
export const forceRefreshSchemaConfig = async (orgId: string) => {
    try {
        // Clear the cache for this organization
        lastSchemaConfigHash = null;
        schemaConfigCache = null;
        cachedProcessedAlarms = null;
        lastProcessedTimestamp = null;
        
        // Fetch fresh schema config
        const freshConfig = await getOrganizationSchemaConfig(orgId);
        const newHash = createSchemaConfigHash(freshConfig);
        
        // Update cache with fresh data
        schemaConfigCache = freshConfig;
        lastSchemaConfigHash = newHash;
        
        if (DEBUG) {
            console.log(`🔄 Forced schema config refresh for org ${orgId}`);
            console.log(`📊 New schema hash: ${newHash}`);
            console.log(`📊 Columns: ${freshConfig.columns.length}`);
            console.log(`📊 ColumnConfigs: ${Object.keys(freshConfig.columnConfigs || {}).length}`);
        }
        
        return freshConfig;
    } catch (error) {
        console.error('🔴 Error forcing schema config refresh:', error);
        throw error;
    }
};

// Dynamic ScadaData interface - will be built from org schema config
export interface ScadaData {
    [key: string]: any; // Dynamic properties based on org schema
    id: string;
    created_timestamp: Date;
}

// Organization schema configuration interface
interface OrganizationSchemaConfig {
    columns: string[];
    table?: string;
    columnConfigs?: {
        [columnName: string]: {
            name: string;
            type: string;
            zone?: string;
            unit?: string;
            isAnalog?: boolean;
            isBinary?: boolean;
        };
    };
}

// Get organization schema configuration
export const getOrganizationSchemaConfig = async (orgId: string): Promise<OrganizationSchemaConfig> => {
  try {
      console.log(`🔍 Fetching schema config for org: ${orgId}`);
      
      const org = await prisma.organization.findUnique({
          where: { id: orgId },
          select: { schemaConfig: true, scadaDbConfig: true }
      });

      if (!org) {
          console.error(`❌ Organization not found: ${orgId}`);
          throw new Error(`Organization not found: ${orgId}`);
      }

      if (DEBUG) {
        console.log(`📊 Raw schema config:`, org.schemaConfig);
        console.log(`📊 Raw SCADA DB config:`, org.scadaDbConfig);
      }

      // Parse schema config
      const schemaConfig = typeof org.schemaConfig === 'string' 
          ? JSON.parse(org.schemaConfig) 
          : org.schemaConfig;

      // Parse SCADA DB config to get table name
      const scadaDbConfig = typeof org.scadaDbConfig === 'string'
          ? JSON.parse(org.scadaDbConfig)
          : org.scadaDbConfig;

      if (DEBUG) {
      console.log(`📊 Parsed schema config:`, {
          columns: schemaConfig.columns?.length || 0,
          columnConfigs: Object.keys(schemaConfig.columnConfigs || {}).length,
            table: scadaDbConfig.table
        });
      }

      // Validate schema config structure
      if (!schemaConfig.columns || !Array.isArray(schemaConfig.columns)) {
          console.error('❌ Invalid schema config: columns is missing or not an array');
          throw new Error('Invalid schema config: columns is missing or not an array');
      }

      if (!schemaConfig.columnConfigs || typeof schemaConfig.columnConfigs !== 'object') {
          console.error('❌ Invalid schema config: columnConfigs is missing or not an object');
          throw new Error('Invalid schema config: columnConfigs is missing or not an object');
      }

      // Log binary and analog alarm counts
      const binaryCount = Object.values(schemaConfig.columnConfigs)
          .filter((config: any) => config.isBinary).length;
      const analogCount = Object.values(schemaConfig.columnConfigs)
          .filter((config: any) => config.isAnalog).length;
      
      if (DEBUG) {
        console.log(`📊 Found ${binaryCount} binary alarms and ${analogCount} analog alarms in config`);
      }

      return {
          columns: schemaConfig.columns || [],
          table: scadaDbConfig.table || 'jk2', // Default fallback
          columnConfigs: schemaConfig.columnConfigs || undefined
      };
  } catch (error) {
      console.error('❌ Error fetching organization schema config:', error);
      console.error('Stack trace:', (error as Error).stack);
      // Return default schema for backward compatibility
      const defaultConfig = {
          columns: [
              'hz1sv', 'hz1pv', 'hz2sv', 'hz2pv', 'cpsv', 'cppv', 
              'tz1sv', 'tz1pv', 'tz2sv', 'tz2pv', 'oilpv',
              'oiltemphigh', 'oillevelhigh', 'oillevellow',
              'hz1hfail', 'hz2hfail', 'hardconfail', 'hardcontraip',
              'oilconfail', 'oilcontraip', 'hz1fanfail', 'hz2fanfail',
              'hz1fantrip', 'hz2fantrip', 'tempconfail', 'tempcontraip',
              'tz1fanfail', 'tz2fanfail', 'tz1fantrip', 'tz2fantrip',
              'id', 'created_timestamp'
          ],
          table: 'jk2'
      };
      console.log('⚠️ Using default config:', defaultConfig);
      return defaultConfig;
  }
};

// Build dynamic SELECT query based on organization schema
const buildDynamicSelectQuery = (columns: string[], table: string): string => {
  if (!columns || columns.length === 0) {
      throw new Error('No columns defined in organization schema config');
  }

  // Ensure required columns are always included
  const requiredColumns = ['id', 'created_timestamp'];
  const allColumns = [...new Set([...columns, ...requiredColumns])];
  
  const columnList = allColumns.join(', ');
  
  return `
      SELECT ${columnList}
      FROM ${table}
      ORDER BY created_timestamp DESC 
      LIMIT 1
  `;
};

// Build dynamic SELECT query for historical data
const buildDynamicHistoryQuery = (
  columns: string[], 
  table: string, 
  whereClause: string, 
  sortBy: string, 
  sortOrder: string,
  limit: number,
  offset: number
): string => {
  if (!columns || columns.length === 0) {
      throw new Error('No columns defined in organization schema config');
  }

  // Ensure required columns are always included
  const requiredColumns = ['id', 'created_timestamp'];
  const allColumns = [...new Set([...columns, ...requiredColumns])];
  
  const columnList = allColumns.join(', ');
  
  return `
      SELECT ${columnList}
      FROM ${table}
      ${whereClause}
      ORDER BY ${sortBy === 'timestamp' ? 'created_timestamp' : sortBy} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}
      LIMIT $${limit} OFFSET $${offset}
  `;
};

// Build dynamic COUNT query for pagination
const buildDynamicCountQuery = (table: string, whereClause: string): string => {
  return `SELECT COUNT(*) FROM ${table} ${whereClause}`;
};


interface SetpointConfig {
    id: string;
    name: string;
    type: string;
    zone?: string | null;
    scadaField: string;
    lowDeviation: number;
    highDeviation: number;
}

interface PrismaSetpoint {
    id: string;
    name: string;
    type: string;
    zone: string | null;
    scadaField: string;
    lowDeviation: number;
    highDeviation: number;
    createdAt: Date;
    updatedAt: Date;
}

// Helper function to format alarm values
const formatValue = (value: number | undefined | null, unit?: string): string => {
    // Handle undefined, null, or NaN values
    if (value === undefined || value === null || isNaN(value)) {
        return `N/A${unit ? ` ${unit}` : ''}`;
    }
    return `${value.toFixed(2)}${unit ? ` ${unit}` : ''}`;
};

// Helper function to format timestamp in IST with AM/PM format
const formatTimestamp = (date: Date): string => {
    // Since the database timestamps are already in IST, we need to handle them carefully
    // to avoid double timezone conversion
    
    try {
        // Extract the components manually to ensure we're working with IST time
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // getMonth() returns 0-11
        const day = date.getDate();
        let hours = date.getHours();
        const minutes = date.getMinutes();
        const seconds = date.getSeconds();
        
        // Convert to 12-hour format with AM/PM
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // Convert 0 to 12 for 12 AM
        
        // Format month names
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        // Pad numbers with leading zeros
        const formattedDay = day.toString().padStart(2, '0');
        const formattedHours = hours.toString().padStart(2, '0');
        const formattedMinutes = minutes.toString().padStart(2, '0');
        const formattedSeconds = seconds.toString().padStart(2, '0');
        
        const result = `${monthNames[month - 1]} ${formattedDay}, ${year} ${formattedHours}:${formattedMinutes}:${formattedSeconds} ${ampm}`;
        
        if (DEBUG) {
            console.log(`🕐 Timestamp formatting: ${date.toISOString()} -> ${result}`);
        }
        
        return result;
    } catch (error) {
        console.error('Error formatting timestamp:', error);
        // Fallback to a safe format
        return `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
    }
};

// Calculate severity for analog values
const calculateAnalogSeverity = (value: number, setpoint: number, lowDeviation: number, highDeviation: number): 'critical' | 'warning' | 'info' => {
  const lowLimit = setpoint + lowDeviation; // lowDeviation is already negative
  const highLimit = setpoint + highDeviation;
  const warningOffset = 10;

  // Critical: Beyond deviation band by >10 units
  if (value < lowLimit - warningOffset || value > highLimit + warningOffset) {
      return 'critical';
  }
  
  // Warning: Outside deviation band but within 10 units
  // (setpoint + lowDeviation - 10) <= value < setpoint + lowDeviation
  // OR
  // setpoint + highDeviation < value <= (setpoint + highDeviation + 10)
  if (value < lowLimit || value > highLimit) {
      return 'warning';
  }
  
  // Info: Within deviation band
  return 'info';
};

// Calculate severity for binary values
const calculateBinarySeverity = (isFailure: boolean): 'critical' | 'warning' | 'info' => {
  return isFailure ? 'critical' : 'info';
};

// Get latest SCADA data with respect to polling interval
export const getLatestScadaData = async (orgId: string, forceRefresh = false): Promise<ScadaData | null> => {
  const now = Date.now();
  
  // Check if organization is enabled
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { isEnabled: true }
  });
  
  if (!org?.isEnabled && !forceRefresh) {
    if (DEBUG) console.log('🛑 Organization disabled - skipping SCADA data fetch');
    return null;
  }
  
  // Check if maintenance mode is active
  const isMaintenanceActive = await isMaintenanceModeActive(orgId);
  if (isMaintenanceActive && !forceRefresh) {
      if (DEBUG) console.log('🔧 Maintenance mode active - returning cached SCADA data without fetching new data');
      
      // Return cached data if available, otherwise return null
      if (cachedScadaData) {
          return cachedScadaData;
      } else {
          console.log('⚠️ No cached SCADA data available during maintenance mode');
          return null;
      }
  }
  
  // If not forced and within polling interval, return cached data
  if (!forceRefresh && lastFetchTime > 0 && now - lastFetchTime < SCADA_POLLING_INTERVAL && cachedScadaData) {
      if (DEBUG) console.log(`📊 Using cached SCADA data (${Math.round((now - lastFetchTime) / 1000)}s old, refresh in ${Math.round((SCADA_POLLING_INTERVAL - (now - lastFetchTime)) / 1000)}s)`);
      return cachedScadaData;
  }
  
  try {
      const client = await getClientWithRetry(orgId);

      try {
          // Get organization schema configuration
          const schemaConfig = await getOrganizationSchemaConfig(orgId);
          
          if (DEBUG) {
              console.log(`📊 Using dynamic schema for org ${orgId}:`);
              console.log(`  Table: ${schemaConfig.table}`);
              console.log(`  Columns: ${schemaConfig.columns.join(', ')}`);
          }

          // Build dynamic query
          const query = buildDynamicSelectQuery(schemaConfig.columns, schemaConfig.table || 'jk2');
  
          if (DEBUG) {
              console.log(`📊 Dynamic query: ${query}`);
          }

          const result = await client.query(query);
          
          // Reset consecutive errors counter on success
          consecutiveErrors = 0;
          
          lastFetchTime = now;
          cachedScadaData = result.rows[0] || null;
          
          if (!cachedScadaData) {
              console.warn('⚠️ No SCADA data rows returned from query');
          } else if (DEBUG) {
              console.log(`📊 Fresh SCADA data fetched at ${new Date().toISOString()}`);
              console.log(`📊 Available fields: ${Object.keys(cachedScadaData).join(', ')}`);
          }
          
          return cachedScadaData;
      } finally {
          client.release(true); // Force release to prevent connection leaks
      }
  } catch (error) {
      // Increment consecutive errors for exponential backoff
      consecutiveErrors++;
      
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          // If we've had many consecutive errors, add increasing delay
          const backoffDelay = Math.min(1000 * Math.pow(2, consecutiveErrors - MAX_CONSECUTIVE_ERRORS), 30000);
          console.error(`🔴 Multiple consecutive SCADA fetch errors (${consecutiveErrors}). Backing off for ${backoffDelay}ms before next attempt.`);
          // We don't actually need to wait here, just logging the backoff strategy
      }
      
      console.error('Error fetching latest SCADA data:', error);
      
      // If we have cached data, return it as fallback even if expired
      if (cachedScadaData) {
          console.log('⚠️ Using stale cached SCADA data due to fetch error');
          return cachedScadaData;
      }
      
      return null;
  }
};

// Get setpoint configurations for a specific organization
const getSetpointConfigs = async (orgId: string): Promise<SetpointConfig[]> => {
  try {
      const setpoints = await prisma.$queryRaw<PrismaSetpoint[]>`
    SELECT id, name, type, zone, "scadaField",
    "lowDeviation", "highDeviation",
    "createdAt", "updatedAt"
    FROM "Setpoint"
    WHERE "organizationId" = ${orgId}
  `;
      return setpoints.map(setpoint => ({
          id: setpoint.id,
          name: setpoint.name,
          type: setpoint.type,
          zone: setpoint.zone,
          scadaField: setpoint.scadaField,
          lowDeviation: setpoint.lowDeviation,
          highDeviation: setpoint.highDeviation
      }));
  } catch (error) {
      console.error('Error fetching setpoint configs for organization:', orgId, error);
      return [];
  }
};

// Create notification with enhanced details
const createEnhancedNotification = async (
    title: string,
    description: string,
    value: string,
    setPoint: string,
    severity: 'critical' | 'warning' | 'info',
    type: string,
    orgId: string,
    zone?: string,
    scadaTimestamp?: Date
) => {
    try {
        // SUPER_ADMIN users are always excluded from notifications by NotificationService
        // No need to filter here; enforced centrally
        // Use SCADA timestamp if available (already in IST), otherwise use current time
        let timestamp = scadaTimestamp || new Date();
        
        // Ensure we're working with a proper Date object for IST timestamp
        if (scadaTimestamp) {
            // Use the safe IST timestamp parser
            timestamp = parseISTTimestamp(scadaTimestamp);
            
            if (DEBUG) {
                console.log(`🕐 SCADA timestamp received: ${scadaTimestamp}`);
                console.log(`🕐 Parsed timestamp object: ${timestamp.toISOString()}`);
                console.log(`🕐 Local components: ${timestamp.getFullYear()}-${(timestamp.getMonth()+1).toString().padStart(2,'0')}-${timestamp.getDate().toString().padStart(2,'0')} ${timestamp.getHours().toString().padStart(2,'0')}:${timestamp.getMinutes().toString().padStart(2,'0')}:${timestamp.getSeconds().toString().padStart(2,'0')}`);
            }
        }
        
        const formattedTime = formatTimestamp(timestamp);
        
        if (DEBUG) {
            console.log(`🕐 Final formatted time for notification: ${formattedTime}`);
        }
        
        const notificationBody = [
            `Time: ${formattedTime}`,
            `Current Value: ${value}`,
            `Set Point: ${setPoint}`,
            zone ? `Zone: ${zone}` : '',
            `Type: ${type}`,
        ].filter(Boolean).join('\n');

        await NotificationService.createNotification({
            title: `${title} - ${severity.toUpperCase()}`,
            body: notificationBody,
            severity: severity === 'critical' ? 'CRITICAL' : severity === 'warning' ? 'WARNING' : 'INFO',
            type: 'ALARM',
            metadata: {
                timestamp,
                value,
                setPoint,
                type,
                zone
            },
            organizationId: orgId
        });
        
        if (DEBUG) {
            console.log(`✅ Notification created successfully with timestamp: ${formattedTime}`);
        }
        
    } catch (error) {
        console.error('🔴 Error creating enhanced notification:', error);
        console.error('🔴 Input parameters:', {
            title,
            scadaTimestamp: scadaTimestamp?.toISOString(),
            severity,
            type,
            zone
        });
        
        // Create a fallback notification with current time
        const fallbackTime = formatTimestamp(new Date());
        const fallbackBody = [
            `Time: ${fallbackTime}`,
            `Current Value: ${value}`,
            `Set Point: ${setPoint}`,
            zone ? `Zone: ${zone}` : '',
            `Type: ${type}`,
        ].filter(Boolean).join('\n');

        await NotificationService.createNotification({
            title: `${title} - ${severity.toUpperCase()}`,
            body: fallbackBody,
            severity: severity === 'critical' ? 'CRITICAL' : severity === 'warning' ? 'WARNING' : 'INFO',
            type: 'ALARM',
            metadata: {
                timestamp: new Date(),
                value,
                setPoint,
                type,
                zone,
                error: 'Timestamp formatting error'
            },
            organizationId: orgId
        });
    }
};

// Dynamic alarm configuration based on available columns
export const getDynamicAlarmConfigs = (scadaData: ScadaData, schemaConfig: OrganizationSchemaConfig) => {
  const availableColumns = schemaConfig.columns;
  const analogConfigs = [];
  const binaryConfigs = [];

  console.log(`\n🔍 Processing alarm configs:`);
  console.log(`📊 Available columns: ${availableColumns.length}`);
  console.log(`📊 Has columnConfigs: ${!!schemaConfig.columnConfigs}`);
  console.log(`📊 Available columns list: ${availableColumns.join(', ')}`);

  // If columnConfigs are provided, use them for dynamic configuration
  if (schemaConfig.columnConfigs) {
      const totalColumns = Object.keys(schemaConfig.columnConfigs).length;
      const binaryColumns = Object.entries(schemaConfig.columnConfigs)
          .filter(([_, config]) => config.isBinary).length;
      const analogColumns = Object.entries(schemaConfig.columnConfigs)
          .filter(([_, config]) => config.isAnalog).length;

      console.log(`\n📊 Column config summary:`);
      console.log(`  Total columns: ${totalColumns}`);
      console.log(`  Binary columns: ${binaryColumns}`);
      console.log(`  Analog columns: ${analogColumns}`);
      
      for (const [columnName, config] of Object.entries(schemaConfig.columnConfigs)) {
          console.log(`\n🔍 Processing column: ${columnName}`);
          console.log(`  Type: ${config.isAnalog ? 'Analog' : config.isBinary ? 'Binary' : 'Unknown'}`);
          console.log(`  Name: ${config.name}`);
          
          if (!availableColumns.includes(columnName)) {
              console.log(`  ⚠️ Column not found in available columns, skipping`);
              continue;
          }

          if (config.isAnalog) {
              // For analog fields, we need to find the corresponding SV/PV pair
              const isPV = columnName.endsWith('pv');
              const isSV = columnName.endsWith('sv');
              
              if (isPV) {
                  // Find corresponding SV field
                  const svField = availableColumns.find(col => 
                      col.endsWith('sv') && 
                      col.replace('pv', 'sv') === columnName.replace('pv', 'sv')
                  );
                  
                  analogConfigs.push({
                      name: config.name,
                      type: config.type,
                      zone: config.zone,
                      pvField: columnName,
                      svField: svField || '', // Empty string if no SV field
                      unit: config.unit
                  });
                  
                  console.log(`  ✅ Added analog config (PV): ${config.name}`);
                  console.log(`    PV: ${columnName}, SV: ${svField || 'none'}`);
              } else if (isSV) {
                  // Find corresponding PV field
                  const pvField = availableColumns.find(col => 
                      col.endsWith('pv') && 
                      col.replace('sv', 'pv') === columnName.replace('sv', 'pv')
                  );
                  
                  if (pvField) {
                      analogConfigs.push({
                          name: config.name,
                          type: config.type,
                          zone: config.zone,
                          pvField,
                          svField: columnName,
                          unit: config.unit
                      });
                      
                      console.log(`  ✅ Added analog config (SV): ${config.name}`);
                      console.log(`    PV: ${pvField}, SV: ${columnName}`);
                  } else {
                      console.log(`  ⚠️ No PV field found for SV column ${columnName}`);
                  }
              } else {
                  // Single field analog (like oilpv)
                  analogConfigs.push({
                      name: config.name,
                      type: config.type,
                      zone: config.zone,
                      pvField: columnName,
                      svField: '', // No SV field
                      unit: config.unit
                  });
                  
                  console.log(`  ✅ Added analog config (single): ${config.name}`);
                  console.log(`    Field: ${columnName}`);
              }
          } else if (config.isBinary) {
              // Check if field exists in SCADA data
              if (columnName in scadaData) {
                  binaryConfigs.push({
                      field: columnName,
                      name: config.name,
                      type: config.type,
                      zone: config.zone
                  });
                  
                  console.log(`  ✅ Added binary config: ${config.name}`);
                  console.log(`    Field: ${columnName}, Type: ${config.type}`);
              } else {
                  console.log(`  ⚠️ Binary field ${columnName} not found in SCADA data`);
              }
          } else {
              console.log(`  ⚠️ Column is neither analog nor binary`);
          }
      }
  } else {
      console.log('\n⚠️ No columnConfigs found, using fallback patterns');
      // Fallback to pattern-based configuration for backward compatibility
      const analogPatterns = [
          {
              pattern: /^hz1(sv|pv)$/,
              name: 'HARDENING ZONE 1 TEMPERATURE',
              type: 'temperature',
              zone: 'zone1',
              unit: '°C'
          },
          {
              pattern: /^hz2(sv|pv)$/,
              name: 'HARDENING ZONE 2 TEMPERATURE',
              type: 'temperature',
              zone: 'zone2',
              unit: '°C'
          },
          {
              pattern: /^cp(sv|pv)$/,
              name: 'CARBON POTENTIAL',
              type: 'carbon',
              unit: '%'
          },
          {
              pattern: /^tz1(sv|pv)$/,
              name: 'TEMPERING ZONE1 TEMPERATURE',
              type: 'temperature',
              zone: 'zone1',
              unit: '°C'
          },
          {
              pattern: /^tz2(sv|pv)$/,
              name: 'TEMPERING ZONE2 TEMPERATURE',
              type: 'temperature',
              zone: 'zone2',
              unit: '°C'
          },
          {
              pattern: /^oilpv$/,
              name: 'OIL TEMPERATURE',
              type: 'temperature',
              unit: '°C'
          }
      ];

      // Find matching analog fields
      for (const pattern of analogPatterns) {
          const svField = availableColumns.find(col => pattern.pattern.test(col) && col.endsWith('sv'));
          const pvField = availableColumns.find(col => pattern.pattern.test(col) && col.endsWith('pv'));
          
          // For oilpv, we only have PV field, no SV field
          if (pattern.name === 'OIL TEMPERATURE') {
              if (pvField) {
                  analogConfigs.push({
                      name: pattern.name,
                      type: pattern.type,
                      zone: pattern.zone,
                      pvField,
                      svField: '', // Empty string to indicate no SV field
                      unit: pattern.unit
                  });
                  console.log(`  ✅ Added fallback analog (single): ${pattern.name}`);
              }
          } else if (svField && pvField) {
              // For other fields, require both SV and PV
              analogConfigs.push({
                  name: pattern.name,
                  type: pattern.type,
                  zone: pattern.zone,
                  pvField,
                  svField,
                  unit: pattern.unit
              });
              console.log(`  ✅ Added fallback analog: ${pattern.name}`);
          }
      }

      // Define potential binary field patterns
      const binaryPatterns = [
          { pattern: 'oiltemphigh', name: 'OIL TEMPERATURE HIGH', type: 'temperature' },
          { pattern: 'oillevelhigh', name: 'OIL LEVEL HIGH', type: 'level' },
          { pattern: 'oillevellow', name: 'OIL LEVEL LOW', type: 'level' },
          { pattern: 'hz1hfail', name: 'HARDENING ZONE 1 HEATER FAILURE', type: 'heater', zone: 'zone1' },
          { pattern: 'hz2hfail', name: 'HARDENING ZONE 2 HEATER FAILURE', type: 'heater', zone: 'zone2' },
          { pattern: 'hz1fanfail', name: 'HARDENING ZONE 1 FAN FAILURE', type: 'fan', zone: 'zone1' },
          { pattern: 'hz2fanfail', name: 'HARDENING ZONE 2 FAN FAILURE', type: 'fan', zone: 'zone2' },
          { pattern: 'tz1fanfail', name: 'TEMPERING ZONE 1 FAN FAILURE', type: 'fan', zone: 'zone1' },
          { pattern: 'tz2fanfail', name: 'TEMPERING ZONE 2 FAN FAILURE', type: 'fan', zone: 'zone2' }
      ];

      // Find matching binary fields
      for (const pattern of binaryPatterns) {
          if (availableColumns.includes(pattern.pattern)) {
              binaryConfigs.push({
                  field: pattern.pattern,
                  name: pattern.name,
                  type: pattern.type,
                  zone: pattern.zone
              });
              console.log(`  ✅ Added fallback binary: ${pattern.name}`);
          }
      }
  }

  console.log(`\n📊 Final config summary:`);
  console.log(`  Analog alarms: ${analogConfigs.length}`);
  console.log(`  Binary alarms: ${binaryConfigs.length}`);
  
  // Log all configured alarms for debugging
  if (analogConfigs.length > 0) {
      console.log(`  Analog alarms configured:`);
      analogConfigs.forEach(config => {
          console.log(`    - ${config.name} (${config.pvField}${config.svField ? '/' + config.svField : ''})`);
      });
  }
  
  if (binaryConfigs.length > 0) {
      console.log(`  Binary alarms configured:`);
      binaryConfigs.forEach(config => {
          console.log(`    - ${config.name} (${config.field})`);
      });
  }

  return { analogConfigs, binaryConfigs };
};

/**
 * Process and format alarms for a specific organization.
 * @param orgId - Organization ID
 * @param forceRefresh - Whether to force refresh SCADA data (default: false)
 */
export const processAndFormatAlarms = async (orgId: string, forceRefresh = false) => {
  try {
      // Check if organization is enabled
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { isEnabled: true }
      });
      
      if (!org?.isEnabled && !forceRefresh) {
        if (DEBUG) console.log('🛑 Organization disabled - skipping alarm processing');
        return [];
      }
      
      // Check if maintenance mode is active
      const isMaintenanceActive = await isMaintenanceModeActive(orgId);
      
      const scadaData = await getLatestScadaData(orgId, forceRefresh);
      if (DEBUG) console.log('📊 Latest SCADA Data:', scadaData);

      if (!scadaData) {
          // If no SCADA data and we have cached alarms, return them
          if (cachedProcessedAlarms) {
              if (DEBUG) console.log('📊 No SCADA data available, returning cached processed alarms');
              return {
                  ...cachedProcessedAlarms,
                  lastUpdate: new Date(),
                  fromCache: true,
                  maintenanceMode: isMaintenanceActive
              };
          }
          throw new Error('No SCADA data available');
      }

      // Get organization schema configuration FIRST to check for changes
      const schemaConfig = await getOrganizationSchemaConfig(orgId);
      const currentSchemaHash = createSchemaConfigHash(schemaConfig);
      
      // Check if this is the same timestamp as previously processed, even on force refresh
      const scadaTimestamp = parseISTTimestamp(scadaData.created_timestamp);
      const scadaTimestampString = scadaTimestamp.toISOString();
      
      // Check if schema config has changed
      const schemaConfigChanged = lastSchemaConfigHash !== currentSchemaHash;
      
      // Check if this is a new timestamp (for notification purposes)
      // IMPORTANT: This should NEVER be affected by forceRefresh
      const isNewTimestamp = lastProcessedTimestamp !== scadaTimestampString;
      
      if (DEBUG) {
          console.log(`📊 Schema config check:`);
          console.log(`  Current hash: ${currentSchemaHash}`);
          console.log(`  Last hash: ${lastSchemaConfigHash}`);
          console.log(`  Schema changed: ${schemaConfigChanged}`);
          console.log(`  New timestamp: ${isNewTimestamp}`);
          console.log(`  Force refresh: ${forceRefresh}`);
      }
      
      // If same timestamp AND same schema config AND not force refresh, return cached alarms
      if (!isNewTimestamp && !schemaConfigChanged && !forceRefresh) {
          if (DEBUG) {
              console.log(`📊 Timestamp ${scadaTimestampString} already processed with same schema, returning cached alarms (no notifications will be sent)`);
          }
          
          // Return cached alarms without processing (no notifications)
          if (cachedProcessedAlarms) {
              return {
                  ...cachedProcessedAlarms,
                  lastUpdate: new Date(),
                  fromCache: true,
                  skipReason: 'Same timestamp and schema as previously processed'
              };
          }
      }
      
      // If force refresh but same timestamp, we still process for display but won't send notifications
      if (forceRefresh && !isNewTimestamp) {
          if (DEBUG) {
              console.log(`📊 Force refresh requested but same timestamp ${scadaTimestampString}, processing for display only (no notifications)`);
          }
      }
      
      // If schema config changed, log it for debugging
      if (schemaConfigChanged) {
          console.log(`🔄 Schema configuration changed for org ${orgId}, re-processing alarms`);
          if (DEBUG) {
              console.log(`📊 Previous schema columns: ${schemaConfigCache?.columns?.length || 0}`);
              console.log(`📊 New schema columns: ${schemaConfig.columns.length}`);
              console.log(`📊 Previous columnConfigs: ${Object.keys(schemaConfigCache?.columnConfigs || {}).length}`);
              console.log(`📊 New columnConfigs: ${Object.keys(schemaConfig.columnConfigs || {}).length}`);
          }
      }

      if (DEBUG) {
          console.log(`📊 Processing timestamp: ${scadaTimestampString} (previous: ${lastProcessedTimestamp})`);
          console.log(`📊 Will send notifications: ${isNewTimestamp && !isMaintenanceActive}`);
          if (forceRefresh && !isNewTimestamp) {
              console.log(`📊 Force refresh mode: processing for display only, no notifications`);
          }
      }

      const setpointConfigs = await getSetpointConfigs(orgId);
      if (DEBUG) {
          console.log('\n🔍 Available Setpoint Configurations:');
          setpointConfigs.forEach(sp => {
              console.log(`${sp.name} (${sp.type}${sp.zone ? `, ${sp.zone}` : ''})`);
              console.log(`  - Deviations: ${sp.lowDeviation} to +${sp.highDeviation}`);
              console.log(`  - SCADA Field: ${sp.scadaField}`);
          });
          console.log('');
      }
      
      // Always use the current timestamp for alarm data to ensure clients see updates
      // even when the underlying SCADA data hasn't changed
      const alarmTimestamp = new Date();
      
      // Get dynamic alarm configurations based on available columns
      const { analogConfigs, binaryConfigs } = getDynamicAlarmConfigs(scadaData, schemaConfig);
      
      const analogAlarms = [];
      const binaryAlarms = [];

      // Process Analog Alarms
      for (const config of analogConfigs) {
          const setpoint = setpointConfigs.find(sp => {
              const nameMatch = sp.name.trim().toLowerCase() === config.name.trim().toLowerCase();
              const typeMatch = sp.type.toLowerCase() === config.type.toLowerCase();
              const zoneMatch = (!sp.zone && !config.zone) || (sp.zone === config.zone);
              
              if (DEBUG && nameMatch) {
                  console.log(`Name match found for ${config.name}`);
                  console.log(`Type match: ${typeMatch}, Zone match: ${zoneMatch}`);
              }
              
              return nameMatch && typeMatch && zoneMatch;
          });

          if (DEBUG) {
              console.log(`\n📈 Processing Analog Alarm: ${config.name}`);
              console.log(`Looking for setpoint with:`);
              console.log(`  - Type: ${config.type}`);
              console.log(`  - Zone: ${config.zone || 'none'}`);
              console.log(`  - Name: ${config.name}`);
              if (setpoint) {
                  console.log('✅ Found matching setpoint configuration:');
                  console.log(`  - ID: ${setpoint.id}`);
                  console.log(`  - Deviations: ${setpoint.lowDeviation} to +${setpoint.highDeviation}`);
              } else {
                  console.log('⚠️ No matching setpoint found, using defaults');
              }
          }

          const currentValue = scadaData[config.pvField] as number;
          
          // Handle case where there's no SV field (like oilpv)
          let setValue: number;
          if (config.svField === '') {
              // For Oil Temperature, use a default setpoint or the current value
              setValue = currentValue; // Use current value as setpoint for now
          } else {
              setValue = scadaData[config.svField] as number;
          }

          // Validate that we have valid numeric values
          if (currentValue === undefined || currentValue === null || isNaN(currentValue)) {
              if (DEBUG) {
                  console.log(`⚠️ Invalid current value for ${config.pvField}: ${currentValue}, skipping alarm`);
              }
              continue; // Skip this alarm if we don't have valid data
          }

          if (setValue === undefined || setValue === null || isNaN(setValue)) {
              if (DEBUG) {
                  console.log(`⚠️ Invalid set value for ${config.svField || config.pvField}: ${setValue}, using current value as setpoint`);
              }
              setValue = currentValue; // Use current value as setpoint if SV is invalid
          }

          // Update default deviations based on alarm type
          const getDefaultDeviation = (type: string, isHigh: boolean = false) => {
              switch (type.toLowerCase()) {
                  case 'carbon':
                      return isHigh ? 0.05 : -0.05;
                  case 'temperature':
                      if (config.name.toLowerCase().includes('oil')) {
                          return isHigh ? 20 : 0; // Oil temperature specific defaults
                      }
                      return isHigh ? 10 : -10;
                  default:
                      return isHigh ? 10 : -10;
              }
          };

          // Use setpoint config if available, otherwise use type-specific defaults
          const lowDeviation = setpoint?.lowDeviation ?? getDefaultDeviation(config.type);
          const highDeviation = setpoint?.highDeviation ?? getDefaultDeviation(config.type, true);

          if (DEBUG) {
              console.log(`Current Value: ${currentValue}${config.unit}`);
              console.log(`Set Value: ${setValue}${config.unit}`);
              console.log(`Deviations: Low=${lowDeviation}, High=${highDeviation}`);
              if (!setpoint) {
                  console.log(`Using type-specific defaults for ${config.type}`);
              }
          }

          const severity = calculateAnalogSeverity(
              currentValue,
              setValue,
              lowDeviation,
              highDeviation
          );

          const lowLimit = setValue + lowDeviation;
          const highLimit = setValue + highDeviation;
          const formattedValue = formatValue(currentValue, config.unit);
          const formattedSetPoint = `${formatValue(setValue, config.unit)} (${lowDeviation}/+${highDeviation})`;

          analogAlarms.push({
              id: `${config.pvField}-${scadaData.id}`,
              description: config.name,
              severity,
              status: 'active',
              type: config.type,
              value: formattedValue,
              unit: config.unit,
              setPoint: formattedSetPoint,
              lowLimit: formatValue(lowLimit, config.unit),
              highLimit: formatValue(highLimit, config.unit),
              timestamp: alarmTimestamp.toISOString(), // Use current timestamp
              zone: config.zone,
              alarmType: 'analog'
          });

          // Only send notifications if not in maintenance mode AND this is a new timestamp
          // IMPORTANT: forceRefresh does NOT affect notification logic - notifications only for new timestamps
          if (severity !== 'info' && !isMaintenanceActive && isNewTimestamp) {
              await createEnhancedNotification(
                  config.name,
                  `${config.name} Alert`,
                  formattedValue,
                  formattedSetPoint,
                  severity,
                  config.type,
                  orgId,
                  config.zone,
                  parseISTTimestamp(scadaData.created_timestamp)
              );
          }
      }

      // Process Binary Alarms
      for (const config of binaryConfigs) {
          const value = scadaData[config.field] as boolean;
          
          // Validate binary value
          if (value === undefined || value === null) {
              if (DEBUG) {
                  console.log(`⚠️ Invalid binary value for ${config.field}: ${value}, treating as false (no failure)`);
              }
              // Treat undefined/null as false (no failure)
              continue; // Skip this alarm if we don't have valid data
          }
          
          const severity = calculateBinarySeverity(value);
          const status = value ? 'FAILURE' : 'NORMAL';

          binaryAlarms.push({
              id: `${config.field}-${scadaData.id}`,
              description: config.name,
              severity,
              status: 'active',
              type: config.type,
              value: status,
              setPoint: 'NORMAL',
              timestamp: alarmTimestamp.toISOString(), // Use current timestamp
              zone: config.zone
          });

          // Only send notifications if binary alarm is active and not in maintenance mode AND this is a new timestamp
          // IMPORTANT: forceRefresh does NOT affect notification logic - notifications only for new timestamps
          if (value && !isMaintenanceActive && isNewTimestamp) {
              await createEnhancedNotification(
                  config.name,
                  `${config.name} Status Change`,
                  status,
                  'NORMAL',
                  severity,
                  config.type,
                  orgId,
                  config.zone,
                  parseISTTimestamp(scadaData.created_timestamp)
              );
          }
      }

      const result = {
          analogAlarms,
          binaryAlarms,
          timestamp: alarmTimestamp, // Use current timestamp
          lastUpdate: new Date(),
          maintenanceMode: isMaintenanceActive
      };

      // Cache the processed alarms and update last processed timestamp
      cachedProcessedAlarms = result;
      lastProcessedTimestamp = scadaTimestampString;
      
      // Cache the schema config and hash for change detection
      schemaConfigCache = schemaConfig;
      lastSchemaConfigHash = currentSchemaHash;

      if (DEBUG) {
          console.log('📊 Processed Alarms Summary:');
          console.log(`Analog Alarms: ${analogAlarms.length}`);
          console.log(`Binary Alarms: ${binaryAlarms.length}`);
          console.log(`Cached timestamp: ${lastProcessedTimestamp}`);
          console.log(`Cached schema hash: ${lastSchemaConfigHash}`);
          console.log(`Maintenance Mode: ${isMaintenanceActive}`);
          console.log(`Notifications sent: ${isNewTimestamp && !isMaintenanceActive}`);
      }

      return result;
  } catch (error) {
      console.error('🔴 Error processing SCADA alarms:', error);
      throw error;
  }
};

// Fetch historical SCADA alarms with pagination, filtering and sorting
export const getScadaAlarmHistory = async (
  orgId: string,
  page = 1, 
  limit = 20, 
  statusFilter = 'all',
  timeFilter?: number, // Hours back from now
  searchQuery?: string,
  sortBy = 'timestamp',
  sortOrder = 'desc',
  alarmType?: string,  // Filter by specific alarm type (temperature, carbon, etc.)
  alarmId?: string,    // Filter for a specific alarm ID to get its history
  startTime?: string,  // Optional start time for custom date filtering
  endTime?: string     // Optional end time for custom date filtering
) => {
  try {
    const offset = (page - 1) * limit;
    
    // Build WHERE clause based on filters
    let whereClause = "";
    const params: any[] = [];
    
    // Add time filter - either using hours back or specific start/end time
    if (startTime && endTime) {
      // Use specific date range if both start and end times are provided
      whereClause += whereClause ? " AND " : " WHERE ";
      whereClause += "created_timestamp >= $" + (params.length + 1) + " AND created_timestamp <= $" + (params.length + 2);
      params.push(new Date(startTime));
      params.push(new Date(endTime));
      
      if (DEBUG) {
        console.log(`Using custom date range filter: ${startTime} -> ${new Date(startTime).toISOString()} to ${endTime} -> ${new Date(endTime).toISOString()}`);
      }
    } else if (startTime) {
      // Use only start time if provided (for backward compatibility)
      whereClause += whereClause ? " AND " : " WHERE ";
      whereClause += "created_timestamp >= $" + (params.length + 1);
      params.push(new Date(startTime));
      
      if (DEBUG) {
        console.log(`Using custom start time filter: ${startTime} -> ${new Date(startTime).toISOString()}`);
      }
    } else if (timeFilter) {
      // Fall back to hours if no specific start time
      const startDate = new Date(Date.now() - timeFilter * 60 * 60 * 1000);
      whereClause += whereClause ? " AND " : " WHERE ";
      whereClause += "created_timestamp >= $" + (params.length + 1);
      params.push(startDate);
      
      if (DEBUG) {
        console.log(`Using hours-based filter: ${timeFilter} hours -> from ${startDate.toISOString()}`);
      }
    }
    
    // Add search query if specified
    if (searchQuery) {
      const searchPattern = `%${searchQuery.toLowerCase()}%`;
      const exactSearchValue = searchQuery.toLowerCase();
      whereClause += whereClause ? " AND " : " WHERE ";
      
      // Get organization schema configuration for dynamic search
      const schemaConfig = await getOrganizationSchemaConfig(orgId);
      
      // Build dynamic search query based on available columns
      const searchConditions = schemaConfig.columns
        .filter(col => col !== 'id' && col !== 'created_timestamp')
        .map(col => `LOWER(${col}::text) = $${params.length + 1} OR ${col}::text LIKE $${params.length + 2}`)
        .join(' OR ');
      
      whereClause += `(${searchConditions})`;
      
      // Add both exact match and pattern match parameters
      params.push(exactSearchValue);
      params.push(searchPattern);
    }
    
    // Get organization schema configuration
    const schemaConfig = await getOrganizationSchemaConfig(orgId);
    
    // Count total records for pagination
    const client = await getClientWithRetry(orgId);
    
    try {
      // Count total records for pagination
      const countQuery = buildDynamicCountQuery(schemaConfig.table || 'jk2', whereClause);
      const countResult = await client.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);
      
      // Get data with pagination, filtering, and sorting
      const query = buildDynamicHistoryQuery(
        schemaConfig.columns,
        schemaConfig.table || 'jk2',
        whereClause,
        sortBy,
        sortOrder,
        params.length + 1,
        params.length + 2
      );
      
      // Add limit and offset to params
      params.push(limit, offset);
      
      // Execute query
      const result = await client.query(query, params);
      
      if (DEBUG) {
        console.log(`📊 Raw SCADA data rows returned: ${result.rows.length}`);
        if (result.rows.length > 0) {
          console.log(`📊 Sample SCADA data:`, {
            id: result.rows[0].id,
            timestamp: result.rows[0].created_timestamp,
            sampleFields: Object.keys(result.rows[0]).slice(0, 5)
          });
        }
      }
      
      // Process each row into alarm formats
      const alarms = await Promise.all(result.rows.map(async (scadaData) => {
        const processed = await processScadaDataRow(orgId, scadaData);
        return processed;
      }));
      
      if (DEBUG) {
        console.log(`📊 Processed alarm sets: ${alarms.length}`);
        if (alarms.length > 0) {
          const totalAnalog = alarms.reduce((sum, set) => sum + set.analogAlarms.length, 0);
          const totalBinary = alarms.reduce((sum, set) => sum + set.binaryAlarms.length, 0);
          console.log(`📊 Total alarms generated: ${totalAnalog} analog, ${totalBinary} binary`);
        }
      }
      
      // Get all alarm IDs before filtering
      const alarmIds = alarms.flatMap(alarm => [...alarm.analogAlarms, ...alarm.binaryAlarms]).map(a => a.id);
      
      // Get acknowledgment and resolution data for these alarms
      const alarmStatuses = await prisma.alarm.findMany({
        where: {
          id: { in: alarmIds }
        },
        include: {
          acknowledgedBy: {
            select: { id: true, name: true, email: true }
          },
          resolvedBy: {
            select: { id: true, name: true, email: true }
          }
        }
      });
      
      const statusMap = new Map(alarmStatuses.map(status => [status.id, status]));
      
      // Check if schema config has changed
      const currentSchemaHash = createSchemaConfigHash(schemaConfig);
      const schemaConfigChanged = lastSchemaConfigHash !== currentSchemaHash;

      if (DEBUG) {
          console.log(`📊 Schema config check for history:`);
          console.log(`  Current hash: ${currentSchemaHash}`);
          console.log(`  Last hash: ${lastSchemaConfigHash}`);
          console.log(`  Schema changed: ${schemaConfigChanged}`);
      }

      // If schema config changed, re-process alarms to ensure correct setpoints
      if (schemaConfigChanged) {
          console.log(`🔄 Schema configuration changed for org ${orgId}, re-processing alarms for history`);
          if (DEBUG) {
              console.log(`📊 Previous schema columns: ${schemaConfigCache?.columns?.length || 0}`);
              console.log(`📊 New schema columns: ${schemaConfig.columns.length}`);
              console.log(`📊 Previous columnConfigs: ${Object.keys(schemaConfigCache?.columnConfigs || {}).length}`);
              console.log(`📊 New columnConfigs: ${Object.keys(schemaConfig.columnConfigs || {}).length}`);
          }
      }

      // Filter by alarm type if specified
      let filteredAlarms = alarms;
      if (alarmType) {
        filteredAlarms = alarms.map(alarmSet => ({
          ...alarmSet,
          analogAlarms: alarmSet.analogAlarms.filter(alarm => alarm.type === alarmType),
          binaryAlarms: alarmSet.binaryAlarms.filter(alarm => alarm.type === alarmType),
        }));
      }
      
      // Filter by specific alarm ID if specified
      if (alarmId) {
        if (DEBUG) {
          console.log(`🔍 Debug: Filtering by alarmId: ${alarmId}`);
          console.log(`🔍 Debug: Before filtering - Total alarm sets: ${alarms.length}`);
          const totalBefore = alarms.reduce((sum, set) => sum + set.analogAlarms.length + set.binaryAlarms.length, 0);
          console.log(`🔍 Debug: Before filtering - Total alarms: ${totalBefore}`);
        }
        
        filteredAlarms = alarms.map(alarmSet => ({
          ...alarmSet,
          analogAlarms: alarmSet.analogAlarms.filter(alarm => alarm.id.includes(alarmId)),
          binaryAlarms: alarmSet.binaryAlarms.filter(alarm => alarm.id.includes(alarmId)),
        }));
        
        if (DEBUG) {
          console.log(`🔍 Debug: After filtering - Total alarm sets: ${filteredAlarms.length}`);
          const totalAfter = filteredAlarms.reduce((sum, set) => sum + set.analogAlarms.length + set.binaryAlarms.length, 0);
          console.log(`🔍 Debug: After filtering - Total alarms: ${totalAfter}`);
        }
      }
      
      // Filter by status if specified - MOVED AFTER data processing
      if (statusFilter && statusFilter !== 'all') {
        // Convert frontend status to backend enum
        const statusEnum = statusFilter.toUpperCase() as AlarmStatus;
        
        filteredAlarms = filteredAlarms.map(alarmSet => ({
          ...alarmSet,
          analogAlarms: alarmSet.analogAlarms.filter(alarm => {
            const status = statusMap.get(alarm.id)?.status || 'ACTIVE';
            return status === statusEnum;
          }),
          binaryAlarms: alarmSet.binaryAlarms.filter(alarm => {
            const status = statusMap.get(alarm.id)?.status || 'ACTIVE';
            return status === statusEnum;
          }),
        }));
      }
      
      // Merge status information into alarm data
      const enrichedAlarms = filteredAlarms.map(alarmSet => ({
        ...alarmSet,
        analogAlarms: alarmSet.analogAlarms.map(alarm => ({
          ...alarm,
          acknowledgedBy: statusMap.get(alarm.id)?.acknowledgedBy || null,
          acknowledgedAt: statusMap.get(alarm.id)?.acknowledgedAt || null,
          resolvedBy: statusMap.get(alarm.id)?.resolvedBy || null,
          resolvedAt: statusMap.get(alarm.id)?.resolvedAt || null,
          status: statusMap.get(alarm.id)?.status?.toLowerCase() || 'active',
          resolutionMessage: statusMap.get(alarm.id)?.resolutionMessage || null
        })),
        binaryAlarms: alarmSet.binaryAlarms.map(alarm => ({
          ...alarm,
          acknowledgedBy: statusMap.get(alarm.id)?.acknowledgedBy || null,
          acknowledgedAt: statusMap.get(alarm.id)?.acknowledgedAt || null,
          resolvedBy: statusMap.get(alarm.id)?.resolvedBy || null,
          resolvedAt: statusMap.get(alarm.id)?.resolvedAt || null,
          status: statusMap.get(alarm.id)?.status?.toLowerCase() || 'active',
          resolutionMessage: statusMap.get(alarm.id)?.resolutionMessage || null
        }))
      }))
      .filter(alarmSet => 
        (alarmSet.analogAlarms.length > 0 || alarmSet.binaryAlarms.length > 0)
      );
      
      const filteredTotal = enrichedAlarms.reduce(
        (acc, curr) => acc + curr.analogAlarms.length + curr.binaryAlarms.length, 
        0
      );

      if (DEBUG) {
        console.log('📋 Filter Summary:');
        console.log(`Status Filter: ${statusFilter || 'None'}`);
        console.log(`Time Filter: ${timeFilter ? `${timeFilter} hours` : 'None'}`);
        console.log(`Start Time: ${startTime || 'None'}`);
        console.log(`Search Query: ${searchQuery || 'None'}`);
        console.log(`Alarm Type: ${alarmType || 'All'}`);
        console.log(`Alarm ID: ${alarmId || 'All'}`);
        console.log(`Raw Results Count: ${total}`);
        console.log(`After Filtering Count: ${filteredTotal}`);
      }
      
      return {
        alarms: enrichedAlarms,
        pagination: {
          total,
          filteredTotal,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching SCADA alarm history:', error);
    throw error;
  }
};

// Helper function to process a single SCADA data row into alarm format
async function processScadaDataRow(orgId: string, scadaData: ScadaData) {
  const analogAlarms = [];
  const binaryAlarms = [];
  
  // Get organization schema configuration for dynamic alarm processing
  const schemaConfig = await getOrganizationSchemaConfig(orgId);
  
  // Get dynamic alarm configurations based on available columns
  const { analogConfigs, binaryConfigs } = getDynamicAlarmConfigs(scadaData, schemaConfig);
  
  // Process analog alarms
  for (const config of analogConfigs) {
    const currentValue = scadaData[config.pvField] as number;
    
    // Handle case where there's no SV field (like oilpv)
    let setValue: number;
    if (config.svField === '') {
      // For Oil Temperature, use a default setpoint or the current value
      setValue = currentValue; // Use current value as setpoint for now
    } else {
      setValue = scadaData[config.svField] as number;
    }
    
    // Validate that we have valid numeric values
    if (currentValue === undefined || currentValue === null || isNaN(currentValue)) {
        if (DEBUG) {
            console.log(`⚠️ Invalid current value for ${config.pvField}: ${currentValue}, skipping alarm`);
        }
        continue; // Skip this alarm if we don't have valid data
    }

    if (setValue === undefined || setValue === null || isNaN(setValue)) {
        if (DEBUG) {
            console.log(`⚠️ Invalid set value for ${config.svField || config.pvField}: ${setValue}, using current value as setpoint`);
        }
        setValue = currentValue; // Use current value as setpoint if SV is invalid
    }

    // Use the same deviation logic as in original function
    const getDefaultDeviation = (type: string, isHigh: boolean = false) => {
      switch (type.toLowerCase()) {
        case 'carbon':
          return isHigh ? 0.05 : -0.05;
        case 'temperature':
          if (config.name.toLowerCase().includes('oil')) {
            return isHigh ? 20 : 0; // Oil temperature specific defaults
          }
          return isHigh ? 10 : -10;
        default:
          return isHigh ? 10 : -10;
      }
    };
    
    const lowDeviation = getDefaultDeviation(config.type);
    const highDeviation = getDefaultDeviation(config.type, true);
    
    const severity = calculateAnalogSeverity(
      currentValue,
      setValue,
      lowDeviation,
      highDeviation
    );
    
    const lowLimit = setValue + lowDeviation;
    const highLimit = setValue + highDeviation;
    const formattedValue = formatValue(currentValue, config.unit);
    const formattedSetPoint = `${formatValue(setValue, config.unit)} (${lowDeviation}/+${highDeviation})`;
    
    analogAlarms.push({
      id: `${config.pvField}-${scadaData.id}`,
      description: config.name,
      severity,
      status: 'active', // Default status, will be updated from Prisma data
      type: config.type,
      value: formattedValue,
      unit: config.unit,
      setPoint: formattedSetPoint,
      lowLimit: formatValue(lowLimit, config.unit),
      highLimit: formatValue(highLimit, config.unit),
      timestamp: scadaData.created_timestamp.toISOString(),
      zone: config.zone,
      alarmType: 'analog'
    });
  }
  
  // Process binary alarms
  for (const config of binaryConfigs) {
    const value = scadaData[config.field] as boolean;
    
    // Validate binary value
    if (value === undefined || value === null) {
        if (DEBUG) {
            console.log(`⚠️ Invalid binary value for ${config.field}: ${value}, treating as false (no failure)`);
        }
        // Treat undefined/null as false (no failure)
        continue; // Skip this alarm if we don't have valid data
    }
    
    const severity = calculateBinarySeverity(value);
    const status = value ? 'FAILURE' : 'NORMAL';
    
    binaryAlarms.push({
      id: `${config.field}-${scadaData.id}`,
      description: config.name,
      severity,
      status: 'active', // Default status, will be updated from Prisma data
      type: config.type,
      value: status,
      setPoint: 'NORMAL',
      timestamp: scadaData.created_timestamp.toISOString(),
      zone: config.zone
    });
  }
  
  return {
    analogAlarms,
    binaryAlarms,
    timestamp: scadaData.created_timestamp,
    id: scadaData.id
  };
}

// Get SCADA analytics data for charts
export const getScadaAnalyticsData = async (orgId: string, timeFilter: string) => {
  try {
    if (DEBUG) console.log('📈 Fetching SCADA analytics data for timeFilter:', timeFilter);
    
    // Parse time filter and calculate duration in milliseconds
    let durationMs = 20000; // Default 20 seconds
    
    if (timeFilter.endsWith('s')) {
      const seconds = parseInt(timeFilter.slice(0, -1));
      if (isNaN(seconds) || seconds <= 0) {
        throw new Error(`Invalid seconds value: ${timeFilter}`);
      }
      durationMs = seconds * 1000;
    } else if (timeFilter.endsWith('m')) {
      const minutes = parseInt(timeFilter.slice(0, -1));
      if (isNaN(minutes) || minutes <= 0) {
        throw new Error(`Invalid minutes value: ${timeFilter}`);
      }
      durationMs = minutes * 60 * 1000;
    } else {
      console.warn(`⚠️ Unknown time filter format: ${timeFilter}, using default 20s`);
    }
    
    // Calculate start time
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - durationMs);
    
    if (DEBUG) {
      console.log(`Time range: ${startTime.toISOString()} to ${endTime.toISOString()}`);
      console.log(`Duration: ${durationMs}ms (${timeFilter})`);
    }
    
    // Get organization schema configuration
    const schemaConfig = await getOrganizationSchemaConfig(orgId);
    
    const client = await getClientWithRetry(orgId);
    
    try {
      // Build dynamic query for historical data
      const columnList = schemaConfig.columns.join(', ');
      const query = `
        SELECT ${columnList}
        FROM ${schemaConfig.table || 'jk2'}
        WHERE created_timestamp >= $1 AND created_timestamp <= $2
        ORDER BY created_timestamp ASC
      `;
      
      const result = await client.query(query, [startTime, endTime]);
      
      if (DEBUG) {
        console.log(`📊 Found ${result.rows.length} data points for analytics`);
      }
      
      // If no data found in the time range, try to get the latest available data
      if (result.rows.length === 0) {
        if (DEBUG) console.log('📊 No data in time range, trying to get latest available data...');
        
        // Build dynamic query for latest data
        const columnList = schemaConfig.columns.join(', ');
        const latestQuery = `
          SELECT ${columnList}
          FROM ${schemaConfig.table || 'jk2'}
          ORDER BY created_timestamp DESC
          LIMIT 10
        `;
        
        const latestResult = await client.query(latestQuery);
        
        if (latestResult.rows.length === 0) {
          console.warn('⚠️ No SCADA data found in database at all');
          return {
            analogData: [],
            binaryData: [],
            timeLabels: [],
            message: 'No SCADA data available in database'
          };
        }
        
        // Use the latest available data and duplicate it to show a flat line
        if (DEBUG) console.log(`📊 Using latest ${latestResult.rows.length} data points as fallback`);
        result.rows = latestResult.rows.reverse(); // Reverse to show chronological order
      }
      
      // Determine optimal number of data points based on time filter
      let targetDataPoints = 10;
      if (timeFilter === '10s') targetDataPoints = 10;
      else if (timeFilter === '15s') targetDataPoints = 15;
      else if (timeFilter === '20s') targetDataPoints = 20;
      else if (timeFilter === '1m') targetDataPoints = 20;
      else if (timeFilter === '2m') targetDataPoints = 24;
      
      // Sample data points evenly if we have more data than target
      let sampledData = result.rows;
      if (result.rows.length > targetDataPoints) {
        const step = Math.floor(result.rows.length / targetDataPoints);
        sampledData = result.rows.filter((_, index) => index % step === 0).slice(0, targetDataPoints);
      }
      
      if (DEBUG) {
        console.log(`📊 Using ${sampledData.length} sampled data points from ${result.rows.length} total`);
      }
      
      // Generate time labels
      const timeLabels = sampledData.map(row => {
        const timestamp = new Date(row.created_timestamp);
        // Format based on time range
        if (durationMs <= 60000) { // Less than 1 minute - show seconds
          return format(timestamp, 'HH:mm:ss');
        } else { // More than 1 minute - show minutes
          return format(timestamp, 'HH:mm');
        }
      });
      
      // Get dynamic alarm configurations for analytics
      const { analogConfigs, binaryConfigs } = getDynamicAlarmConfigs(result.rows[0] || {}, schemaConfig);
      
      // Prepare analog data series with highly distinct colors
      const analogDataConfigs = analogConfigs.map((config, index) => {
        const colors = ['#FF1744', '#FF9800', '#9C27B0', '#795548', '#00E676', '#2196F3'];
        return {
          name: config.name,
          color: colors[index % colors.length],
          pvField: config.pvField,
          svField: config.svField,
          unit: config.unit,
          type: config.type,
          zone: config.zone
        };
      });

      // Fetch setpoint configurations from Prisma
      const setpointConfigs = await prisma.setpoint.findMany();

      // Process analog data with dynamic thresholds
      const analogData = await Promise.all(analogDataConfigs.map(async config => {
        // Find matching setpoint configuration
        const setpoint = setpointConfigs.find(sp => {
          const nameMatch = sp.name.trim().toLowerCase() === config.name.trim().toLowerCase();
          const typeMatch = sp.type.toLowerCase() === config.type.toLowerCase();
          const zoneMatch = (!sp.zone && !config.zone) || (sp.zone === config.zone);
          return nameMatch && typeMatch && zoneMatch;
        });

        // Get default deviations based on type
        const getDefaultDeviation = (type: string, isHigh: boolean = false) => {
          switch (type.toLowerCase()) {
            case 'carbon':
              return isHigh ? 0.05 : -0.05;
            case 'hardening_temperature':
              return isHigh ? 10 : -10;
            case 'tempering_temperature':
              return isHigh ? 10 : -10;
            case 'oil_temperature':
              return isHigh ? 20 : -10;
            default:
              return isHigh ? 10 : -10;
          }
        };

        // Use setpoint config if available, otherwise use defaults
        const lowDeviation = setpoint?.lowDeviation ?? getDefaultDeviation(config.type);
        const highDeviation = setpoint?.highDeviation ?? getDefaultDeviation(config.type, true);

        return {
          name: config.name,
          color: config.color,
          data: sampledData.map(row => {
            const value = row[config.pvField] as number;
            if (value === null || value === undefined || isNaN(value)) {
              console.warn(`⚠️ Invalid value for ${config.pvField}:`, value);
              return 0;
            }
            return parseFloat(value.toFixed(2));
          }),
          setpoint: sampledData.map(row => {
            // Handle case where there's no SV field (like oilpv)
            if (config.svField === '') {
              const pvValue = row[config.pvField] as number;
              return pvValue || 0;
            } else {
              const value = row[config.svField] as number;
              return value || 0;
            }
          }),
          thresholds: {
            critical: { 
              low: sampledData.map(row => {
                // Handle case where there's no SV field (like oilpv)
                if (config.svField === '') {
                  const pvValue = row[config.pvField] as number;
                  return pvValue + lowDeviation;
                } else {
                  const sv = row[config.svField] as number;
                  return sv + lowDeviation;
                }
              }),
              high: sampledData.map(row => {
                // Handle case where there's no SV field (like oilpv)
                if (config.svField === '') {
                  const pvValue = row[config.pvField] as number;
                  return pvValue + highDeviation;
                } else {
                  const sv = row[config.svField] as number;
                  return sv + highDeviation;
                }
              })
            },
            warning: {
              low: sampledData.map(row => {
                // Handle case where there's no SV field (like oilpv)
                if (config.svField === '') {
                  const pvValue = row[config.pvField] as number;
                  return pvValue + (lowDeviation * 0.8); // 80% of critical deviation for warning
                } else {
                  const sv = row[config.svField] as number;
                  return sv + (lowDeviation * 0.8); // 80% of critical deviation for warning
                }
              }),
              high: sampledData.map(row => {
                // Handle case where there's no SV field (like oilpv)
                if (config.svField === '') {
                  const pvValue = row[config.pvField] as number;
                  return pvValue + (highDeviation * 0.8); // 80% of critical deviation for warning
                } else {
                  const sv = row[config.svField] as number;
                  return sv + (highDeviation * 0.8); // 80% of critical deviation for warning
                }
              })
            }
          },
          unit: config.unit
        };
      }));
      
      // Prepare binary data series with distinct colors
      const binaryDataConfigs = binaryConfigs.map((config, index) => {
        const colors = ['#FF6384', '#FF8C94', '#36A2EB', '#4BC0C0', '#9966FF', '#FF9F40', '#4CAF50', '#2196F3', '#00BCD4'];
        return {
          field: config.field,
          name: config.name,
          color: colors[index % colors.length]
        };
      });
      
              const binaryData = binaryDataConfigs.map(config => ({
          name: config.name,
          color: config.color,
          data: sampledData.map(row => {
            const value = row[config.field] as boolean;
            // Handle null/undefined values by returning 0 (no failure)
            if (value === null || value === undefined) {
              console.warn(`⚠️ Invalid boolean value for ${config.field}:`, value);
              return 0;
            }
            return value ? 1 : 0;
          })
        }));
      
      if (DEBUG) {
        console.log('📊 Analytics data prepared successfully');
        console.log(`Analog series: ${analogData.length}`);
        console.log(`Binary series: ${binaryData.length}`);
        console.log(`Time labels: ${timeLabels.length}`);
        
        // Log sample data for debugging
        if (analogData.length > 0 && analogData[0].data.length > 0) {
          console.log(`Sample analog data (${analogData[0].name}):`, analogData[0].data.slice(0, 3));
        }
        if (binaryData.length > 0 && binaryData[0].data.length > 0) {
          console.log(`Sample binary data (${binaryData[0].name}):`, binaryData[0].data.slice(0, 3));
        }
        console.log(`Sample time labels:`, timeLabels.slice(0, 3));
      }
      
      return {
        analogData,
        binaryData,
        timeLabels,
        timestamp: new Date(),
        duration: durationMs
      };
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('🔴 Error fetching SCADA analytics data:', error);
    throw error;
  }
}; 