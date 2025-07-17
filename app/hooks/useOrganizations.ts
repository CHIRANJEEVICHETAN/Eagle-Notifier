import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { apiConfig } from '../api/config';

export interface Organization {
  id: string;
  name: string;
  scadaDbConfig: string;
  schemaConfig: string;
}

interface OrgForm {
  name: string;
  scadaDbConfig: Record<string, any>;
  schemaConfig: Record<string, any>;
}

export function useOrganizations() {
  const queryClient = useQueryClient();

  // Fetch all organizations
  const {
    data: organizations = [],
    isLoading,
    refetch
  } = useQuery<Organization[]>({
    queryKey: ['organizations'],
    queryFn: async () => {
      const { data } = await axios.get<Organization[]>(`${apiConfig.apiUrl}/api/admin/organizations`);
      return data;
    },
  });

  // Create organization
  const createMutation = useMutation({
    mutationFn: async (form: OrgForm) => {
      const { data } = await axios.post<Organization>(`${apiConfig.apiUrl}/api/admin/organizations`, form);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    }
  });

  // Update organization
  const updateMutation = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: OrgForm }) => {
      const { data } = await axios.put<Organization>(`${apiConfig.apiUrl}/api/admin/organizations/${id}`, form);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    }
  });

  // Delete organization
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`${apiConfig.apiUrl}/api/admin/organizations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    }
  });

  return {
    organizations,
    isLoading,
    createOrganization: createMutation.mutateAsync,
    updateOrganization: (id: string, form: OrgForm) => updateMutation.mutateAsync({ id, form }),
    deleteOrganization: deleteMutation.mutateAsync,
    refetchOrganizations: refetch,
  };
} 