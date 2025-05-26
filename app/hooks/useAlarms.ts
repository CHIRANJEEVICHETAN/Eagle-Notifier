import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alarmService } from '../api/alarmService';
import { Alarm, AlarmStatus } from '../types/alarm';
import { useAlarmStore } from '../store/useAlarmStore';
import axios from 'axios';
import { getAuthHeader } from '../api/auth';
import { apiConfig } from '../api/config';

// Query keys
export const ALARM_KEYS = {
  all: ['alarms'] as const,
  active: () => [...ALARM_KEYS.all, 'active'] as const,
  history: (timeframe: number) => [...ALARM_KEYS.all, 'history', timeframe] as const,
  detail: (id: string) => [...ALARM_KEYS.all, 'detail', id] as const,
  scada: () => ['scada-alarms'] as const,
};

// Hook for fetching all alarms
export const useAlarms = () => {
  const { setAlarms, setLoading, setError } = useAlarmStore();
  
  return useQuery({
    queryKey: ALARM_KEYS.all,
    queryFn: async () => {
      setLoading(true);
      try {
        const alarms = await alarmService.fetchAlarms();
        setAlarms(alarms);
        setLoading(false);
        return alarms;
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to fetch alarms');
        setLoading(false);
        throw error;
      }
    },
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider data fresh for 30 seconds
  });
};

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

// Hook for fetching alarm history
export const useAlarmHistory = (timeframe: number = 24) => {
  return useQuery({
    queryKey: ALARM_KEYS.history(timeframe),
    queryFn: () => alarmService.fetchAlarmHistory(timeframe),
    staleTime: 60000, // Consider history data fresh for 1 minute
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