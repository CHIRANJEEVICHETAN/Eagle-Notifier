import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// import { alarmService } from '../api/alarmService';
import { Alarm, AlarmStatus } from '../types/alarm';
import { useAlarmStore } from '../store/useAlarmStore';
import axios from 'axios';
import { getAuthHeader } from '../api/auth';
import { apiConfig } from '../api/config';

// Query keys
export const ALARM_KEYS = {
  all: ['alarms'] as const,
  active: () => [...ALARM_KEYS.all, 'active'] as const,
  history: (params: Record<string, any>) => [...ALARM_KEYS.all, 'history', params] as const,
  detail: (id: string) => [...ALARM_KEYS.all, 'detail', id] as const,
  scada: () => ['scada-alarms'] as const,
  alarmHistory: (params: { alarmId: string; status?: string; hours?: number; search?: string; startTime?: string; timeFilter?: string }) => 
    [...ALARM_KEYS.all, 'alarm-history', params.alarmId, params] as const,
};

// // Hook for fetching all alarms
// export const useAlarms = () => {
//   const { setAlarms, setLoading, setError } = useAlarmStore();
  
//   return useQuery({
//     queryKey: ALARM_KEYS.all,
//     queryFn: async () => {
//       setLoading(true);
//       try {
//         const alarms = await alarmService.fetchAlarms();
//         setAlarms(alarms);
//         setLoading(false);
//         return alarms;
//       } catch (error) {
//         setError(error instanceof Error ? error.message : 'Failed to fetch alarms');
//         setLoading(false);
//         throw error;
//       }
//     },
//     refetchInterval: 60000, // Refetch every minute
//     staleTime: 30000, // Consider data fresh for 30 seconds
//   });
// };

export interface ScadaAlarmResponse {
  analogAlarms: Alarm[];
  binaryAlarms: Alarm[];
}

// Hook for fetching active SCADA alarms
export const useActiveAlarms = () => {
  const { setAlarms, setLoading, setError } = useAlarmStore();

  return useQuery<ScadaAlarmResponse, Error>({
    queryKey: ALARM_KEYS.scada(),
    queryFn: async () => {
      setLoading(true);
      try {
        const headers = await getAuthHeader();
        const { data } = await axios.get<ScadaAlarmResponse>(
          `${apiConfig.apiUrl}/api/scada/alarms`,
          { headers }
        );
        
        // Ensure both arrays exist and are arrays
        const analogAlarms = Array.isArray(data.analogAlarms) ? data.analogAlarms : [];
        const binaryAlarms = Array.isArray(data.binaryAlarms) ? data.binaryAlarms : [];
        
        // Add type markers to distinguish alarms
        const markedAnalogAlarms = analogAlarms.map(alarm => ({
          ...alarm,
          alarmType: 'analog' as const
        }));
        
        const markedBinaryAlarms = binaryAlarms.map(alarm => ({
          ...alarm,
          alarmType: 'binary' as const
        }));

        // Update global store with marked alarms
        setAlarms([...markedAnalogAlarms, ...markedBinaryAlarms]);
        setLoading(false);
        
        return {
          analogAlarms: markedAnalogAlarms,
          binaryAlarms: markedBinaryAlarms
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch alarms';
        setError(errorMessage);
        setLoading(false);
        throw error;
      }
    },
    refetchInterval: 120000, // Refetch every 2 minutes
    staleTime: 110000, // Consider data stale after 1.8 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

interface UpdateAlarmStatusParams {
  id: string;
  status: AlarmStatus;
  resolutionMessage?: string;
}

// Hook for updating alarm status
export const useUpdateAlarmStatus = () => {
  const queryClient = useQueryClient();
  const { updateAlarmStatus: updateStoreAlarmStatus } = useAlarmStore();

  return useMutation({
    mutationFn: async ({ id, status, resolutionMessage }: UpdateAlarmStatusParams) => {
      const headers = await getAuthHeader();
      await axios.put(
        `${apiConfig.apiUrl}/api/alarms/${id}/status`,
        { status, resolutionMessage },
        { headers }
      );
      // Update local store immediately for optimistic updates
      updateStoreAlarmStatus(id, status);
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ALARM_KEYS.scada() });
    },
  });
};

export interface AlarmHistoryParams {
  page?: number;
  limit?: number;
  status?: string;
  hours?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  type?: string;
  alarmId?: string;
  startTime?: string;
  timeFilter?: string;
}

// Enhanced hook for fetching alarm history with pagination, filtering and sorting
export function useAlarmHistory({
  page = 1, 
  limit = 20, 
  status = 'all', 
  hours,
  search,
  sortBy = 'timestamp',
  sortOrder = 'desc',
  type,
  alarmId
}: AlarmHistoryParams = {}) {
  const params = { page, limit, status, hours, search, sortBy, sortOrder, type, alarmId };
  
  return useQuery({
    queryKey: ALARM_KEYS.history(params),
    queryFn: async () => {
      try {
        // Build the query string with parameters
        const urlParams = new URLSearchParams();
        urlParams.append('page', page.toString());
        urlParams.append('limit', limit.toString());
        urlParams.append('status', status);
        if (hours) urlParams.append('hours', hours.toString());
        if (search) urlParams.append('search', search);
        urlParams.append('sortBy', sortBy);
        urlParams.append('sortOrder', sortOrder);
        if (type) urlParams.append('type', type);
        if (alarmId) urlParams.append('alarmId', alarmId);
        
        const headers = await getAuthHeader();
        const response = await axios.get(
          `${apiConfig.apiUrl}/api/scada/history?${urlParams.toString()}`,
          { headers }
        );
        
        if (response.status !== 200) {
          throw new Error(`Error fetching alarm history: ${response.status}`);
        }
        
        return response.data;
      } catch (error) {
        console.error('Failed to fetch alarm history:', error);
        throw error;
      }
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: (previousData) => previousData, // Use previous data as placeholder
  });
}

// Hook for fetching history of a specific alarm
export function useSpecificAlarmHistory(alarmId: string, params: Partial<AlarmHistoryParams> = {}) {
  const { limit = 50, status, hours, search, startTime, timeFilter } = params;
  
  return useQuery({
    queryKey: ALARM_KEYS.alarmHistory({ alarmId, status, hours, search, startTime, timeFilter }),
    queryFn: async () => {
      if (!alarmId) return null;
      
      try {
        const urlParams = new URLSearchParams();
        urlParams.append('limit', limit.toString());
        urlParams.append('alarmId', alarmId);
        urlParams.append('sortBy', 'timestamp');
        urlParams.append('sortOrder', 'desc');
        
        // Add filter parameters if provided
        if (status && status !== 'all') urlParams.append('status', status);
        if (hours) urlParams.append('hours', hours.toString());
        if (search) urlParams.append('search', search);
        if (startTime) urlParams.append('startTime', startTime);
        if (timeFilter) urlParams.append('timeFilter', timeFilter);
        
        const headers = await getAuthHeader();
        const response = await axios.get(
          `${apiConfig.apiUrl}/api/scada/history?${urlParams.toString()}`,
          { headers }
        );
        
        if (response.status !== 200) {
          throw new Error(`Error fetching alarm history: ${response.status}`);
        }
        
        return response.data;
      } catch (error) {
        console.error(`Failed to fetch history for alarm ${alarmId}:`, error);
        throw error;
      }
    },
    enabled: !!alarmId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

// Add this function to the file if it doesn't already exist
function getAccessToken() {
  if (typeof window === 'undefined') return null;
  
  try {
    const authData = localStorage.getItem('auth');
    if (!authData) return null;
    
    const parsed = JSON.parse(authData);
    return parsed?.token || null;
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
} 