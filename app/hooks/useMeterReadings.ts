import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  fetchLatestReading, 
  fetchMeterHistory, 
  fetchMeterLimits,
  updateMeterLimit,
  MeterReading,
  MeterLimit
} from '../api/meterApi';
import { useAuth } from '../context/AuthContext';

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
  const { organizationId, authState } = useAuth();
  const enabled = authState.isAuthenticated && !!authState.user;
  return useQuery({
    queryKey: METER_KEYS.latest,
    queryFn: () => fetchLatestReading(organizationId ?? undefined),
    staleTime: 1000 * 60 * 3, // 3 minutes
    enabled,
  });
};

/**
 * Hook for fetching historical meter readings
 */
export const useMeterHistory = (hours: number = 1, startTime?: string) => {
  const { organizationId, authState } = useAuth();
  const enabled = authState.isAuthenticated && !!authState.user;
  
  console.log('🔍 useMeterHistory hook called:', { hours, startTime, organizationId, enabled });
  
  return useQuery({
    queryKey: METER_KEYS.history(hours, startTime),
    queryFn: () => {
      if (!organizationId) throw new Error('organizationId is required');
      console.log('🔍 useMeterHistory queryFn executing with organizationId:', organizationId);
      return fetchMeterHistory(hours, 1, 20, startTime, organizationId);
    },
    staleTime: 1000 * 60 * 3, // 3 minutes
    enabled,
    retry: 1, // Reduce retries to avoid spam
    retryDelay: 1000, // 1 second delay
  });
};

/**
 * Hook for fetching all meter parameter limits
 */
export const useMeterLimits = () => {
  const { organizationId, authState } = useAuth();
  const enabled = authState.isAuthenticated && !!authState.user;
  return useQuery({
    queryKey: METER_KEYS.limits,
    queryFn: () => fetchMeterLimits(organizationId ?? undefined),
    staleTime: 1000 * 60 * 10, // 10 minutes
    enabled,
  });
};

/**
 * Hook for updating meter parameter limits
 */
export const useUpdateMeterLimit = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useAuth();
  
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: { highLimit?: number; lowLimit?: number } }) => {
      if (!organizationId) throw new Error('organizationId is required');
      return updateMeterLimit(id, values, organizationId);
    },
    onSuccess: (updatedLimit) => {
      // Update both the specific limit and the list of all limits
      queryClient.invalidateQueries({ queryKey: METER_KEYS.limits });
      queryClient.invalidateQueries({ queryKey: METER_KEYS.limit(updatedLimit.id) });
    }
  });
};

// Export types
export type { MeterReading, MeterLimit }; 