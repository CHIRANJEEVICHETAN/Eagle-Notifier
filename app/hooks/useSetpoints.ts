import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { getOrgHeaders } from '../api/auth';
import { apiConfig } from '../api/config';
import { useAuth } from '../context/AuthContext';

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
  const { authState } = useAuth();
  const isAdmin = authState?.user?.role === 'ADMIN';
  
  return useQuery({
    queryKey: SETPOINT_KEYS.all,
    queryFn: async () => {
      // Only make API call if user is admin
      if (!isAdmin) {
        return [];
      }
      
      const organizationId = authState?.user?.organizationId;
      if (!organizationId) {
        throw new Error("Organization ID not found in user context.");
      }
      const headers = await getOrgHeaders(organizationId);
      const { data } = await axios.get<Setpoint[]>(
        `${apiConfig.apiUrl}/api/admin/setpoints`,
        { headers }
      );
      return data;
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    enabled: isAdmin, // Only run the query if the user is an admin
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
  const { authState } = useAuth();
  const isAdmin = authState?.user?.role === 'ADMIN';

  return useMutation({
    mutationFn: async ({ id, lowDeviation, highDeviation }: UpdateSetpointParams) => {
      // Extra safety check
      if (!isAdmin) {
        throw new Error("Unauthorized: Only admins can update setpoints");
      }
      
      const organizationId = authState?.user?.organizationId;
      if (!organizationId) {
        throw new Error("Organization ID not found in user context.");
      }
      const headers = await getOrgHeaders(organizationId);
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