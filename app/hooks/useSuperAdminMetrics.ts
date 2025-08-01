import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { apiConfig } from '../api/config';

export interface SuperAdminMetrics {
  totalOrganizations: number;
  totalUsers: number;
  activeOrganizations: number;
  newOrganizationsThisWeek: number;
  newUsersThisWeek: number;
  disabledOrganizations: number;
}

export function useSuperAdminMetrics() {
  const {
    data: metrics,
    isLoading,
    error,
    refetch
  } = useQuery<SuperAdminMetrics>({
    queryKey: ['superAdminMetrics'],
    queryFn: async () => {
      const { data } = await axios.get<SuperAdminMetrics>(`${apiConfig.apiUrl}/api/admin/metrics`);
      return data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 60000, // Consider data stale after 1 minute
  });

  return {
    metrics,
    isLoading,
    error,
    refetchMetrics: refetch,
  };
} 