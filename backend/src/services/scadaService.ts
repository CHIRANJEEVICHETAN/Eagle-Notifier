import { getClientWithRetry } from '../config/scadaDb';
import { NotificationService } from './notificationService';
import prisma from '../config/db';
import { format } from 'date-fns';
import { AlarmStatus } from './../generated/prisma-client';

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
let cachedScadaData: ScadaData | null = null;

// Keep track of consecutive errors for backoff strategy
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;

// Cache for processed alarms to prevent duplicate notifications
let lastProcessedTimestamp: string | null = null;
let cachedProcessedAlarms: any = null;

export interface ScadaData {
    // Analog Values
    hz1sv: number;
    hz1pv: number;
    hz2sv: number;
    hz2pv: number;
    cpsv: number;
    cppv: number;
    tz1sv: number;
    tz1pv: number;
    tz2sv: number;
    tz2pv: number;
    oilpv: number;

    // Binary Values
    oiltemphigh: boolean;
    oillevelhigh: boolean;
    oillevellow: boolean;
    hz1hfail: boolean;
    hz2hfail: boolean;
    hardconfail: boolean;
    hardcontraip: boolean;
    oilconfail: boolean;
    oilcontraip: boolean;
    hz1fanfail: boolean;
    hz2fanfail: boolean;
    hz1fantrip: boolean;
    hz2fantrip: boolean;
    tempconfail: boolean;
    tempcontraip: boolean;
    tz1fanfail: boolean;
    tz2fanfail: boolean;
    tz1fantrip: boolean;
    tz2fantrip: boolean;

    id: string;
    created_timestamp: Date;
}

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
const formatValue = (value: number, unit?: string): string => {
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
export const getLatestScadaData = async (forceRefresh = false): Promise<ScadaData | null> => {
    const now = Date.now();
    
    // If not forced and within polling interval, return cached data
    if (!forceRefresh && lastFetchTime > 0 && now - lastFetchTime < SCADA_POLLING_INTERVAL && cachedScadaData) {
        if (DEBUG) console.log(`📊 Using cached SCADA data (${Math.round((now - lastFetchTime) / 1000)}s old, refresh in ${Math.round((SCADA_POLLING_INTERVAL - (now - lastFetchTime)) / 1000)}s)`);
        return cachedScadaData;
    }
    
    try {
        const client = await getClientWithRetry();

        try {
            const query = `
              SELECT 
                hz1sv, hz1pv, hz2sv, hz2pv, cpsv, cppv, 
                tz1sv, tz1pv, tz2sv, tz2pv, oilpv,
                oiltemphigh, oillevelhigh, oillevellow,
                hz1hfail, hz2hfail, hardconfail, hardcontraip,
                oilconfail, oilcontraip, hz1fanfail, hz2fanfail,
                hz1fantrip, hz2fantrip, tempconfail, tempcontraip,
                tz1fanfail, tz2fanfail, tz1fantrip, tz2fantrip,
                id, created_timestamp
              FROM jk2 
              ORDER BY created_timestamp DESC 
              LIMIT 1
            `;
    
            const result = await client.query(query);
            
            // Reset consecutive errors counter on success
            consecutiveErrors = 0;
            
            lastFetchTime = now;
            cachedScadaData = result.rows[0] || null;
            
            if (!cachedScadaData) {
                console.warn('⚠️ No SCADA data rows returned from query');
            } else if (DEBUG) {
                console.log(`📊 Fresh SCADA data fetched at ${new Date().toISOString()}`);
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

// Get setpoint configurations
const getSetpointConfigs = async (): Promise<SetpointConfig[]> => {
    try {
        const setpoints = await prisma.$queryRaw<PrismaSetpoint[]>`
      SELECT id, name, type, zone, "scadaField",
      "lowDeviation", "highDeviation",
      "createdAt", "updatedAt"
      FROM "Setpoint"
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
        console.error('Error fetching setpoint configs:', error);
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
    zone?: string,
    scadaTimestamp?: Date
) => {
    try {
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
            }
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
            }
        });
    }
};

// Process and format alarms
export const processAndFormatAlarms = async (forceRefresh = false) => {
    try {
        const scadaData = await getLatestScadaData(forceRefresh);
        if (DEBUG) console.log('📊 Latest SCADA Data:', scadaData);

        if (!scadaData) {
            // If no SCADA data and we have cached alarms, return them
            if (cachedProcessedAlarms) {
                if (DEBUG) console.log('📊 No SCADA data available, returning cached processed alarms');
                return {
                    ...cachedProcessedAlarms,
                    lastUpdate: new Date(),
                    fromCache: true
                };
            }
            throw new Error('No SCADA data available');
        }

        // Check if this is the same timestamp as previously processed
        const scadaTimestamp = parseISTTimestamp(scadaData.created_timestamp);
        const scadaTimestampString = scadaTimestamp.toISOString();
        
        if (lastProcessedTimestamp === scadaTimestampString && !forceRefresh) {
            if (DEBUG) {
                console.log(`📊 Timestamp ${scadaTimestampString} already processed, returning cached alarms (no notifications will be sent)`);
            }
            
            // Return cached alarms without processing (no notifications)
            if (cachedProcessedAlarms) {
                return {
                    ...cachedProcessedAlarms,
                    lastUpdate: new Date(),
                    fromCache: true,
                    skipReason: 'Same timestamp as previously processed'
                };
            }
        }

        if (DEBUG) {
            console.log(`📊 Processing new timestamp: ${scadaTimestampString} (previous: ${lastProcessedTimestamp})`);
        }

        const setpointConfigs = await getSetpointConfigs();
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
        
        const analogAlarms = [];
        const binaryAlarms = [];

        // Process Analog Alarms
        const analogConfigs = [
            {
                name: 'HARDENING ZONE 1 TEMPERATURE',
                type: 'temperature',
                zone: 'zone1',
                pvField: 'hz1pv',
                svField: 'hz1sv',
                unit: '°C'
            },
            {
                name: 'HARDENING ZONE 2 TEMPERATURE',
                type: 'temperature',
                zone: 'zone2',
                pvField: 'hz2pv',
                svField: 'hz2sv',
                unit: '°C'
            },
            {
                name: 'CARBON POTENTIAL',
                type: 'carbon',
                pvField: 'cppv',
                svField: 'cpsv',
                unit: '%'
            },
            {
                name: 'TEMPERING ZONE1 TEMPERATURE',
                type: 'temperature',
                zone: 'zone1',
                pvField: 'tz1pv',
                svField: 'tz1sv',
                unit: '°C'
            },
            {
                name: 'TEMPERING ZONE2 TEMPERATURE',
                type: 'temperature',
                zone: 'zone2',
                pvField: 'tz2pv',
                svField: 'tz2sv',
                unit: '°C'
            },
            {
                name: 'OIL TEMPERATURE',
                type: 'temperature',
                pvField: 'oilpv',
                svField: 'oilpv',
                unit: '°C'
            }
        ];

        // Process each analog alarm
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

            const currentValue = scadaData[config.pvField as keyof ScadaData] as number;
            const setValue = scadaData[config.svField as keyof ScadaData] as number;

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

            if (severity !== 'info') {
                await createEnhancedNotification(
                    config.name,
                    `${config.name} Alert`,
                    formattedValue,
                    formattedSetPoint,
                    severity,
                    config.type,
                    config.zone,
                    parseISTTimestamp(scadaData.created_timestamp)
                );
            }
        }

        // Process Binary Alarms
        const binaryConfigs = [
            {
                field: 'oiltemphigh',
                name: 'OIL TEMPERATURE HIGH',
                type: 'temperature'
            },
            {
                field: 'oillevelhigh',
                name: 'OIL LEVEL HIGH',
                type: 'level'
            },
            {
                field: 'oillevellow',
                name: 'OIL LEVEL LOW',
                type: 'level'
            },
            {
                field: 'hz1hfail',
                name: 'HARDENING ZONE 1 HEATER FAILURE',
                type: 'heater',
                zone: 'zone1'
            },
            {
                field: 'hz2hfail',
                name: 'HARDENING ZONE 2 HEATER FAILURE',
                type: 'heater',
                zone: 'zone2'
            },
            {
                field: 'hz1fanfail',
                name: 'HARDENING ZONE 1 FAN FAILURE',
                type: 'fan',
                zone: 'zone1'
            },
            {
                field: 'hz2fanfail',
                name: 'HARDENING ZONE 2 FAN FAILURE',
                type: 'fan',
                zone: 'zone2'
            },
            {
                field: 'tz1fanfail',
                name: 'TEMPERING ZONE 1 FAN FAILURE',
                type: 'fan',
                zone: 'zone1'
            },
            {
                field: 'tz2fanfail',
                name: 'TEMPERING ZONE 2 FAN FAILURE',
                type: 'fan',
                zone: 'zone2'
            }
        ];

        // Process each binary alarm
        for (const config of binaryConfigs) {
            const value = scadaData[config.field as keyof ScadaData] as boolean;
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

            if (value) {
                await createEnhancedNotification(
                    config.name,
                    `${config.name} Status Change`,
                    status,
                    'NORMAL',
                    severity,
                    config.type,
                    config.zone,
                    parseISTTimestamp(scadaData.created_timestamp)
                );
            }
        }

        const result = {
            analogAlarms,
            binaryAlarms,
            timestamp: alarmTimestamp, // Use current timestamp
            lastUpdate: new Date()
        };

        // Cache the processed alarms and update last processed timestamp
        cachedProcessedAlarms = result;
        lastProcessedTimestamp = scadaTimestampString;

        if (DEBUG) {
            console.log('📊 Processed Alarms Summary:');
            console.log(`Analog Alarms: ${analogAlarms.length}`);
            console.log(`Binary Alarms: ${binaryAlarms.length}`);
            console.log(`Cached timestamp: ${lastProcessedTimestamp}`);
        }

        return result;
    } catch (error) {
        console.error('🔴 Error processing SCADA alarms:', error);
        throw error;
    }
};

// Fetch historical SCADA alarms with pagination, filtering and sorting
export const getScadaAlarmHistory = async (
  page = 1, 
  limit = 20, 
  statusFilter = 'all',
  timeFilter?: number, // Hours back from now
  searchQuery?: string,
  sortBy = 'timestamp',
  sortOrder = 'desc',
  alarmType?: string,  // Filter by specific alarm type (temperature, carbon, etc.)
  alarmId?: string,    // Filter for a specific alarm ID to get its history
  startTime?: string   // Optional start time for custom date filtering
) => {
  try {
    const offset = (page - 1) * limit;
    
    // Build WHERE clause based on filters
    let whereClause = "";
    const params: any[] = [];
    
    // Add time filter - either using hours back or specific start time
    if (startTime) {
      // Use specific start date if provided
      whereClause += whereClause ? " AND " : " WHERE ";
      whereClause += "created_timestamp >= $" + (params.length + 1);
      params.push(new Date(startTime));
    } else if (timeFilter) {
      // Fall back to hours if no specific start time
      whereClause += whereClause ? " AND " : " WHERE ";
      whereClause += "created_timestamp > $" + (params.length + 1);
      params.push(new Date(Date.now() - timeFilter * 60 * 60 * 1000)); // Convert hours to ms
    }
    
    // Add search query if specified
    if (searchQuery) {
      const searchPattern = `%${searchQuery.toLowerCase()}%`;
      const exactSearchValue = searchQuery.toLowerCase();
      whereClause += whereClause ? " AND " : " WHERE ";
      
      // Enhanced search - search through all relevant numeric fields with exact value matching
      whereClause += "(LOWER(hz1sv::text) = $" + (params.length + 1) + 
                     " OR LOWER(hz1pv::text) = $" + (params.length + 1) + 
                     " OR LOWER(hz2sv::text) = $" + (params.length + 1) + 
                     " OR LOWER(hz2pv::text) = $" + (params.length + 1) +
                     " OR LOWER(cpsv::text) = $" + (params.length + 1) +
                     " OR LOWER(cppv::text) = $" + (params.length + 1) +
                     " OR LOWER(tz1sv::text) = $" + (params.length + 1) +
                     " OR LOWER(tz1pv::text) = $" + (params.length + 1) +
                     " OR LOWER(tz2sv::text) = $" + (params.length + 1) +
                     " OR LOWER(tz2pv::text) = $" + (params.length + 1) +
                     " OR LOWER(oilpv::text) = $" + (params.length + 1) +
                     " OR hz1pv::text LIKE $" + (params.length + 2) + 
                     " OR hz2pv::text LIKE $" + (params.length + 2) + 
                     " OR cppv::text LIKE $" + (params.length + 2) +
                     " OR tz1pv::text LIKE $" + (params.length + 2) +
                     " OR tz2pv::text LIKE $" + (params.length + 2) +
                     " OR oilpv::text LIKE $" + (params.length + 2) + ")";
      
      // Add both exact match and pattern match parameters
      params.push(exactSearchValue);
      params.push(searchPattern);
    }
    
    // Count total records for pagination
    const client = await getClientWithRetry();
    
    try {
      // Count total records for pagination
      const countQuery = `SELECT COUNT(*) FROM jk2 ${whereClause}`;
      const countResult = await client.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);
      
      // Get data with pagination, filtering, and sorting
      const query = `
        SELECT 
          hz1sv, hz1pv, hz2sv, hz2pv, cpsv, cppv, 
          tz1sv, tz1pv, tz2sv, tz2pv, oilpv,
          oiltemphigh, oillevelhigh, oillevellow,
          hz1hfail, hz2hfail, hardconfail, hardcontraip,
          oilconfail, oilcontraip, hz1fanfail, hz2fanfail,
          hz1fantrip, hz2fantrip, tempconfail, tempcontraip,
          tz1fanfail, tz2fanfail, tz1fantrip, tz2fantrip,
          id, created_timestamp
        FROM jk2
        ${whereClause}
        ORDER BY ${sortBy === 'timestamp' ? 'created_timestamp' : sortBy} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      
      // Add limit and offset to params
      params.push(limit, offset);
      
      // Execute query
      const result = await client.query(query, params);
      
      // Process each row into alarm formats
      const alarms = await Promise.all(result.rows.map(async (scadaData) => {
        const processed = await processScadaDataRow(scadaData);
        return processed;
      }));
      
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
        filteredAlarms = alarms.map(alarmSet => ({
          ...alarmSet,
          analogAlarms: alarmSet.analogAlarms.filter(alarm => alarm.id.includes(alarmId)),
          binaryAlarms: alarmSet.binaryAlarms.filter(alarm => alarm.id.includes(alarmId)),
        }));
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
async function processScadaDataRow(scadaData: ScadaData) {
  const analogAlarms = [];
  const binaryAlarms = [];
  
  // Reuse the existing alarm configuration from processAndFormatAlarms
  const analogConfigs = [
    {
      name: 'HARDENING ZONE 1 TEMPERATURE',
      type: 'temperature',
      zone: 'zone1',
      pvField: 'hz1pv',
      svField: 'hz1sv',
      unit: '°C'
    },
    {
      name: 'HARDENING ZONE 2 TEMPERATURE',
      type: 'temperature',
      zone: 'zone2',
      pvField: 'hz2pv',
      svField: 'hz2sv',
      unit: '°C'
    },
    {
      name: 'CARBON POTENTIAL',
      type: 'carbon',
      pvField: 'cppv',
      svField: 'cpsv',
      unit: '%'
    },
    {
      name: 'TEMPERING ZONE1 TEMPERATURE',
      type: 'temperature',
      zone: 'zone1',
      pvField: 'tz1pv',
      svField: 'tz1sv',
      unit: '°C'
    },
    {
      name: 'TEMPERING ZONE2 TEMPERATURE',
      type: 'temperature',
      zone: 'zone2',
      pvField: 'tz2pv',
      svField: 'tz2sv',
      unit: '°C'
    },
    {
      name: 'OIL TEMPERATURE',
      type: 'temperature',
      pvField: 'oilpv',
      svField: 'oilpv',
      unit: '°C'
    }
  ];
  
  // Process analog alarms
  for (const config of analogConfigs) {
    const currentValue = scadaData[config.pvField as keyof ScadaData] as number;
    const setValue = scadaData[config.svField as keyof ScadaData] as number;
    
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
  const binaryConfigs = [
    {
      field: 'oiltemphigh',
      name: 'OIL TEMPERATURE HIGH',
      type: 'temperature'
    },
    {
      field: 'oillevelhigh',
      name: 'OIL LEVEL HIGH',
      type: 'level'
    },
    {
      field: 'oillevellow',
      name: 'OIL LEVEL LOW',
      type: 'level'
    },
    {
      field: 'hz1hfail',
      name: 'HARDENING ZONE 1 HEATER FAILURE',
      type: 'heater',
      zone: 'zone1'
    },
    {
      field: 'hz2hfail',
      name: 'HARDENING ZONE 2 HEATER FAILURE',
      type: 'heater',
      zone: 'zone2'
    },
    {
      field: 'hz1fanfail',
      name: 'HARDENING ZONE 1 FAN FAILURE',
      type: 'fan',
      zone: 'zone1'
    },
    {
      field: 'hz2fanfail',
      name: 'HARDENING ZONE 2 FAN FAILURE',
      type: 'fan',
      zone: 'zone2'
    },
    {
      field: 'tz1fanfail',
      name: 'TEMPERING ZONE 1 FAN FAILURE',
      type: 'fan',
      zone: 'zone1'
    },
    {
      field: 'tz2fanfail',
      name: 'TEMPERING ZONE 2 FAN FAILURE',
      type: 'fan',
      zone: 'zone2'
    }
  ];
  
  // Process binary alarms
  for (const config of binaryConfigs) {
    const value = scadaData[config.field as keyof ScadaData] as boolean;
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
export const getScadaAnalyticsData = async (timeFilter: string) => {
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
    
    const client = await getClientWithRetry();
    
    try {
      // Get historical data within the time range
      const query = `
        SELECT 
          hz1sv, hz1pv, hz2sv, hz2pv, cpsv, cppv, 
          tz1sv, tz1pv, tz2sv, tz2pv, oilpv,
          oiltemphigh, oillevelhigh, oillevellow,
          hz1hfail, hz2hfail, hardconfail, hardcontraip,
          oilconfail, oilcontraip, hz1fanfail, hz2fanfail,
          hz1fantrip, hz2fantrip, tempconfail, tempcontraip,
          tz1fanfail, tz2fanfail, tz1fantrip, tz2fantrip,
          id, created_timestamp
        FROM jk2
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
        
        const latestQuery = `
          SELECT 
            hz1sv, hz1pv, hz2sv, hz2pv, cpsv, cppv, 
            tz1sv, tz1pv, tz2sv, tz2pv, oilpv,
            oiltemphigh, oillevelhigh, oillevellow,
            hz1hfail, hz2hfail, hardconfail, hardcontraip,
            oilconfail, oilcontraip, hz1fanfail, hz2fanfail,
            hz1fantrip, hz2fantrip, tempconfail, tempcontraip,
            tz1fanfail, tz2fanfail, tz1fantrip, tz2fantrip,
            id, created_timestamp
          FROM jk2
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
      
      // Prepare analog data series with highly distinct colors
      const analogDataConfigs = [
        {
          name: 'HARDENING ZONE 1 TEMPERATURE',
          color: '#FF1744', // Bright Red - Highly visible
          pvField: 'hz1pv',
          svField: 'hz1sv',
          unit: '°C',
          thresholds: {
            critical: { low: 760, high: 840 },
            warning: { low: 775, high: 825 }
          }
        },
        {
          name: 'HARDENING ZONE 2 TEMPERATURE',
          color: '#FF9800', // Bright Orange - Distinct from HZ1
          pvField: 'hz2pv',
          svField: 'hz2sv',
          unit: '°C',
          thresholds: {
            critical: { low: 810, high: 880 },
            warning: { low: 820, high: 870 }
          }
        },
        {
          name: 'CARBON POTENTIAL (CP %)',
          color: '#9C27B0', // Purple - Easily distinguishable
          pvField: 'cppv',
          svField: 'cpsv',
          unit: '%',
          thresholds: {
            critical: { low: 0.30, high: 0.50 },
            warning: { low: 0.35, high: 0.45 }
          }
        },
        {
          name: 'OIL TEMPERATURE',
          color: '#795548', // Brown - Distinct color
          pvField: 'oilpv',
          svField: 'oilpv',
          unit: '°C',
          thresholds: {
            critical: { low: 50, high: 80 },
            warning: { low: 55, high: 75 }
          }
        },
        {
          name: 'TEMPERING ZONE 1 TEMPERATURE',
          color: '#00E676', // Bright Green - Highly visible, contrasts with red HZ1
          pvField: 'tz1pv',
          svField: 'tz1sv',
          unit: '°C',
          thresholds: {
            critical: { low: 420, high: 460 },
            warning: { low: 425, high: 455 }
          }
        },
        {
          name: 'TEMPERING ZONE 2 TEMPERATURE',
          color: '#2196F3', // Blue - Distinct from TZ1 green
          pvField: 'tz2pv',
          svField: 'tz2sv',
          unit: '°C',
          thresholds: {
            critical: { low: 450, high: 470 },
            warning: { low: 452, high: 468 }
          }
        }
      ];
      
      const analogData = analogDataConfigs.map(config => ({
        name: config.name,
        color: config.color,
        data: sampledData.map(row => {
          const value = row[config.pvField as keyof ScadaData] as number;
          // Handle null/undefined values by returning 0 or a reasonable default
          if (value === null || value === undefined || isNaN(value)) {
            console.warn(`⚠️ Invalid value for ${config.pvField}:`, value);
            return 0;
          }
          return parseFloat(value.toFixed(2));
        }),
        thresholds: config.thresholds
      }));
      
      // Prepare binary data series with distinct colors
      const binaryDataConfigs = [
        {
          field: 'oillevelhigh',
          name: 'OIL LEVEL HIGH',
          color: '#FF6384' // Red-Pink
        },
        {
          field: 'oillevellow',
          name: 'OIL LEVEL LOW',
          color: '#FF8C94' // Light Red-Pink
        },
        {
          field: 'hz1hfail',
          name: 'HARDENING ZONE 1 HEATER FAILURE',
          color: '#36A2EB' // Blue
        },
        {
          field: 'hz2hfail',
          name: 'HARDENING ZONE 2 HEATER FAILURE',
          color: '#4BC0C0' // Teal
        },
        {
          field: 'hardconfail',
          name: 'HARDENING CONVEYOR FAILURE',
          color: '#FFCE56' // Yellow
        },
        {
          field: 'oilconfail',
          name: 'OIL CONVEYOR FAILURE',
          color: '#9966FF' // Purple
        },
        {
          field: 'hz1fanfail',
          name: 'HARDENING ZONE 1 FAN FAILURE',
          color: '#FF9F40' // Orange
        },
        {
          field: 'hz2fanfail',
          name: 'HARDENING ZONE 2 FAN FAILURE',
          color: '#4CAF50' // Green
        },
        {
          field: 'tempconfail',
          name: 'TEMPERING CONVEYOR FAILURE',
          color: '#E91E63' // Pink
        },
        {
          field: 'tz1fanfail',
          name: 'TEMPERING ZONE 1 FAN FAILURE',
          color: '#2196F3' // Light Blue
        },
        {
          field: 'tz2fanfail',
          name: 'TEMPERING ZONE 2 FAN FAILURE',
          color: '#00BCD4' // Cyan
        }
      ];
      
      const binaryData = binaryDataConfigs.map(config => ({
        name: config.name,
        color: config.color,
        data: sampledData.map(row => {
          const value = row[config.field as keyof ScadaData] as boolean;
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