import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../../context/ThemeContext';
import axios from 'axios';
import { apiConfig } from '../../../../api/config';
import { getAuthHeader } from '../../../../api/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';

interface MeterLimit {
  id: string;
  parameter: string;
  description: string;
  unit: string;
  highLimit: number;
  lowLimit: number | null;
}

export default function MeterLimitConfigScreen() {
  // Theme, Auth, and Navigation
  const { isDarkMode } = useTheme();
  const { authState } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const queryClient = useQueryClient();

  // Check if user is admin
  const isAdmin = authState?.user?.role === 'ADMIN';
  
  // States
  const [highLimit, setHighLimit] = useState<string>('');
  const [lowLimit, setLowLimit] = useState<string>('');

  // Fetch limit details
  const { data: limitData, isLoading, isError } = useQuery({
    queryKey: ['meter', 'limit', id],
    queryFn: async () => {
      const headers = await getAuthHeader();
      const { data } = await axios.get(
        `${apiConfig.apiUrl}/api/meter/limits`,
        { headers }
      );
      return data.data.find((limit: MeterLimit) => limit.id === id) as MeterLimit;
    },
    enabled: !!id && isAdmin,
  });

  // Update limit mutation
  const updateLimitMutation = useMutation({
    mutationFn: async (values: { highLimit?: number; lowLimit?: number }) => {
      const headers = await getAuthHeader();
      return axios.put(
        `${apiConfig.apiUrl}/api/meter/limits/${id}`,
        values,
        { headers }
      );
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['meter', 'limits'] });
      queryClient.invalidateQueries({ queryKey: ['meter', 'limit', id] });
      
      Alert.alert(
        "Success",
        "Limit configuration updated successfully",
        [
          { 
            text: "OK", 
            onPress: () => router.back()
          }
        ]
      );
    },
    onError: (error) => {
      Alert.alert(
        "Error",
        "Failed to update limit configuration. Please try again.",
        [{ text: "OK" }]
      );
      console.error('Error updating limit:', error);
    },
  });

  // Set initial values
  useEffect(() => {
    if (limitData) {
      setHighLimit(limitData.highLimit.toString());
      if (limitData.lowLimit !== null) {
        setLowLimit(limitData.lowLimit.toString());
      }
    }
  }, [limitData]);

  const handleSave = () => {
    const updatedValues: { highLimit?: number; lowLimit?: number } = {};
    
    // Only include values that changed
    if (highLimit !== limitData?.highLimit.toString()) {
      updatedValues.highLimit = parseFloat(highLimit);
    }
    
    if (lowLimit !== (limitData?.lowLimit?.toString() || '')) {
      updatedValues.lowLimit = lowLimit ? parseFloat(lowLimit) : undefined;
    }
    
    // Check if there are changes
    if (Object.keys(updatedValues).length === 0) {
      Alert.alert("No Changes", "No changes detected to save.");
      return;
    }
    
    updateLimitMutation.mutate(updatedValues);
  };

  // For non-admin users, show access denied
  if (!isAdmin) {
    return (
      <SafeAreaView 
        style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}
      >
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <View style={styles.accessDeniedContainer}>
          <Ionicons 
            name="lock-closed" 
            size={64} 
            color={isDarkMode ? '#94A3B8' : '#64748B'} 
          />
          <Text 
            style={[
              styles.accessDeniedText, 
              { color: isDarkMode ? '#F8FAFC' : '#1E293B' }
            ]}
          >
            Access Denied
          </Text>
          <Text 
            style={[
              styles.accessDeniedSubtext, 
              { color: isDarkMode ? '#94A3B8' : '#64748B' }
            ]}
          >
            You need administrator privileges to access this page.
          </Text>
          <TouchableOpacity
            style={[
              styles.button, 
              { backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB' }
            ]}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}
    >
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(248, 250, 252, 0.95)',
            borderBottomColor: isDarkMode ? 'rgba(51, 65, 85, 0.3)' : 'rgba(226, 232, 240, 0.8)',
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons 
            name="arrow-back" 
            size={24} 
            color={isDarkMode ? '#94A3B8' : '#64748B'} 
          />
        </TouchableOpacity>
        <Text
          style={[
            styles.headerTitle,
            { color: isDarkMode ? '#F8FAFC' : '#1E293B' },
          ]}
        >
          Configure Parameter Limits
        </Text>
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDarkMode ? '#6EE7B7' : '#10B981'} />
          <Text style={[styles.loadingText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            Loading parameter details...
          </Text>
        </View>
      ) : isError ? (
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={64}
            color={isDarkMode ? '#F87171' : '#EF4444'}
          />
          <Text style={[styles.errorTitle, { color: isDarkMode ? '#F8FAFC' : '#1E293B' }]}>
            Error Loading Data
          </Text>
          <Text style={[styles.errorMessage, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            Failed to load parameter details. Please try again.
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB' }]}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : limitData ? (
        <View style={styles.formContainer}>
          <View style={styles.parameterTitleContainer}>
            <View
              style={[
                styles.paramIconContainer,
                {
                  backgroundColor: isDarkMode
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(16, 185, 129, 0.1)',
                },
              ]}
            >
              <Ionicons
                name={getParameterIcon(limitData.parameter)}
                size={32}
                color={isDarkMode ? '#6EE7B7' : '#10B981'}
              />
            </View>
            <View style={styles.paramTextContainer}>
              <Text
                style={[
                  styles.parameterName,
                  { color: isDarkMode ? '#F8FAFC' : '#1E293B' },
                ]}
              >
                {limitData.description}
              </Text>
              <Text
                style={[
                  styles.parameterDescription,
                  { color: isDarkMode ? '#94A3B8' : '#64748B' },
                ]}
              >
                Unit: {limitData.unit}
              </Text>
            </View>
          </View>
          
          {/* High Limit Input */}
          <View 
            style={[
              styles.inputContainer,
              { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }
            ]}
          >
            <Text style={[styles.inputLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              High Limit
            </Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[
                  styles.input,
                  { color: isDarkMode ? '#F8FAFC' : '#1E293B' }
                ]}
                value={highLimit}
                onChangeText={setHighLimit}
                keyboardType="numeric"
                placeholder="Enter high limit value"
                placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
              />
              <Text style={[styles.unitText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                {limitData.unit}
              </Text>
            </View>
          </View>
          
          {/* Low Limit Input */}
          <View 
            style={[
              styles.inputContainer,
              { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }
            ]}
          >
            <Text style={[styles.inputLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              Low Limit (Optional)
            </Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[
                  styles.input,
                  { color: isDarkMode ? '#F8FAFC' : '#1E293B' }
                ]}
                value={lowLimit}
                onChangeText={setLowLimit}
                keyboardType="numeric"
                placeholder="Enter low limit value (optional)"
                placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
              />
              <Text style={[styles.unitText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                {limitData.unit}
              </Text>
            </View>
          </View>
          
          {/* Info Text */}
          <View style={styles.infoContainer}>
            <Ionicons 
              name="information-circle-outline" 
              size={20} 
              color={isDarkMode ? '#94A3B8' : '#64748B'} 
            />
            <Text style={[styles.infoText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
              When parameter values exceed these limits, notifications will be sent to users.
            </Text>
          </View>
          
          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: isDarkMode ? '#10B981' : '#059669' },
              updateLimitMutation.isPending && { opacity: 0.7 }
            ]}
            onPress={handleSave}
            disabled={updateLimitMutation.isPending}
          >
            {updateLimitMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#FFFFFF" style={styles.saveIcon} />
                <Text style={styles.saveButtonText}>Save Configuration</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// Helper function to get appropriate icon for parameter
function getParameterIcon(parameter: string): any {
  switch (parameter.toLowerCase()) {
    case 'voltage':
      return 'flash-outline';
    case 'current':
      return 'repeat-outline';
    case 'frequency':
      return 'pulse-outline';
    case 'pf':
      return 'options-outline';
    case 'energy':
      return 'battery-charging-outline';
    case 'power':
      return 'flash-outline';
    default:
      return 'analytics-outline';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
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
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  formContainer: {
    padding: 16,
  },
  parameterTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  paramIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  paramTextContainer: {
    flex: 1,
  },
  parameterName: {
    fontSize: 20,
    fontWeight: '600',
  },
  parameterDescription: {
    fontSize: 14,
    marginTop: 4,
  },
  inputContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  unitText: {
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '500',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginVertical: 16,
  },
  infoText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  saveButton: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  saveIcon: {
    marginRight: 8,
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  accessDeniedText: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 16,
  },
  accessDeniedSubtext: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
}); 