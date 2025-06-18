import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  fetchLatestReading, 
  fetchMeterHistory, 
  fetchMeterLimits,
  updateMeterLimit,
  MeterReading,
  MeterLimit
} from '../api/meterApi';

// Query keys
export const METER_KEYS = {
  latest: ['meter', 'latest'],
  history: (hours: number, startTime?: string) => ['meter', 'history', hours, startTime],
  limits: ['meter', 'limits'],
  limit: (id: string) => ['meter', 'limit', id],
};

/**
 * Hook for fetching the latest meter reading
 */
export const useLatestMeterReading = () => {
  return useQuery({
    queryKey: METER_KEYS.latest,
    queryFn: fetchLatestReading,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
};

/**
 * Hook for fetching historical meter readings
 */
export const useMeterHistory = (hours: number = 1, startTime?: string) => {
  return useQuery({
    queryKey: METER_KEYS.history(hours, startTime),
    queryFn: () => fetchMeterHistory(hours, 1, 20, startTime),
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
};

/**
 * Hook for fetching all meter parameter limits
 */
export const useMeterLimits = () => {
  return useQuery({
    queryKey: METER_KEYS.limits,
    queryFn: fetchMeterLimits,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

/**
 * Hook for updating meter parameter limits
 */
export const useUpdateMeterLimit = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: { highLimit?: number; lowLimit?: number } }) => 
      updateMeterLimit(id, values),
    onSuccess: (updatedLimit) => {
      // Update both the specific limit and the list of all limits
      queryClient.invalidateQueries({ queryKey: METER_KEYS.limits });
      queryClient.invalidateQueries({ queryKey: METER_KEYS.limit(updatedLimit.id) });
    }
  });
};

// Export types
export type { MeterReading, MeterLimit }; 