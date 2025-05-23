import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../../context/ThemeContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Define setpoint interface
interface Setpoint {
  id: string;
  name: string;
  type: string;
  zone?: string;
  value: number;
  unit?: string;
  lowDeviation?: number;
  highDeviation?: number;
  lastUpdated: string;
  updatedBy?: string;
}

// Mock API service for setpoints
const setpointService = {
  getSetpoints: async (): Promise<Setpoint[]> => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // Mock setpoint data based on the required alarms
    return [
      {
        id: '1',
        name: 'Hardening Zone 1 Temperature',
        type: 'temperature',
        zone: 'zone1',
        value: 870,
        unit: '°C',
        lowDeviation: 20,
        highDeviation: 10,
        lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updatedBy: 'Admin User',
      },
      {
        id: '2',
        name: 'Hardening Zone 2 Temperature',
        type: 'temperature',
        zone: 'zone2',
        value: 880,
        unit: '°C',
        lowDeviation: 10,
        highDeviation: 10,
        lastUpdated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updatedBy: 'Admin User',
      },
      {
        id: '3',
        name: 'Carbon Potential (CP%)',
        type: 'carbon',
        value: 0.40,
        unit: '%',
        lowDeviation: 0.05,
        highDeviation: 0.05,
        lastUpdated: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        updatedBy: 'Admin User',
      },
      {
        id: '4',
        name: 'Oil Temperature',
        type: 'oil',
        value: 60,
        unit: '°C',
        lowDeviation: 0,
        highDeviation: 20,
        lastUpdated: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedBy: 'Admin User',
      },
      {
        id: '5',
        name: 'Tempering Zone 1 Temperature',
        type: 'temperature',
        zone: 'zone1',
        value: 450,
        unit: '°C',
        lowDeviation: 30,
        highDeviation: 10,
        lastUpdated: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        updatedBy: 'Admin User',
      },
      {
        id: '6',
        name: 'Tempering Zone 2 Temperature',
        type: 'temperature',
        zone: 'zone2',
        value: 450,
        unit: '°C',
        lowDeviation: 30,
        highDeviation: 10,
        lastUpdated: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        updatedBy: 'Admin User',
      },
    ];
  },
  
  updateSetpoint: async (id: string, data: Partial<Setpoint>): Promise<Setpoint> => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // In a real app, this would send data to the server
    console.log(`Updating setpoint ${id} with:`, data);
    
    // Return the updated setpoint (mock response)
    return {
      id,
      name: 'Updated Setpoint',
      type: 'temperature',
      value: data.value || 0,
      lastUpdated: new Date().toISOString(),
      updatedBy: 'Current User',
      unit: '°C',
      lowDeviation: data.lowDeviation || 0,
      highDeviation: data.highDeviation || 0,
    };
  },
};

export default function SetpointScreen() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // State for editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editLowDev, setEditLowDev] = useState<string>('');
  const [editHighDev, setEditHighDev] = useState<string>('');
  
  // Fetch setpoints
  const {
    data: setpoints,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['setpoints'],
    queryFn: setpointService.getSetpoints,
  });
  
  // Update setpoint mutation
  const updateSetpointMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Setpoint> }) =>
      setpointService.updateSetpoint(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setpoints'] });
      setEditingId(null);
      setEditValue('');
      setEditLowDev('');
      setEditHighDev('');
    },
  });
  
  // Handle edit button
  const handleEdit = useCallback((setpoint: Setpoint) => {
    setEditingId(setpoint.id);
    setEditValue(setpoint.value.toString());
    setEditLowDev(setpoint.lowDeviation?.toString() || '0');
    setEditHighDev(setpoint.highDeviation?.toString() || '0');
  }, []);
  
  // Handle save
  const handleSave = useCallback((id: string) => {
    const value = parseFloat(editValue);
    const lowDeviation = parseFloat(editLowDev);
    const highDeviation = parseFloat(editHighDev);
    
    // Validate input
    if (isNaN(value)) {
      Alert.alert('Validation Error', 'Please enter a valid number for Setpoint value');
      return;
    }
    
    if (isNaN(lowDeviation)) {
      Alert.alert('Validation Error', 'Please enter a valid number for Low Deviation');
      return;
    }
    
    if (isNaN(highDeviation)) {
      Alert.alert('Validation Error', 'Please enter a valid number for High Deviation');
      return;
    }
    
    updateSetpointMutation.mutate({
      id,
      data: {
        value,
        lowDeviation,
        highDeviation,
      },
    });
  }, [editValue, editLowDev, editHighDev, updateSetpointMutation]);
  
  // Handle cancel edit
  const handleCancel = useCallback(() => {
    setEditingId(null);
    setEditValue('');
    setEditLowDev('');
    setEditHighDev('');
  }, []);
  
  // Render setpoint item
  const renderSetpointItem = useCallback(({ item }: { item: Setpoint }) => {
    const isEditing = editingId === item.id;
    
    return (
      <View style={[
        styles.setpointCard,
        { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }
      ]}>
        <View style={styles.setpointHeader}>
          <Text style={[styles.setpointName, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            {item.name}
          </Text>
          
          {!isEditing ? (
            <TouchableOpacity
              style={[styles.editButton, { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }]}
              onPress={() => handleEdit(item)}
            >
              <Ionicons
                name="pencil-outline"
                size={18}
                color={isDarkMode ? '#60A5FA' : '#2563EB'}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }]}
                onPress={handleCancel}
              >
                <Ionicons
                  name="close-outline"
                  size={18}
                  color={isDarkMode ? '#F87171' : '#EF4444'}
                />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.actionButton, 
                  { 
                    backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                    marginLeft: 8,
                  }
                ]}
                onPress={() => handleSave(item.id)}
              >
                <Ionicons
                  name="checkmark-outline"
                  size={18}
                  color={isDarkMode ? '#4ADE80' : '#22C55E'}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        <View style={styles.setpointType}>
          <View style={[
            styles.typeBadge,
            { 
              backgroundColor: isDarkMode 
                ? item.type === 'temperature' ? '#4F46E5' : '#2563EB' 
                : item.type === 'temperature' ? '#6366F1' : '#3B82F6' 
            }
          ]}>
            <Text style={styles.typeText}>
              {item.type}
              {item.zone ? ` (${item.zone})` : ''}
            </Text>
          </View>
        </View>
        
        {isEditing ? (
          <View style={styles.editForm}>
            <View style={styles.formRow}>
              <Text style={[styles.formLabel, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                Setpoint Value:
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                    color: isDarkMode ? '#E5E7EB' : '#1F2937',
                    borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                  }
                ]}
                value={editValue}
                onChangeText={setEditValue}
                keyboardType="numeric"
                placeholder="Enter value"
                placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
              />
              <Text style={[styles.unitText, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                {item.unit}
              </Text>
            </View>
            
            <View style={styles.formRow}>
              <Text style={[styles.formLabel, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                Low Deviation:
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                    color: isDarkMode ? '#E5E7EB' : '#1F2937',
                    borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                  }
                ]}
                value={editLowDev}
                onChangeText={setEditLowDev}
                keyboardType="numeric"
                placeholder="Enter low deviation"
                placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
              />
              <Text style={[styles.unitText, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                {item.unit}
              </Text>
            </View>
            
            <View style={styles.formRow}>
              <Text style={[styles.formLabel, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                High Deviation:
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                    color: isDarkMode ? '#E5E7EB' : '#1F2937',
                    borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                  }
                ]}
                value={editHighDev}
                onChangeText={setEditHighDev}
                keyboardType="numeric"
                placeholder="Enter high deviation"
                placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
              />
              <Text style={[styles.unitText, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                {item.unit}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.setpointInfo}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                Setpoint:
              </Text>
              <Text style={[styles.infoValue, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                {item.value} {item.unit}
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                Acceptable Range:
              </Text>
              <Text style={[styles.infoValue, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                {item.lowDeviation ? `${item.value - item.lowDeviation}` : '-'} to {' '}
                {item.highDeviation ? `${item.value + item.highDeviation}` : '-'} {item.unit}
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                Last Updated:
              </Text>
              <Text style={[styles.infoValue, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                {new Date(item.lastUpdated).toLocaleDateString()}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  }, [isDarkMode, editingId, editValue, editLowDev, editHighDev, handleEdit, handleSave, handleCancel]);
  
  // Render loading state
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' }]}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDarkMode ? '#60A5FA' : '#2563EB'} />
          <Text style={[styles.loadingText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Loading setpoints...
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // Render error state
  if (isError) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' }]}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={64}
            color={isDarkMode ? '#F87171' : '#EF4444'}
          />
          <Text style={[styles.errorTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            Error Loading Setpoints
          </Text>
          <Text style={[styles.errorMessage, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            {error instanceof Error ? error.message : 'Failed to load setpoints'}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB' }]}
            onPress={() => refetch()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color={isDarkMode ? '#E5E7EB' : '#4B5563'}
          />
        </TouchableOpacity>
        
        <View>
          <Text style={[styles.headerTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            Alarm Setpoints
          </Text>
          <Text style={[styles.headerSubtitle, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Configure alarm thresholds and deviation ranges
          </Text>
        </View>
      </View>
      
      {/* Setpoint List */}
      <FlatList
        data={setpoints}
        keyExtractor={(item) => item.id}
        renderItem={renderSetpointItem}
        contentContainerStyle={styles.listContainer}
      />
      
      {/* Show saving indicator */}
      {updateSetpointMutation.isPending && (
        <View style={styles.savingOverlay}>
          <View style={[styles.savingContainer, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}>
            <ActivityIndicator size="small" color={isDarkMode ? '#60A5FA' : '#2563EB'} />
            <Text style={[styles.savingText, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
              Saving changes...
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
  },
  listContainer: {
    padding: 16,
  },
  setpointCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  setpointHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  setpointName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editActions: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  setpointType: {
    marginBottom: 12,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  typeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  setpointInfo: {
    marginTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    width: 120,
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  editForm: {
    marginTop: 12,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  formLabel: {
    width: 120,
    fontSize: 14,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    flex: 1,
  },
  unitText: {
    marginLeft: 8,
    fontSize: 14,
    width: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  savingOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  savingContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  savingText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
}); 