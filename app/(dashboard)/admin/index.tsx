import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { AlarmDetails } from '../../components/AlarmDetails';
import { useActiveAlarms, useUpdateAlarmStatus } from '../../hooks/useAlarms';
import { Alarm, AlarmSeverity } from '../../types/alarm';

// Define AlarmData interface for helper functions, similar to operator/index.tsx
interface AlarmData {
  id: string;
  description: string;
  severity: string; // 'critical', 'warning', 'info'
  status: string; // 'active', 'acknowledged', 'resolved'
  type: string;
  value: string;
  unit?: string;
  setPoint: string;
  lowLimit?: string;
  highLimit?: string;
  timestamp: string;
  zone?: string;
}

// Sample data from operator/index.tsx
const sampleAnalogAlarms: AlarmData[] = [
  {
    id: 'analog-1',
    description: 'HARDENING ZONE 1 TEMPERATURE (LOW/HIGH)',
    severity: 'warning',
    status: 'active',
    type: 'temperature',
    value: '860',
    unit: '°C',
    setPoint: '870°C (-30/+10)',
    lowLimit: '850°C',
    highLimit: '880°C',
    timestamp: new Date().toISOString(),
    zone: 'zone1'
  },
  {
    id: 'analog-2',
    description: 'HARDENING ZONE 2 TEMPERATURE (LOW/HIGH)',
    severity: 'critical',
    status: 'active',
    type: 'temperature',
    value: '895',
    unit: '°C',
    setPoint: '880°C (-10/+10)',
    lowLimit: '870°C',
    highLimit: '890°C',
    timestamp: new Date().toISOString(),
    zone: 'zone2'
  },
  {
    id: 'analog-3',
    description: 'CARBON POTENTIAL (CP %)',
    severity: 'info',
    status: 'active',
    type: 'carbon',
    value: '0.42',
    unit: '%',
    setPoint: '0.40% (±0.05)',
    lowLimit: '0.35%',
    highLimit: '0.45%',
    timestamp: new Date().toISOString()
  },
  {
    id: 'analog-4',
    description: 'OIL TEMPERATURE (LOW/HIGH)',
    severity: 'warning',
    status: 'active',
    type: 'temperature',
    value: '72',
    unit: '°C',
    setPoint: '60°C',
    lowLimit: '-',
    highLimit: '80°C',
    timestamp: new Date().toISOString()
  },
  {
    id: 'analog-5',
    description: 'TEMPERING ZONE1 TEMPERATURE (LOW/HIGH)',
    severity: 'warning',
    status: 'active',
    type: 'temperature',
    value: '435',
    unit: '°C',
    setPoint: '450°C (-30/+10°C)',
    lowLimit: '420°C',
    highLimit: '460°C',
    timestamp: new Date().toISOString(),
    zone: 'zone1'
  },
  {
    id: 'analog-6',
    description: 'TEMPERING ZONE2 TEMPERATURE (LOW/HIGH)',
    severity: 'info',
    status: 'active',
    type: 'temperature',
    value: '455',
    unit: '°C',
    setPoint: '460°C (±10°C)',
    lowLimit: '450°C',
    highLimit: '470°C',
    timestamp: new Date().toISOString(),
    zone: 'zone2'
  }
];

const sampleBinaryAlarms: AlarmData[] = [
  {
    id: 'binary-1',
    description: 'OIL LEVEL (LOW/HIGH)',
    severity: 'critical',
    status: 'active',
    type: 'level',
    value: 'Normal',
    setPoint: 'Normal',
    timestamp: new Date().toISOString()
  },
  {
    id: 'binary-2',
    description: 'HARDENING HEATER FAILURE (ZONE 1)',
    severity: 'critical',
    status: 'active',
    type: 'heater',
    value: 'Normal',
    setPoint: 'Normal',
    timestamp: new Date().toISOString(),
    zone: 'zone1'
  },
  {
    id: 'binary-3',
    description: 'HARDENING HEATER FAILURE (ZONE 2)',
    severity: 'critical',
    status: 'active',
    type: 'heater',
    value: 'FAILURE',
    setPoint: 'Normal',
    timestamp: new Date().toISOString(),
    zone: 'zone2'
  },
  {
    id: 'binary-4',
    description: 'HARDENING CONVEYOR (NOT ROTATING)',
    severity: 'warning',
    status: 'active',
    type: 'conveyor',
    value: 'NOT ROTATING',
    setPoint: 'Rotating',
    timestamp: new Date().toISOString()
  },
  {
    id: 'binary-5',
    description: 'OIL QUECH CONVEYOR (NOT ROTATING)',
    severity: 'warning',
    status: 'active',
    type: 'conveyor',
    value: 'NOT ROTATING',
    setPoint: 'Rotating',
    timestamp: new Date().toISOString()
  },
  {
    id: 'binary-6',
    description: 'HARDENING FAN MOTOR NOT RUNNING (ZONE 1)',
    severity: 'warning',
    status: 'active',
    type: 'fan',
    value: 'NOT RUNNING',
    setPoint: 'Running',
    timestamp: new Date().toISOString(),
    zone: 'zone1'
  },
  {
    id: 'binary-7',
    description: 'HARDENING FAN MOTOR NOT RUNNING (ZONE 2)',
    severity: 'warning',
    status: 'active',
    type: 'fan',
    value: 'NOT RUNNING',
    setPoint: 'Running',
    timestamp: new Date().toISOString(),
    zone: 'zone2'
  },
  {
    id: 'binary-8',
    description: 'TEMPERING CONVEYOR (NOT ROTATING)',
    severity: 'warning',
    status: 'active',
    type: 'conveyor',
    value: 'NOT ROTATING',
    setPoint: 'Rotating',
    timestamp: new Date().toISOString()
  },
  {
    id: 'binary-9',
    description: 'TEMPERING FAN MOTOR NOT RUNNING (ZONE 1)',
    severity: 'warning',
    status: 'active',
    type: 'fan',
    value: 'NOT RUNNING',
    setPoint: 'Running',
    timestamp: new Date().toISOString(),
    zone: 'zone1'
  },
  {
    id: 'binary-10',
    description: 'TEMPERING FAN MOTOR NOT RUNNING (ZONE 2)',
    severity: 'warning',
    status: 'active',
    type: 'fan',
    value: 'NOT RUNNING',
    setPoint: 'Running',
    timestamp: new Date().toISOString(),
    zone: 'zone2'
  }
];


export default function AdminDashboard() {
  const { isDarkMode, toggleTheme } = useTheme();
  const { authState, logout } = useAuth();
  const router = useRouter();
  
  const { isLoading, isError, error, refetch } = useActiveAlarms(); 
  
  const [selectedAlarm, setSelectedAlarm] = useState<Alarm | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const updateAlarmStatus = useUpdateAlarmStatus();

  const getAnalogAlarmBackground = (alarm: AlarmData): string => {
    const value = parseFloat(alarm.value);
    const lowLimit = alarm.lowLimit && alarm.lowLimit !== '-' ? parseFloat(alarm.lowLimit) : null;
    const highLimit = alarm.highLimit && alarm.highLimit !== '-' ? parseFloat(alarm.highLimit) : null;
    
    if ((lowLimit !== null && value < lowLimit) || (highLimit !== null && value > highLimit)) {
      return '#FEE2E2';
    } else {
      return '#DCFCE7';
    }
  };

  const getAnalogAlarmBackgroundDark = (alarm: AlarmData): string => {
    const value = parseFloat(alarm.value);
    const lowLimit = alarm.lowLimit && alarm.lowLimit !== '-' ? parseFloat(alarm.lowLimit) : null;
    const highLimit = alarm.highLimit && alarm.highLimit !== '-' ? parseFloat(alarm.highLimit) : null;
    
    if ((lowLimit !== null && value < lowLimit) || (highLimit !== null && value > highLimit)) {
      return '#7F1D1D';
    } else {
      return '#065F46';
    }
  };

  const getAnalogAlarmBorder = (alarm: AlarmData): string => {
    const value = parseFloat(alarm.value);
    const lowLimit = alarm.lowLimit && alarm.lowLimit !== '-' ? parseFloat(alarm.lowLimit) : null;
    const highLimit = alarm.highLimit && alarm.highLimit !== '-' ? parseFloat(alarm.highLimit) : null;
    
    if ((lowLimit !== null && value < lowLimit) || (highLimit !== null && value > highLimit)) {
      return '#F87171';
    } else {
      return '#4ADE80';
    }
  };

  const getAnalogAlarmBorderDark = (alarm: AlarmData): string => {
    const value = parseFloat(alarm.value);
    const lowLimit = alarm.lowLimit && alarm.lowLimit !== '-' ? parseFloat(alarm.lowLimit) : null;
    const highLimit = alarm.highLimit && alarm.highLimit !== '-' ? parseFloat(alarm.highLimit) : null;
    
    if ((lowLimit !== null && value < lowLimit) || (highLimit !== null && value > highLimit)) {
      return '#EF4444';
    } else {
      return '#34D399';
    }
  };

  const getBinaryAlarmBackground = (alarm: AlarmData): string => {
    return alarm.value === alarm.setPoint ? '#DCFCE7' : '#FEE2E2';
  };

  const getBinaryAlarmBackgroundDark = (alarm: AlarmData): string => {
    return alarm.value === alarm.setPoint ? '#065F46' : '#7F1D1D';
  };

  const getBinaryAlarmBorder = (alarm: AlarmData): string => {
    return alarm.value === alarm.setPoint ? '#4ADE80' : '#F87171';
  };

  const getBinaryAlarmBorderDark = (alarm: AlarmData): string => {
    return alarm.value === alarm.setPoint ? '#34D399' : '#EF4444';
  };

  const getAlarmTitleColor = (alarm: AlarmData, isDark: boolean): string => {
    const value = parseFloat(alarm.value);
    const lowLimit = alarm.lowLimit && alarm.lowLimit !== '-' ? parseFloat(alarm.lowLimit) : null;
    const highLimit = alarm.highLimit && alarm.highLimit !== '-' ? parseFloat(alarm.highLimit) : null;
    const isOutOfRange = ((lowLimit !== null && value < lowLimit) || (highLimit !== null && value > highLimit));
    
    if (isDark) {
      return isOutOfRange ? '#FEE2E2' : '#D1FAE5'; 
    } else {
      return isOutOfRange ? '#991B1B' : '#065F46'; 
    }
  };

  const getBinaryTitleColor = (alarm: AlarmData, isDark: boolean): string => {
    const isNormal = alarm.value === alarm.setPoint;
    
    if (isDark) {
      return isNormal ? '#D1FAE5' : '#FEE2E2';
    } else {
      return isNormal ? '#065F46' : '#991B1B';
    }
  };

  const getValueTextColor = (alarm: AlarmData, isDark: boolean): string => {
    const value = parseFloat(alarm.value);
    const lowLimit = alarm.lowLimit && alarm.lowLimit !== '-' ? parseFloat(alarm.lowLimit) : null;
    const highLimit = alarm.highLimit && alarm.highLimit !== '-' ? parseFloat(alarm.highLimit) : null;
    const isOutOfRange = ((lowLimit !== null && value < lowLimit) || (highLimit !== null && value > highLimit));
    
    if (isDark) {
      return isOutOfRange ? '#FCA5A5' : '#6EE7B7';
    } else {
      return isOutOfRange ? '#DC2626' : '#059669';
    }
  };
  
  const getBinaryValueColor = (alarm: AlarmData, isDark: boolean): string => {
    const isNormal = alarm.value === alarm.setPoint;
    
    if (isDark) {
      return isNormal ? '#6EE7B7' : '#FCA5A5'; 
    } else {
      return isNormal ? '#059669' : '#DC2626'; 
    }
  };
  
  const handleAcknowledge = useCallback((id: string) => {
    updateAlarmStatus.mutate({ id, status: 'acknowledged' });
    if (selectedAlarm?.id === id) {
      setSelectedAlarm(prev => {
        if (!prev) return null;
        // Create a new object for state update to ensure re-render
        const updatedAlarm = { ...prev, status: 'acknowledged' };
        // If the original selectedAlarm was from sampleData, its status might not be directly mutable
        // For AlarmDetails component, ensure it reflects this change or refetches.
        // Here, we update the local state for the modal.
        return updatedAlarm as Alarm; 
      });
    }
  }, [updateAlarmStatus, selectedAlarm]);
  
  const handleResolve = useCallback((id: string) => {
    updateAlarmStatus.mutate({ id, status: 'resolved' });
    if (selectedAlarm?.id === id) {
       setSelectedAlarm(prev => {
        if (!prev) return null;
        const updatedAlarm = { ...prev, status: 'resolved' };
        return updatedAlarm as Alarm;
      });
    }
  }, [updateAlarmStatus, selectedAlarm]);
  
  const handleAlarmPress = useCallback((alarmData: AlarmData) => {
    // Map only known or essential fields to the Alarm type
    // This avoids errors if Alarm type has a very specific structure
    // that doesn't match all fields in AlarmData or added defaults.
    const alarmToDisplay: Alarm = {
      id: alarmData.id,
      description: alarmData.description,
      severity: alarmData.severity.toUpperCase() as AlarmSeverity,
      status: alarmData.status as 'active' | 'acknowledged' | 'resolved',
      timestamp: alarmData.timestamp, // Assuming Alarm.timestamp is a string
      // Other fields from AlarmData (like value, unit, type, zone, etc.)
      // should be added here ONLY if they are defined in the Alarm type.
      // For now, keeping it minimal to ensure type compatibility.
      // If AlarmDetails needs more fields, the Alarm type and this mapping must be updated.
      type: alarmData.type as any, // Keep as per user's original structure, but acknowledge it might be an issue
      value: alarmData.value, // Keep as per user's original structure
      unit: alarmData.unit, // Keep as per user's original structure
      setPoint: alarmData.setPoint, // Keep as per user's original structure
      lowLimit: alarmData.lowLimit && alarmData.lowLimit !== '-' ? parseFloat(alarmData.lowLimit) : undefined,
      highLimit: alarmData.highLimit && alarmData.highLimit !== '-' ? parseFloat(alarmData.highLimit) : undefined,
      zone: alarmData.zone as any, // Keep as per user's original structure

      // Explicitly add fields if they are part of the actual Alarm type definition
      // Example: if 'notes' is in Alarm type:
      // notes: alarmData.notes || '',
    };
    setSelectedAlarm(alarmToDisplay);
    setDetailsVisible(true);
  }, []);
  
  const handleCloseDetails = useCallback(() => {
    setDetailsVisible(false);
    setSelectedAlarm(null); 
  }, []);
  
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch(); 
    setRefreshing(false);
  }, [refetch]);
  
  const navigateToUserManagement = () => {
    router.push("/admin/users" as any);
  };
  
  const navigateToSettings = () => {
    router.push("/admin/setpoints" as any);
  };
  
  const handleSelectedAcknowledge = useCallback(() => {
    if (selectedAlarm) {
      handleAcknowledge(selectedAlarm.id);
      // Optionally update the selectedAlarm state directly if AlarmDetails doesn't auto-reflect
       setSelectedAlarm(prev => prev ? ({ ...prev, status: 'acknowledged' } as Alarm) : null);
       // setDetailsVisible(false); // Keep modal open to see change or close as preferred
    }
  }, [selectedAlarm, handleAcknowledge]);

  const handleSelectedResolve = useCallback(() => {
    if (selectedAlarm) {
      handleResolve(selectedAlarm.id);
      setSelectedAlarm(prev => prev ? ({ ...prev, status: 'resolved' } as Alarm) : null);
      // setDetailsVisible(false);
    }
  }, [selectedAlarm, handleResolve]);

  const renderSummaryCards = () => {
    const criticalCount = sampleAnalogAlarms.filter(a => a.severity === 'critical' && a.status === 'active').length +
                          sampleBinaryAlarms.filter(a => a.severity === 'critical' && a.status === 'active').length;
    const warningCount = sampleAnalogAlarms.filter(a => a.severity === 'warning' && a.status === 'active').length +
                         sampleBinaryAlarms.filter(a => a.severity === 'warning' && a.status === 'active').length;
    const infoCount = sampleAnalogAlarms.filter(a => a.severity === 'info' && a.status === 'active').length +
                      sampleBinaryAlarms.filter(a => a.severity === 'info' && a.status === 'active').length;

    return (
      <View style={styles.opSummaryContainer}>
        <View style={[
          styles.opSummaryCardItem, 
          { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }
        ]}>
          <View style={[styles.opSummaryIcon, { backgroundColor: '#EF4444' }]}>
            <Ionicons name="alert-circle" size={16} color="#FFFFFF" />
          </View>
          <Text style={[styles.opSummaryCount, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            {criticalCount}
          </Text>
          <Text style={[styles.opSummaryLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Critical
          </Text>
        </View>
        
        <View style={[
          styles.opSummaryCardItem, 
          { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }
        ]}>
          <View style={[styles.opSummaryIcon, { backgroundColor: '#F59E0B' }]}>
            <Ionicons name="warning" size={16} color="#FFFFFF" />
          </View>
          <Text style={[styles.opSummaryCount, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            {warningCount}
          </Text>
          <Text style={[styles.opSummaryLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Warning
          </Text>
        </View>
        
        <View style={[
          styles.opSummaryCardItem, 
          { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }
        ]}>
          <View style={[styles.opSummaryIcon, { backgroundColor: '#10B981' }]}>
            <Ionicons name="information-circle" size={16} color="#FFFFFF" />
          </View>
          <Text style={[styles.opSummaryCount, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            {infoCount}
          </Text>
          <Text style={[styles.opSummaryLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Info
          </Text>
        </View>
      </View>
    );
  };

  const renderAlarmSections = () => {
    return (
      <View style={styles.opAlarmSections}>
        {/* Analog Alarms Section */}
        <View style={styles.opAlarmSection}>
          <View style={styles.opSectionHeader}>
            <Text style={[styles.opSectionTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>Analog Alarms</Text>
            <Text style={[styles.opSectionSubtitle, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>Continuous values with thresholds</Text>
          </View>
          <View style={styles.opAlarmGrid}>
            {sampleAnalogAlarms.map(alarm => (
                <View key={alarm.id} style={styles.opAlarmCardWrapper}>
                  <TouchableOpacity
                    style={[
                      styles.opAlarmCard,
                      {
                      backgroundColor: isDarkMode 
                        ? getAnalogAlarmBackgroundDark(alarm) 
                        : getAnalogAlarmBackground(alarm),
                      borderColor: isDarkMode 
                        ? getAnalogAlarmBorderDark(alarm) 
                        : getAnalogAlarmBorder(alarm)
                      }
                    ]}
                    onPress={() => handleAlarmPress(alarm)}
                  >
                    <View style={styles.opAlarmCardTop}>
                      <Text style={[styles.opAlarmCardTitle, { color: getAlarmTitleColor(alarm, isDarkMode) }]} numberOfLines={2}>{alarm.description}</Text>
                    </View>
                    <View style={styles.opAlarmCardContent}>
                      <Ionicons 
                        name={
                          alarm.type === 'temperature' ? 'thermometer-outline' : 
                          alarm.type === 'carbon' ? 'flask-outline' :
                          alarm.type === 'level' ? 'water-outline' :
                          'analytics-outline'
                        } 
                        size={24} 
                        color={isDarkMode ? '#9CA3AF' : "#6B7280"} 
                      />
                      <View style={styles.opAlarmCardValues}>
                        <Text style={[
                          styles.opValueText, 
                          { color: getValueTextColor(alarm, isDarkMode) }
                        ]}>Value: {alarm.value}{alarm.unit}</Text>
                        <Text style={[styles.opSetValue, {color: isDarkMode ? '#9CA3AF' : '#6B7280'}]}>(Set: {alarm.setPoint})</Text>
                        <Text style={[styles.opLimitText, {color: isDarkMode ? '#9CA3AF' : '#6B7280'}]}>Limits: {alarm.lowLimit} - {alarm.highLimit}</Text>
                        <View style={styles.opTimeWrapper}>
                          <Ionicons name="time-outline" size={12} color={isDarkMode ? '#9CA3AF' : "#6B7280"} />
                          <Text style={[styles.opTimeText, {color: isDarkMode ? '#9CA3AF' : '#6B7280'}]}>{new Date(alarm.timestamp).toLocaleTimeString()}</Text>
                        </View>
                      </View>
                    </View>
                    {alarm.zone && (
                      <View style={styles.opZoneWrapper}>
                        <Text style={[styles.opZoneText, {color: isDarkMode ? '#9CA3AF' : '#6B7280'}]}>Zone: {alarm.zone}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
            ))}
          </View>
        </View>
        
        {/* Binary Alarms Section */}
        <View style={styles.opAlarmSection}>
          <View style={styles.opSectionHeader}>
            <Text style={[styles.opSectionTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>Binary Alarms</Text>
            <Text style={[styles.opSectionSubtitle, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>Status indicators (OK/Alarm)</Text>
          </View>
          <View style={styles.opAlarmGrid}>
            {sampleBinaryAlarms.map(alarm => (
                <View key={alarm.id} style={styles.opAlarmCardWrapper}>
                  <TouchableOpacity
                    style={[
                      styles.opAlarmCard,
                      {
                      backgroundColor: isDarkMode 
                        ? getBinaryAlarmBackgroundDark(alarm) 
                        : getBinaryAlarmBackground(alarm),
                      borderColor: isDarkMode 
                        ? getBinaryAlarmBorderDark(alarm) 
                        : getBinaryAlarmBorder(alarm)
                      }
                    ]}
                    onPress={() => handleAlarmPress(alarm)}
                  >
                    <View style={styles.opAlarmCardTop}>
                      <Text style={[styles.opAlarmCardTitle, { color: getBinaryTitleColor(alarm, isDarkMode) }]} numberOfLines={2}>{alarm.description}</Text>
                    </View>
                    <View style={styles.opAlarmCardContent}>
                       <Ionicons 
                        name={
                          alarm.type === 'conveyor' ? 'swap-horizontal-outline' : 
                          alarm.type === 'fan' ? 'aperture-outline' :
                          alarm.type === 'heater' ? 'flame-outline' :
                          alarm.type === 'level' ? 'water-outline' :
                          'alert-circle-outline'
                        } 
                        size={24} 
                        color={isDarkMode ? '#9CA3AF' : "#6B7280"}
                      />
                      <View style={styles.opAlarmCardValues}>
                        <Text style={[styles.opValueText, {color: isDarkMode ? '#E5E7EB' : '#1F2937'}]}>Status: <Text style={{ 
                          color: getBinaryValueColor(alarm, isDarkMode),
                          fontWeight: 'bold' 
                        }}>{alarm.value}</Text></Text>
                        <Text style={[styles.opSetValue, {color: isDarkMode ? '#9CA3AF' : '#6B7280'}]}>(Expected: {alarm.setPoint})</Text>
                        <View style={styles.opTimeWrapper}>
                          <Ionicons name="time-outline" size={12} color={isDarkMode ? '#9CA3AF' : "#6B7280"} />
                          <Text style={[styles.opTimeText, {color: isDarkMode ? '#9CA3AF' : '#6B7280'}]}>{new Date(alarm.timestamp).toLocaleTimeString()}</Text>
                        </View>
                      </View>
                    </View>
                     {alarm.zone && (
                      <View style={styles.opZoneWrapper}>
                        <Text style={[styles.opZoneText, {color: isDarkMode ? '#9CA3AF' : '#6B7280'}]}>Zone: {alarm.zone}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
            ))}
          </View>
        </View>
      </View>
    );
  };
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      {/* Header (Preserved from original AdminDashboard) */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            Admin Dashboard
          </Text>
          <Text style={[styles.headerSubtitle, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Monitor and manage system alarms
          </Text>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={[styles.iconButton, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}
            onPress={toggleTheme}
          >
            <Ionicons 
              name={isDarkMode ? 'sunny-outline' : 'moon-outline'} 
              size={22} 
              color={isDarkMode ? '#E5E7EB' : '#4B5563'}
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.iconButton, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}
            onPress={logout}
          >
            <Ionicons 
              name="log-out-outline" 
              size={22}
              color={isDarkMode ? '#E5E7EB' : '#4B5563'}
            />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Quick Actions (Preserved from original AdminDashboard) */}
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}
          onPress={navigateToUserManagement}
        >
          <Ionicons
            name="people-outline"
            size={22}
            color={isDarkMode ? '#60A5FA' : '#2563EB'}
            style={styles.actionIcon}
          />
          <Text style={[styles.actionText, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
            Manage Users
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}
          onPress={navigateToSettings}
        >
          <Ionicons
            name="settings-outline"
            size={22}
            color={isDarkMode ? '#60A5FA' : '#2563EB'}
            style={styles.actionIcon}
          />
          <Text style={[styles.actionText, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
            System Settings
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Content Area */}
      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDarkMode ? '#60A5FA' : '#2563EB'} />
          <Text style={[styles.loadingText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Loading data...
          </Text>
        </View>
      ) : isError ? (
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={64}
            color={isDarkMode ? '#F87171' : '#EF4444'}
          />
          <Text style={[styles.errorTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            Error Loading Data
          </Text>
          <Text style={[styles.errorMessage, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            {error instanceof Error ? error.message : 'Failed to load data'}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB' }]}
            onPress={handleRefresh}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#3B82F6']}
              tintColor={isDarkMode ? '#60A5FA' : '#3B82F6'}
            />
          }
        >
          {/* Status Summary Cards */}
          {renderSummaryCards()}
          
          {/* Alarm Sections */}
          {renderAlarmSections()}

           {/* Last updated text */}
          <Text style={[styles.opLastUpdatedText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Last updated: {new Date().toLocaleTimeString()} (Sample Data)
          </Text>
          <Text style={[styles.opUpdateInfoText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Displaying sample alarm data.
          </Text>

        </ScrollView>
      )}
      
      {/* Alarm Details Modal (Preserved) */}
      <AlarmDetails
        alarm={selectedAlarm}
        visible={detailsVisible}
        onClose={handleCloseDetails}
        onAcknowledge={selectedAlarm?.status === 'active' || selectedAlarm?.status === 'acknowledged' ? handleSelectedAcknowledge : undefined}
        onResolve={selectedAlarm?.status === 'active' || selectedAlarm?.status === 'acknowledged' ? handleSelectedResolve : undefined}
      />
    </SafeAreaView>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
  },
  headerActions: {
    flexDirection: 'row',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  actionButton: { 
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionIcon: {
    marginRight: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 16, 
    paddingBottom: 24, 
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
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  opSummaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16, 
  },
  opSummaryCardItem: {
    width: '30%', 
    borderRadius: 8, 
    padding: 8, 
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1, 
  },
  opSummaryIcon: {
    width: 24, 
    height: 24, 
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4, 
  },
  opSummaryCount: {
    fontSize: 18, 
    fontWeight: 'bold',
  },
  opSummaryLabel: {
    fontSize: 12, 
  },
  opAlarmSections: {},
  opAlarmSection: {
    marginBottom: 20, 
  },
  opSectionHeader: {
    marginBottom: 12,
  },
  opSectionTitle: { 
    fontSize: 18,
    fontWeight: '600',
  },
  opSectionSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  opAlarmGrid: { 
    flexDirection: 'column', 
  },
  opAlarmCardWrapper: {
    marginBottom: 12,
  },
  opAlarmCard: {
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  opAlarmCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  opAlarmCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  opAlarmCardContent: {
    flexDirection: 'row',
    alignItems: 'center', 
  },
  opAlarmCardValues: {
    marginLeft: 12, 
    flex: 1,
  },
  opValueText: {
    fontSize: 14,
  },
  opSetValue: {
    fontSize: 12,
  },
  opLimitText: {
    fontSize: 11,
  },
  opTimeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  opTimeText: {
    fontSize: 12,
    marginLeft: 4,
  },
  opZoneWrapper: {
    marginTop: 8,
  },
  opZoneText: {
    fontSize: 12,
  },
  opLastUpdatedText: { 
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 16, 
  },
  opUpdateInfoText: { 
    textAlign: 'center',
    fontSize: 10,
    marginTop: 2,
    marginBottom: 8,
  },
}); 