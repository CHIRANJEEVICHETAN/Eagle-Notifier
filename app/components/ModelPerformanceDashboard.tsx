import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Organization } from '../hooks/useOrganizations';
import { usePredictiveMaintenanceData, ModelInfo } from '../hooks/usePredictiveMaintenanceData';

interface ModelPerformanceDashboardProps {
  organizations: Organization[];
  isLoading: boolean;
}

const ModelPerformanceDashboard: React.FC<ModelPerformanceDashboardProps> = ({
  organizations,
  isLoading
}) => {
  const { isDarkMode } = useTheme();
  const { fetchModelInfo } = usePredictiveMaintenanceData();
  
  const [modelInfos, setModelInfos] = useState<Record<string, ModelInfo>>({});
  const [loadingModels, setLoadingModels] = useState<Set<string>>(new Set());
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);

  // Load model info for all organizations
  useEffect(() => {
    loadAllModelInfos();
  }, [organizations]);

  const loadAllModelInfos = async () => {
    const loadingSet = new Set(organizations.map(org => org.id));
    setLoadingModels(loadingSet);
    
    const infos: Record<string, ModelInfo> = {};
    
    for (const org of organizations) {
      try {
        const info = await fetchModelInfo(org.id);
        infos[org.id] = info;
      } catch (error) {
        console.error(`Failed to load model info for ${org.name}:`, error);
      } finally {
        loadingSet.delete(org.id);
        setLoadingModels(new Set(loadingSet));
      }
    }
    
    setModelInfos(infos);
  };

  const refreshModelInfo = async (orgId: string) => {
    setLoadingModels(prev => new Set(prev).add(orgId));
    try {
      const info = await fetchModelInfo(orgId);
      setModelInfos(prev => ({ ...prev, [orgId]: info }));
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh model information');
    } finally {
      setLoadingModels(prev => {
        const newSet = new Set(prev);
        newSet.delete(orgId);
        return newSet;
      });
    }
  };

  const getPerformanceColor = (value: number) => {
    if (value >= 0.9) return '#22c55e'; // Green
    if (value >= 0.8) return '#f59e0b'; // Yellow
    if (value >= 0.7) return '#f97316'; // Orange
    return '#ef4444'; // Red
  };

  const PerformanceCard = ({ 
    organization, 
    modelInfo, 
    isLoading: isLoadingModel 
  }: {
    organization: Organization;
    modelInfo?: ModelInfo;
    isLoading: boolean;
  }) => (
    <TouchableOpacity
      onPress={() => setSelectedOrg(selectedOrg === organization.id ? null : organization.id)}
      style={{
        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: selectedOrg === organization.id 
          ? (isDarkMode ? '#3b82f6' : '#2563eb')
          : (isDarkMode ? '#374155' : '#e5e7eb'),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 18,
            fontWeight: '600',
            color: isDarkMode ? '#F8FAFC' : '#1E293B',
            marginBottom: 4
          }}>
            {organization.name}
          </Text>
          <Text style={{
            fontSize: 14,
            color: isDarkMode ? '#94a3b8' : '#64748b'
          }}>
            Model: {organization.modelVersion || 'N/A'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              refreshModelInfo(organization.id);
            }}
            disabled={isLoadingModel}
            style={{ marginRight: 12 }}
          >
            {isLoadingModel ? (
              <ActivityIndicator size="small" color={isDarkMode ? '#60A5FA' : '#2563EB'} />
            ) : (
              <Ionicons name="refresh" size={20} color={isDarkMode ? '#60A5FA' : '#2563EB'} />
            )}
          </TouchableOpacity>
          <Ionicons 
            name={selectedOrg === organization.id ? 'chevron-up' : 'chevron-down'} 
            size={20} 
            color={isDarkMode ? '#94a3b8' : '#64748b'} 
          />
        </View>
      </View>

      {/* Performance Metrics */}
      {modelInfo && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: getPerformanceColor(modelInfo.modelMetrics.accuracy)
            }}>
              {(modelInfo.modelMetrics.accuracy * 100).toFixed(1)}%
            </Text>
            <Text style={{
              fontSize: 12,
              color: isDarkMode ? '#94a3b8' : '#64748b'
            }}>
              Accuracy
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: getPerformanceColor(modelInfo.modelMetrics.precision)
            }}>
              {(modelInfo.modelMetrics.precision * 100).toFixed(1)}%
            </Text>
            <Text style={{
              fontSize: 12,
              color: isDarkMode ? '#94a3b8' : '#64748b'
            }}>
              Precision
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: getPerformanceColor(modelInfo.modelMetrics.recall)
            }}>
              {(modelInfo.modelMetrics.recall * 100).toFixed(1)}%
            </Text>
            <Text style={{
              fontSize: 12,
              color: isDarkMode ? '#94a3b8' : '#64748b'
            }}>
              Recall
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: getPerformanceColor(modelInfo.modelMetrics.auc)
            }}>
              {(modelInfo.modelMetrics.auc * 100).toFixed(1)}%
            </Text>
            <Text style={{
              fontSize: 12,
              color: isDarkMode ? '#94a3b8' : '#64748b'
            }}>
              AUC
            </Text>
          </View>
        </View>
      )}

      {/* Expanded Details */}
      {selectedOrg === organization.id && modelInfo && (
        <View style={{
          borderTopWidth: 1,
          borderTopColor: isDarkMode ? '#374155' : '#e5e7eb',
          paddingTop: 12,
          marginTop: 12
        }}>
          {/* Cache Status */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>Cache Status:</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons 
                name={modelInfo.cache.isInCache ? 'checkmark-circle' : 'close-circle'} 
                size={16} 
                color={modelInfo.cache.isInCache ? '#22c55e' : '#ef4444'} 
              />
              <Text style={{ 
                color: isDarkMode ? '#F8FAFC' : '#1E293B', 
                marginLeft: 4,
                fontWeight: '600'
              }}>
                {modelInfo.cache.isInCache ? 'Cached' : 'Not Cached'}
              </Text>
            </View>
          </View>

          {/* Recent Training */}
          {modelInfo.recentTraining.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ 
                color: isDarkMode ? '#94a3b8' : '#64748b',
                marginBottom: 4
              }}>
                Recent Training:
              </Text>
              {modelInfo.recentTraining.slice(0, 3).map((training, index) => (
                <View key={index} style={{ 
                  flexDirection: 'row', 
                  justifyContent: 'space-between',
                  marginBottom: 4
                }}>
                  <Text style={{ 
                    color: isDarkMode ? '#F8FAFC' : '#1E293B',
                    fontSize: 13
                  }}>
                    {training.version}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons 
                      name={training.status === 'COMPLETED' ? 'checkmark-circle' : 'close-circle'} 
                      size={14} 
                      color={training.status === 'COMPLETED' ? '#22c55e' : '#ef4444'} 
                    />
                    <Text style={{ 
                      color: isDarkMode ? '#94a3b8' : '#64748b',
                      fontSize: 13,
                      marginLeft: 4
                    }}>
                      {(training.accuracy * 100).toFixed(1)}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Recent Accuracy */}
          {modelInfo.recentAccuracy && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                Recent Accuracy ({modelInfo.recentAccuracy.period}):
              </Text>
              <Text style={{ 
                color: isDarkMode ? '#F8FAFC' : '#1E293B',
                fontWeight: '600'
              }}>
                {modelInfo.recentAccuracy.accuracy.toFixed(1)}% ({modelInfo.recentAccuracy.sampleSize} samples)
              </Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <ActivityIndicator size="large" color={isDarkMode ? '#60A5FA' : '#2563EB'} />
        <Text style={{ 
          color: isDarkMode ? '#F8FAFC' : '#1E293B', 
          marginTop: 16,
          fontSize: 16
        }}>
          Loading model performance data...
        </Text>
      </View>
    );
  }

  if (organizations.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <Ionicons name="analytics-outline" size={64} color={isDarkMode ? '#94a3b8' : '#64748b'} />
        <Text style={{ 
          color: isDarkMode ? '#F8FAFC' : '#1E293B', 
          fontSize: 18,
          fontWeight: '600',
          marginTop: 16,
          textAlign: 'center'
        }}>
          No ML-Enabled Organizations
        </Text>
        <Text style={{ 
          color: isDarkMode ? '#94a3b8' : '#64748b', 
          fontSize: 14,
          marginTop: 8,
          textAlign: 'center'
        }}>
          Enable predictive maintenance for organizations to view performance metrics.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          fontSize: 24,
          fontWeight: 'bold',
          color: isDarkMode ? '#F8FAFC' : '#1E293B',
          marginBottom: 8
        }}>
          Model Performance
        </Text>
        <Text style={{
          fontSize: 14,
          color: isDarkMode ? '#94a3b8' : '#64748b'
        }}>
          Performance metrics for all ML-enabled organizations
        </Text>
      </View>

      {/* Performance Summary */}
      <View style={{
        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: isDarkMode ? '#374155' : '#e5e7eb',
      }}>
        <Text style={{
          fontSize: 18,
          fontWeight: '600',
          color: isDarkMode ? '#F8FAFC' : '#1E293B',
          marginBottom: 12
        }}>
          Performance Summary
        </Text>
        
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: '#3b82f6'
            }}>
              {organizations.length}
            </Text>
            <Text style={{
              fontSize: 12,
              color: isDarkMode ? '#94a3b8' : '#64748b'
            }}>
              Active Models
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: '#22c55e'
            }}>
              {Object.values(modelInfos).filter(info => info.modelMetrics.accuracy > 0.8).length}
            </Text>
            <Text style={{
              fontSize: 12,
              color: isDarkMode ? '#94a3b8' : '#64748b'
            }}>
              High Accuracy
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: '#8b5cf6'
            }}>
              {Object.values(modelInfos).filter(info => info.cache.isInCache).length}
            </Text>
            <Text style={{
              fontSize: 12,
              color: isDarkMode ? '#94a3b8' : '#64748b'
            }}>
              Cached
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: '#f59e0b'
            }}>
              {Object.values(modelInfos).reduce((avg, info) => avg + info.modelMetrics.accuracy, 0) / Math.max(Object.values(modelInfos).length, 1) * 100 || 0}%
            </Text>
            <Text style={{
              fontSize: 12,
              color: isDarkMode ? '#94a3b8' : '#64748b'
            }}>
              Avg Accuracy
            </Text>
          </View>
        </View>
      </View>

      {/* Organization Performance Cards */}
      <ScrollView style={{ flex: 1 }}>
        {organizations.map((org) => (
          <PerformanceCard
            key={org.id}
            organization={org}
            modelInfo={modelInfos[org.id]}
            isLoading={loadingModels.has(org.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
};

export default ModelPerformanceDashboard;