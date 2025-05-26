import scadaPool from '../config/scadaDb';
import { NotificationService } from './notificationService';
import { PrismaClient } from '@prisma/client';
import { format } from 'date-fns';

const prisma = new PrismaClient();

const DEBUG = process.env.NODE_ENV === 'development';

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

// Helper function to format timestamp
const formatTimestamp = (date: Date): string => {
    return format(date, 'MMM dd, yyyy HH:mm:ss');
};

// Calculate severity for analog values
const calculateAnalogSeverity = (value: number, setpoint: number, lowDeviation: number, highDeviation: number): 'critical' | 'warning' | 'info' => {
    const lowLimit = setpoint + lowDeviation; // lowDeviation is already negative
    const highLimit = setpoint + highDeviation;

    if (value < lowLimit - 10 || value > highLimit + 10) {
        return 'critical';
    } else if (value < lowLimit || value > highLimit) {
        return 'warning';
    }
    return 'info';
};

// Calculate severity for binary values
const calculateBinarySeverity = (isFailure: boolean): 'critical' | 'warning' | 'info' => {
    return isFailure ? 'critical' : 'info';
};

// Get latest SCADA data
export const getLatestScadaData = async (): Promise<ScadaData | null> => {
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

        const result = await scadaPool.query(query);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error fetching latest SCADA data:', error);
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
    zone?: string
) => {
    const timestamp = new Date();
    const formattedTime = formatTimestamp(timestamp);
    
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
};

// Process and format alarms
export const processAndFormatAlarms = async () => {
    try {
        const scadaData = await getLatestScadaData();
        if (DEBUG) console.log('📊 Latest SCADA Data:', scadaData);

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

        if (!scadaData) {
            throw new Error('No SCADA data available');
        }

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
                timestamp: scadaData.created_timestamp.toISOString(),
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
                    config.zone
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
                timestamp: scadaData.created_timestamp.toISOString(),
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
                    config.zone
                );
            }
        }

        const result = {
            analogAlarms,
            binaryAlarms,
            timestamp: scadaData.created_timestamp,
            lastUpdate: new Date()
        };

        if (DEBUG) {
            console.log('📊 Processed Alarms Summary:');
            console.log(`Analog Alarms: ${analogAlarms.length}`);
            console.log(`Binary Alarms: ${binaryAlarms.length}`);
        }

        return result;
    } catch (error) {
        console.error('🔴 Error processing SCADA alarms:', error);
        throw error;
    }
}; 