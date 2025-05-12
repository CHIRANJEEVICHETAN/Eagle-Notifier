import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Image,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { AlarmCard } from '../../components/AlarmCard';
import { AlarmDetails } from '../../components/AlarmDetails';
import { useActiveAlarms, useUpdateAlarmStatus } from '../../hooks/useAlarms';
import { Alarm, AlarmType, AlarmSeverity, AlarmStatus } from '../../types/alarm';

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

// Add these constants for consistent spacing
const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_PADDING = 16;
const CARD_MARGIN = 8;
const CARD_WIDTH = (SCREEN_WIDTH - (SCREEN_PADDING * 2) - (CARD_MARGIN * 2));

// Animation Constants
const SCALE_ANIMATION_CONFIG = {
  duration: 200,
  useNativeDriver: true,
};

interface ExtendedAlarm extends Omit<Alarm, 'setPoint' | 'lowLimit' | 'highLimit'> {
  unit?: string;
  setPoint?: string;
  lowLimit?: string | number;
  highLimit?: string | number;
  zone?: 'zone1' | 'zone2';
}

const sampleAnalogAlarms: ExtendedAlarm[] = [
  {
    id: 'analog-1',
    description: 'HARDENING ZONE 1 TEMPERATURE (LOW/HIGH)',
    severity: 'warning' as AlarmSeverity,
    status: 'active' as AlarmStatus,
    type: 'temperature' as AlarmType,
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
    severity: 'critical' as AlarmSeverity,
    status: 'active' as AlarmStatus,
    type: 'temperature' as AlarmType,
    value: '895',
    unit: '°C',
    setPoint: '880°C (-10/+10)',
    lowLimit: '870°C',
    highLimit: '890°C',
    timestamp: new Date().toISOString(),
    zone: 'zone2'
  },
  {
    id: 'binary-1',
    description: 'HARDENING CONVEYOR (NOT ROTATING)',
    severity: 'warning' as AlarmSeverity,
    status: 'active' as AlarmStatus,
    type: 'conveyor' as AlarmType,
    value: 'NOT ROTATING',
    setPoint: 'Rotating',
    timestamp: new Date().toISOString()
  },
  {
    id: 'binary-2',
    description: 'OIL QUENCH CONVEYOR (NOT ROTATING)',
    severity: 'critical' as AlarmSeverity,
    status: 'active' as AlarmStatus,
    type: 'conveyor' as AlarmType,
    value: 'NOT ROTATING',
    setPoint: 'Rotating',
    timestamp: new Date().toISOString()
  }
];

export default function AdminDashboard() {
  const { isDarkMode, toggleTheme } = useTheme();
  const { authState, logout } = useAuth();
  const router = useRouter();
  
  const { data: activeAlarms, isLoading, isError, error, refetch } = useActiveAlarms();
  
  const [selectedAlarm, setSelectedAlarm] = useState<Alarm | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const updateAlarmStatus = useUpdateAlarmStatus();
  
  // Add animation state for cards
  const [cardScales] = useState(() => 
    new Map<string, Animated.Value>(
      (activeAlarms || []).map(alarm => 
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

  const handlePressIn = useCallback((id: string) => {
    animateCard(id, 0.95);
  }, [animateCard]);

  const handlePressOut = useCallback((id: string) => {
    animateCard(id, 1);
  }, [animateCard]);

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
  
  // Navigate to user management
  const navigateToUserManagement = () => {
    router.push("/admin/users" as any);
  };
  
  // Navigate to system settings
  const navigateToSettings = () => {
    router.push("/admin/setpoints" as any);
  };
  
  // Handle acknowledge for the selected alarm
  const handleSelectedAcknowledge = useCallback(() => {
    if (selectedAlarm) {
      handleAcknowledge(selectedAlarm.id);
    }
  }, [selectedAlarm, handleAcknowledge]);

  // Handle resolve for the selected alarm
  const handleSelectedResolve = useCallback(() => {
    if (selectedAlarm) {
      handleResolve(selectedAlarm.id);
    }
  }, [selectedAlarm, handleResolve]);
  
  // Helper functions for alarm colors
  const getAnalogAlarmBackground = (alarm: any): string => {
    const value = parseFloat(alarm.value);
    const lowLimit = alarm.lowLimit && alarm.lowLimit !== '-' ? parseFloat(alarm.lowLimit) : null;
    const highLimit = alarm.highLimit && alarm.highLimit !== '-' ? parseFloat(alarm.highLimit) : null;
    
    if ((lowLimit !== null && value < lowLimit) || (highLimit !== null && value > highLimit)) {
      return isDarkMode ? 
        'rgba(220, 38, 38, 0.1)' :    // Softer red background in dark mode
        'rgba(254, 226, 226, 0.8)';   // Light red with more opacity
    }
    return isDarkMode ? 
      'rgba(5, 150, 105, 0.1)' :    // Softer green background in dark mode
      'rgba(209, 250, 229, 0.8)';   // Light green with more opacity
  };

  const getAlarmBorderColor = (alarm: any): string => {
    const value = parseFloat(alarm.value);
    const lowLimit = alarm.lowLimit && alarm.lowLimit !== '-' ? parseFloat(alarm.lowLimit) : null;
    const highLimit = alarm.highLimit && alarm.highLimit !== '-' ? parseFloat(alarm.highLimit) : null;
    
    if ((lowLimit !== null && value < lowLimit) || (highLimit !== null && value > highLimit)) {
      return isDarkMode ? '#EF4444' : '#DC2626'; // Brighter red in dark mode
    }
    return isDarkMode ? '#10B981' : '#059669';   // Brighter green in dark mode
  };

  const renderAlarmCard = (alarm: ExtendedAlarm) => {
    const scale = cardScales.get(alarm.id) || new Animated.Value(1);
    
    // Determine if it's a binary/conveyor alarm or an analog alarm
    const isBinaryAlarm = alarm.type === 'conveyor' || alarm.type === 'fan' || alarm.type === 'level';
    
    return (
      <Animated.View 
        key={alarm.id}
        style={[
          styles.alarmCard,
          {
            transform: [{ scale }],
            backgroundColor: getAnalogAlarmBackground(alarm),
            borderColor: getAlarmBorderColor(alarm),
          }
        ]}
      >
        <TouchableOpacity
          style={styles.cardTouchable}
          onPressIn={() => handlePressIn(alarm.id)}
          onPressOut={() => handlePressOut(alarm.id)}
          onPress={() => handleAlarmPress(alarm.id)}
        >
          <View style={styles.cardHeader}>
            <Text style={[
              styles.alarmTitle,
              { color: isDarkMode ? THEME.dark.text.primary : THEME.light.text.primary }
            ]} numberOfLines={2}>
              {alarm.description}
            </Text>
          </View>

          <View style={styles.cardContent}>
            <View style={styles.valueContainer}>
              <Ionicons 
                name={
                  alarm.type === 'temperature' ? 'thermometer-outline' : 
                  alarm.type === 'carbon' ? 'flask-outline' :
                  alarm.type === 'level' ? 'water-outline' :
                  alarm.type === 'heater' ? 'flame-outline' :
                  alarm.type === 'fan' ? 'aperture-outline' :
                  alarm.type === 'conveyor' ? 'git-network-outline' :
                  'analytics-outline'
                }
                size={24}
                color={isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary}
              />
              <View style={styles.valueTextContainer}>
                {isBinaryAlarm ? (
                  // Binary alarm display (conveyor, fan, etc.)
                  <>
                    <Text style={[
                      styles.valueText,
                      { 
                        color: isDarkMode ? 
                          (alarm.value === alarm.setPoint ? '#6EE7B7' : '#FCA5A5') : 
                          (alarm.value === alarm.setPoint ? '#065F46' : '#991B1B')
                      }
                    ]}>
                      Status: {alarm.value}
                    </Text>
                    <Text style={[
                      styles.setpointText,
                      { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }
                    ]}>
                      Expected: {alarm.setPoint}
                    </Text>
                  </>
                ) : (
                  // Analog alarm display (temperature, carbon, etc.)
                  <>
                    <Text style={[
                      styles.valueText,
                      { color: isDarkMode ? THEME.dark.text.primary : THEME.light.text.primary }
                    ]}>
                      Value: {alarm.value}{alarm.unit || ''}
                    </Text>
                    <Text style={[
                      styles.setpointText,
                      { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }
                    ]}>
                      {alarm.type === 'temperature' ? `Setpoint: ${alarm.setPoint}` : `Expected: ${alarm.setPoint}`}
                    </Text>
                    {alarm.lowLimit && alarm.highLimit && (
                      <Text style={[
                        styles.limitsText,
                        { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }
                      ]}>
                        Limits: {alarm.lowLimit} - {alarm.highLimit}
                      </Text>
                    )}
                  </>
                )}
              </View>
            </View>

            <View style={styles.cardFooter}>
              <View style={styles.timestampContainer}>
                <Ionicons 
                  name="time-outline" 
                  size={14}
                  color={isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary}
                />
                <Text style={[
                  styles.timestampText,
                  { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }
                ]}>
                  {new Date(alarm.timestamp).toLocaleTimeString()}
                </Text>
              </View>
              {alarm.zone && (
                <View style={styles.zoneContainer}>
                  <Text style={[
                    styles.zoneText,
                    { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }
                  ]}>
                    {alarm.zone === 'zone1' ? 'Zone 1' : 'Zone 2'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };
  
  // Filter alarms by type - keep only the 3 key alarms
  const filteredAlarms = (activeAlarms as ExtendedAlarm[] || sampleAnalogAlarms).filter(alarm => 
    [
      'HARDENING ZONE 1 TEMPERATURE',
      'HARDENING ZONE 2 TEMPERATURE',
      'HARDENING CONVEYOR',
      'OIL QUENCH CONVEYOR'
    ].some(name => (alarm.description || '').toUpperCase().includes(name))
  );
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? THEME.dark.background : THEME.light.background }]}>
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
              { color: isDarkMode ? THEME.dark.text.primary : THEME.light.text.primary }
            ]}>
              Eagle Notifier
            </Text>
            <Text style={[
              styles.headerSubtitle,
              { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }
            ]}>
              Admin Dashboard
            </Text>
          </View>
        </View>
        
        <View style={styles.headerActions}>
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
              color={isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary}
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.headerButton,
              { backgroundColor: isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(241, 245, 249, 0.8)' }
            ]}
            onPress={logout}
          >
            <Ionicons 
              name="log-out-outline" 
              size={22}
              color={isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary}
            />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Quick Actions with fixed width */}
      <View style={styles.quickActionsContainer}>
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={[
              styles.actionButton,
              { 
                backgroundColor: isDarkMode ? THEME.dark.cardBg : THEME.light.cardBg,
                borderColor: isDarkMode ? THEME.dark.border : THEME.light.border,
              }
            ]}
            onPress={navigateToUserManagement}
          >
            <View style={styles.actionIcon}>
              <Ionicons
                name="people-outline"
                size={22}
                color={isDarkMode ? THEME.dark.text.accent : THEME.light.text.accent}
              />
            </View>
            <Text style={[
              styles.actionText,
              { color: isDarkMode ? THEME.dark.text.primary : THEME.light.text.primary }
            ]}>
              Manage Users
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.actionButton,
              { 
                backgroundColor: isDarkMode ? THEME.dark.cardBg : THEME.light.cardBg,
                borderColor: isDarkMode ? THEME.dark.border : THEME.light.border,
              }
            ]}
            onPress={navigateToSettings}
          >
            <View style={styles.actionIcon}>
              <Ionicons
                name="settings-outline"
                size={22}
                color={isDarkMode ? THEME.dark.text.accent : THEME.light.text.accent}
              />
            </View>
            <Text style={[
              styles.actionText,
              { color: isDarkMode ? THEME.dark.text.primary : THEME.light.text.primary }
            ]}>
              System Settings
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Main Content */}
      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDarkMode ? THEME.dark.accent : THEME.light.accent} />
          <Text style={[
            styles.loadingText,
            { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }
          ]}>
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
          <Text style={[
            styles.errorTitle,
            { color: isDarkMode ? THEME.dark.text.primary : THEME.light.text.primary }
          ]}>
            Error Loading Alarms
          </Text>
          <Text style={[
            styles.errorMessage,
            { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }
          ]}>
            {error instanceof Error ? error.message : 'Failed to load alarms'}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: isDarkMode ? THEME.dark.accent : THEME.light.accent }]}
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
              colors={[THEME.light.accent]}
              tintColor={isDarkMode ? THEME.dark.accent : THEME.light.accent}
            />
          }
        >
          {/* Status Summary */}
          <View style={styles.summaryContainer}>
            <View style={[
              styles.summaryCardItem,
              { backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : '#FFFFFF' }
            ]}>
              <View style={[styles.summaryIcon, { backgroundColor: isDarkMode ? '#881337' : '#FEE2E2' }]}>
                <Ionicons name="alert-circle" size={16} color={isDarkMode ? '#FCA5A5' : '#991B1B'} />
              </View>
              <Text style={[
                styles.summaryCount,
                { color: isDarkMode ? '#FCA5A5' : '#991B1B' }
              ]}>
                {filteredAlarms.filter(a => a.severity === 'critical' && a.status === 'active').length || 2}
              </Text>
              <Text style={[
                styles.summaryLabel,
                { color: isDarkMode ? '#FCA5A5' : '#991B1B' }
              ]}>
                Critical
              </Text>
            </View>
            
            <View style={[
              styles.summaryCardItem,
              { backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : '#FFFFFF' }
            ]}>
              <View style={[styles.summaryIcon, { backgroundColor: isDarkMode ? '#B45309' : '#FEF3C7' }]}>
                <Ionicons name="warning" size={16} color={isDarkMode ? '#FCD34D' : '#92400E'} />
              </View>
              <Text style={[
                styles.summaryCount,
                { color: isDarkMode ? '#FCD34D' : '#92400E' }
              ]}>
                {filteredAlarms.filter(a => a.severity === 'warning' && a.status === 'active').length || 3}
              </Text>
              <Text style={[
                styles.summaryLabel,
                { color: isDarkMode ? '#FCD34D' : '#92400E' }
              ]}>
                Warning
              </Text>
            </View>
            
            <View style={[
              styles.summaryCardItem,
              { backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : '#FFFFFF' }
            ]}>
              <View style={[styles.summaryIcon, { backgroundColor: isDarkMode ? '#1E3A8A' : '#DBEAFE' }]}>
                <Ionicons name="information-circle" size={16} color={isDarkMode ? '#93C5FD' : '#1E40AF'} />
              </View>
              <Text style={[
                styles.summaryCount,
                { color: isDarkMode ? '#93C5FD' : '#1E40AF' }
              ]}>
                {filteredAlarms.filter(a => a.severity === 'info' && a.status === 'active').length || 0}
              </Text>
              <Text style={[
                styles.summaryLabel,
                { color: isDarkMode ? '#93C5FD' : '#1E40AF' }
              ]}>
                Info
              </Text>
            </View>
          </View>
          
          {/* Active Alarms Section */}
          <View style={styles.alarmsContainer}>
            <View style={[
              styles.sectionHeader,
              {
                backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.6)' : 'rgba(241, 245, 249, 0.8)',
                borderLeftColor: isDarkMode ? '#3B82F6' : '#2563EB',
              }
            ]}>
              <Text style={[
                styles.sectionTitle,
                { color: isDarkMode ? THEME.dark.text.primary : THEME.light.text.primary }
              ]}>
                Active Alarms
              </Text>
              <Text style={[
                styles.sectionSubtitle,
                { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }
              ]}>
                Requires immediate attention
              </Text>
            </View>
            
            {filteredAlarms.length > 0 ? (
              <View style={styles.alarmsList}>
                {sampleAnalogAlarms.map(alarm => renderAlarmCard(alarm))}
              </View>
            ) : (
              <View style={[
                styles.emptyState,
                { 
                  backgroundColor: isDarkMode ? THEME.dark.cardBg : THEME.light.cardBg,
                  borderColor: isDarkMode ? THEME.dark.border : THEME.light.border,
                }
              ]}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={48}
                  color={isDarkMode ? '#4ADE80' : '#22C55E'}
                />
                <Text style={[
                  styles.emptyStateText,
                  { color: isDarkMode ? THEME.dark.text.primary : THEME.light.text.primary }
                ]}>
                  All Clear
                </Text>
                <Text style={[
                  styles.emptyStateSubtext,
                  { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }
                ]}>
                  No active alarms at the moment
                </Text>
              </View>
            )}
          </View>
          
          {/* Last Updated Info */}
          <View style={styles.lastUpdatedContainer}>
            <Text style={[styles.lastUpdatedText, { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }]}>
              Last updated: {new Date().toLocaleTimeString()}
            </Text>
            <Text style={[styles.updateInfoText, { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }]}>
              Data refreshes every 5 minutes
            </Text>
          </View>
        </ScrollView>
      )}
      
      {/* Alarm Details Modal */}
      <AlarmDetails
        alarm={selectedAlarm}
        visible={detailsVisible}
        onClose={handleCloseDetails}
        onAcknowledge={selectedAlarm?.status === 'active' ? handleSelectedAcknowledge : undefined}
        onResolve={selectedAlarm?.status !== 'resolved' ? handleSelectedResolve : undefined}
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
    marginBottom: 8,
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
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 32,
    height: 32,
  },
  titleContainer: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginBottom: 0,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionIcon: {
    marginRight: 8,
    width: 22,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    textAlign: 'left',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 0,
    paddingHorizontal: 12,
    marginHorizontal: 0,
    gap: 6,
  },
  summaryCardItem: {
    width: '31%',
    borderRadius: 8,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 3,
  },
  summaryCount: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 1,
    textAlign: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  alarmsContainer: {
    paddingHorizontal: 12,
    marginBottom: 16,
    marginTop: 10,
  },
  sectionHeader: {
    marginBottom: 12,
    paddingTop: 6,
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    opacity: 0.8,
  },
  alarmsList: {
    marginTop: 16,
    paddingBottom: 8,
  },
  alarmCard: {
    width: '100%',
    borderRadius: 12,
    borderLeftWidth: 4,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginTop: 8,
    minHeight: 160,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardTouchable: {
    padding: 16,
    height: '100%',
  },
  cardHeader: {
    marginBottom: 12,
    minHeight: 44,
  },
  alarmTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  cardContent: {
    gap: 12,
    flex: 1,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    padding: 12,
    borderRadius: 8,
    minHeight: 80,
  },
  valueTextContainer: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  valueText: {
    fontSize: 15,
    fontWeight: '500',
  },
  setpointText: {
    fontSize: 13,
  },
  limitsText: {
    fontSize: 13,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  timestampText: {
    fontSize: 12,
  },
  zoneContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  zoneText: {
    fontSize: 12,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingVertical: 24,
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  lastUpdatedContainer: {
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: SCREEN_PADDING,
  },
  lastUpdatedText: {
    fontSize: 14,
    fontWeight: '500',
  },
  updateInfoText: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.8,
  },
}); 