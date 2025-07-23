import { ReportTimeRange } from '../components/ReportGenerator';
import { apiConfig } from './config';
import { getOrgHeaders } from './auth';

export interface ReportFilters {
  timeRange: ReportTimeRange;
  alarmTypes?: string[];
  severities?: string[];
}

export interface ReportData {
  alarms: {
    id: string;
    description: string;
    type: string;
    severity: string;
    status: string;
    value: string;
    setPoint: string;
    timestamp: string;
    acknowledgedAt?: string;
    resolvedAt?: string;
  }[];
  analytics: {
    totalAlarms: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    averageResponseTime: number;
  };
  timeSeriesData: {
    timestamp: string;
    values: Record<string, number | string>;
  }[];
}

export const reportsApi = {
  // Fetch report data
  fetchReportData: async (filters: ReportFilters, organizationId?: string): Promise<ReportData> => {
    const { timeRange, alarmTypes, severities } = filters;
    
    // Format parameters
    const params = new URLSearchParams({
      startDate: timeRange.startDate.toISOString(),
      endDate: timeRange.endDate.toISOString(),
    });
    
    if (alarmTypes && alarmTypes.length > 0) {
      params.append('types', alarmTypes.join(','));
    }
    
    if (severities && severities.length > 0) {
      params.append('severities', severities.join(','));
    }
    
    try {
      if (!organizationId) {
        throw new Error('Organization ID is required for reports');
      }
      
      const headers = await getOrgHeaders(organizationId);
      
      // Since we want to use a front-end approach, we'll fetch basic data and process it
      const alarmsResponse = await fetch(
        `${apiConfig.apiUrl}/alarms/history?${params.toString()}`,
        {
          headers,
        }
      );
      
      if (!alarmsResponse.ok) {
        throw new Error('Failed to fetch alarm history');
      }
      
      const alarmHistory = await alarmsResponse.json();
      
      // Process the data to generate analytics
      const analytics = processAnalytics(alarmHistory);
      
      // Process time series data
      const timeSeriesData = processTimeSeriesData(alarmHistory, timeRange);
      
      return {
        alarms: alarmHistory,
        analytics,
        timeSeriesData,
      };
    } catch (error) {
      console.error('Error fetching report data:', error);
      throw error;
    }
  },
};

// Helper function to process analytics from raw alarm data
function processAnalytics(alarms: any[]): ReportData['analytics'] {
  // Count alarms by type
  const byType: Record<string, number> = {};
  // Count alarms by severity
  const bySeverity: Record<string, number> = {};
  
  // Calculate average response time (time between alarm and acknowledgment)
  let totalResponseTime = 0;
  let acknowledgedAlarms = 0;
  
  alarms.forEach(alarm => {
    // Count by type
    byType[alarm.type] = (byType[alarm.type] || 0) + 1;
    
    // Count by severity
    bySeverity[alarm.severity] = (bySeverity[alarm.severity] || 0) + 1;
    
    // Calculate response time if acknowledged
    if (alarm.acknowledgedAt) {
      const alarmTime = new Date(alarm.timestamp).getTime();
      const ackTime = new Date(alarm.acknowledgedAt).getTime();
      totalResponseTime += (ackTime - alarmTime);
      acknowledgedAlarms++;
    }
  });
  
  // Calculate average response time in minutes
  const averageResponseTime = acknowledgedAlarms > 0
    ? totalResponseTime / acknowledgedAlarms / (1000 * 60)
    : 0;
  
  return {
    totalAlarms: alarms.length,
    byType,
    bySeverity,
    averageResponseTime,
  };
}

// Helper function to process time series data
function processTimeSeriesData(
  alarms: any[],
  timeRange: ReportTimeRange
): ReportData['timeSeriesData'] {
  // Create time buckets based on the time range
  const startTime = timeRange.startDate.getTime();
  const endTime = timeRange.endDate.getTime();
  const timeSpan = endTime - startTime;
  
  // Determine appropriate interval based on time span
  let interval: number;
  
  if (timeSpan <= 24 * 60 * 60 * 1000) {
    // Less than or equal to 24 hours: use hourly intervals
    interval = 60 * 60 * 1000;
  } else if (timeSpan <= 7 * 24 * 60 * 60 * 1000) {
    // Less than or equal to 7 days: use 6-hour intervals
    interval = 6 * 60 * 60 * 1000;
  } else {
    // More than 7 days: use daily intervals
    interval = 24 * 60 * 60 * 1000;
  }
  
  // Create buckets
  const buckets: Record<number, Record<string, number>> = {};
  
  // Initialize buckets
  for (let time = startTime; time <= endTime; time += interval) {
    buckets[time] = {};
  }
  
  // Group alarms into buckets
  alarms.forEach(alarm => {
    const alarmTime = new Date(alarm.timestamp).getTime();
    
    // Find the appropriate bucket
    const bucketTime = Math.floor((alarmTime - startTime) / interval) * interval + startTime;
    
    // Skip if outside range
    if (bucketTime < startTime || bucketTime > endTime) return;
    
    // Increment count for this alarm type
    buckets[bucketTime][alarm.type] = (buckets[bucketTime][alarm.type] || 0) + 1;
  });
  
  // Convert buckets to array format for easier use
  return Object.entries(buckets).map(([timestamp, values]) => ({
    timestamp: new Date(parseInt(timestamp)).toISOString(),
    values,
  }));
} 