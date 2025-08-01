import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { Alarm, AlarmStatus } from '../types/alarm';
import { useAlarmStore } from '../store/useAlarmStore';
import axios from 'axios';
import { getOrgHeaders } from '../api/auth';
import { apiConfig, SCADA_INTERVAL } from '../api/config';
import { useAuth } from '../context/AuthContext';

// Query keys
export const ALARM_KEYS = {
  all: ['alarms'] as const,
  active: () => [...ALARM_KEYS.all, 'active'] as const,
  history: (params: Record<string, any>) => [...ALARM_KEYS.all, 'history', params] as const,
  detail: (id: string) => [...ALARM_KEYS.all, 'detail', id] as const,
  scada: (forceRefresh?: boolean) => ['scada-alarms', forceRefresh] as const,
  analytics: (timeFilter: string) => ['scada-analytics', timeFilter] as const,
  alarmHistory: (params: { alarmId: string; status?: string; hours?: number; search?: string; startTime?: string; endTime?: string; timeFilter?: string }) =>
    [...ALARM_KEYS.all, 'alarm-history', params.alarmId, params] as const,
};

export interface ScadaAlarmResponse {
  analogAlarms: Alarm[];
  binaryAlarms: Alarm[];
  maintenanceMode?: boolean;
  timestamp?: string;
  lastUpdate?: string;
  fromCache?: boolean;
}

// Hook for fetching active SCADA alarms
export const useActiveAlarms = (initialForceRefresh = false) => {
  const { setAlarms, setLoading, setError } = useAlarmStore();
  const { organizationId, authState } = useAuth();

  // Get interval from environment variable or use default value (120000 ms = 2 minutes)
  const scadaInterval = SCADA_INTERVAL
    ? parseInt(SCADA_INTERVAL, 10)
    : 30000;

  console.log('scadaInterval', scadaInterval);

  // Calculate staleTime based on interval (if interval ≥ 60000ms, it's in minutes, else in seconds)
  const staleTime = scadaInterval >= 60000
    ? scadaInterval - 10000  // For minutes, subtract 10000ms (0.2 minutes)
    : scadaInterval - 5000;  // For seconds, subtract 5000ms (5 seconds)

  console.log('staleTime', staleTime);

  return useQuery<ScadaAlarmResponse, Error>({
    queryKey: ALARM_KEYS.scada(initialForceRefresh),
    queryFn: async ({ queryKey }) => {
      setLoading(true);
      try {
        const forceRefresh = queryKey[1] as boolean;
        // ✅ Prevent queryFn execution if unauthorized — fallback safeguard
        if (!authState.isAuthenticated || !organizationId) {
          throw new Error('Unauthorized: Missing organization or authentication');
        }

        const headers = await getOrgHeaders(organizationId ?? undefined);
        const { data } = await axios.get<ScadaAlarmResponse>(
          `${apiConfig.apiUrl}/api/scada/alarms${forceRefresh ? '?force=true' : ''}`,
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
          binaryAlarms: markedBinaryAlarms,
          maintenanceMode: data.maintenanceMode,
          timestamp: data.timestamp,
          lastUpdate: data.lastUpdate,
          fromCache: data.fromCache
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch alarms';
        setError(errorMessage);
        setLoading(false);
        throw error;
      }
    },
    enabled: authState.isAuthenticated && !!authState.user?.organizationId,
    refetchInterval: 30000,
    staleTime: 25000, // Ensure staleTime doesn't go negative
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
  const { organizationId } = useAuth();

  return useMutation({
    mutationFn: async ({ id, status, resolutionMessage }: UpdateAlarmStatusParams) => {
      const headers = await getOrgHeaders(organizationId ?? undefined);
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
  endTime?: string;
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
  const { organizationId } = useAuth();

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

        const headers = await getOrgHeaders(organizationId ?? undefined);
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

// Hook for fetching history of a specific alarm with proper pagination
export function useSpecificAlarmHistory(alarmId: string, params: Partial<AlarmHistoryParams> = {}) {
  const { limit = 50, status, hours, startTime, endTime, timeFilter } = params;
  const { organizationId } = useAuth();

  return useInfiniteQuery({
    queryKey: ALARM_KEYS.alarmHistory({ alarmId, status, hours, startTime, endTime, timeFilter }),
    queryFn: async ({ pageParam = 1 }) => {
      if (!alarmId) return null;

      try {
        const urlParams = new URLSearchParams();
        urlParams.append('page', pageParam.toString());
        urlParams.append('limit', limit.toString());
        urlParams.append('alarmId', alarmId);
        urlParams.append('sortBy', 'timestamp');
        urlParams.append('sortOrder', 'desc');

        // Add filter parameters if provided
        if (status && status !== 'all') urlParams.append('status', status);
        if (hours) urlParams.append('hours', hours.toString());
        if (startTime) urlParams.append('startTime', startTime);
        if (endTime) urlParams.append('endTime', endTime);
        if (timeFilter) urlParams.append('timeFilter', timeFilter);

        const headers = await getOrgHeaders(organizationId ?? undefined);
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
    getNextPageParam: (lastPage) => {
      if (!lastPage?.pagination) return undefined;
      const { page, pages } = lastPage.pagination;
      return page < pages ? page + 1 : undefined;
    },
    enabled: !!alarmId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    initialPageParam: 1,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
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

// Hook for fetching SCADA analytics data
export const useAnalyticsData = (timeFilter: string) => {
  const { organizationId } = useAuth();
  return useQuery({
    queryKey: ALARM_KEYS.analytics(timeFilter),
    queryFn: async () => {
      try {
        const headers = await getOrgHeaders(organizationId ?? undefined);
        const { data } = await axios.get(
          `${apiConfig.apiUrl}/api/scada/analytics?timeFilter=${timeFilter}`,
          { headers }
        );

        return data;
      } catch (error) {
        console.error('Error fetching analytics data:', error);
        throw error;
      }
    },
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
    staleTime: 500, // Reduced from 3000 to 500ms for faster filter switching
    gcTime: 30000, // Keep cached data for 30 seconds (renamed from cacheTime)
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    enabled: !!timeFilter, // Only fetch if timeFilter is provided
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch on window focus to avoid unnecessary calls
  });
};

// Hook to fetch dynamic alarm configurations
export const useAlarmConfigurations = () => {
  const { organizationId } = useAuth();
  
  return useQuery({
    queryKey: ['scada', 'config', organizationId],
    queryFn: async () => {
      try {
        const headers = await getOrgHeaders(organizationId ?? undefined);
        const { data } = await axios.get(
          `${apiConfig.apiUrl}/api/scada/config`,
          { headers }
        );
        return data;
      } catch (error) {
        console.error('Error fetching alarm configurations:', error);
        throw error;
      }
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}; 