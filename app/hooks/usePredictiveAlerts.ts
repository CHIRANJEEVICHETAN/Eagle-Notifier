import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alarm } from '../types/alarm';
import axios from 'axios';
import { getOrgHeaders } from '../api/auth';
import { apiConfig } from '../api/config';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Query keys for predictive alerts
export const PREDICTIVE_ALERT_KEYS = {
  all: ['predictive-alerts'] as const,
  active: () => [...PREDICTIVE_ALERT_KEYS.all, 'active'] as const,
  history: (params: Record<string, any>) => [...PREDICTIVE_ALERT_KEYS.all, 'history', params] as const,
  cached: () => [...PREDICTIVE_ALERT_KEYS.all, 'cached'] as const,
};

export interface PredictiveAlertResponse {
  predictiveAlerts: Alarm[];
  timestamp?: string;
  lastUpdate?: string;
  fromCache?: boolean;
}

// Storage key for offline caching
const PREDICTIVE_ALERTS_CACHE_KEY = 'predictive_alerts_cache';

// Hook for fetching active predictive alerts
export const usePredictiveAlerts = () => {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();

  return useQuery<PredictiveAlertResponse, Error>({
    queryKey: PREDICTIVE_ALERT_KEYS.active(),
    queryFn: async () => {
      try {
        const headers = await getOrgHeaders(organizationId ?? undefined);
        const { data } = await axios.get<PredictiveAlertResponse>(
          `${apiConfig.apiUrl}/api/predictive-alerts/active`,
          { headers }
        );
        
        // Ensure predictiveAlerts is an array
        const predictiveAlerts = Array.isArray(data.predictiveAlerts) ? data.predictiveAlerts : [];
        
        // Mark alerts as predictive type
        const markedPredictiveAlerts = predictiveAlerts.map(alert => ({
          ...alert,
          alarmType: 'predictive' as const,
          type: 'predictive'
        }));

        const response = {
          predictiveAlerts: markedPredictiveAlerts,
          timestamp: data.timestamp,
          lastUpdate: data.lastUpdate,
          fromCache: data.fromCache
        };

        // Cache the data for offline use with timestamp
        try {
          const cacheData = {
            ...response,
            cachedAt: new Date().toISOString(),
          };
          await AsyncStorage.setItem(
            `${PREDICTIVE_ALERTS_CACHE_KEY}_${organizationId}`,
            JSON.stringify(cacheData)
          );
        } catch (cacheError) {
          console.warn('Failed to cache predictive alerts:', cacheError);
        }

        return response;
      } catch (error) {
        console.error('Failed to fetch predictive alerts, trying cache:', error);
        
        // Try to load from cache if network request fails
        try {
          const cachedData = await AsyncStorage.getItem(
            `${PREDICTIVE_ALERTS_CACHE_KEY}_${organizationId}`
          );
          if (cachedData) {
            const parsed = JSON.parse(cachedData);
            // Check if cache is not too old (max 5 minutes)
            const cacheAge = Date.now() - new Date(parsed.cachedAt || 0).getTime();
            const maxCacheAge = 5 * 60 * 1000; // 5 minutes
            
            if (cacheAge < maxCacheAge) {
              console.log('Using cached predictive alerts data');
              return {
                ...parsed,
                fromCache: true,
                cacheAge: Math.round(cacheAge / 1000) // in seconds
              };
            } else {
              console.log('Cached predictive alerts data is too old, removing');
              await AsyncStorage.removeItem(`${PREDICTIVE_ALERTS_CACHE_KEY}_${organizationId}`);
            }
          }
        } catch (cacheError) {
          console.error('Failed to load cached predictive alerts:', cacheError);
        }
        
        throw error;
      }
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 25000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

// Hook for submitting feedback on predictive alerts
export const usePredictiveAlertFeedback = () => {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ alertId, isAccurate }: { alertId: string; isAccurate: boolean }) => {
      const headers = await getOrgHeaders(organizationId ?? undefined);
      const { data } = await axios.post(
        `${apiConfig.apiUrl}/api/predictive-alerts/${alertId}/feedback`,
        { isAccurate },
        { headers }
      );
      return data;
    },
    onSuccess: () => {
      // Invalidate and refetch predictive alerts
      queryClient.invalidateQueries({ queryKey: PREDICTIVE_ALERT_KEYS.active() });
    },
    onError: (error) => {
      console.error('Failed to submit predictive alert feedback:', error);
    },
  });
};

// Hook for getting cached predictive alerts (for offline mode)
export const useCachedPredictiveAlerts = () => {
  const { organizationId } = useAuth();

  return useQuery<PredictiveAlertResponse | null>({
    queryKey: PREDICTIVE_ALERT_KEYS.cached(),
    queryFn: async () => {
      try {
        const cachedData = await AsyncStorage.getItem(
          `${PREDICTIVE_ALERTS_CACHE_KEY}_${organizationId}`
        );
        if (cachedData) {
          return JSON.parse(cachedData);
        }
        return null;
      } catch (error) {
        console.error('Failed to load cached predictive alerts:', error);
        return null;
      }
    },
    enabled: false, // Only fetch when explicitly called
  });
};

// Hook for predictive alert history with filtering and sorting
export interface PredictiveAlertHistoryParams {
  page?: number;
  limit?: number;
  status?: string;
  hours?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  confidence?: number;
  component?: string;
  startTime?: string;
  endTime?: string;
}

export const usePredictiveAlertHistory = (params: PredictiveAlertHistoryParams = {}) => {
  const { organizationId } = useAuth();
  const {
    page = 1,
    limit = 20,
    status = 'all',
    hours,
    search,
    sortBy = 'timestamp',
    sortOrder = 'desc',
    confidence,
    component,
    startTime,
    endTime
  } = params;

  return useQuery({
    queryKey: PREDICTIVE_ALERT_KEYS.history(params),
    queryFn: async () => {
      try {
        const urlParams = new URLSearchParams();
        urlParams.append('page', page.toString());
        urlParams.append('limit', limit.toString());
        urlParams.append('status', status);
        if (hours) urlParams.append('hours', hours.toString());
        if (search) urlParams.append('search', search);
        urlParams.append('sortBy', sortBy);
        urlParams.append('sortOrder', sortOrder);
        if (confidence) urlParams.append('confidence', confidence.toString());
        if (component) urlParams.append('component', component);
        if (startTime) urlParams.append('startTime', startTime);
        if (endTime) urlParams.append('endTime', endTime);

        const headers = await getOrgHeaders(organizationId ?? undefined);
        const response = await axios.get(
          `${apiConfig.apiUrl}/api/predictive-alerts/history?${urlParams.toString()}`,
          { headers }
        );

        if (response.status !== 200) {
          throw new Error(`Error fetching predictive alert history: ${response.status}`);
        }

        return response.data;
      } catch (error) {
        console.error('Failed to fetch predictive alert history:', error);
        throw error;
      }
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: (previousData) => previousData,
  });
};

// Hook for updating predictive alert status
export const useUpdatePredictiveAlertStatus = () => {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      resolutionMessage 
    }: { 
      id: string; 
      status: 'acknowledged' | 'resolved'; 
      resolutionMessage?: string;
    }) => {
      const headers = await getOrgHeaders(organizationId ?? undefined);
      const { data } = await axios.put(
        `${apiConfig.apiUrl}/api/predictive-alerts/${id}/status`,
        { status, resolutionMessage },
        { headers }
      );
      return data;
    },
    onSuccess: () => {
      // Invalidate and refetch predictive alerts
      queryClient.invalidateQueries({ queryKey: PREDICTIVE_ALERT_KEYS.active() });
    },
    onError: (error) => {
      console.error('Failed to update predictive alert status:', error);
    },
  });
};

// Utility function to clear cached predictive alerts
export const clearPredictiveAlertsCache = async (organizationId?: string) => {
  try {
    if (organizationId) {
      await AsyncStorage.removeItem(`${PREDICTIVE_ALERTS_CACHE_KEY}_${organizationId}`);
    } else {
      // Clear all cached predictive alerts
      const keys = await AsyncStorage.getAllKeys();
      const predictiveAlertKeys = keys.filter(key => key.startsWith(PREDICTIVE_ALERTS_CACHE_KEY));
      await AsyncStorage.multiRemove(predictiveAlertKeys);
    }
  } catch (error) {
    console.error('Failed to clear predictive alerts cache:', error);
  }
};