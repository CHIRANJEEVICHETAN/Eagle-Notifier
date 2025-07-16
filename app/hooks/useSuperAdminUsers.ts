import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { apiConfig } from '../api/config';

export interface SuperAdminUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'OPERATOR';
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserForm {
  name: string;
  email: string;
  password?: string;
  role: 'ADMIN' | 'OPERATOR';
  organizationId: string;
}

export function useSuperAdminUsers(organizationId?: string) {
  const queryClient = useQueryClient();

  // Fetch all users (optionally filtered by org)
  const {
    data: users = [],
    isLoading,
    refetch
  } = useQuery<SuperAdminUser[]>({
    queryKey: ['superAdminUsers', organizationId],
    queryFn: async () => {
      const params = organizationId ? { organizationId } : {};
      const { data } = await axios.get<SuperAdminUser[]>(`${apiConfig.apiUrl}/api/admin/users`, { params });
      return data;
    },
  });

  // Create user
  const createMutation = useMutation({
    mutationFn: async (form: UserForm) => {
      const { data } = await axios.post<SuperAdminUser>(`${apiConfig.apiUrl}/api/admin/users`, form);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminUsers'] });
    }
  });

  // Update user
  const updateMutation = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: Partial<UserForm> }) => {
      const { data } = await axios.put<SuperAdminUser>(`${apiConfig.apiUrl}/api/admin/users/${id}`, form);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminUsers'] });
    }
  });

  // Delete user
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`${apiConfig.apiUrl}/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminUsers'] });
    }
  });

  return {
    users,
    isLoading,
    createUser: createMutation.mutateAsync,
    updateUser: (id: string, form: Partial<UserForm>) => updateMutation.mutateAsync({ id, form }),
    deleteUser: deleteMutation.mutateAsync,
    refetchUsers: refetch,
  };
} 