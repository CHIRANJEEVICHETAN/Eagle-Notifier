import React, { useCallback, useState, useEffect, useMemo } from 'react';
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
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { AlarmDetails } from '../../components/AlarmDetails';
import { useActiveAlarms, useUpdateAlarmStatus, ALARM_KEYS, ScadaAlarmResponse } from '../../hooks/useAlarms';
import { Alarm, AlarmSeverity } from '../../types/alarm';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { apiConfig } from '../../api/config';
import { getAuthHeader } from '../../api/auth';
import { ResolutionModal } from '../../components/ResolutionModal';
import { useSetpoints, useUpdateSetpoint, Setpoint } from '../../hooks/useSetpoints';
import { SetpointConfigModal } from '../../components/SetpointConfigModal';
import { useMaintenance } from '../../context/MaintenanceContext';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Add this type after the SCREEN_WIDTH constant
type AlarmSeverityFilter = 'critical' | 'warning' | 'info' | 'all';

// Add admin navigation functions after SCREEN_WIDTH constant
const ADMIN_ROUTES = {
  userManagement: '(dashboard)/screens/admin/users',
  systemSettings: '(dashboard)/screens/admin/setpoints'
} as const;

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

// Add these type definitions after the SCREEN_WIDTH constant
type CardScales = Map<string, Animated.Value>;

interface AlarmData {
  id: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'active' | 'acknowledged' | 'resolved';
  type: string;
  value: string;
  unit?: string;
  setPoint: string;
  lowLimit?: number;
  highLimit?: number;
  timestamp: string;
  zone?: string;
}

// Helper function to correctly format timestamps to show IST time consistently
const formatTimestamp = (timestamp: string): string => {
  try {
    // Always use a consistent approach for both development and production
    // by manually calculating IST time from UTC
    
    // Parse the ISO string to Date object
    const date = new Date(timestamp);
    
    // Get UTC components
    const utcHours = date.getUTCHours();
    const utcMinutes = date.getUTCMinutes();
    const utcSeconds = date.getUTCSeconds();
    
    // Add IST offset (+5:30)
    let istHours = utcHours + 5;
    let istMinutes = utcMinutes + 30;
    
    // Handle minute overflow
    if (istMinutes >= 60) {
      istHours += 1;
      istMinutes -= 60;
    }
    
    // Handle hour overflow
    if (istHours >= 24) {
      istHours -= 24;
    }
    
    // Format the time components
    const hours = istHours.toString().padStart(2, '0');
    const minutes = istMinutes.toString().padStart(2, '0');
    const seconds = utcSeconds.toString().padStart(2, '0');
    
    return `${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return '';
  }
};

export default function OperatorDashboard() {
  // Theme and Auth Context
  const { isDarkMode, toggleTheme } = useTheme();
  const { authState } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // Alarm Data and Mutations
  const { data: alarmData, isLoading, isError, error, refetch } = useActiveAlarms();
  const updateAlarmStatus = useUpdateAlarmStatus();

  // Setpoint Data and Mutations - Only for Admin
  const isAdmin = authState?.user?.role === 'ADMIN';
  const isTestUser = authState?.user?.email === 'chetan@gmail.com';
  // Only fetch setpoints if user is admin
  const { data: setpoints } = useSetpoints();
  const updateSetpointMutation = useUpdateSetpoint();

  // UI State
  const [selectedAlarm, setSelectedAlarm] = useState<Alarm | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTimestamp, setRefreshTimestamp] = useState(Date.now());
  const [unreadNotifications, setUnreadNotifications] = useState(5);
  const [selectedAlarmForResolution, setSelectedAlarmForResolution] = useState<Alarm | null>(null);
  const [resolutionModalVisible, setResolutionModalVisible] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<AlarmSeverityFilter>('all');

  // Admin-only state
  const [selectedSetpoint, setSelectedSetpoint] = useState<Setpoint | null>(null);
  const [setpointModalVisible, setSetpointModalVisible] = useState(false);

  // Animation State
  const [notificationBadgeScale] = useState(new Animated.Value(1));
  const [cardScales] = useState<CardScales>(() => new Map());

  // Monitoring State
  const [previousBinaryStates, setPreviousBinaryStates] = useState<Record<string, string>>({});
  const [alarmStates, setAlarmStates] = useState<Record<string, boolean>>({});

  // Memoized Values
  const analogAlarms = useMemo(() => alarmData?.analogAlarms || [], [alarmData]);
  const binaryAlarms = useMemo(() => alarmData?.binaryAlarms || [], [alarmData]);

  const filteredAnalogAlarms = useMemo(() => {
    if (!alarmData?.analogAlarms) return [];
    return severityFilter === 'all'
      ? alarmData.analogAlarms
      : alarmData.analogAlarms.filter((alarm) => alarm.severity === severityFilter);
  }, [severityFilter, alarmData?.analogAlarms]);

  const filteredBinaryAlarms = useMemo(() => {
    if (!alarmData?.binaryAlarms) return [];
    return severityFilter === 'all'
      ? alarmData.binaryAlarms
      : alarmData.binaryAlarms.filter((alarm) => alarm.severity === severityFilter);
  }, [severityFilter, alarmData?.binaryAlarms]);

  const criticalCount = useMemo(
    () =>
      (alarmData?.analogAlarms?.filter((a) => a.severity === 'critical').length || 0) +
      (alarmData?.binaryAlarms?.filter((a) => a.severity === 'critical').length || 0),
    [alarmData]
  );

  const warningCount = useMemo(
    () =>
      (alarmData?.analogAlarms?.filter((a) => a.severity === 'warning').length || 0) +
      (alarmData?.binaryAlarms?.filter((a) => a.severity === 'warning').length || 0),
    [alarmData]
  );

  const infoCount = useMemo(
    () =>
      (alarmData?.analogAlarms?.filter((a) => a.severity === 'info').length || 0) +
      (alarmData?.binaryAlarms?.filter((a) => a.severity === 'info').length || 0),
    [alarmData]
  );

  // Callbacks
  const animateCard = useCallback(
    (id: string, toValue: number) => {
      const scale = cardScales.get(id);
      if (scale) {
        Animated.spring(scale, {
          toValue,
          useNativeDriver: true,
          tension: 300,
          friction: 20,
        }).start();
      }
    },
    [cardScales]
  );

  const handleAcknowledge = useCallback(
    (id: string) => {
      updateAlarmStatus.mutate({ id, status: 'acknowledged' });
      if (selectedAlarm?.id === id) {
        setSelectedAlarm((prev) => (prev ? { ...prev, status: 'acknowledged' } : null));
      }
    },
    [updateAlarmStatus, selectedAlarm]
  );

  const handleResolve = useCallback(
    (id: string) => {
      updateAlarmStatus.mutate({ id, status: 'resolved' });
      if (selectedAlarm?.id === id) {
        setSelectedAlarm((prev) => (prev ? { ...prev, status: 'resolved' } : null));
      }
    },
    [updateAlarmStatus, selectedAlarm]
  );

  const handleCloseDetails = useCallback(() => {
    setDetailsVisible(false);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);

    // Use the queryClient to fetch with force refresh parameter
    try {
      await queryClient.fetchQuery({
        queryKey: ALARM_KEYS.scada(true),
        queryFn: async () => {
          const headers = await getAuthHeader();
          const { data } = await axios.get<ScadaAlarmResponse>(
            `${apiConfig.apiUrl}/api/scada/alarms?force=true`,
            { headers }
          );
          return data;
        },
      });

      // Update refresh timestamp to force re-render of timestamp components
      setRefreshTimestamp(Date.now());
      console.log('Manual refresh completed with force=true');
    } catch (error) {
      console.error('Error during manual refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  const handleSeverityFilter = useCallback((severity: AlarmSeverityFilter) => {
    setSeverityFilter((prev) => (prev === severity ? 'all' : severity));
  }, []);

  // This function will now be even safer with additional checks
  const handleConfigureSetpoint = useCallback(
    (alarm: Alarm) => {
      if (!isAdmin || !setpoints) return;

      const matchingSetpoint = setpoints.find(
        (sp) => sp.type === alarm.type && (!alarm.zone || sp.zone === alarm.zone?.toLowerCase())
      );

      if (matchingSetpoint) {
        setSelectedSetpoint(matchingSetpoint);
        setSetpointModalVisible(true);
      }
    },
    [setpoints, isAdmin]
  );

  const handleSetpointUpdate = useCallback(
    async (lowDeviation: number, highDeviation: number) => {
      if (!selectedSetpoint || !isAdmin) return;

      try {
        await updateSetpointMutation.mutateAsync({
          id: selectedSetpoint.id,
          lowDeviation,
          highDeviation,
        });
        setSetpointModalVisible(false);
        setSelectedSetpoint(null);
      } catch (error) {
        console.error('Error updating setpoint:', error);
        Alert.alert('Update Failed', 'Failed to update setpoint configuration. Please try again.');
      }
    },
    [selectedSetpoint, updateSetpointMutation, isAdmin]
  );

  const handleResolutionSubmit = useCallback(
    async (message: string) => {
      if (selectedAlarmForResolution) {
        try {
          updateAlarmStatus.mutate({
            id: selectedAlarmForResolution.id,
            status: 'resolved',
            resolutionMessage: message,
          });
          setResolutionModalVisible(false);
          setSelectedAlarmForResolution(null);
        } catch (error) {
          console.error('Error resolving alarm:', error);
        }
      }
    },
    [selectedAlarmForResolution, updateAlarmStatus]
  );

  const openResolutionModal = useCallback((alarm: Alarm) => {
    setSelectedAlarmForResolution(alarm);
    setResolutionModalVisible(true);
  }, []);

  const navigateToUserManagement = useCallback(() => {
    if (isAdmin) {
      router.push(ADMIN_ROUTES.userManagement as any);
    }
  }, [authState?.user?.role, router]);

  const navigateToSettings = useCallback(() => {
    if (isAdmin) {
      router.push(ADMIN_ROUTES.systemSettings as any);
    }
  }, [authState?.user?.role, router]);

  const scadaInterval = process.env.EXPO_PUBLIC_SCADA_INTERVAL
    ? parseInt(process.env.EXPO_PUBLIC_SCADA_INTERVAL, 10)
    : 30000;

  // Effects
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

  useEffect(() => {
    const intervalId = setInterval(() => {
      console.log('Fetching fresh alarm data...');
      refetch().then(() => {
        // Update refresh timestamp to force re-render of timestamp components
        setRefreshTimestamp(Date.now());
      });
    }, scadaInterval);

    return () => clearInterval(intervalId);
  }, [refetch, scadaInterval]);

  useEffect(() => {
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
  }, [unreadNotifications, notificationBadgeScale]);

  // Render Functions
  const renderActionButtons = useCallback(
    (alarm: Alarm) => (
      <View style={styles.alarmCardActions}>
        {alarm.status === 'active' && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                borderColor: isDarkMode ? '#3B82F6' : '#2563EB',
                borderWidth: 1,
              },
            ]}
            onPress={() => handleAcknowledge(alarm.id)}>
            <Ionicons
              name="checkmark-circle-outline"
              size={16}
              color={isDarkMode ? '#3B82F6' : '#2563EB'}
            />
            <Text style={[styles.actionButtonText, { color: isDarkMode ? '#3B82F6' : '#2563EB' }]}>
              {alarm.acknowledgedBy ? 'Acknowledged' : 'Acknowledge'}
            </Text>
          </TouchableOpacity>
        )}

        {(alarm.status === 'active' || alarm.status === 'acknowledged') && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.1)' : 'rgba(22, 163, 74, 0.1)',
                borderColor: isDarkMode ? '#22C55E' : '#16A34A',
                borderWidth: 1,
              },
            ]}
            onPress={() => openResolutionModal(alarm)}>
            <Ionicons
              name="checkmark-done-circle-outline"
              size={16}
              color={isDarkMode ? '#22C55E' : '#16A34A'}
            />
            <Text style={[styles.actionButtonText, { color: isDarkMode ? '#22C55E' : '#16A34A' }]}>
              Resolve
            </Text>
          </TouchableOpacity>
        )}

        {/* Add Configure button for admins */}
        {isAdmin && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: isDarkMode ? 'rgba(79, 70, 229, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                borderColor: isDarkMode ? '#4F46E5' : '#6366F1',
                borderWidth: 1,
              },
            ]}
            onPress={() => handleConfigureSetpoint(alarm)}>
            <Ionicons
              name="settings-outline"
              size={16}
              color={isDarkMode ? '#4F46E5' : '#6366F1'}
            />
            <Text style={[styles.actionButtonText, { color: isDarkMode ? '#4F46E5' : '#6366F1' }]}>
              Configure
            </Text>
          </TouchableOpacity>
        )}

        {alarm.acknowledgedBy && (
          <View style={styles.acknowledgedByContainer}>
            <Text
              style={[styles.acknowledgedByText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
              Acknowledged by {alarm.acknowledgedBy.name}
            </Text>
          </View>
        )}
      </View>
    ),
    [
      isDarkMode,
      authState?.user?.role,
      handleAcknowledge,
      openResolutionModal,
      handleConfigureSetpoint,
    ]
  );

  // Modify the renderSummaryCards function
  const renderSummaryCards = () => {
    return (
      <View style={styles.summaryContainer}>
        <TouchableOpacity
          onPress={() => handleSeverityFilter('critical')}
          style={[
            styles.summaryCardItem,
            {
              backgroundColor: isDarkMode ? THEME.dark.cardBg : THEME.light.cardBg,
              borderColor:
                severityFilter === 'critical'
                  ? THEME.dark.status.critical
                  : isDarkMode
                    ? THEME.dark.border
                    : THEME.light.border,
              borderWidth: severityFilter === 'critical' ? 2 : 1,
            },
          ]}>
          <View style={[styles.summaryIcon, { backgroundColor: THEME.dark.status.critical }]}>
            <Ionicons name="alert-circle" size={16} color={THEME.dark.text.primary} />
          </View>
          <Text
            style={[
              styles.summaryCount,
              { color: isDarkMode ? THEME.dark.text.primary : THEME.light.text.primary },
            ]}>
            {criticalCount}
          </Text>
          <Text
            style={[
              styles.summaryLabel,
              { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary },
            ]}>
            Critical
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleSeverityFilter('warning')}
          style={[
            styles.summaryCardItem,
            {
              backgroundColor: isDarkMode ? THEME.dark.cardBg : THEME.light.cardBg,
              borderColor:
                severityFilter === 'warning'
                  ? THEME.dark.status.warning
                  : isDarkMode
                    ? THEME.dark.border
                    : THEME.light.border,
              borderWidth: severityFilter === 'warning' ? 2 : 1,
            },
          ]}>
          <View style={[styles.summaryIcon, { backgroundColor: THEME.dark.status.warning }]}>
            <Ionicons name="warning" size={16} color={THEME.dark.text.primary} />
          </View>
          <Text
            style={[
              styles.summaryCount,
              { color: isDarkMode ? THEME.dark.text.primary : THEME.light.text.primary },
            ]}>
            {warningCount}
          </Text>
          <Text
            style={[
              styles.summaryLabel,
              { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary },
            ]}>
            Warning
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleSeverityFilter('info')}
          style={[
            styles.summaryCardItem,
            {
              backgroundColor: isDarkMode ? THEME.dark.cardBg : THEME.light.cardBg,
              borderColor:
                severityFilter === 'info'
                  ? THEME.dark.status.success
                  : isDarkMode
                    ? THEME.dark.border
                    : THEME.light.border,
              borderWidth: severityFilter === 'info' ? 2 : 1,
            },
          ]}>
          <View style={[styles.summaryIcon, { backgroundColor: THEME.dark.status.success }]}>
            <Ionicons name="information-circle" size={16} color={THEME.dark.text.primary} />
          </View>
          <Text
            style={[
              styles.summaryCount,
              { color: isDarkMode ? THEME.dark.text.primary : THEME.light.text.primary },
            ]}>
            {infoCount}
          </Text>
          <Text
            style={[
              styles.summaryLabel,
              { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary },
            ]}>
            Info
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Modify the renderAlarmSections function to use filtered alarms.
  const renderAlarmSections = () => {
    return (
      <View style={styles.alarmSections}>
        {/* Analog Alarms Section */}
        <View style={styles.alarmSection}>
          <View style={styles.sectionHeader}>
            <Text
              style={[
                styles.sectionTitle,
                { color: isDarkMode ? THEME.dark.text.primary : THEME.light.text.primary },
              ]}>
              Analog Alarms {severityFilter !== 'all' && `(${severityFilter})`}
            </Text>
            <Text
              style={[
                styles.sectionSubtitle,
                { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary },
              ]}>
              Continuous values with thresholds
            </Text>
          </View>
          <View style={styles.alarmGrid}>
            {filteredAnalogAlarms.map((alarm: Alarm) => (
              <View key={alarm.id} style={styles.alarmCardWrapper}>
                <View
                  style={[
                    styles.alarmCard,
                    {
                      backgroundColor: isDarkMode
                        ? getAnalogAlarmBackground(alarm)
                        : getAnalogAlarmBackground(alarm),
                      borderColor: isDarkMode
                        ? getAnalogAlarmBorder(alarm)
                        : getAnalogAlarmBorder(alarm),
                      borderLeftWidth: 4,
                    },
                  ]}>
                  <View style={styles.alarmCardTop}>
                    <Text
                      style={[
                        styles.alarmCardTitle,
                        { color: getAlarmTitleColor(alarm, isDarkMode) },
                      ]}
                      numberOfLines={2}>
                      {alarm.description}
                    </Text>
                  </View>
                  <View style={styles.alarmCardContent}>
                    <Ionicons
                      name={
                        alarm.type === 'temperature'
                          ? 'thermometer-outline'
                          : alarm.type === 'carbon'
                            ? 'flask-outline'
                            : alarm.type === 'level'
                              ? 'water-outline'
                              : 'analytics-outline'
                      }
                      size={20}
                      color={isDarkMode ? '#6B7280' : '#64748B'}
                    />
                    <View style={styles.alarmCardValues}>
                      <Text
                        style={[styles.valueText, { color: getValueTextColor(alarm, isDarkMode) }]}>
                        Value: {alarm.value}
                      </Text>
                      <Text
                        style={[
                          styles.setValue,
                          {
                            color: isDarkMode
                              ? THEME.dark.text.secondary
                              : THEME.light.text.secondary,
                          },
                        ]}>
                        (Set: {alarm.setPoint})
                      </Text>
                      <Text
                        style={[
                          styles.limitText,
                          {
                            color: isDarkMode
                              ? THEME.dark.text.secondary
                              : THEME.light.text.secondary,
                          },
                        ]}>
                        Limits: {alarm.lowLimit} - {alarm.highLimit}
                      </Text>
                      <View style={styles.timeWrapper}>
                        <Ionicons
                          name="time-outline"
                          size={10}
                          color={isDarkMode ? '#6B7280' : '#64748B'}
                        />
                        <Text
                          key={`analog-time-${alarm.id}-${refreshTimestamp}`}
                          style={[
                            styles.timeText,
                            {
                              color: isDarkMode
                                ? THEME.dark.text.secondary
                                : THEME.light.text.secondary,
                            },
                          ]}>
                          {alarm.timestamp ? formatTimestamp(alarm.timestamp) : ''}
                        </Text>
                      </View>
                    </View>
                    {/* NEW ZONE PLACEMENT for Analog Alarms */}
                    {alarm.zone && (
                      <Text
                        style={[
                          styles.zoneText,
                          {
                            color: isDarkMode
                              ? THEME.dark.text.secondary
                              : THEME.light.text.secondary,
                            marginLeft: 8, // Add spacing from the alarmCardValues
                            alignSelf: 'center', // Vertically align with other items in alarmCardContent
                          },
                        ]}>
                        {alarm.zone === 'zone1' ? 'Zone 1' : 'Zone 2'}
                      </Text>
                    )}
                  </View>
                  {renderActionButtons(alarm)}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Binary Alarms Section */}
        <View style={styles.alarmSection}>
          <View style={styles.sectionHeader}>
            <Text
              style={[
                styles.sectionTitle,
                { color: isDarkMode ? THEME.dark.text.primary : THEME.light.text.primary },
              ]}>
              Binary Alarms {severityFilter !== 'all' && `(${severityFilter})`}
            </Text>
            <Text
              style={[
                styles.sectionSubtitle,
                { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary },
              ]}>
              Status indicators (OK/Alarm)
            </Text>
          </View>
          <View style={styles.alarmGrid}>
            {filteredBinaryAlarms.map((alarm: Alarm) => (
              <View key={alarm.id} style={styles.alarmCardWrapper}>
                <View
                  style={[
                    styles.alarmCard,
                    {
                      backgroundColor: isDarkMode
                        ? getBinaryAlarmBackground(alarm)
                        : getBinaryAlarmBackground(alarm),
                      borderColor: isDarkMode
                        ? getBinaryAlarmBorder(alarm)
                        : getBinaryAlarmBorder(alarm),
                      borderLeftWidth: 4,
                    },
                  ]}>
                  <View style={styles.alarmCardTop}>
                    <Text
                      style={[
                        styles.alarmCardTitle,
                        { color: getBinaryTitleColor(alarm, isDarkMode) },
                      ]}
                      numberOfLines={2}>
                      {alarm.description}
                    </Text>
                  </View>
                  <View style={styles.alarmCardContent}>
                    <Ionicons
                      name={
                        alarm.type === 'conveyor'
                          ? 'swap-horizontal-outline'
                          : alarm.type === 'fan'
                            ? 'aperture-outline'
                            : alarm.type === 'heater'
                              ? 'flame-outline'
                              : alarm.type === 'level'
                                ? 'water-outline'
                                : 'alert-circle-outline'
                      }
                      size={20}
                      color={isDarkMode ? '#6B7280' : '#64748B'}
                    />
                    <View style={styles.alarmCardValues}>
                      <View style={styles.statusRow}>
                        <Text
                          style={[
                            styles.valueText,
                            {
                              color: isDarkMode
                                ? THEME.dark.text.secondary
                                : THEME.light.text.secondary,
                            },
                          ]}>
                          Status:{' '}
                          <Text
                            style={{
                              color: getBinaryValueColor(alarm, isDarkMode),
                              fontWeight: 'bold',
                            }}>
                            {alarm.value}
                          </Text>
                        </Text>
                        {alarm.zone && (
                          <Text
                            style={[
                              styles.zoneText,
                              {
                                color: isDarkMode
                                  ? THEME.dark.text.secondary
                                  : THEME.light.text.secondary,
                              },
                            ]}>
                            {alarm.zone === 'zone1' ? 'Zone 1' : 'Zone 2'}
                          </Text>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.setValue,
                          {
                            color: isDarkMode
                              ? THEME.dark.text.secondary
                              : THEME.light.text.secondary,
                          },
                        ]}>
                        (Expected: {alarm.setPoint})
                      </Text>
                      <View style={styles.timeWrapper}>
                        <Ionicons
                          name="time-outline"
                          size={10}
                          color={isDarkMode ? '#6B7280' : '#64748B'}
                        />
                        <Text
                          key={`binary-time-${alarm.id}-${refreshTimestamp}`}
                          style={[
                            styles.timeText,
                            {
                              color: isDarkMode
                                ? THEME.dark.text.secondary
                                : THEME.light.text.secondary,
                            },
                          ]}>
                          {alarm.timestamp ? formatTimestamp(alarm.timestamp) : ''}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {renderActionButtons(alarm)}
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  // Helper functions for dynamic alarm colors
  const getAnalogAlarmBackground = (alarm: Alarm): string => {
    switch (alarm.severity) {
      case 'critical':
        return isDarkMode
          ? 'rgba(136, 19, 55, 0.3)' // Softer dark red background
          : 'rgba(254, 226, 226, 0.6)'; // Light red with more opacity
      case 'warning':
        return isDarkMode
          ? 'rgba(234, 179, 8, 0.3)' // Softer dark yellow background
          : 'rgba(254, 243, 199, 0.6)'; // Light yellow with more opacity
      case 'info':
      default:
        return isDarkMode
          ? 'rgba(6, 95, 70, 0.2)' // Softer dark green background
          : 'rgba(220, 252, 231, 0.6)'; // Light green with more opacity
    }
  };

  const getAnalogAlarmBorder = (alarm: Alarm): string => {
    switch (alarm.severity) {
      case 'critical':
        return isDarkMode ? THEME.dark.status.critical : THEME.light.status.critical;
      case 'warning':
        return isDarkMode ? THEME.dark.status.warning : THEME.light.status.warning;
      case 'info':
      default:
        return isDarkMode ? THEME.dark.status.success : THEME.light.status.success;
    }
  };

  const getBinaryAlarmBackground = (alarm: Alarm): string => {
    switch (alarm.severity) {
      case 'critical':
        return isDarkMode ? 'rgba(136, 19, 55, 0.3)' : 'rgba(254, 226, 226, 0.6)';
      case 'info':
      default:
        return isDarkMode ? 'rgba(6, 95, 70, 0.2)' : 'rgba(220, 252, 231, 0.6)';
    }
  };

  const getBinaryAlarmBorder = (alarm: Alarm): string => {
    switch (alarm.severity) {
      case 'critical':
        return isDarkMode ? THEME.dark.status.critical : THEME.light.status.critical;
      case 'info':
      default:
        return isDarkMode ? THEME.dark.status.success : THEME.light.status.success;
    }
  };

  const getAlarmTitleColor = (alarm: Alarm, isDark: boolean): string => {
    switch (alarm.severity) {
      case 'critical':
        return isDark ? '#FCA5A5' : '#991B1B'; // Red
      case 'warning':
        return isDark ? '#FCD34D' : '#92400E'; // Yellow
      case 'info':
      default:
        return isDark ? '#6EE7B7' : '#065F46'; // Green
    }
  };

  const getBinaryTitleColor = (alarm: Alarm, isDark: boolean): string => {
    return alarm.severity === 'critical'
      ? isDark
        ? '#FCA5A5'
        : '#991B1B' // Red for critical
      : isDark
        ? '#6EE7B7'
        : '#065F46'; // Green for info
  };

  const getValueTextColor = (alarm: Alarm, isDark: boolean): string => {
    switch (alarm.severity) {
      case 'critical':
        return isDark ? '#FCA5A5' : '#991B1B'; // Red
      case 'warning':
        return isDark ? '#FCD34D' : '#92400E'; // Yellow
      case 'info':
      default:
        return isDark ? '#6EE7B7' : '#065F46'; // Green
    }
  };

  const getBinaryValueColor = (alarm: Alarm, isDark: boolean): string => {
    const isNormal = alarm.value === alarm.setPoint;
    return isDark
      ? isNormal
        ? '#6EE7B7'
        : '#FCA5A5' // More visible in dark mode
      : isNormal
        ? '#065F46'
        : '#991B1B'; // More readable in light mode
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

  // Functions are now declared at the top of the component using useCallback

  // Add admin actions section to renderSummaryCards
  const renderAdminActions = () => {
    if (authState?.user?.role !== 'ADMIN') return null;

    return (
      <View style={styles.adminActions}>
        <TouchableOpacity
          style={[
            styles.adminActionButton,
            { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' },
          ]}
          onPress={navigateToUserManagement}>
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
          style={[
            styles.adminActionButton,
            { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' },
          ]}
          onPress={navigateToSettings}>
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
    );
  };

  // Handlers are now declared at the top of the component using useCallback

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
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderTopWidth: 1,
      width: '100%',
    },
    navItem: {
      flex: 1,
      minWidth: 64,
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
    },
    navLabel: {
      fontSize: 12,
      marginTop: 4,
      textAlign: 'center',
      fontWeight: '500',
    },
    bottomNavContainer: {
      backgroundColor: 'transparent',
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
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
      justifyContent: 'flex-end',
      gap: 12,
      flexWrap: 'wrap',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: isDarkMode ? 'rgba(71, 85, 105, 0.3)' : 'rgba(203, 213, 225, 0.8)',
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 6,
      gap: 3,
      marginBottom: 4,
    },
    actionButtonText: {
      fontSize: 11,
      fontWeight: '600',
    },
    adminActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      marginBottom: 16,
      marginTop: 8,
      gap: 12,
    },
    adminActionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(203, 213, 225, 0.3)',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    actionIcon: {
      marginRight: 6,
    },
    actionText: {
      fontSize: 14,
      fontWeight: '500',
    },
    acknowledgedByContainer: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: 'rgba(156, 163, 175, 0.1)',
    },
    acknowledgedByText: {
      fontSize: 12,
      fontStyle: 'italic',
    },
    maintenanceOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    maintenanceOverlayContent: {
      padding: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: 'rgba(203, 213, 225, 0.8)',
    },
    maintenanceOverlayIconContainer: {
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
    },
    maintenanceOverlayTitle: {
      fontSize: 20,
      fontWeight: '600',
      marginBottom: 8,
    },
    maintenanceOverlayDescription: {
      fontSize: 14,
      textAlign: 'center',
    },
    maintenanceOverlayProgress: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 16,
    },
    maintenanceOverlayProgressText: {
      marginLeft: 8,
    },
  });

  const { isMaintenanceMode } = useMaintenance();

  // Add maintenance screen component
  const MaintenanceScreen = () => (
    <View
      style={[styles.maintenanceOverlay, { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' }]}>
      <View
        style={[
          styles.maintenanceOverlayContent,
          {
            backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: isDarkMode ? '#374151' : '#E5E7EB',
          },
        ]}>
        <View
          style={[
            styles.maintenanceOverlayIconContainer,
            { backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)' },
          ]}>
          <Ionicons name="construct-outline" size={80} color={isDarkMode ? '#F87171' : '#EF4444'} />
        </View>

        <Text
          style={[styles.maintenanceOverlayTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
          Under Maintenance
        </Text>

        <Text
          style={[
            styles.maintenanceOverlayDescription,
            { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
          ]}>
          The system is currently under maintenance. Please check back later.
        </Text>

        <View style={styles.maintenanceOverlayProgress}>
          <ActivityIndicator size="large" color={isDarkMode ? '#F87171' : '#EF4444'} />
          <Text
            style={[
              styles.maintenanceOverlayProgressText,
              { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
            ]}>
            Please wait...
          </Text>
        </View>
      </View>
    </View>
  );

  // Show maintenance screen for non-admin users when maintenance mode is active
  if (isMaintenanceMode && !isAdmin) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' }]}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <MaintenanceScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      {/* Enhanced Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(248, 250, 252, 0.95)',
            borderBottomColor: isDarkMode ? 'rgba(51, 65, 85, 0.3)' : 'rgba(226, 232, 240, 0.8)',
          },
        ]}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.logoContainer,
              {
                backgroundColor: isDarkMode
                  ? 'rgba(59, 130, 246, 0.15)'
                  : 'rgba(59, 130, 246, 0.1)',
              },
            ]}>
            <Image
              source={require('../../../assets/images/icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.titleContainer}>
            <Text
              style={[
                styles.headerTitle,
                {
                  color: isDarkMode ? '#F8FAFC' : '#1E293B',
                },
              ]}>
              Eagle Notifier
            </Text>
            <Text
              style={[
                styles.headerSubtitle,
                {
                  color: isDarkMode ? '#94A3B8' : '#64748B',
                },
              ]}>
              {isAdmin ? 'Admin Dashboard' : 'Operator Dashboard'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.headerButton,
              {
                backgroundColor: isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(241, 245, 249, 0.8)',
              },
            ]}
            onPress={() => router.push('/notifications')}>
            <Ionicons
              name="notifications-outline"
              size={22}
              color={isDarkMode ? '#94A3B8' : '#475569'}
            />
            {unreadNotifications > 0 && (
              <View
                style={[
                  styles.notificationBadge,
                  {
                    backgroundColor: isDarkMode ? '#EF4444' : '#DC2626',
                  },
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
              {
                backgroundColor: isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(241, 245, 249, 0.8)',
              },
            ]}
            onPress={toggleTheme}>
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
            onPress={handleRefresh}>
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
          }>
          {/* Status Summary */}
          {renderSummaryCards()}

          {/* Admin Actions */}
          {renderAdminActions()}

          {/* Alarm Sections */}
          {renderAlarmSections()}

          {/* Last updated text */}
          <Text
            key={`last-updated-${refreshTimestamp}`}
            style={[styles.lastUpdatedText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Last updated: {formatTimestamp(new Date().toISOString())}
          </Text>
          <Text style={[styles.updateInfoText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            {isTestUser ? scadaInterval : ''}
          </Text>
          <Text style={[styles.updateInfoText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Data refreshes every{' '}
            {scadaInterval < 60000 ? scadaInterval / 1000 : scadaInterval / 60000}{' '}
            {scadaInterval < 60000 ? 'seconds' : 'minutes'}
          </Text>
        </ScrollView>
      )}

      {/* Bottom Navigation */}
      <SafeAreaView
        edges={['bottom']}
        style={[
          styles.bottomNavContainer,
          { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' },
        ]}>
        <View
          style={[
            styles.bottomNav,
            {
              backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
              borderTopColor: isDarkMode ? '#374151' : '#E5E7EB',
            },
          ]}>
          {[
            {
              name: 'Dashboard',
              icon: 'home',
              route: '/(dashboard)/operator/',
              active: true,
            },
            {
              name: 'Analytics',
              icon: 'analytics-outline',
              route: '/(dashboard)/analytics',
              active: false,
            },
            {
              name: 'History',
              icon: 'alarm-outline',
              route: '/(dashboard)/alarms/history',
              active: false,
            },
            {
              name: 'Reports',
              icon: 'document-text-outline',
              route: '/(dashboard)/reports',
              active: false,
            },
            {
              name: 'Settings',
              icon: 'settings-outline',
              route: '/(dashboard)/profile',
              active: false,
            },
          ].map((item, index) => (
            <TouchableOpacity
              key={item.name}
              style={styles.navItem}
              onPress={() => router.push(item.route as any)}
              accessibilityRole="button"
              accessibilityLabel={item.name}>
              <Ionicons
                name={item.icon as any}
                size={22}
                color={
                  item.active
                    ? isDarkMode
                      ? '#60A5FA'
                      : '#2563EB'
                    : isDarkMode
                      ? '#9CA3AF'
                      : '#6B7280'
                }
              />
              <Text
                style={[
                  styles.navLabel,
                  {
                    color: item.active
                      ? isDarkMode
                        ? '#60A5FA'
                        : '#2563EB'
                      : isDarkMode
                        ? '#9CA3AF'
                        : '#6B7280',
                  },
                ]}
                numberOfLines={1}>
                {item.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {/* Alarm Details Modal */}
      <AlarmDetails
        alarm={selectedAlarm}
        visible={detailsVisible}
        onClose={handleCloseDetails}
        onAcknowledge={
          selectedAlarm?.status === 'active' ? () => handleAcknowledge(selectedAlarm.id) : undefined
        }
        onResolve={
          selectedAlarm?.status === 'active' || selectedAlarm?.status === 'acknowledged'
            ? () => handleResolve(selectedAlarm.id)
            : undefined
        }
      />

      {/* Add Resolution Modal */}
      <ResolutionModal
        visible={resolutionModalVisible}
        onClose={() => {
          setResolutionModalVisible(false);
          setSelectedAlarmForResolution(null);
        }}
        onSubmit={handleResolutionSubmit}
        alarmDescription={selectedAlarmForResolution?.description || ''}
      />

      {/* Setpoint Config Modal - Only render for admin */}
      {isAdmin && (
        <SetpointConfigModal
          visible={setpointModalVisible}
          onClose={() => {
            setSetpointModalVisible(false);
            setSelectedSetpoint(null);
          }}
          onSubmit={handleSetpointUpdate}
          setpoint={selectedSetpoint}
          isSubmitting={updateSetpointMutation.isPending}
        />
      )}
    </SafeAreaView>
  );
} 