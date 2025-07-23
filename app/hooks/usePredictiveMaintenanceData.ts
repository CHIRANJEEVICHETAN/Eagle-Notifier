import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { apiConfig } from '../api/config';

export interface SystemStats {
  period: {
    hours: number;
    since: string;
  };
  organizations: {
    total: number;
    withPredictions: number;
  };
  predictions: {
    total: number;
    withFeedback: number;
    accurate: number;
    systemAccuracy: number;
  };
  training: {
    completed: number;
    failed: number;
    successRate: number;
  };
  cache: {
    size: number;
    maxSize: number;
    organizations: string[];
  };
  predictionsByOrganization: Array<{
    organizationId: string;
    count: number;
  }>;
}

export interface ModelInfo {
  organization: {
    id: string;
    name: string;
    modelVersion: string;
    modelAccuracy: number;
    predictionEnabled: boolean;
  };
  modelMetrics: {
    accuracy: number;
    precision: number;
    recall: number;
    auc: number;
  };
  cache: {
    isInCache: boolean;
    cacheStats: {
      size: number;
      organizations: string[];
    };
  };
  recentTraining: Array<{
    version: string;
    status: string;
    accuracy: number;
    startedAt: string;
  }>;
  recentAccuracy: {
    accuracy: number;
    sampleSize: number;
    period: string;
  };
}

export interface TrainingConfig {
  organizationId: string;
  schedule: string; // cron pattern
  enabled: boolean;
  hyperparameters: {
    numLeaves: number;
    learningRate: number;
    featureFraction: number;
    baggingFraction: number;
    maxDepth: number;
    numIterations: number;
  };
  dataRange: {
    days: number;
  };
}

export function usePredictiveMaintenanceData() {
  const queryClient = useQueryClient();

  // Fetch system-wide statistics
  const {
    data: systemStats,
    isLoading: isLoadingStats,
    refetch: refetchSystemStats
  } = useQuery<SystemStats>({
    queryKey: ['predictive-maintenance', 'system-stats'],
    queryFn: async () => {
      const { data } = await axios.get<{ success: boolean; data: SystemStats }>(
        `${apiConfig.apiUrl}/api/predictive-alerts/admin/system-stats?hours=24`
      );
      return data.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch model information for a specific organization
  const fetchModelInfo = async (organizationId: string): Promise<ModelInfo> => {
    const { data } = await axios.get<{ success: boolean; data: ModelInfo }>(
      `${apiConfig.apiUrl}/api/predictive-alerts/models/info`,
      {
        headers: {
          'X-Organization-ID': organizationId
        }
      }
    );
    return data.data;
  };

  // Update ML configuration for organization
  const updateMLConfigMutation = useMutation({
    mutationFn: async ({ 
      organizationId, 
      config 
    }: { 
      organizationId: string; 
      config: Partial<{
        predictionEnabled: boolean;
        mlModelConfig: Record<string, any>;
        trainingSchedule: Record<string, any>;
      }>;
    }) => {
      const { data } = await axios.put(
        `${apiConfig.apiUrl}/api/admin/organizations/${organizationId}/ml-config`,
        config
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['predictive-maintenance'] });
    }
  });

  // Trigger training for organization
  const triggerTrainingMutation = useMutation({
    mutationFn: async ({ 
      organizationId, 
      config 
    }: { 
      organizationId: string; 
      config?: Partial<TrainingConfig>;
    }) => {
      const { data } = await axios.post(
        `${apiConfig.apiUrl}/api/predictive-alerts/training/trigger`,
        config,
        {
          headers: {
            'X-Organization-ID': organizationId
          }
        }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predictive-maintenance'] });
    }
  });

  // Test model with sample data
  const testModelMutation = useMutation({
    mutationFn: async ({ 
      organizationId, 
      testData 
    }: { 
      organizationId: string; 
      testData: Record<string, number>;
    }) => {
      const { data } = await axios.post(
        `${apiConfig.apiUrl}/api/predictive-alerts/models/test`,
        { testData, iterations: 5 },
        {
          headers: {
            'X-Organization-ID': organizationId
          }
        }
      );
      return data;
    }
  });

  return {
    systemStats,
    isLoadingStats,
    refetchSystemStats,
    fetchModelInfo,
    updateMLConfig: updateMLConfigMutation.mutateAsync,
    triggerTraining: triggerTrainingMutation.mutateAsync,
    testModel: testModelMutation.mutateAsync,
    isUpdatingConfig: updateMLConfigMutation.isPending,
    isTraining: triggerTrainingMutation.isPending,
    isTesting: testModelMutation.isPending,
  };
}