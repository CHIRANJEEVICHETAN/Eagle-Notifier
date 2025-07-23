import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useOrganizations, Organization } from '../hooks/useOrganizations';
import { usePredictiveMaintenanceData } from '../hooks/usePredictiveMaintenanceData';
import OrganizationMLConfig from './OrganizationMLConfig';
import ModelPerformanceDashboard from './ModelPerformanceDashboard';
import TrainingScheduleConfig from './TrainingScheduleConfig';
import SystemOverviewDashboard from './SystemOverviewDashboard';

type TabType = 'overview' | 'organizations' | 'performance' | 'training';

const PredictiveMaintenanceManagement: React.FC = () => {
  const { isDarkMode } = useTheme();
  const { organizations, isLoading, refetchOrganizations } = useOrganizations();
  const { systemStats, isLoadingStats, refetchSystemStats } = usePredictiveMaintenanceData();
  
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter organizations with predictive maintenance enabled
  const mlEnabledOrgs = useMemo(() => {
    return organizations.filter(org => org.predictionEnabled);
  }, [organizations]);

  // Filter organizations based on search
  const filteredOrgs = useMemo(() => {
    if (!search) return organizations;
    return organizations.filter(org => 
      org.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [organizations, search]);

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchOrganizations(),
      refetchSystemStats()
    ]);
    setIsRefreshing(false);
  };

  // Tab configuration
  const tabs = [
    { key: 'overview', label: 'System Overview', icon: 'analytics-outline' },
    { key: 'organizations', label: 'Organizations', icon: 'business-outline' },
    { key: 'performance', label: 'Performance', icon: 'trending-up-outline' },
    { key: 'training', label: 'Training', icon: 'school-outline' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <SystemOverviewDashboard 
            systemStats={systemStats}
            isLoading={isLoadingStats}
            organizations={organizations}
            mlEnabledOrgs={mlEnabledOrgs}
          />
        );
      
      case 'organizations':
        return (
          <View style={{ flex: 1 }}>
            {/* Search bar */}
            <View style={{ position: 'relative', marginBottom: 16 }}>
              <Ionicons
                name="search"
                size={20}
                color={isDarkMode ? '#94a3b8' : '#64748b'}
                style={{ position: 'absolute', left: 12, top: '50%', transform: [{ translateY: -10 }], zIndex: 1 }}
              />
              <TextInput
                placeholder="Search organizations..."
                value={search}
                onChangeText={setSearch}
                style={{
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#374155' : '#e5e7eb',
                  borderRadius: 8,
                  padding: 12,
                  paddingLeft: 40,
                  backgroundColor: isDarkMode ? '#334155' : '#f9fafb',
                  color: isDarkMode ? '#fff' : '#111827',
                }}
                placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
              />
            </View>

            {/* Organization List */}
            <ScrollView style={{ flex: 1 }}>
              {isLoading ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={isDarkMode ? '#60A5FA' : '#2563EB'} />
                  <Text style={{ color: isDarkMode ? '#F8FAFC' : '#1E293B', marginTop: 8 }}>
                    Loading organizations...
                  </Text>
                </View>
              ) : filteredOrgs.length === 0 ? (
                <Text style={{ color: isDarkMode ? '#F8FAFC' : '#1E293B', textAlign: 'center', marginTop: 20 }}>
                  No organizations found.
                </Text>
              ) : (
                filteredOrgs.map((org) => (
                  <TouchableOpacity
                    key={org.id}
                    onPress={() => setSelectedOrg(org)}
                    style={{
                      backgroundColor: isDarkMode ? '#1e293b' : '#f3f4f6',
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: 12,
                      borderWidth: 1,
                      borderColor: org.predictionEnabled 
                        ? (isDarkMode ? '#22c55e' : '#16a34a')
                        : (isDarkMode ? '#374155' : '#e5e7eb'),
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ 
                          fontSize: 18, 
                          fontWeight: '600', 
                          color: isDarkMode ? '#F8FAFC' : '#1E293B',
                          marginBottom: 4
                        }}>
                          {org.name}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                          <Ionicons 
                            name={org.predictionEnabled ? 'checkmark-circle' : 'close-circle'} 
                            size={16} 
                            color={org.predictionEnabled ? '#22c55e' : '#ef4444'} 
                          />
                          <Text style={{ 
                            fontSize: 14, 
                            color: isDarkMode ? '#cbd5e1' : '#64748b',
                            marginLeft: 6
                          }}>
                            {org.predictionEnabled ? 'ML Enabled' : 'ML Disabled'}
                          </Text>
                        </View>
                        {org.predictionEnabled && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                            <Text style={{ 
                              fontSize: 13, 
                              color: isDarkMode ? '#94a3b8' : '#6b7280',
                              marginRight: 16
                            }}>
                              Model: {org.modelVersion || 'N/A'}
                            </Text>
                            <Text style={{ 
                              fontSize: 13, 
                              color: isDarkMode ? '#94a3b8' : '#6b7280'
                            }}>
                              Accuracy: {org.modelAccuracy ? `${(org.modelAccuracy * 100).toFixed(1)}%` : 'N/A'}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Ionicons 
                        name="chevron-forward" 
                        size={20} 
                        color={isDarkMode ? '#94a3b8' : '#64748b'} 
                      />
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        );
      
      case 'performance':
        return (
          <ModelPerformanceDashboard 
            organizations={mlEnabledOrgs}
            isLoading={isLoading}
          />
        );
      
      case 'training':
        return (
          <TrainingScheduleConfig 
            organizations={mlEnabledOrgs}
            isLoading={isLoading}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {/* Tab Navigation */}
      <View style={{ 
        flexDirection: 'row', 
        backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
        borderRadius: 12,
        padding: 4,
        marginBottom: 16
      }}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key as TabType)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 12,
              paddingHorizontal: 8,
              borderRadius: 8,
              backgroundColor: activeTab === tab.key 
                ? (isDarkMode ? '#2563eb' : '#3b82f6')
                : 'transparent',
            }}
          >
            <Ionicons 
              name={tab.icon as any} 
              size={18} 
              color={activeTab === tab.key 
                ? '#ffffff'
                : (isDarkMode ? '#94a3b8' : '#64748b')
              }
            />
            <Text style={{
              fontSize: 12,
              fontWeight: activeTab === tab.key ? '600' : '500',
              color: activeTab === tab.key 
                ? '#ffffff'
                : (isDarkMode ? '#94a3b8' : '#64748b'),
              marginLeft: 6,
            }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <ScrollView 
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[isDarkMode ? '#22d3ee' : '#2563eb']}
            tintColor={isDarkMode ? '#22d3ee' : '#2563eb'}
            progressBackgroundColor={isDarkMode ? '#1e293b' : '#f3f4f6'}
          />
        }
      >
        {renderTabContent()}
      </ScrollView>

      {/* Organization ML Configuration Modal */}
      <Modal visible={!!selectedOrg} animationType="slide" transparent>
        <View style={{ 
          flex: 1, 
          backgroundColor: 'rgba(0,0,0,0.5)', 
          justifyContent: 'center', 
          alignItems: 'center' 
        }}>
          <View style={{ 
            backgroundColor: isDarkMode ? '#1e293b' : '#fff', 
            borderRadius: 16, 
            padding: 20, 
            width: '95%', 
            maxHeight: '90%' 
          }}>
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: 16
            }}>
              <Text style={{ 
                fontSize: 20, 
                fontWeight: 'bold', 
                color: isDarkMode ? '#F8FAFC' : '#1E293B' 
              }}>
                ML Configuration
              </Text>
              <TouchableOpacity onPress={() => setSelectedOrg(null)}>
                <Ionicons 
                  name="close" 
                  size={24} 
                  color={isDarkMode ? '#94a3b8' : '#64748b'} 
                />
              </TouchableOpacity>
            </View>
            
            {selectedOrg && (
              <OrganizationMLConfig 
                organization={selectedOrg}
                onClose={() => setSelectedOrg(null)}
                onUpdate={refetchOrganizations}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default PredictiveMaintenanceManagement;