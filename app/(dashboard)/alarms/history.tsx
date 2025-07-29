import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { format as formatDate, parseISO } from 'date-fns';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '../../context/ThemeContext';
import { AlarmDetails } from '../../components/AlarmDetails';
import { useAlarmHistory, useAlarmConfigurations } from '../../hooks/useAlarms';
import { Alarm } from '../../types/alarm';

// Helper function to correctly format timestamps to show IST time consistently in 12-hour format
const formatTimestamp = (timestamp: string): string => {
  try {
    // Always use a consistent approach for both development and production
    // by manually calculating IST time from UTC
    
    // Parse the ISO string to Date object
    const date = new Date(timestamp);
    
    // Get UTC components
    const utcYear = date.getUTCFullYear();
    const utcMonth = date.getUTCMonth();
    const utcDay = date.getUTCDate();
    const utcHours = date.getUTCHours();
    const utcMinutes = date.getUTCMinutes();
    const utcSeconds = date.getUTCSeconds();
    
    // Add IST offset (+5:30)
    let istHours = utcHours + 5;
    let istMinutes = utcMinutes + 30;
    let istDay = utcDay;
    let istMonth = utcMonth;
    let istYear = utcYear;
    
    // Handle minute overflow
    if (istMinutes >= 60) {
      istHours += 1;
      istMinutes -= 60;
    }
    
    // Handle hour overflow
    if (istHours >= 24) {
      istHours -= 24;
      istDay += 1;
      
      // Handle day overflow (simplified)
      if (istDay > 31) {
        istDay = 1;
        istMonth += 1;
        if (istMonth > 11) {
          istMonth = 0;
          istYear += 1;
        }
      }
    }
    
    // Format date using month name, day, and year
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const month = monthNames[istMonth];
    const day = istDay;
    const year = istYear;
    
    // Convert to 12-hour format
    let displayHours = istHours;
    const ampm = istHours >= 12 ? 'PM' : 'AM';
    
    if (istHours === 0) {
      displayHours = 12; // 12 AM
    } else if (istHours > 12) {
      displayHours = istHours - 12; // Convert to 12-hour format
    }
    
    // Format the time components
    const hours = displayHours.toString().padStart(2, '0');
    const minutes = istMinutes.toString().padStart(2, '0');
    const seconds = utcSeconds.toString().padStart(2, '0');
    
    return `${month} ${day}, ${year} ${hours}:${minutes}:${seconds} ${ampm}`;
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return '';
  }
};

interface AlarmHistoryRecord {
  analogAlarms: Alarm[];
  binaryAlarms: Alarm[];
  timestamp: string;
  id: string;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function AlarmHistoryScreen() {
  const { isDarkMode } = useTheme();
  const router = useRouter();

  // UI State
  const [refreshing, setRefreshing] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedAlarm, setSelectedAlarm] = useState<Alarm | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(50); // Increased limit to fetch more alarms at once

  // Fetch alarm configurations
  const {
    data: alarmConfigData,
    isLoading: configLoading,
  } = useAlarmConfigurations();

  // Fetch alarm history
  const {
    data: alarmHistoryData,
    isLoading,
    refetch,
    isFetching,
  } = useAlarmHistory({
    page: currentPage,
    limit,
    status: 'all',
    // hours: 168, // Default to 7 days
    sortBy: 'timestamp',
    sortOrder: 'desc',
  });

  // Extract and filter analog and binary alarms
  const { filteredAnalogAlarms, filteredBinaryAlarms } = useMemo(() => {
    if (!alarmHistoryData?.alarms) {
      console.log('🔍 Debug: Missing alarm history data');
      return { filteredAnalogAlarms: [], filteredBinaryAlarms: [] };
    }

    const analog: Alarm[] = [];
    const binary: Alarm[] = [];

    alarmHistoryData.alarms.forEach((record: AlarmHistoryRecord) => {
      if (record.analogAlarms) {
        analog.push(...record.analogAlarms);
      }
      if (record.binaryAlarms) {
        binary.push(...record.binaryAlarms);
      }
    });

    console.log('🔍 Debug: Raw alarm data', {
      totalAnalog: analog.length,
      totalBinary: binary.length,
      sampleAnalog: analog.slice(0, 2).map(a => ({ description: a.description, id: a.id })),
      sampleBinary: binary.slice(0, 2).map(a => ({ description: a.description, id: a.id })),
      alarmHistoryData: alarmHistoryData
    });

    // If no configuration data, show all alarms
    if (!alarmConfigData?.configurations) {
      console.log('🔍 Debug: No config data, showing all alarms');
      return { 
        filteredAnalogAlarms: analog.slice(0, 10), // Limit to first 10
        filteredBinaryAlarms: binary.slice(0, 10)  // Limit to first 10
      };
    }

    // Get dynamic alarm descriptions from backend
    const analogDescriptions = alarmConfigData.configurations.analog.map((config: any) => config.name);
    const binaryDescriptions = alarmConfigData.configurations.binary.map((config: any) => config.name);

    console.log('🔍 Debug: Config descriptions', {
      analogDescriptions,
      binaryDescriptions
    });

    // Filter to show only the specified alarms
    // For each description, find the most recent alarm (avoid duplicates)
    const filteredAnalogAlarms = analogDescriptions.map((description: string) => {
      // Try exact match first
      let matches = analog.filter((alarm: Alarm) => alarm.description === description);
      
      // If no exact match, try partial match
      if (matches.length === 0) {
        matches = analog.filter((alarm: Alarm) => 
          alarm.description.toLowerCase().includes(description.toLowerCase()) ||
          description.toLowerCase().includes(alarm.description.toLowerCase())
        );
      }
      
      console.log(`🔍 Debug: Analog matches for "${description}":`, matches.length);
      if (matches.length > 0) {
        console.log(`🔍 Debug: Found matches:`, matches.map(m => m.description));
      }
      
      // Return the most recent one
      return matches.sort(
        (a: Alarm, b: Alarm) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0];
    }).filter(Boolean); // Remove undefined entries

    const filteredBinaryAlarms = binaryDescriptions.map((description: string) => {
      // Try exact match first
      let matches = binary.filter((alarm: Alarm) => alarm.description === description);
      
      // If no exact match, try partial match
      if (matches.length === 0) {
        matches = binary.filter((alarm: Alarm) => 
          alarm.description.toLowerCase().includes(description.toLowerCase()) ||
          description.toLowerCase().includes(alarm.description.toLowerCase())
        );
      }
      
      console.log(`🔍 Debug: Binary matches for "${description}":`, matches.length);
      if (matches.length > 0) {
        console.log(`🔍 Debug: Found matches:`, matches.map(m => m.description));
      }
      
      // Return the most recent one
      return matches.sort(
        (a: Alarm, b: Alarm) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0];
    }).filter(Boolean); // Remove undefined entries

    console.log('🔍 Debug: Final filtered results', {
      filteredAnalogCount: filteredAnalogAlarms.length,
      filteredBinaryCount: filteredBinaryAlarms.length
    });

    // If no matches found with configurations, show all alarms as fallback
    if (filteredAnalogAlarms.length === 0 && filteredBinaryAlarms.length === 0) {
      console.log('🔍 Debug: No matches found, showing all alarms as fallback');
      return { 
        filteredAnalogAlarms: analog.slice(0, 10), // Limit to first 10
        filteredBinaryAlarms: binary.slice(0, 10)  // Limit to first 10
      };
    }

    return { filteredAnalogAlarms, filteredBinaryAlarms };
  }, [alarmHistoryData, alarmConfigData]);

  // Combine both alarm types for a single list view with sections
  const combinedAlarms = useMemo(() => {
    // Create a combined list with section headers
    const combined = [];

    // Add analog alarms section header
    if (filteredAnalogAlarms.length > 0) {
      combined.push({
        id: 'analog-header',
        isHeader: true,
        title: 'Analog',
        count: filteredAnalogAlarms.length,
      });

      // Add analog alarms
      combined.push(
        ...filteredAnalogAlarms.map((alarm: Alarm) => ({
          ...alarm,
          isHeader: false,
        }))
      );
    }

    // Add binary alarms section header
    if (filteredBinaryAlarms.length > 0) {
      combined.push({
        id: 'binary-header',
        isHeader: true,
        title: 'Binary',
        count: filteredBinaryAlarms.length,
      });

      // Add binary alarms
      combined.push(
        ...filteredBinaryAlarms.map((alarm: Alarm) => ({
          ...alarm,
          isHeader: false,
        }))
      );
    }

    return combined;
  }, [filteredAnalogAlarms, filteredBinaryAlarms]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Handle view alarm details
  const handleViewAlarm = useCallback(
    (alarm: Alarm) => {
      // Navigate to the detail page with the alarm id
      const baseId = alarm.id.split('-')[0]; // Get the base part of the ID
      router.push(`/(dashboard)/alarms/${baseId}` as any);
    },
    [router]
  );

  // Handle close details
  const handleCloseDetails = useCallback(() => {
    setDetailsVisible(false);
  }, []);

  // Render status badge
  const renderStatusBadge = useCallback(
    (status: string) => {
      let bgColor = '';
      let textColor = '#FFFFFF';

      switch (status) {
        case 'active':
          bgColor = isDarkMode ? '#EF4444' : '#F87171';
          break;
        case 'acknowledged':
          bgColor = isDarkMode ? '#F59E0B' : '#FBBF24';
          break;
        case 'resolved':
          bgColor = isDarkMode ? '#10B981' : '#34D399';
          break;
        default:
          bgColor = isDarkMode ? '#6B7280' : '#9CA3AF';
      }

      return (
        <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
          <Text style={[styles.statusText, { color: textColor }]}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Text>
        </View>
      );
    },
    [isDarkMode]
  );

  // Render list item - either header or alarm item
  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      if (item.isHeader) {
        return (
          <View
            style={[
              styles.sectionHeader,
              {
                backgroundColor: isDarkMode ? '#111827' : '#F1F5F9',
              },
            ]}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: isDarkMode ? '#E5E7EB' : '#1F2937',
                },
              ]}>
              {item.title} Alarms ({item.count})
            </Text>
          </View>
        );
      }

      return (
        <TouchableOpacity
          style={[styles.alarmItem, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}
          onPress={() => handleViewAlarm(item)}>
          <View style={styles.alarmHeader}>
            <Text style={[styles.alarmName, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
              {item.description}
            </Text>
            {renderStatusBadge(item.status)}
          </View>

          <View style={styles.alarmDetails}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                Type:
              </Text>
              <Text style={[styles.detailValue, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                {item.type}
                {item.zone ? ` (${item.zone})` : ''}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                Value:
              </Text>
              <Text style={[styles.detailValue, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                {item.value}
              </Text>
            </View>

                                  <View style={styles.timeWrapper}>
                        <Ionicons name="time-outline" size={10} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
                        <Text style={[styles.timeText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                          {formatTimestamp(item.timestamp)}
                        </Text>
                      </View>
          </View>
        </TouchableOpacity>
      );
    },
    [isDarkMode, handleViewAlarm, renderStatusBadge]
  );

  // Render loading state
  if (isLoading && !refreshing) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' }]}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDarkMode ? '#60A5FA' : '#2563EB'} />
          <Text style={[styles.loadingText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Loading alarm history...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render the main view
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}
          onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={isDarkMode ? '#E5E7EB' : '#4B5563'} />
        </TouchableOpacity>

        <View>
          <Text style={[styles.headerTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            Alarm History
          </Text>
          <Text style={[styles.headerSubtitle, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Browse past alarms and events
          </Text>
        </View>
      </View>

      {/* Combined Alarms List */}
      <View style={styles.fullListContainer}>
        <FlashList
          data={combinedAlarms}
          renderItem={renderItem}
          estimatedItemSize={150}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#3B82F6']}
              tintColor={isDarkMode ? '#60A5FA' : '#3B82F6'}
            />
          }
          ListEmptyComponent={
            <View
              style={[styles.emptyState, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}>
              <Text
                style={[styles.emptyStateText, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                {isLoading || isFetching ? 'Loading...' : 'No alarms found'}
              </Text>
              <Text
                style={[styles.emptyStateSubtext, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                {isLoading || isFetching ? 
                  'Fetching alarm data...' : 
                  'No alarm history data available. This could be due to:\n• No recent SCADA data\n• No alarms in the specified time range\n• Database connection issues'}
              </Text>
              {!isLoading && !isFetching && (
                <View style={{ marginTop: 16, padding: 12, backgroundColor: isDarkMode ? '#374151' : '#F3F4F6', borderRadius: 8 }}>
                  <Text style={[styles.emptyStateSubtext, { color: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: 12 }]}>
                    Debug Info:{'\n'}
                    Config Loading: {configLoading ? 'Yes' : 'No'}{'\n'}
                    Has Config Data: {alarmConfigData?.configurations ? 'Yes' : 'No'}{'\n'}
                    Has History Data: {alarmHistoryData?.alarms ? 'Yes' : 'No'}{'\n'}
                    History Records: {alarmHistoryData?.alarms?.length || 0}
                  </Text>
                </View>
              )}
            </View>
          }
        />
      </View>

      {/* Alarm Details Modal */}
      <AlarmDetails alarm={selectedAlarm} visible={detailsVisible} onClose={handleCloseDetails} />
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
  section: {
    flex: 1,
    paddingTop: 8,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  alarmItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  alarmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alarmName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  alarmDetails: {
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    width: 65,
    marginRight: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
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
  timeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  timeText: {
    marginLeft: 4,
  },
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  fullListContainer: {
    flex: 1,
  },
});
