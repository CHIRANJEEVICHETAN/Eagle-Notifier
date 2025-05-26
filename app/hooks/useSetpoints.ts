import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { getAuthHeader } from '../api/auth';
import { apiConfig } from '../api/config';

export interface Setpoint {
  id: string;
  name: string;
  type: string;
  zone?: string | null;
  scadaField: string;
  lowDeviation: number;
  highDeviation: number;
  createdAt: Date;
  updatedAt: Date;
}

// Query keys
export const SETPOINT_KEYS = {
  all: ['setpoints'] as const,
  detail: (id: string) => [...SETPOINT_KEYS.all, 'detail', id] as const,
};

// Hook for fetching all setpoints
export const useSetpoints = () => {
  return useQuery({
    queryKey: SETPOINT_KEYS.all,
    queryFn: async () => {
      const headers = await getAuthHeader();
      const { data } = await axios.get<Setpoint[]>(
        `${apiConfig.apiUrl}/api/admin/setpoints`,
        { headers }
      );
      return data;
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
  });
};

interface UpdateSetpointParams {
  id: string;
  lowDeviation: number;
  highDeviation: number;
}

// Hook for updating setpoint deviations
export const useUpdateSetpoint = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, lowDeviation, highDeviation }: UpdateSetpointParams) => {
      const headers = await getAuthHeader();
      const { data } = await axios.put(
        `${apiConfig.apiUrl}/api/admin/setpoints/${id}`,
        { lowDeviation, highDeviation },
        { headers }
      );
      return data;
    },
    onSuccess: () => {
      // Invalidate and refetch setpoints
      queryClient.invalidateQueries({ queryKey: SETPOINT_KEYS.all });
    },
  });
}; 