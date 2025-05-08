import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alarmService } from '../api/alarmService';
import { Alarm, AlarmStatus } from '../types/alarm';
import { useAlarmStore } from '../store/useAlarmStore';

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

// Hook for updating alarm status
export const useUpdateAlarmStatus = () => {
  const queryClient = useQueryClient();
  const { updateAlarmStatus: updateStore } = useAlarmStore();
  
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AlarmStatus }) => 
      alarmService.updateAlarmStatus(id, status),
    onSuccess: (updatedAlarm) => {
      // Update store
      updateStore(updatedAlarm.id, updatedAlarm.status);
      
      // Update queries
      queryClient.invalidateQueries({ queryKey: ALARM_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ALARM_KEYS.active() });
      queryClient.invalidateQueries({ queryKey: ALARM_KEYS.detail(updatedAlarm.id) });
    },
  });
}; 