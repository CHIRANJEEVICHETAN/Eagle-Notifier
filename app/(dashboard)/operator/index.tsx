import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  FlatList,
  Image,
  Platform,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Link } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { AlarmCard } from '../../components/AlarmCard';
import { AlarmDetails } from '../../components/AlarmDetails';
import { useActiveAlarms, useUpdateAlarmStatus } from '../../hooks/useAlarms';
import { Alarm, AlarmSeverity } from '../../types/alarm';
import { useNotifications } from '../../hooks/useNotifications';
import * as Notifications from 'expo-notifications';
import axios from 'axios';
import { apiConfig } from '../../api/config';
import { getAuthHeader } from '../../api/auth';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function OperatorDashboard() {
  const { isDarkMode, toggleTheme } = useTheme();
  const { authState, logout } = useAuth();
  const router = useRouter();
  
  const { data: activeAlarms, isLoading, isError, error, refetch } = useActiveAlarms();
  
  const [selectedAlarm, setSelectedAlarm] = useState<Alarm | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(5); // Simulate unread notifications
  
  const updateAlarmStatus = useUpdateAlarmStatus();

  // For monitoring previous states of binary alarms
  const [previousBinaryStates, setPreviousBinaryStates] = useState<Record<string, string>>({});
  // For tracking if analog values are outside ranges
  const [alarmStates, setAlarmStates] = useState<Record<string, boolean>>({});

  // Sample analog alarms data for when no real data is available
  const sampleAnalogAlarms = [
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

  // Sample binary alarms data for when no real data is available
  const sampleBinaryAlarms = [
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

  // Request notification permissions
  useEffect(() => {
    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Notification Permission',
          'Please enable notifications for this app to receive critical alarm alerts'
        );
      }
    };
    
    requestPermissions();
  }, []);

  // Simulate periodic alarm data fetching (every 5 minutes)
  useEffect(() => {
    const intervalId = setInterval(() => {
      console.log('Fetching fresh alarm data...');
      refetch();
      // Also check if we need to send notifications
      checkAndTriggerNotifications();
    }, 300000); // 5 minutes = 300000ms
    
    return () => clearInterval(intervalId);
  }, [refetch]);
  
  // Set up more frequent monitoring (every 30 seconds)
  useEffect(() => {
    const monitoringInterval = setInterval(() => {
      checkAndTriggerNotifications();
    }, 30000); // 30 seconds for demo purposes
    
    return () => clearInterval(monitoringInterval);
  }, [sampleAnalogAlarms, sampleBinaryAlarms, previousBinaryStates, alarmStates]);

  // Function to check values and trigger notifications
  const checkAndTriggerNotifications = useCallback(() => {
    // Check analog alarms for threshold violations
    sampleAnalogAlarms.forEach(alarm => {
      const value = parseFloat(alarm.value);
      const lowLimit = alarm.lowLimit ? parseFloat(alarm.lowLimit) : null;
      const highLimit = alarm.highLimit ? parseFloat(alarm.highLimit) : null;
      
      // Check if value is outside limits
      const isOutOfRange = (
        (lowLimit !== null && value < lowLimit) || 
        (highLimit !== null && value > highLimit)
      );
      
      // Get previous state
      const previouslyInAlarm = alarmStates[alarm.id] || false;
      
      // If state changed, trigger notification through backend
      if (isOutOfRange && !previouslyInAlarm) {
        // Value just went out of range, send to backend
        triggerBackendNotification({
          type: 'ANALOG_ALARM',
          description: alarm.description,
          value: alarm.value,
          unit: alarm.unit,
          severity: alarm.severity.toUpperCase(),
          details: `Value ${value}${alarm.unit} is outside normal range (${alarm.lowLimit}-${alarm.highLimit})`,
          alarmId: alarm.id
        });
        
        // Update alarm state
        setAlarmStates(prev => ({ ...prev, [alarm.id]: true }));
      } else if (!isOutOfRange && previouslyInAlarm) {
        // Value returned to normal range
        triggerBackendNotification({
          type: 'ANALOG_RESOLVED',
          description: alarm.description,
          value: alarm.value,
          unit: alarm.unit,
          severity: 'INFO',
          details: `Value ${value}${alarm.unit} has returned to normal range`,
          alarmId: alarm.id
        });
        
        // Update alarm state
        setAlarmStates(prev => ({ ...prev, [alarm.id]: false }));
      }
    });
    
    // Check binary alarms for state changes
    sampleBinaryAlarms.forEach(alarm => {
      const currentValue = alarm.value;
      const previousValue = previousBinaryStates[alarm.id];
      
      // If this is first check, just store the value
      if (!previousValue) {
        setPreviousBinaryStates(prev => ({ ...prev, [alarm.id]: currentValue }));
        return;
      }
      
      // If value changed, trigger notification through backend
      if (currentValue !== previousValue) {
        // Status changed, send to backend
        if (currentValue !== alarm.setPoint) {
          // Alarm condition
          triggerBackendNotification({
            type: 'BINARY_ALARM',
            description: alarm.description,
            value: currentValue,
            severity: alarm.severity.toUpperCase(),
            details: `Status changed to ${currentValue} (Expected: ${alarm.setPoint})`,
            alarmId: alarm.id
          });
        } else {
          // Normal condition
          triggerBackendNotification({
            type: 'BINARY_RESOLVED',
            description: alarm.description,
            value: currentValue,
            severity: 'INFO',
            details: `Status returned to normal: ${currentValue}`,
            alarmId: alarm.id
          });
        }
        
        // Update state
        setPreviousBinaryStates(prev => ({ ...prev, [alarm.id]: currentValue }));
      }
    });
  }, [sampleAnalogAlarms, sampleBinaryAlarms, previousBinaryStates, alarmStates]);

  // Send notification through backend to all users
  const triggerBackendNotification = async (alarmData: any) => {
    try {
      const headers = await getAuthHeader();
      await axios.post(
        `${apiConfig.apiUrl}/api/alarms/notification`,
        alarmData,
        { headers }
      );
      console.log(`Backend notification triggered for: ${alarmData.description}`);
    } catch (error) {
      console.error('Error triggering backend notification:', error);
      
      // Fallback to local notification if backend fails
      triggerLocalNotification(
        `${alarmData.description} ${alarmData.type.includes('RESOLVED') ? 'Resolved' : 'Alarm'}`,
        alarmData.details
      );
    }
  };

  // Helper to trigger local notifications (as fallback only)
  const triggerLocalNotification = async (title: string, body: string) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // immediately
      });
      console.log(`Notification triggered: ${title} - ${body}`);
    } catch (error) {
      console.error('Error triggering notification:', error);
    }
  };

  // Handle alarm actions
  const handleAcknowledge = useCallback((id: string) => {
    updateAlarmStatus.mutate({ id, status: 'acknowledged' });
    if (selectedAlarm?.id === id) {
      setSelectedAlarm(prev => prev ? { ...prev, status: 'acknowledged' } : null);
    }
  }, [updateAlarmStatus, selectedAlarm]);
  
  const handleResolve = useCallback((id: string) => {
    updateAlarmStatus.mutate({ id, status: 'resolved' });
    if (selectedAlarm?.id === id) {
      setSelectedAlarm(prev => prev ? { ...prev, status: 'resolved' } : null);
    }
  }, [updateAlarmStatus, selectedAlarm]);
  
  const handleAlarmPress = useCallback((id: string) => {
    const alarm = activeAlarms?.find(a => a.id === id) || null;
    setSelectedAlarm(alarm);
    setDetailsVisible(true);
  }, [activeAlarms]);
  
  const handleCloseDetails = useCallback(() => {
    setDetailsVisible(false);
  }, []);
  
  // Refresh data
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);
  
  // Filter alarms by type
  const analogAlarms = activeAlarms?.filter(alarm => 
    [
      'HARDENING ZONE 1 TEMPERATURE',
      'HARDENING ZONE 2 TEMPERATURE',
      'CARBON POTENTIAL',
      'OIL TEMPERATURE',
      'TEMPERING ZONE1 TEMPERATURE',
      'TEMPERING ZONE2 TEMPERATURE'
    ].some(name => (alarm.description || '').toUpperCase().includes(name))
  ) || [];
  
  const binaryAlarms = activeAlarms?.filter(alarm => 
    [
      'OIL LEVEL',
      'HARDENING HEATER FAILURE',
      'HARDENING CONVEYOR',
      'OIL QUECH CONVEYOR',
      'HARDENING FAN MOTOR',
      'TEMPERING CONVEYOR',
      'TEMPERING FAN MOTOR'
    ].some(name => (alarm.description || '').toUpperCase().includes(name))
  ) || [];

  // Rendering the summary status counts
  const renderSummaryCards = () => {
    return (
      <View style={styles.summaryContainer}>
        <View style={[
          styles.summaryCardItem, 
          { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }
        ]}>
          <View style={[styles.summaryIcon, { backgroundColor: '#EF4444' }]}>
            <Ionicons name="alert-circle" size={16} color="#FFFFFF" />
          </View>
          <Text style={[styles.summaryCount, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            {activeAlarms?.filter(a => a.status === 'active' && a.severity === 'critical').length || 2}
          </Text>
          <Text style={[styles.summaryLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Critical
          </Text>
        </View>
        
        <View style={[
          styles.summaryCardItem, 
          { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }
        ]}>
          <View style={[styles.summaryIcon, { backgroundColor: '#F59E0B' }]}>
            <Ionicons name="warning" size={16} color="#FFFFFF" />
          </View>
          <Text style={[styles.summaryCount, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            {activeAlarms?.filter(a => a.status === 'active' && a.severity === 'warning').length || 3}
          </Text>
          <Text style={[styles.summaryLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Warning
          </Text>
        </View>
        
        <View style={[
          styles.summaryCardItem, 
          { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }
        ]}>
          <View style={[styles.summaryIcon, { backgroundColor: '#10B981' }]}>
            <Ionicons name="information-circle" size={16} color="#FFFFFF" />
          </View>
          <Text style={[styles.summaryCount, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            {activeAlarms?.filter(a => a.status === 'active' && a.severity === 'info').length || 0}
          </Text>
          <Text style={[styles.summaryLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Info
          </Text>
        </View>
      </View>
    );
  };

  // Rendering the alarm sections
  const renderAlarmSections = () => {
    return (
      <View style={styles.alarmSections}>
        {/* Analog Alarms Section */}
        <View style={styles.alarmSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>Analog Alarms</Text>
            <Text style={[styles.sectionSubtitle, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>Continuous values with thresholds</Text>
          </View>
          <View style={styles.alarmGrid}>
            {sampleAnalogAlarms.map(alarm => (
                <View key={alarm.id} style={styles.alarmCardWrapper}>
                  <TouchableOpacity
                    style={[
                      styles.alarmCard,
                      {
                      backgroundColor: isDarkMode 
                        ? getAnalogAlarmBackgroundDark(alarm) 
                        : getAnalogAlarmBackground(alarm),
                      borderColor: isDarkMode 
                        ? getAnalogAlarmBorderDark(alarm) 
                        : getAnalogAlarmBorder(alarm)
                      }
                    ]}
                  onPress={() => {
                    setSelectedAlarm(alarm as unknown as Alarm);
                    setDetailsVisible(true);
                  }}
                  >
                    <View style={styles.alarmCardTop}>
                    <Text style={[styles.alarmCardTitle, { color: getAlarmTitleColor(alarm, isDarkMode) }]} numberOfLines={2}>{alarm.description}</Text>
                      </View>
                    <View style={styles.alarmCardContent}>
                      <Ionicons 
                        name={
                          alarm.type === 'temperature' ? 'thermometer-outline' : 
                          alarm.type === 'carbon' ? 'flask-outline' :
                          alarm.type === 'level' ? 'water-outline' :
                          'analytics-outline'
                        } 
                        size={24} 
                        color="#6B7280" 
                      />
                      <View style={styles.alarmCardValues}>
                      <Text style={[
                        styles.valueText, 
                        { color: getValueTextColor(alarm, isDarkMode) }
                      ]}>Value: {alarm.value}{alarm.unit}</Text>
                      <Text style={styles.setValue}>(Set: {alarm.setPoint})</Text>
                      <Text style={styles.limitText}>Limits: {alarm.lowLimit} - {alarm.highLimit}</Text>
                        <View style={styles.timeWrapper}>
                          <Ionicons name="time-outline" size={12} color="#6B7280" />
                        <Text style={styles.timeText}>{alarm.timestamp ? new Date(alarm.timestamp).toLocaleTimeString() : ''}</Text>
                        </View>
                      </View>
                    </View>
                    {alarm.zone && (
                      <View style={styles.zoneWrapper}>
                      <Text style={styles.zoneText}>Zone: {alarm.zone === 'zone1' ? 'Zone 1' : 'Zone 2'}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
            ))}
                      </View>
                    </View>
        {/* Binary Alarms Section */}
        <View style={styles.alarmSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>Binary Alarms</Text>
            <Text style={[styles.sectionSubtitle, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>Status indicators (OK/Alarm)</Text>
          </View>
          <View style={styles.alarmGrid}>
            {sampleBinaryAlarms.map(alarm => (
                <View key={alarm.id} style={styles.alarmCardWrapper}>
                  <TouchableOpacity
                    style={[
                      styles.alarmCard,
                      {
                      backgroundColor: isDarkMode 
                        ? getBinaryAlarmBackgroundDark(alarm) 
                        : getBinaryAlarmBackground(alarm),
                      borderColor: isDarkMode 
                        ? getBinaryAlarmBorderDark(alarm) 
                        : getBinaryAlarmBorder(alarm)
                      }
                    ]}
                  onPress={() => {
                    setSelectedAlarm(alarm as unknown as Alarm);
                    setDetailsVisible(true);
                  }}
                  >
                    <View style={styles.alarmCardTop}>
                    <Text style={[styles.alarmCardTitle, { color: getBinaryTitleColor(alarm, isDarkMode) }]} numberOfLines={2}>{alarm.description}</Text>
                      </View>
                    <View style={styles.alarmCardContent}>
                      <Ionicons 
                        name={
                          alarm.type === 'conveyor' ? 'swap-horizontal-outline' : 
                          alarm.type === 'fan' ? 'aperture-outline' :
                          alarm.type === 'heater' ? 'flame-outline' :
                          alarm.type === 'level' ? 'water-outline' :
                          'alert-circle-outline'
                        } 
                        size={24} 
                        color="#6B7280" 
                      />
                      <View style={styles.alarmCardValues}>
                      <Text style={styles.valueText}>Status: <Text style={{ 
                        color: getBinaryValueColor(alarm, isDarkMode),
                        fontWeight: 'bold' 
                      }}>{alarm.value}</Text></Text>
                      <Text style={styles.setValue}>(Expected: {alarm.setPoint})</Text>
                        <View style={styles.timeWrapper}>
                          <Ionicons name="time-outline" size={12} color="#6B7280" />
                        <Text style={styles.timeText}>{alarm.timestamp ? new Date(alarm.timestamp).toLocaleTimeString() : ''}</Text>
                        </View>
                      </View>
                    </View>
                    {alarm.zone && (
                      <View style={styles.zoneWrapper}>
                      <Text style={styles.zoneText}>Zone: {alarm.zone === 'zone1' ? 'Zone 1' : 'Zone 2'}</Text>
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
  
  // Helper functions for dynamic alarm colors
  interface AlarmData {
    value: string;
    lowLimit?: string;
    highLimit?: string;
    setPoint: string;
  }

  // Enhanced color system for better theme matching
  const getAnalogAlarmBackground = (alarm: AlarmData): string => {
    const value = parseFloat(alarm.value);
    const lowLimit = alarm.lowLimit && alarm.lowLimit !== '-' ? parseFloat(alarm.lowLimit) : null;
    const highLimit = alarm.highLimit && alarm.highLimit !== '-' ? parseFloat(alarm.highLimit) : null;
    
    if ((lowLimit !== null && value < lowLimit) || (highLimit !== null && value > highLimit)) {
      return '#FEE2E2'; // Light theme - Error background (light red)
    } else {
      return '#DCFCE7'; // Light theme - Success background (light green)
    }
  };

  const getAnalogAlarmBackgroundDark = (alarm: AlarmData): string => {
    const value = parseFloat(alarm.value);
    const lowLimit = alarm.lowLimit && alarm.lowLimit !== '-' ? parseFloat(alarm.lowLimit) : null;
    const highLimit = alarm.highLimit && alarm.highLimit !== '-' ? parseFloat(alarm.highLimit) : null;
    
    if ((lowLimit !== null && value < lowLimit) || (highLimit !== null && value > highLimit)) {
      return '#7F1D1D'; // Dark theme - Error background (lighter red)
    } else {
      return '#065F46'; // Dark theme - Success background (lighter green)
    }
  };

  const getAnalogAlarmBorder = (alarm: AlarmData): string => {
    const value = parseFloat(alarm.value);
    const lowLimit = alarm.lowLimit && alarm.lowLimit !== '-' ? parseFloat(alarm.lowLimit) : null;
    const highLimit = alarm.highLimit && alarm.highLimit !== '-' ? parseFloat(alarm.highLimit) : null;
    
    if ((lowLimit !== null && value < lowLimit) || (highLimit !== null && value > highLimit)) {
      return '#F87171'; // Light theme - Error border (medium red)
    } else {
      return '#4ADE80'; // Light theme - Success border (medium green)
    }
  };

  const getAnalogAlarmBorderDark = (alarm: AlarmData): string => {
    const value = parseFloat(alarm.value);
    const lowLimit = alarm.lowLimit && alarm.lowLimit !== '-' ? parseFloat(alarm.lowLimit) : null;
    const highLimit = alarm.highLimit && alarm.highLimit !== '-' ? parseFloat(alarm.highLimit) : null;
    
    if ((lowLimit !== null && value < lowLimit) || (highLimit !== null && value > highLimit)) {
      return '#EF4444'; // Dark theme - Error border (brighter red)
    } else {
      return '#34D399'; // Dark theme - Success border (brighter green)
    }
  };

  const getBinaryAlarmBackground = (alarm: AlarmData): string => {
    return alarm.value === alarm.setPoint ? '#DCFCE7' : '#FEE2E2'; // Light theme backgrounds
  };

  const getBinaryAlarmBackgroundDark = (alarm: AlarmData): string => {
    return alarm.value === alarm.setPoint ? '#065F46' : '#7F1D1D'; // Dark theme backgrounds - lighter colors
  };

  const getBinaryAlarmBorder = (alarm: AlarmData): string => {
    return alarm.value === alarm.setPoint ? '#4ADE80' : '#F87171'; // Light theme borders
  };

  const getBinaryAlarmBorderDark = (alarm: AlarmData): string => {
    return alarm.value === alarm.setPoint ? '#34D399' : '#EF4444'; // Dark theme borders - brighter colors
  };

  // Get text color for alarm card title based on theme and alarm status
  const getAlarmTitleColor = (alarm: AlarmData, isDark: boolean): string => {
    const value = parseFloat(alarm.value);
    const lowLimit = alarm.lowLimit && alarm.lowLimit !== '-' ? parseFloat(alarm.lowLimit) : null;
    const highLimit = alarm.highLimit && alarm.highLimit !== '-' ? parseFloat(alarm.highLimit) : null;
    const isOutOfRange = ((lowLimit !== null && value < lowLimit) || (highLimit !== null && value > highLimit));
    
    if (isDark) {
      return isOutOfRange ? '#FEE2E2' : '#D1FAE5'; // Dark theme - brighter text for better contrast
    } else {
      return isOutOfRange ? '#991B1B' : '#065F46'; // Light theme - unchanged
    }
  };

  // Get text color for binary alarm card title based on theme and alarm status
  const getBinaryTitleColor = (alarm: AlarmData, isDark: boolean): string => {
    const isNormal = alarm.value === alarm.setPoint;
    
    if (isDark) {
      return isNormal ? '#D1FAE5' : '#FEE2E2'; // Dark theme - brighter text for better contrast
    } else {
      return isNormal ? '#065F46' : '#991B1B'; // Light theme - unchanged
    }
  };

  // Get text color for the value display based on alarm status
  const getValueTextColor = (alarm: AlarmData, isDark: boolean): string => {
    const value = parseFloat(alarm.value);
    const lowLimit = alarm.lowLimit && alarm.lowLimit !== '-' ? parseFloat(alarm.lowLimit) : null;
    const highLimit = alarm.highLimit && alarm.highLimit !== '-' ? parseFloat(alarm.highLimit) : null;
    const isOutOfRange = ((lowLimit !== null && value < lowLimit) || (highLimit !== null && value > highLimit));
    
    if (isDark) {
      return isOutOfRange ? '#FCA5A5' : '#6EE7B7'; // Bright colors for dark theme - unchanged
    } else {
      return isOutOfRange ? '#DC2626' : '#059669'; // Strong colors for light theme - unchanged
    }
  };

  // Get text color for binary alarm value display
  const getBinaryValueColor = (alarm: AlarmData, isDark: boolean): string => {
    const isNormal = alarm.value === alarm.setPoint;
    
    if (isDark) {
      return isNormal ? '#6EE7B7' : '#FCA5A5'; // Bright colors for dark theme
    } else {
      return isNormal ? '#059669' : '#DC2626'; // Strong colors for light theme
    }
  };
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: isDarkMode ? '#374151' : '#E5E7EB' }]}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../../assets/images/icon.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.headerTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            Eagle Notifier
          </Text>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons 
              name="notifications-outline" 
              size={24} 
              color={isDarkMode ? '#E5E7EB' : '#4B5563'} 
            />
            {unreadNotifications > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          
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
        </View>
      </View>
      
      {/* Main Content */}
      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDarkMode ? '#60A5FA' : '#2563EB'} />
          <Text style={[styles.loadingText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Loading alarms...
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
            Error Loading Alarms
          </Text>
          <Text style={[styles.errorMessage, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            {error instanceof Error ? error.message : 'Failed to load alarms'}
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
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#3B82F6']}
              tintColor={isDarkMode ? '#60A5FA' : '#3B82F6'}
            />
          }
        >
          {/* Status Summary */}
          {renderSummaryCards()}
          
          {/* Alarm Sections */}
          {renderAlarmSections()}
          
          {/* Last updated text */}
          <Text style={[styles.lastUpdatedText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Last updated: {new Date().toLocaleTimeString()}
          </Text>
          <Text style={[styles.updateInfoText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Data refreshes every 5 minutes
          </Text>
        </ScrollView>
      )}
      
      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { 
        backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
        borderTopColor: isDarkMode ? '#374151' : '#E5E7EB'
      }]}>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => router.push('/(dashboard)/operator/' as any)}
        >
          <Ionicons 
            name="home" 
            size={22} 
            color={isDarkMode ? '#60A5FA' : '#2563EB'} 
          />
          <Text style={[styles.navLabel, { color: isDarkMode ? '#60A5FA' : '#2563EB' }]}>
            Dashboard
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => router.push('/(dashboard)/analytics')}
        >
          <Ionicons 
            name="analytics-outline" 
            size={22} 
            color={isDarkMode ? '#9CA3AF' : '#6B7280'} 
          />
          <Text style={[styles.navLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Analytics
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => router.push('/(dashboard)/reports')}
        >
          <Ionicons 
            name="document-text-outline" 
            size={22} 
            color={isDarkMode ? '#9CA3AF' : '#6B7280'} 
          />
          <Text style={[styles.navLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Reports
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => router.push('/(dashboard)/profile')}
        >
          <Ionicons 
            name="settings-outline" 
            size={22} 
            color={isDarkMode ? '#9CA3AF' : '#6B7280'} 
          />
          <Text style={[styles.navLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Alarm Details Modal */}
      <AlarmDetails
        alarm={selectedAlarm}
        visible={detailsVisible}
        onClose={handleCloseDetails}
        onAcknowledge={selectedAlarm?.status === 'active' ? () => handleAcknowledge(selectedAlarm.id) : undefined}
        onResolve={selectedAlarm?.status === 'active' || selectedAlarm?.status === 'acknowledged' ? 
          () => handleResolve(selectedAlarm.id) : undefined}
      />
    </SafeAreaView>
  );
}

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
    borderBottomWidth: 1,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 36,
    height: 36,
    marginRight: 18,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
    marginRight: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80, // Extra space for bottom nav
  },
  // New summary card styles
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryCardItem: {
    width: '30%',
    borderRadius: 6,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  summaryIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  summaryCount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  summaryLabel: {
    fontSize: 10,
  },
  // Alarm section styles
  alarmSections: {
    marginBottom: 16,
    marginTop: 10,
  },
  alarmSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  alarmGrid: {
    flexDirection: 'column',
  },
  alarmCardWrapper: {
    marginBottom: 12,
  },
  alarmCard: {
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  alarmCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  alarmCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
    marginRight: 8,
  },
  alarmCardIcons: {
    flexDirection: 'row',
  },
  iconBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  alarmCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alarmCardValues: {
    marginLeft: 8,
    flex: 1,
  },
  valueText: {
    fontSize: 14,
    color: '#1F2937',
  },
  setValue: {
    fontSize: 12,
    color: '#6B7280',
  },
  limitText: {
    fontSize: 11,
    color: '#6B7280',
  },
  timeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  zoneWrapper: {
    marginTop: 8,
  },
  zoneText: {
    fontSize: 12,
    color: '#6B7280',
  },
  emptyStateContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#6B7280',
    fontSize: 14,
  },
  lastUpdatedText: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
  },
  updateInfoText: {
    textAlign: 'center',
    fontSize: 10,
    marginTop: 2,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  navLabel: {
    fontSize: 12,
    marginTop: 2,
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
  alarmCardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    flex: 1,
    marginHorizontal: 4,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 4,
  },
}); 