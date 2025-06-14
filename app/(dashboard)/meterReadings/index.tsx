import React, { useCallback, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { LineChart } from 'react-native-chart-kit';
import { useQueryClient } from '@tanstack/react-query';
import { 
  useLatestMeterReading, 
  useMeterHistory, 
  useMeterLimits, 
  MeterReading,
  MeterLimit
} from '../../hooks/useMeterReadings';
import { useUnreadCount } from '../../hooks/useNotifications';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function MeterReadingsScreen() {
  // Theme and Auth Context
  const { isDarkMode, toggleTheme } = useTheme();
  const { authState } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAdmin = authState?.user?.role === 'ADMIN';
  
  // UI State
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<number>(1); // Default 1 hour
  
  // Get unread notifications count
  const { data: unreadCount = 0 } = useUnreadCount();

  // Fetch data using custom hooks
  const { 
    data: latestReadingData, 
    isLoading: isLatestLoading, 
    isError: isLatestError,
    error: latestError,
    refetch: refetchLatest
  } = useLatestMeterReading();

  const { 
    data: historyData, 
    isLoading: isHistoryLoading,
    isError: isHistoryError,
    refetch: refetchHistory
  } = useMeterHistory(selectedTimeframe);

  const { 
    data: limitsData,
    isLoading: isLimitsLoading,
    refetch: refetchLimits
  } = useMeterLimits();

  // Add safe number formatting function at the top of the component
  const formatNumber = (value: number | undefined | null, decimals: number = 1): string => {
    if (value === undefined || value === null || isNaN(value)) {
      return '-';
    }
    // Use Math.round to handle the decimal places instead of toFixed
    const factor = Math.pow(10, decimals);
    return String(Math.round(value * factor) / factor);
  };

  // Format meter parameters for display
  const meterParameters = useMemo(() => {
    if (!latestReadingData) return [];

    return [
      { 
        id: 'voltage', 
        name: 'Voltage', 
        value: latestReadingData.voltage, 
        unit: 'V',
        icon: 'flash-outline',
        color: isDarkMode ? '#F59E0B' : '#D97706'
      },
      { 
        id: 'current', 
        name: 'Current', 
        value: latestReadingData.current, 
        unit: 'A',
        icon: 'repeat-outline',
        color: isDarkMode ? '#3B82F6' : '#2563EB' 
      },
      { 
        id: 'frequency', 
        name: 'Frequency', 
        value: latestReadingData.frequency, 
        unit: 'Hz',
        icon: 'pulse-outline',
        color: isDarkMode ? '#10B981' : '#059669'
      },
      { 
        id: 'pf', 
        name: 'Power Factor', 
        value: latestReadingData.pf, 
        unit: '',
        icon: 'options-outline',
        color: isDarkMode ? '#8B5CF6' : '#7C3AED'
      },
      { 
        id: 'energy', 
        name: 'Energy', 
        value: latestReadingData.energy, 
        unit: 'kWh',
        icon: 'battery-charging-outline',
        color: isDarkMode ? '#EC4899' : '#DB2777'
      },
      { 
        id: 'power', 
        name: 'Power', 
        value: latestReadingData.power, 
        unit: 'kW',
        icon: 'flash',
        color: isDarkMode ? '#F97316' : '#EA580C'
      },
    ];
  }, [latestReadingData, isDarkMode]);

  // Process chart data
  const chartData = useMemo(() => {
    if (!historyData || historyData.length === 0) {
      return null;
    }
    
    // Sort by timestamp ascending for chart
    const sortedData = [...historyData].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Extract data for chart
    return {
      labels: sortedData.map(d => {
        const date = new Date(d.created_at);
        return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
      }).filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / 6)) === 0), // Show ~6 labels
      datasets: [
        {
          data: sortedData.map(d => d.voltage),
          color: () => isDarkMode ? '#F59E0B' : '#D97706', // Amber
          strokeWidth: 2
        },
        {
          data: sortedData.map(d => d.current),
          color: () => isDarkMode ? '#3B82F6' : '#2563EB', // Blue
          strokeWidth: 2
        },
        {
          data: sortedData.map(d => d.frequency),
          color: () => isDarkMode ? '#10B981' : '#059669', // Green
          strokeWidth: 2
        },
        {
          data: sortedData.map(d => d.pf * 100), // Scale PF for visibility
          color: () => isDarkMode ? '#8B5CF6' : '#7C3AED', // Purple
          strokeWidth: 2
        },
        {
          data: sortedData.map(d => d.power),
          color: () => isDarkMode ? '#F97316' : '#EA580C', // Orange
          strokeWidth: 2
        },
      ],
      legend: ['Voltage', 'Current', 'Frequency', 'PF', 'Power']
    };
  }, [historyData, isDarkMode]);

  // Refresh all data
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchLatest(),
        refetchHistory(),
        refetchLimits()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refetchLatest, refetchHistory, refetchLimits]);

  // Set up auto-refresh every 3 minutes
  useEffect(() => {
    const intervalId = setInterval(() => {
      refetchLatest();
      refetchHistory();
    }, 3 * 60 * 1000); // 3 minutes
    
    return () => clearInterval(intervalId);
  }, [refetchLatest, refetchHistory]);

  // Handle parameter card press (admin only)
  const handleParameterPress = useCallback((parameterId: string) => {
    if (!isAdmin) return;
    
    const limit = limitsData?.find(l => l.parameter === parameterId);
    if (!limit) return;
    
    Alert.alert(
      `${limit.description} Limits`,
      `Current High Limit: ${limit.highLimit} ${limit.unit}\n${
        limit.lowLimit !== null ? `Current Low Limit: ${limit.lowLimit} ${limit.unit}` : 'No Low Limit set'
      }`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Configure", 
          onPress: () => router.push({
            pathname: `/(dashboard)/screens/admin/meter-limits/${limit.id}` as any
          })
        }
      ]
    );
  }, [isAdmin, limitsData, router]);

  // Check if a value exceeds its limit
  const isValueExceeded = (value: number, parameter: string, limits: MeterLimit[] | undefined): boolean => {
    if (!limits) return false;
    const limit = limits.find(l => l.parameter === parameter);
    return limit ? value > limit.highLimit : false;
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      {/* Header */}
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
                  ? 'rgba(16, 185, 129, 0.15)'
                  : 'rgba(16, 185, 129, 0.1)',
              },
            ]}>
            <Ionicons
              name="speedometer-outline"
              size={24}
              color={isDarkMode ? '#6EE7B7' : '#10B981'}
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
              Meter Notifier
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
            {unreadCount > 0 && (
              <View
                style={[
                  styles.notificationBadge,
                  {
                    backgroundColor: isDarkMode ? '#10B981' : '#059669',
                  },
                ]}>
                <Text style={styles.notificationBadgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
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
            onPress={() => router.push('/(dashboard)/operator')}>
            <Ionicons
              name="flame-outline"
              size={22}
              color={isDarkMode ? '#F87171' : '#EF4444'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerButton,
              {
                backgroundColor: isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(241, 245, 249, 0.8)',
              },
            ]}
            onPress={() => toggleTheme()}>
            <Ionicons
              name={isDarkMode ? 'sunny-outline' : 'moon-outline'}
              size={22}
              color={isDarkMode ? '#94A3B8' : '#475569'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      {isLatestLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDarkMode ? '#6EE7B7' : '#10B981'} />
          <Text style={[styles.loadingText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Loading meter readings...
          </Text>
        </View>
      ) : isLatestError ? (
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={64}
            color={isDarkMode ? '#F87171' : '#EF4444'}
          />
          <Text style={[styles.errorTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            Error Loading Meter Data
          </Text>
          <Text style={[styles.errorMessage, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            {latestError instanceof Error ? latestError.message : 'Failed to load meter data'}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: isDarkMode ? '#10B981' : '#059669' }]}
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
              colors={['#10B981']}
              tintColor={isDarkMode ? '#6EE7B7' : '#10B981'}
            />
          }>
          {/* Live Parameters Grid */}
          <View style={styles.sectionHeader}>
            <Text
              style={[
                styles.sectionTitle,
                { color: isDarkMode ? '#F8FAFC' : '#1E293B' },
              ]}>
              Live Meter Readings
            </Text>
            <Text
              style={[
                styles.sectionSubtitle,
                { color: isDarkMode ? '#94A3B8' : '#64748B' },
              ]}>
              Last updated: {latestReadingData ? new Date(latestReadingData.created_at).toLocaleTimeString() : 'N/A'}
            </Text>
          </View>

          <View style={styles.parametersGrid}>
            {meterParameters.map((param) => (
              <TouchableOpacity
                key={param.id}
                style={[
                  styles.parameterCard,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                  },
                ]}
                onPress={() => handleParameterPress(param.id)}
                disabled={!isAdmin}
              >
                <View
                  style={[
                    styles.paramIconContainer,
                    {
                      backgroundColor: `${param.color}20`, // 20% opacity
                    },
                  ]}>
                  <Ionicons name={param.icon as any} size={24} color={param.color} />
                </View>
                <Text
                  style={[
                    styles.paramName,
                    { color: isDarkMode ? '#94A3B8' : '#64748B' },
                  ]}>
                  {param.name}
                </Text>
                <Text
                  style={[
                    styles.paramValue,
                    { color: isDarkMode ? '#F8FAFC' : '#1E293B' },
                  ]}>
                  {param.value} {param.unit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Timeframe Selector */}
          <View style={styles.timeframeContainer}>
            {[
              { value: 1, label: '1 Hour' },
              { value: 6, label: '6 Hours' },
              { value: 24, label: '24 Hours' },
            ].map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.timeframeButton,
                  selectedTimeframe === option.value && styles.timeframeSelected,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                    borderColor:
                      selectedTimeframe === option.value
                        ? isDarkMode ? '#6EE7B7' : '#10B981'
                        : isDarkMode ? '#334155' : '#E2E8F0',
                  },
                ]}
                onPress={() => setSelectedTimeframe(option.value)}>
                <Text
                  style={[
                    styles.timeframeButtonText,
                    {
                      color:
                        selectedTimeframe === option.value
                          ? isDarkMode ? '#6EE7B7' : '#10B981'
                          : isDarkMode ? '#94A3B8' : '#64748B',
                    },
                  ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Chart Section */}
          <View style={styles.chartSection}>
            <View style={styles.sectionHeader}>
              <Text style={[
                styles.sectionTitle,
                { color: isDarkMode ? '#F8FAFC' : '#1E293B' },
              ]}>
                Parameter History
              </Text>
            </View>
            
            {isHistoryLoading ? (
              <View style={styles.chartLoadingContainer}>
                <ActivityIndicator size="large" color={isDarkMode ? '#6EE7B7' : '#10B981'} />
                <Text style={{ color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 8 }}>Loading chart data...</Text>
              </View>
            ) : chartData ? (
              <View style={styles.chartContainer}>
                <LineChart
                  data={chartData}
                  width={SCREEN_WIDTH - 40}
                  height={220}
                  chartConfig={{
                    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                    backgroundGradientFrom: isDarkMode ? '#1E293B' : '#FFFFFF',
                    backgroundGradientTo: isDarkMode ? '#1E293B' : '#FFFFFF',
                    decimalPlaces: 1,
                    color: (opacity = 1) => isDarkMode ? `rgba(248, 250, 252, ${opacity})` : `rgba(30, 41, 59, ${opacity})`,
                    labelColor: (opacity = 1) => isDarkMode ? `rgba(148, 163, 184, ${opacity})` : `rgba(100, 116, 139, ${opacity})`,
                    style: {
                      borderRadius: 16,
                    },
                    propsForDots: {
                      r: "4",
                      strokeWidth: "1",
                    },
                  }}
                  bezier
                  style={{
                    marginVertical: 8,
                    borderRadius: 16,
                  }}
                  withDots={false}
                  withInnerLines={false}
                  withOuterLines={true}
                  withShadow={false}
                  yAxisInterval={1}
                  yLabelsOffset={10}
                />
                
                {/* Legend */}
                <View style={styles.chartLegend}>
                  {chartData.legend.map((label, index) => (
                    <View key={label} style={styles.legendItem}>
                      <View
                        style={[
                          styles.legendColor,
                          {
                            backgroundColor: chartData.datasets[index].color(),
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.legendText,
                          { color: isDarkMode ? '#94A3B8' : '#64748B' },
                        ]}>
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.noDataContainer}>
                <Ionicons name="analytics-outline" size={48} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
                <Text style={{ color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 8 }}>No historical data available</Text>
              </View>
            )}
          </View>

          {/* Recent Readings Table */}
          <View style={styles.recentReadingsSection}>
            <View style={styles.sectionHeader}>
              <Text style={[
                styles.sectionTitle,
                { color: isDarkMode ? '#F8FAFC' : '#1E293B' },
              ]}>
                Recent Readings
              </Text>
            </View>
            
            {/* Table Header */}
            <View
              style={[
                styles.tableHeader,
                { backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(241, 245, 249, 0.8)' },
              ]}>
              <Text style={[styles.tableHeaderText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Time</Text>
              <Text style={[styles.tableHeaderText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>V</Text>
              <Text style={[styles.tableHeaderText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>A</Text>
              <Text style={[styles.tableHeaderText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Hz</Text>
              <Text style={[styles.tableHeaderText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>PF</Text>
              <Text style={[styles.tableHeaderText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>kW</Text>
            </View>
            
            {/* Table Rows */}
            {isHistoryLoading ? (
              <View style={styles.tableLoadingContainer}>
                <ActivityIndicator size="small" color={isDarkMode ? '#6EE7B7' : '#10B981'} />
              </View>
            ) : historyData && historyData.length > 0 ? (
              historyData.slice(0, 10).map((reading, index) => {
                // Check if any value exceeds limits
                const limitExceeded = limitsData && limitsData.some(limit => {
                  const value = reading[limit.parameter as keyof MeterReading] as number;
                  return limit.highLimit && value > limit.highLimit;
                });
                
                return (
                  <View
                    key={reading.meter_id + index}
                    style={[
                      styles.tableRow,
                      {
                        backgroundColor: limitExceeded 
                          ? isDarkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(254, 226, 226, 0.6)'
                          : index % 2 === 0
                          ? isDarkMode ? 'rgba(30, 41, 59, 0.4)' : 'rgba(248, 250, 252, 0.6)'
                          : isDarkMode ? 'rgba(15, 23, 42, 0.3)' : 'rgba(241, 245, 249, 0.4)',
                      },
                    ]}>
                    <Text style={[styles.tableCell, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                      {new Date(reading.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Text style={[
                      styles.tableCell, 
                      { 
                        color: isValueExceeded(reading.voltage, 'voltage', limitsData)
                          ? isDarkMode ? '#F87171' : '#DC2626' 
                          : isDarkMode ? '#F8FAFC' : '#1E293B' 
                      }
                    ]}>
                      {formatNumber(reading.voltage)}
                    </Text>
                    <Text style={[
                      styles.tableCell, 
                      { 
                        color: isValueExceeded(reading.current, 'current', limitsData)
                          ? isDarkMode ? '#F87171' : '#DC2626' 
                          : isDarkMode ? '#F8FAFC' : '#1E293B' 
                      }
                    ]}>
                      {formatNumber(reading.current)}
                    </Text>
                    <Text style={[
                      styles.tableCell, 
                      { 
                        color: isValueExceeded(reading.frequency, 'frequency', limitsData)
                          ? isDarkMode ? '#F87171' : '#DC2626' 
                          : isDarkMode ? '#F8FAFC' : '#1E293B' 
                      }
                    ]}>
                      {formatNumber(reading.frequency)}
                    </Text>
                    <Text style={[
                      styles.tableCell, 
                      { 
                        color: isValueExceeded(reading.pf, 'pf', limitsData)
                          ? isDarkMode ? '#F87171' : '#DC2626' 
                          : isDarkMode ? '#F8FAFC' : '#1E293B'
                      }
                    ]}>
                      {formatNumber(reading.pf, 2)}
                    </Text>
                    <Text style={[
                      styles.tableCell, 
                      { 
                        color: isValueExceeded(reading.power, 'power', limitsData)
                          ? isDarkMode ? '#F87171' : '#DC2626' 
                          : isDarkMode ? '#F8FAFC' : '#1E293B' 
                      }
                    ]}>
                      {formatNumber(reading.power)}
                    </Text>
                  </View>
                );
              })
            ) : (
              <View style={styles.tableLoadingContainer}>
                <Text style={{ color: isDarkMode ? '#94A3B8' : '#64748B' }}>No recent readings available</Text>
              </View>
            )}
            
            {/* Table footer with info */}
            <View style={styles.tableFooter}>
              <Text style={{ color: isDarkMode ? '#94A3B8' : '#64748B', fontSize: 11 }}>
                <Ionicons name="information-circle-outline" size={12} /> Values highlighted in red exceed their limits
              </Text>
            </View>
          </View>

          {/* Admin Meter Settings Section */}
          {isAdmin && (
            <View style={styles.adminSection}>
              <View style={styles.sectionHeader}>
                <Text style={[
                  styles.sectionTitle,
                  { color: isDarkMode ? '#F8FAFC' : '#1E293B' },
                ]}>
                  Admin Settings
                </Text>
              </View>
              
              <TouchableOpacity
                style={[
                  styles.adminButton,
                  { 
                    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                  }
                ]}
                onPress={() => router.push('/(dashboard)/screens/admin/meterLimits' as any)}
              >
                <Ionicons 
                  name="settings-outline" 
                  size={22} 
                  color={isDarkMode ? '#6EE7B7' : '#10B981'} 
                  style={styles.adminButtonIcon} 
                />
                <Text style={[
                  styles.adminButtonText,
                  { color: isDarkMode ? '#F8FAFC' : '#1E293B' }
                ]}>
                  Configure Parameter Limits
                </Text>
                <Ionicons 
                  name="chevron-forward" 
                  size={18} 
                  color={isDarkMode ? '#64748B' : '#94A3B8'} 
                />
              </TouchableOpacity>
            </View>
          )}
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
              route: '/(dashboard)/meterReadings/index',
              active: true,
            },
            {
              name: 'History',
              icon: 'alarm-outline',
              route: '/(dashboard)/meterReadings/History',
              active: false,
            },
            {
              name: 'Reports',
              icon: 'document-text-outline',
              route: '/(dashboard)/meterReadings/Reports',
              active: false,
            },
            {
              name: 'Settings',
              icon: 'settings-outline',
              route: '/(dashboard)/profile',
              active: false,
            },
          ].map((item) => (
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
                      ? '#6EE7B7'
                      : '#10B981'
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
                        ? '#6EE7B7'
                        : '#10B981'
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
  sectionHeader: {
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
    paddingLeft: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  parametersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: 2,
  },
  parameterCard: {
    width: '48%',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
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
  paramIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  paramName: {
    fontSize: 14,
    marginBottom: 4,
  },
  paramValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  timeframeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 16,
    paddingHorizontal: 2,
  },
  timeframeButton: {
    flex: 1,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  timeframeSelected: {
    borderWidth: 2,
  },
  timeframeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  chartSection: {
    marginVertical: 8,
  },
  chartContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  chartLoadingContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
  },
  recentReadingsSection: {
    marginTop: 24,
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 8,
    marginBottom: 4,
  },
  tableHeaderText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginBottom: 2,
  },
  tableCell: {
    flex: 1,
    fontSize: 12,
    textAlign: 'center',
  },
  tableLoadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  tableFooter: {
    padding: 10,
    alignItems: 'center',
  },
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
  adminSection: {
    marginTop: 24,
    marginBottom: 24,
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  adminButtonIcon: {
    marginRight: 12,
  },
  adminButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
});
