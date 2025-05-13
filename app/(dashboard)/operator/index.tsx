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
  Animated,
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

// Theme Colors
const THEME = {
  dark: {
    primary: '#1E3A8A',
    secondary: '#2563EB',
    accent: '#3B82F6',
    background: '#0F172A',
    cardBg: '#1E293B',
    text: {
      primary: '#F8FAFC',
      secondary: '#94A3B8',
      accent: '#60A5FA'
    },
    status: {
      normal: '#1E293B',
      warning: '#FFEB3B',
      critical: '#FF0000', 
      success: '#4CAF50'
    },
    border: '#334155',
    shadow: 'rgba(0, 0, 0, 0.25)'
  },
  light: {
    primary: '#2563EB',
    secondary: '#3B82F6',
    accent: '#60A5FA',
    background: '#F8FAFC',
    cardBg: '#FFFFFF',
    text: {
      primary: '#1E293B',
      secondary: '#475569',
      accent: '#2563EB'
    },
    status: {
      normal: '#F1F5F9',
      warning: '#FDE68A',
      critical: '#FEE2E2',
      success: '#DCFCE7'
    },
    border: '#E2E8F0',
    shadow: 'rgba(0, 0, 0, 0.1)'
  }
};

// Card Shadow Styles
const CARD_SHADOW = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  android: {
    elevation: 8,
  },
});

// Animation Constants
const SCALE_ANIMATION_CONFIG = {
  duration: 200,
  useNativeDriver: true,
};

// Card Dimensions
const SCREEN_PADDING = 16;
const CARD_MARGIN = 8;
const CARD_WIDTH = (SCREEN_WIDTH - (SCREEN_PADDING * 2) - (CARD_MARGIN * 2)) / 2;

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

  // Add notification badge animation
  const [notificationBadgeScale] = useState(new Animated.Value(1));

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

  // Add animation state AFTER sample data is defined
  const [cardScales] = useState(() => 
    new Map<string, Animated.Value>(
      [...sampleAnalogAlarms, ...sampleBinaryAlarms].map(alarm => 
        [alarm.id, new Animated.Value(1)]
      )
    )
  );

  // Animation handlers
  const animateCard = useCallback((id: string, toValue: number) => {
    const scale = cardScales.get(id);
    if (scale) {
      Animated.spring(scale, {
        toValue,
        useNativeDriver: true,
        tension: 300,
        friction: 20,
      }).start();
    }
  }, [cardScales]);

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
          { backgroundColor: isDarkMode ? THEME.dark.cardBg : THEME.light.cardBg }
        ]}>
          <View style={[styles.summaryIcon, { backgroundColor: THEME.dark.status.critical }]}>
            <Ionicons name="alert-circle" size={16} color={THEME.dark.text.primary} />
          </View>
          <Text style={[styles.summaryCount, { color: isDarkMode ? THEME.dark.text.primary : THEME.light.text.primary }]}>
            {activeAlarms?.filter(a => a.status === 'active' && a.severity === 'critical').length || 2}
          </Text>
          <Text style={[styles.summaryLabel, { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }]}>
            Critical
          </Text>
        </View>
        
        <View style={[
          styles.summaryCardItem,
          { backgroundColor: isDarkMode ? THEME.dark.cardBg : THEME.light.cardBg }
        ]}>
          <View style={[styles.summaryIcon, { backgroundColor: THEME.dark.status.warning }]}>
            <Ionicons name="warning" size={16} color={THEME.dark.text.primary} />
          </View>
          <Text style={[styles.summaryCount, { color: isDarkMode ? THEME.dark.text.primary : THEME.light.text.primary }]}>
            {activeAlarms?.filter(a => a.status === 'active' && a.severity === 'warning').length || 3}
          </Text>
          <Text style={[styles.summaryLabel, { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }]}>
            Warning
          </Text>
        </View>
        
        <View style={[
          styles.summaryCardItem,
          { backgroundColor: isDarkMode ? THEME.dark.cardBg : THEME.light.cardBg }
        ]}>
          <View style={[styles.summaryIcon, { backgroundColor: THEME.dark.status.success }]}>
            <Ionicons name="information-circle" size={16} color={THEME.dark.text.primary} />
          </View>
          <Text style={[styles.summaryCount, { color: isDarkMode ? THEME.dark.text.primary : THEME.light.text.primary }]}>
            {activeAlarms?.filter(a => a.status === 'active' && a.severity === 'info').length || 0}
          </Text>
          <Text style={[styles.summaryLabel, { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }]}>
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
            <Text style={[styles.sectionTitle, { color: isDarkMode ? THEME.dark.text.primary : THEME.light.text.primary }]}>
              Analog Alarms
            </Text>
            <Text style={[styles.sectionSubtitle, { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }]}>
              Continuous values with thresholds
            </Text>
          </View>
          <View style={styles.alarmGrid}>
            {sampleAnalogAlarms.map(alarm => (
              <View key={alarm.id} style={styles.alarmCardWrapper}>
                <View style={[
                  styles.alarmCard,
                  {
                    backgroundColor: isDarkMode ? getAnalogAlarmBackground(alarm) : getAnalogAlarmBackground(alarm),
                    borderColor: isDarkMode ? getAnalogAlarmBorder(alarm) : getAnalogAlarmBorder(alarm),
                    borderLeftWidth: 4,
                  }
                ]}>
                  <View style={styles.alarmCardTop}>
                    <Text style={[styles.alarmCardTitle, { color: getAlarmTitleColor(alarm, isDarkMode) }]} numberOfLines={2}>
                      {alarm.description}
                    </Text>
                  </View>
                  <View style={styles.alarmCardContent}>
                    <Ionicons 
                      name={
                        alarm.type === 'temperature' ? 'thermometer-outline' : 
                        alarm.type === 'carbon' ? 'flask-outline' :
                        alarm.type === 'level' ? 'water-outline' :
                        'analytics-outline'
                      } 
                      size={20} 
                      color={isDarkMode ? '#6B7280' : '#64748B'} 
                    />
                    <View style={styles.alarmCardValues}>
                      <Text style={[styles.valueText, { color: getValueTextColor(alarm, isDarkMode) }]}>
                        Value: {alarm.value}{alarm.unit}
                      </Text>
                      <Text style={[styles.setValue, { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }]}>
                        (Set: {alarm.setPoint})
                      </Text>
                      <Text style={[styles.limitText, { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }]}>
                        Limits: {alarm.lowLimit} - {alarm.highLimit}
                      </Text>
                      <View style={styles.timeWrapper}>
                        <Ionicons name="time-outline" size={10} color={isDarkMode ? '#6B7280' : '#64748B'} />
                        <Text style={[styles.timeText, { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }]}>
                          {alarm.timestamp ? new Date(alarm.timestamp).toLocaleTimeString() : ''}
                        </Text>
                      </View>
                    </View>
                    {/* NEW ZONE PLACEMENT for Analog Alarms */}
                    {alarm.zone && (
                      <Text style={[
                        styles.zoneText, 
                        {
                          color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary,
                          marginLeft: 8, // Add spacing from the alarmCardValues
                          alignSelf: 'center' // Vertically align with other items in alarmCardContent
                        }
                      ]}>
                        {alarm.zone === 'zone1' ? 'Zone 1' : 'Zone 2'}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Binary Alarms Section */}
        <View style={styles.alarmSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: isDarkMode ? THEME.dark.text.primary : THEME.light.text.primary }]}>
              Binary Alarms
            </Text>
            <Text style={[styles.sectionSubtitle, { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }]}>
              Status indicators (OK/Alarm)
            </Text>
          </View>
          <View style={styles.alarmGrid}>
            {sampleBinaryAlarms.map(alarm => (
              <View key={alarm.id} style={styles.alarmCardWrapper}>
                <View style={[
                  styles.alarmCard,
                  {
                    backgroundColor: isDarkMode ? getBinaryAlarmBackground(alarm) : getBinaryAlarmBackground(alarm),
                    borderColor: isDarkMode ? getBinaryAlarmBorder(alarm) : getBinaryAlarmBorder(alarm),
                    borderLeftWidth: 4,
                  }
                ]}>
                  <View style={styles.alarmCardTop}>
                    <Text style={[styles.alarmCardTitle, { color: getBinaryTitleColor(alarm, isDarkMode) }]} numberOfLines={2}>
                      {alarm.description}
                    </Text>
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
                      size={20} 
                      color={isDarkMode ? '#6B7280' : '#64748B'} 
                    />
                    <View style={styles.alarmCardValues}>
                      <View style={styles.statusRow}>
                        <Text style={[styles.valueText, { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }]}>
                          Status: <Text style={{ color: getBinaryValueColor(alarm, isDarkMode), fontWeight: 'bold' }}>{alarm.value}</Text>
                        </Text>
                        {alarm.zone && (
                          <Text style={[styles.zoneText, { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }]}>
                            {alarm.zone === 'zone1' ? 'Zone 1' : 'Zone 2'}
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.setValue, { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }]}>
                        (Expected: {alarm.setPoint})
                      </Text>
                      <View style={styles.timeWrapper}>
                        <Ionicons name="time-outline" size={10} color={isDarkMode ? '#6B7280' : '#64748B'} />
                        <Text style={[styles.timeText, { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }]}>
                          {alarm.timestamp ? new Date(alarm.timestamp).toLocaleTimeString() : ''}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
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

  const getAnalogAlarmBackground = (alarm: AlarmData): string => {
    const value = parseFloat(alarm.value);
    const lowLimit = alarm.lowLimit && alarm.lowLimit !== '-' ? parseFloat(alarm.lowLimit) : null;
    const highLimit = alarm.highLimit && alarm.highLimit !== '-' ? parseFloat(alarm.highLimit) : null;
    
    if ((lowLimit !== null && value < lowLimit) || (highLimit !== null && value > highLimit)) {
      return isDarkMode ? 
        'rgba(136, 19, 55, 0.3)' : // Softer dark red background
        'rgba(254, 226, 226, 0.6)'; // Light red with more opacity
    }
    return isDarkMode ? 
      'rgba(6, 95, 70, 0.2)' : // Softer dark green background
      'rgba(220, 252, 231, 0.6)'; // Light green with more opacity
  };

  const getAnalogAlarmBackgroundDark = (alarm: AlarmData): string => {
    const value = parseFloat(alarm.value);
    const lowLimit = alarm.lowLimit && alarm.lowLimit !== '-' ? parseFloat(alarm.lowLimit) : null;
    const highLimit = alarm.highLimit && alarm.highLimit !== '-' ? parseFloat(alarm.highLimit) : null;
    
    if ((lowLimit !== null && value < lowLimit) || (highLimit !== null && value > highLimit)) {
      return 'rgba(136, 19, 55, 0.3)'; // Softer dark red
    }
    return 'rgba(6, 95, 70, 0.2)'; // Softer dark green
  };

  const getAnalogAlarmBorder = (alarm: AlarmData): string => {
    const value = parseFloat(alarm.value);
    const lowLimit = alarm.lowLimit && alarm.lowLimit !== '-' ? parseFloat(alarm.lowLimit) : null;
    const highLimit = alarm.highLimit && alarm.highLimit !== '-' ? parseFloat(alarm.highLimit) : null;
    
    if ((lowLimit !== null && value < lowLimit) || (highLimit !== null && value > highLimit)) {
      return isDarkMode ? THEME.dark.status.critical : THEME.light.status.critical;
    }
    return isDarkMode ? THEME.dark.status.success : THEME.light.status.success;
  };

  const getBinaryAlarmBackground = (alarm: AlarmData): string => {
    return alarm.value === alarm.setPoint ? 
      (isDarkMode ? 'rgba(6, 95, 70, 0.2)' : 'rgba(220, 252, 231, 0.6)') :
      (isDarkMode ? 'rgba(136, 19, 55, 0.3)' : 'rgba(254, 226, 226, 0.6)');
  };

  const getBinaryAlarmBorder = (alarm: AlarmData): string => {
    return alarm.value === alarm.setPoint ? 
      (isDarkMode ? THEME.dark.status.success : THEME.light.status.success) :
      (isDarkMode ? THEME.dark.status.critical : THEME.light.status.critical);
  };

  const getAlarmTitleColor = (alarm: AlarmData, isDark: boolean): string => {
    const value = parseFloat(alarm.value);
    const lowLimit = alarm.lowLimit && alarm.lowLimit !== '-' ? parseFloat(alarm.lowLimit) : null;
    const highLimit = alarm.highLimit && alarm.highLimit !== '-' ? parseFloat(alarm.highLimit) : null;
    const isOutOfRange = ((lowLimit !== null && value < lowLimit) || (highLimit !== null && value > highLimit));
    
    return isDark ? 
      (isOutOfRange ? '#FCA5A5' : '#6EE7B7') : // More visible in dark mode
      (isOutOfRange ? '#991B1B' : '#065F46'); // More readable in light mode
  };

  const getBinaryTitleColor = (alarm: AlarmData, isDark: boolean): string => {
    const isNormal = alarm.value === alarm.setPoint;
    return isDark ? 
      (isNormal ? '#6EE7B7' : '#FCA5A5') : // More visible in dark mode
      (isNormal ? '#065F46' : '#991B1B'); // More readable in light mode
  };

  const getValueTextColor = (alarm: AlarmData, isDark: boolean): string => {
    const value = parseFloat(alarm.value);
    const lowLimit = alarm.lowLimit && alarm.lowLimit !== '-' ? parseFloat(alarm.lowLimit) : null;
    const highLimit = alarm.highLimit && alarm.highLimit !== '-' ? parseFloat(alarm.highLimit) : null;
    const isOutOfRange = ((lowLimit !== null && value < lowLimit) || (highLimit !== null && value > highLimit));
    
    return isDark ? 
      (isOutOfRange ? '#FCA5A5' : '#6EE7B7') : // More visible in dark mode
      (isOutOfRange ? '#991B1B' : '#065F46'); // More readable in light mode
  };

  const getBinaryValueColor = (alarm: AlarmData, isDark: boolean): string => {
    const isNormal = alarm.value === alarm.setPoint;
    return isDark ? 
      (isNormal ? '#6EE7B7' : '#FCA5A5') : // More visible in dark mode
      (isNormal ? '#065F46' : '#991B1B'); // More readable in light mode
  };
  
  // Add notification badge animation
  useEffect(() => {
    // Animate notification badge when count changes
    Animated.sequence([
      Animated.spring(notificationBadgeScale, {
        toValue: 1.2,
        useNativeDriver: true,
        tension: 400,
        friction: 20,
      }),
      Animated.spring(notificationBadgeScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 400,
        friction: 20,
      }),
    ]).start();
  }, [unreadNotifications]);

  // Define styles inside the component to access isDarkMode
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
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    logoContainer: {
      padding: 8,
      borderRadius: 14,
    },
    logo: {
      width: 40,
      height: 40,
    },
    titleContainer: {
      marginLeft: 14,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    headerSubtitle: {
      fontSize: 13,
      marginTop: 2,
      fontWeight: '400',
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerButton: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    notificationBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    notificationBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '600',
    },
    scrollContent: {
      padding: SCREEN_PADDING,
      paddingBottom: 80,
    },
    // New summary card styles
    summaryContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
      marginTop: 8,
      paddingHorizontal: 4,
    },
    summaryCardItem: {
      width: '32%',
      borderRadius: 12,
      padding: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    summaryIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 6,
    },
    summaryCount: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 2,
    },
    summaryLabel: {
      fontSize: 11,
      fontWeight: '500',
    },
    // Alarm section styles
    alarmSections: {
      marginBottom: 16,
      marginTop: 16,
    },
    alarmSection: {
      marginBottom: 24,
    },
    sectionHeader: {
      marginBottom: 16,
      backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(241, 245, 249, 0.8)',
      padding: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(71, 85, 105, 0.3)' : 'rgba(203, 213, 225, 0.8)',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 2,
    },
    sectionSubtitle: {
      fontSize: 12,
      marginTop: 2,
    },
    alarmGrid: {
      flexDirection: 'column',
      marginHorizontal: 0,
    },
    alarmCardWrapper: {
      width: '100%',
      marginHorizontal: 0,
      marginBottom: 8,
    },
    alarmCard: {
      borderRadius: 8,
      padding: 10,
      backgroundColor: isDarkMode ? THEME.dark.cardBg : THEME.light.cardBg,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(71, 85, 105, 0.3)' : 'rgba(203, 213, 225, 0.8)',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    alarmCardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    alarmCardTitle: {
      fontSize: 13,
      fontWeight: '600',
      flex: 1,
      marginRight: 8,
    },
    alarmCardContent: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
      padding: 8,
      borderRadius: 6,
      marginTop: 6,
    },
    alarmCardValues: {
      marginLeft: 10,
      flex: 1,
    },
    statusRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 2,
    },
    valueText: {
      fontSize: 13,
      fontWeight: '600',
    },
    setValue: {
      fontSize: 11,
      marginBottom: 2,
      opacity: 0.9,
    },
    limitText: {
      fontSize: 10,
      opacity: 0.8,
    },
    timeWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
      padding: 4,
      borderRadius: 4,
      alignSelf: 'flex-start',
    },
    timeText: {
      fontSize: 10,
      marginLeft: 3,
      opacity: 0.9,
    },
    zoneWrapper: {
      marginTop: 8,
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
      padding: 4,
      borderRadius: 4,
      alignSelf: 'flex-start',
    },
    zoneText: {
      fontSize: 12,
      fontWeight: '500',
      backgroundColor: 'rgba(0, 0, 0, 0.05)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
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
      color: THEME.dark.text.secondary,
    },
    updateInfoText: {
      textAlign: 'center',
      fontSize: 10,
      marginTop: 2,
      color: THEME.dark.text.secondary,
    },
    bottomNav: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-around',
      borderRadius: 10,
      paddingVertical: 10,
      borderTopWidth: 1,
      backgroundColor: THEME.dark.cardBg,
      borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    navItem: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
    },
    navLabel: {
      fontSize: 12,
      marginTop: 2,
      color: THEME.dark.text.secondary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: THEME.dark.text.secondary,
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
      color: THEME.dark.text.primary,
    },
    errorMessage: {
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 24,
      color: THEME.dark.text.secondary,
    },
    retryButton: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      backgroundColor: THEME.dark.primary,
    },
    retryButtonText: {
      color: THEME.dark.text.primary,
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      {/* Enhanced Header */}
      <View style={[
        styles.header,
        {
          backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(248, 250, 252, 0.95)',
          borderBottomColor: isDarkMode ? 'rgba(51, 65, 85, 0.3)' : 'rgba(226, 232, 240, 0.8)',
        }
      ]}>
        <View style={styles.headerLeft}>
          <View style={[
            styles.logoContainer,
            {
              backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
            }
          ]}>
            <Image 
              source={require('../../../assets/images/icon.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.titleContainer}>
            <Text style={[
              styles.headerTitle,
              { 
                color: isDarkMode ? '#F8FAFC' : '#1E293B',
              }
            ]}>
              Eagle Notifier
            </Text>
            <Text style={[
              styles.headerSubtitle,
              { 
                color: isDarkMode ? '#94A3B8' : '#64748B',
              }
            ]}>
              Operator Dashboard
            </Text>
          </View>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={[styles.headerButton, {
              backgroundColor: isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(241, 245, 249, 0.8)',
            }]}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons 
              name="notifications-outline" 
              size={22} 
              color={isDarkMode ? '#94A3B8' : '#475569'}
            />
            {unreadNotifications > 0 && (
              <View style={[
                styles.notificationBadge,
                { 
                  backgroundColor: isDarkMode ? '#EF4444' : '#DC2626',
                }
              ]}>
                <Text style={styles.notificationBadgeText}>
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.headerButton,
              { backgroundColor: isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(241, 245, 249, 0.8)' }
            ]}
            onPress={toggleTheme}
          >
            <Ionicons 
              name={isDarkMode ? 'sunny-outline' : 'moon-outline'} 
              size={22}
              color={isDarkMode ? '#94A3B8' : '#475569'}
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
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }}>
        <View style={[styles.bottomNav, { 
          backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
          borderTopColor: isDarkMode ? '#374151' : '#E5E7EB'
        }]}
        >
          <TouchableOpacity 
            style={styles.navItem}
            onPress={() => router.push('/(dashboard)/operator/' as any)}
          >
            <Ionicons 
              name="home" 
              size={22} 
              color={isDarkMode ? '#60A5FA' : '#2563EB'} 
            />
            <Text style={[styles.navLabel, { color: isDarkMode ? '#60A5FA' : '#2563EB' }]}>Dashboard</Text>
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
            <Text style={[styles.navLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>Analytics</Text>
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
            <Text style={[styles.navLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>Reports</Text>
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
            <Text style={[styles.navLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>Settings</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      
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