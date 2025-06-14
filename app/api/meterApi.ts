import axios from 'axios';
import { apiConfig } from './config';
import { getAuthHeader } from './auth';

// Types for meter readings
interface MeterReading {
  meter_id: string;
  voltage: number;
  current: number;
  frequency: number;
  pf: number;
  energy: number;
  power: number;
  created_at: string; 
}

interface MeterLimit {
  id: string;
  parameter: string;
  description: string;
  unit: string;
  highLimit: number;
  lowLimit: number | null;
}

/**
 * Fetch latest meter reading
 */
export const fetchLatestReading = async (): Promise<MeterReading> => {
  try {
    const headers = await getAuthHeader();
    const { data } = await axios.get(`${apiConfig.apiUrl}/api/meter/latest`, { headers });
    return data.data;
  } catch (error) {
    console.error('Error fetching latest meter reading:', error);
    throw error;
  }
};

/**
 * Fetch historical meter readings
 */
export const fetchMeterHistory = async (hours: number = 1): Promise<MeterReading[]> => {
  try {
    const headers = await getAuthHeader();
    const { data } = await axios.get(
      `${apiConfig.apiUrl}/api/meter/history?hours=${hours}`, 
      { headers }
    );
    return data.data;
  } catch (error) {
    console.error('Error fetching meter history:', error);
    throw error;
  }
};

/**
 * Fetch meter parameter limits
 */
export const fetchMeterLimits = async (): Promise<MeterLimit[]> => {
  try {
    const headers = await getAuthHeader();
    const { data } = await axios.get(`${apiConfig.apiUrl}/api/meter/limits`, { headers });
    return data.data;
  } catch (error) {
    console.error('Error fetching meter limits:', error);
    throw error;
  }
};

/**
 * Update meter parameter limit
 */
export const updateMeterLimit = async (
  id: string, 
  values: { highLimit?: number; lowLimit?: number }
): Promise<MeterLimit> => {
  try {
    const headers = await getAuthHeader();
    const { data } = await axios.put(
      `${apiConfig.apiUrl}/api/meter/limits/${id}`,
      values,
      { headers }
    );
    return data.data;
  } catch (error) {
    console.error('Error updating meter limit:', error);
    throw error;
  }
};

// Export types for use elsewhere
export type { MeterReading, MeterLimit }; 