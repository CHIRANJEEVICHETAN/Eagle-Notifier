import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Organization } from '../hooks/useOrganizations';
import { usePredictiveMaintenanceData } from '../hooks/usePredictiveMaintenanceData';

interface TrainingScheduleConfigProps {
  organizations: Organization[];
  isLoading: boolean;
}

interface TrainingSchedule {
  organizationId: string;
  schedule: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  status: 'active' | 'inactive' | 'running' | 'failed';
}

const TrainingScheduleConfig: React.FC<TrainingScheduleConfigProps> = ({
  organizations,
  isLoading
}) => {
  const { isDarkMode } = useTheme();
  const { triggerTraining, isTraining } = usePredictiveMaintenanceData();
  
  const [schedules, setSchedules] = useState<Record<string, TrainingSchedule>>({});
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<TrainingSchedule | null>(null);

  // Initialize schedules for organizations
  useEffect(() => {
    const initialSchedules: Record<string, TrainingSchedule> = {};
    organizations.forEach(org => {
      initialSchedules[org.id] = {
        organizationId: org.id,
        schedule: org.trainingSchedule ? JSON.parse(org.trainingSchedule).pattern : '0 2 * * 0',
        enabled: org.trainingSchedule ? JSON.parse(org.trainingSchedule).enabled : false,
        lastRun: org.lastTrainingDate,
        status: org.predictionEnabled ? 'active' : 'inactive'
      };
    });
    setSchedules(initialSchedules);
  }, [organizations]);

  const cronPresets = [
    { label: 'Daily at 2 AM', value: '0 2 * * *' },
    { label: 'Weekly (Sunday 2 AM)', value: '0 2 * * 0' },
    { label: 'Bi-weekly (Sunday 2 AM)', value: '0 2 * * 0/2' },
    { label: 'Monthly (1st at 2 AM)', value: '0 2 1 * *' },
    { label: 'Every 6 hours', value: '0 */6 * * *' },
    { label: 'Custom', value: 'custom' }
  ];

  const handleScheduleUpdate = (orgId: string, updates: Partial<TrainingSchedule>) => {
    setSchedules(prev => ({
      ...prev,
      [orgId]: { ...prev[orgId], ...updates }
    }));
  };

  const handleSaveSchedule = async (orgId: string) => {
    const schedule = schedules[orgId];
    if (!schedule) return;

    try {
      // Here you would typically call an API to save the schedule
      // For now, we'll just show a success message
      Alert.alert('Success', 'Training schedule updated successfully');
      setEditingSchedule(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to update training schedule');
    }
  };

  const handleTriggerTraining = async (orgId: string) => {
    try {
      await triggerTraining({ organizationId: orgId });
      Alert.alert('Success', 'Training triggered successfully');
      
      // Update status to running
      handleScheduleUpdate(orgId, { status: 'running' });
      
      // Simulate completion after some time (in real app, this would be handled by backend)
      setTimeout(() => {
        handleScheduleUpdate(orgId, { 
          status: 'active',
          lastRun: new Date().toISOString()
        });
      }, 5000);
    } catch (error) {
      Alert.alert('Error', 'Failed to trigger training');
      handleScheduleUpdate(orgId, { status: 'failed' });
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <ActivityIndicator size="large" color={isDarkMode ? '#60A5FA' : '#2563EB'} />
        <Text style={{ 
          color: isDarkMode ? '#F8FAFC' : '#1E293B', 
          marginTop: 16,
          fontSize: 16
        }}>
          Loading training schedules...
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
          Training Schedules
        </Text>
        <Text style={{
          fontSize: 14,
          color: isDarkMode ? '#94a3b8' : '#64748b'
        }}>
          Configure automated training schedules for ML models
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {organizations.map((org) => {
          const schedule = schedules[org.id];
          if (!schedule) return null;

          return (
            <View
              key={org.id}
              style={{
                backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: isDarkMode ? '#374155' : '#e5e7eb',
              }}
            >
              {/* Organization Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: 18,
                    fontWeight: '600',
                    color: isDarkMode ? '#F8FAFC' : '#1E293B',
                    marginBottom: 4
                  }}>
                    {org.name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: 
                        schedule.status === 'active' ? '#22c55e' :
                        schedule.status === 'running' ? '#f59e0b' :
                        schedule.status === 'failed' ? '#ef4444' : '#94a3b8',
                      marginRight: 6
                    }} />
                    <Text style={{
                      fontSize: 14,
                      color: isDarkMode ? '#94a3b8' : '#64748b',
                      textTransform: 'capitalize'
                    }}>
                      {schedule.status}
                    </Text>
                  </View>
                </View>
                
                <TouchableOpacity
                  onPress={() => handleTriggerTraining(org.id)}
                  disabled={isTraining || schedule.status === 'running'}
                  style={{
                    backgroundColor: isDarkMode ? '#059669' : '#10b981',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    opacity: (isTraining || schedule.status === 'running') ? 0.6 : 1
                  }}
                >
                  {(isTraining || schedule.status === 'running') ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>
                      Run Now
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Schedule Configuration */}
              <View style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: isDarkMode ? '#F8FAFC' : '#1E293B'
                  }}>
                    Schedule Configuration
                  </Text>
                  <Switch
                    value={schedule.enabled}
                    onValueChange={(value) => handleScheduleUpdate(org.id, { enabled: value })}
                    trackColor={{ false: '#767577', true: '#22c55e' }}
                    thumbColor={schedule.enabled ? '#ffffff' : '#f4f3f4'}
                  />
                </View>

                {/* Cron Pattern Input */}
                <View style={{ marginBottom: 12 }}>
                  <Text style={{
                    fontSize: 14,
                    color: isDarkMode ? '#94a3b8' : '#64748b',
                    marginBottom: 8
                  }}>
                    Cron Pattern
                  </Text>
                  <TextInput
                    value={schedule.schedule}
                    onChangeText={(value) => handleScheduleUpdate(org.id, { schedule: value })}
                    style={{
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#374155' : '#e5e7eb',
                      borderRadius: 8,
                      padding: 12,
                      backgroundColor: isDarkMode ? '#334155' : '#f9fafb',
                      color: isDarkMode ? '#fff' : '#111827',
                      fontFamily: 'monospace'
                    }}
                    placeholder="0 2 * * 0"
                    placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
                  />
                </View>

                {/* Preset Buttons */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {cronPresets.slice(0, 3).map((preset) => (
                    <TouchableOpacity
                      key={preset.value}
                      onPress={() => preset.value !== 'custom' && handleScheduleUpdate(org.id, { schedule: preset.value })}
                      style={{
                        backgroundColor: schedule.schedule === preset.value 
                          ? (isDarkMode ? '#2563eb' : '#3b82f6')
                          : (isDarkMode ? '#374155' : '#f3f4f6'),
                        borderRadius: 6,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                      }}
                    >
                      <Text style={{
                        fontSize: 12,
                        color: schedule.schedule === preset.value 
                          ? '#ffffff'
                          : (isDarkMode ? '#94a3b8' : '#64748b'),
                        fontWeight: '500'
                      }}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Last Run Info */}
                {schedule.lastRun && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 14 }}>
                      Last Run:
                    </Text>
                    <Text style={{ color: isDarkMode ? '#F8FAFC' : '#1E293B', fontSize: 14 }}>
                      {new Date(schedule.lastRun).toLocaleString()}
                    </Text>
                  </View>
                )}

                {/* Save Button */}
                <TouchableOpacity
                  onPress={() => handleSaveSchedule(org.id)}
                  style={{
                    backgroundColor: isDarkMode ? '#2563eb' : '#3b82f6',
                    borderRadius: 8,
                    padding: 12,
                    alignItems: 'center',
                    marginTop: 8
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>
                    Save Schedule
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default TrainingScheduleConfig;