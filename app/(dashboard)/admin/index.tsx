import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Animated,
  Image,
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
      warning: '#B45309',
      critical: '#881337',
      success: '#065F46'
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

const SCREEN_PADDING = 16;


export default function AdminDashboard() {
  const { isDarkMode, toggleTheme } = useTheme();
  const { authState, logout } = useAuth();
  const router = useRouter();

  const { isLoading, isError, error, refetch } = useActiveAlarms();

  const [selectedAlarm, setSelectedAlarm] = useState<Alarm | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(5); // Simulate unread notifications

  const updateAlarmStatus = useUpdateAlarmStatus();

  const [notificationBadgeScale] = useState(new Animated.Value(1));

  const getAnalogAlarmBackground = (alarm: AlarmData, isDark: boolean): string => {
    const value = parseFloat(alarm.value);
    const lowLimit = alarm.lowLimit && alarm.lowLimit !== '-' ? parseFloat(alarm.lowLimit) : null;
    const highLimit = alarm.highLimit && alarm.highLimit !== '-' ? parseFloat(alarm.highLimit) : null;

    if ((lowLimit !== null && value < lowLimit) || (highLimit !== null && value > highLimit)) {
      return isDark ?
        'rgba(136, 19, 55, 0.3)' : // Softer dark red background
        'rgba(254, 226, 226, 0.6)'; // Light red with more opacity
    }
    return isDark ?
      'rgba(6, 95, 70, 0.2)' : // Softer dark green background
      'rgba(220, 252, 231, 0.6)'; // Light green with more opacity
  };

  const getAnalogAlarmBorder = (alarm: AlarmData, isDark: boolean): string => {
    const value = parseFloat(alarm.value);
    const lowLimit = alarm.lowLimit && alarm.lowLimit !== '-' ? parseFloat(alarm.lowLimit) : null;
    const highLimit = alarm.highLimit && alarm.highLimit !== '-' ? parseFloat(alarm.highLimit) : null;

    if ((lowLimit !== null && value < lowLimit) || (highLimit !== null && value > highLimit)) {
      return isDark ? '#FF0000' : '#FEE2E2'; // Operator THEME critical colors
    }
    return isDark ? '#4CAF50' : '#DCFCE7'; // Operator THEME success colors
  };

  const getBinaryAlarmBackground = (alarm: AlarmData, isDark: boolean): string => {
    return alarm.value === alarm.setPoint ?
      (isDark ? 'rgba(6, 95, 70, 0.2)' : 'rgba(220, 252, 231, 0.6)') :
      (isDark ? 'rgba(136, 19, 55, 0.3)' : 'rgba(254, 226, 226, 0.6)');
  };

  const getBinaryAlarmBorder = (alarm: AlarmData, isDark: boolean): string => {
    return alarm.value === alarm.setPoint ?
      (isDark ? '#4CAF50' : '#DCFCE7') : // Operator THEME success colors
      (isDark ? '#FF0000' : '#FEE2E2');  // Operator THEME critical colors
  };

  const getAlarmTitleColor = (alarm: AlarmData, isDark: boolean): string => {
    const value = parseFloat(alarm.value);
    const lowLimit = alarm.lowLimit && alarm.lowLimit !== '-' ? parseFloat(alarm.lowLimit) : null;
    const highLimit = alarm.highLimit && alarm.highLimit !== '-' ? parseFloat(alarm.highLimit) : null;
    const isOutOfRange = ((lowLimit !== null && value < lowLimit) || (highLimit !== null && value > highLimit));

    return isDark ?
      (isOutOfRange ? '#FCA5A5' : '#6EE7B7') :
      (isOutOfRange ? '#991B1B' : '#065F46');
  };

  const getBinaryTitleColor = (alarm: AlarmData, isDark: boolean): string => {
    const isNormal = alarm.value === alarm.setPoint;
    return isDark ?
      (isNormal ? '#6EE7B7' : '#FCA5A5') :
      (isNormal ? '#065F46' : '#991B1B');
  };

  const getValueTextColor = (alarm: AlarmData, isDark: boolean): string => {
    const value = parseFloat(alarm.value);
    const lowLimit = alarm.lowLimit && alarm.lowLimit !== '-' ? parseFloat(alarm.lowLimit) : null;
    const highLimit = alarm.highLimit && alarm.highLimit !== '-' ? parseFloat(alarm.highLimit) : null;
    const isOutOfRange = ((lowLimit !== null && value < lowLimit) || (highLimit !== null && value > highLimit));

    return isDark ?
      (isOutOfRange ? '#FCA5A5' : '#6EE7B7') :
      (isOutOfRange ? '#991B1B' : '#059669'); // Operator uses #059669 for light mode success text
  };

  const getBinaryValueColor = (alarm: AlarmData, isDark: boolean): string => {
    const isNormal = alarm.value === alarm.setPoint;

    return isDark ?
      (isNormal ? '#6EE7B7' : '#FCA5A5') :
      (isNormal ? '#059669' : '#991B1B'); // Operator uses #059669 for normal, #991B1B for critical
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

    const operatorThemeDarkStatusCritical = '#FF0000';
    const operatorThemeDarkStatusWarning = '#FFEB3B';
    const operatorThemeDarkStatusSuccess = '#4CAF50';

    return (
      <View style={styles.summaryContainer}>
        <View style={[
          styles.summaryCardItem,
          { backgroundColor: isDarkMode ? THEME.dark.cardBg : THEME.light.cardBg }
        ]}>
          <View style={[styles.summaryIcon, { backgroundColor: operatorThemeDarkStatusCritical }]}>
            <Ionicons name="alert-circle" size={16} color={THEME.dark.text.primary} />
          </View>
          <Text style={[styles.summaryCount, { color: isDarkMode ? THEME.dark.text.primary : THEME.light.text.primary }]}>
            {criticalCount}
          </Text>
          <Text style={[styles.summaryLabel, { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }]}>
            Critical
          </Text>
        </View>

        <View style={[
          styles.summaryCardItem,
          { backgroundColor: isDarkMode ? THEME.dark.cardBg : THEME.light.cardBg }
        ]}>
          <View style={[styles.summaryIcon, { backgroundColor: operatorThemeDarkStatusWarning }]}>
            <Ionicons name="warning" size={16} color={isDarkMode ? '#000000' : THEME.dark.text.primary} />
          </View>
          <Text style={[styles.summaryCount, { color: isDarkMode ? THEME.dark.text.primary : THEME.light.text.primary }]}>
            {warningCount}
          </Text>
          <Text style={[styles.summaryLabel, { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }]}>
            Warning
          </Text>
        </View>

        <View style={[
          styles.summaryCardItem,
          { backgroundColor: isDarkMode ? THEME.dark.cardBg : THEME.light.cardBg }
        ]}>
          <View style={[styles.summaryIcon, { backgroundColor: operatorThemeDarkStatusSuccess }]}>
            <Ionicons name="information-circle" size={16} color={THEME.dark.text.primary} />
          </View>
          <Text style={[styles.summaryCount, { color: isDarkMode ? THEME.dark.text.primary : THEME.light.text.primary }]}>
            {infoCount}
          </Text>
          <Text style={[styles.summaryLabel, { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }]}>
            Info
          </Text>
        </View>
      </View>
    );
  };

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
                <TouchableOpacity
                  onPress={() => handleAlarmPress(alarm)}
                  style={[
                    styles.alarmCard,
                    {
                      backgroundColor: getAnalogAlarmBackground(alarm, isDarkMode),
                      borderColor: getAnalogAlarmBorder(alarm, isDarkMode),
                      borderLeftWidth: 4,
                    }
                  ]}
                >
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
                </TouchableOpacity>
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
                <TouchableOpacity
                  onPress={() => handleAlarmPress(alarm)}
                  style={[
                    styles.alarmCard,
                    {
                      backgroundColor: getBinaryAlarmBackground(alarm, isDarkMode),
                      borderColor: getBinaryAlarmBorder(alarm, isDarkMode),
                      borderLeftWidth: 4,
                    }
                  ]}
                >
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
                        <Text style={[styles.valueText /* Removed color here, will be part of Text below */]}>
                          Status: <Text style={{ color: getBinaryValueColor(alarm, isDarkMode), fontWeight: 'bold' }}>{alarm.value}</Text>
                        </Text>
                        {alarm.zone && (
                          <Text style={[styles.zoneText, { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary, marginLeft: 8 /* Added for spacing */ }]}>
                            {alarm.zone}
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
                  {/* Zone already rendered inside statusRow for binary if needed, or keep this pattern if preferred for consistency */}
                  {/* {alarm.zone && !styles.statusRow.flexDirection && ( // Conditional rendering if zone not in statusRow
                      <View style={styles.zoneWrapper}>
                        <Text style={[styles.zoneText, { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }]}>
                          Zone: {alarm.zone}
                        </Text>
                      </View>
                    )} */}
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
            <Image source={require('../../../assets/images/icon.png')}
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
              Admin Dashboard
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
          <Text style={[styles.lastUpdatedText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Last updated: {new Date().toLocaleTimeString()} (Sample Data)
          </Text>
          <Text style={[styles.updateInfoText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Displaying sample alarm data.
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
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 10,
    justifyContent: 'center',
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
    paddingBottom: 80,
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
  alarmSections: {
    marginBottom: 16,
    marginTop: 16,
  },
  alarmSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 16,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
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
    borderWidth: 1,
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
    padding: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  zoneText: {
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lastUpdatedText: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 16,
  },
  updateInfoText: {
    textAlign: 'center',
    fontSize: 10,
    marginTop: 2,
    marginBottom: 8,
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
}); 