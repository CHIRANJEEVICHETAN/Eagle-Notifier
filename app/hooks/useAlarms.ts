import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alarmService } from '../api/alarmService';
import { Alarm, AlarmStatus } from '../types/alarm';
import { useAlarmStore } from '../store/useAlarmStore';
import axios from 'axios';
import { getAuthHeader } from '../api/auth';
import { apiConfig } from '../api/config';

// Query keys
const ALARM_KEYS = {
  all: ['alarms'] as const,
  active: () => [...ALARM_KEYS.all, 'active'] as const,
  history: (timeframe: number) => [...ALARM_KEYS.all, 'history', timeframe] as const,
  detail: (id: string) => [...ALARM_KEYS.all, 'detail', id] as const,
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

// Hook for fetching active alarms
export const useActiveAlarms = () => {
  return useQuery({
    queryKey: ALARM_KEYS.active(),
    queryFn: alarmService.fetchActiveAlarms,
    refetchInterval: 30000, // Refetch active alarms more frequently (every 30 seconds)
    staleTime: 15000, // Consider data fresh for 15 seconds
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

export const useUpdateAlarmStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, status, resolutionMessage }: UpdateAlarmStatusParams) => {
      const headers = await getAuthHeader();
      await axios.patch(
        `${apiConfig.apiUrl}/api/alarms/${id}/status`,
        { status, resolutionMessage },
        { headers }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alarms'] });
    },
  });
}; 