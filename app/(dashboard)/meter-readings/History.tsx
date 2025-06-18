import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Modal,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { format as formatDate, parseISO, subDays } from 'date-fns';
import { useTheme } from '../../context/ThemeContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchMeterHistory, MeterReading } from '../../api/meterApi';
import { getAuthHeader } from '../../api/auth';
import { apiConfig } from '../../api/config';

/**
 * MeterReadingsHistoryScreen
 * 
 * A screen to display historical meter readings with time-based filtering options.
 * Users can view readings over predefined time periods (24h, 3d, 7d, 30d) or
 * select a custom date range using the date/time picker.
 * 
 * Each reading displays timestamp, ID, and all electrical parameters
 * (voltage, current, frequency, power factor, energy, and power).
 * 
 * Performance Optimizations:
 * - Uses FlashList instead of FlatList for better memory usage and rendering performance
 * - Implements server-side pagination via TanStack Query's useInfiniteQuery
 * - Memoizes expensive components and calculations
 * - Uses callback functions to prevent unnecessary re-renders
 * - Implements proper loading states for initial load and pagination
 * - Estimates item size for FlashList to reduce layout calculations
 * - Only fetches data when needed (on filter change, pull-to-refresh, or reaching list end)
 */

// Time filter types
type TimeFilter = '24h' | '3d' | '7d' | '30d' | 'custom';

// Pagination parameters
interface PaginationParams {
  page: number;
  limit: number;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const PAGE_SIZE = 20; // Number of items per page

export default function MeterReadingsHistoryScreen() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  
  // UI State
  const [refreshing, setRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('24h');
  
  // Custom date range state
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 1));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  
  // Convert date range to hours if using custom range
  const hoursDiff = useMemo(() => {
    if (timeFilter === 'custom') {
      // Calculate hours between startDate and endDate
      const diffMs = endDate.getTime() - startDate.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      return Math.ceil(diffHours);
    }
    
    // Use predefined ranges
    switch (timeFilter) {
      case '24h': return 24;
      case '3d': return 72;
      case '7d': return 168;
      case '30d': return 720;
      default: return 24; // Default to 24h
    }
  }, [timeFilter, startDate, endDate]);

  // Build startTime parameter for custom date range
  const startTimeParam = useMemo(() => {
    if (timeFilter === 'custom') {
      return startDate.toISOString();
    }
    return undefined;
  }, [timeFilter, startDate]);

  // Use TanStack's useInfiniteQuery for pagination
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isFetching,
    refetch
  } = useInfiniteQuery({
    queryKey: ['meter', 'history', hoursDiff, startTimeParam],
    queryFn: async ({ pageParam = 1 }) => {
      const headers = await getAuthHeader();
      // Build query parameters
      let queryParams = `hours=${hoursDiff}&page=${pageParam}&limit=${PAGE_SIZE}`;
      if (startTimeParam) {
        queryParams += `&startTime=${encodeURIComponent(startTimeParam)}`;
      }
      
      const response = await fetch(`${apiConfig.apiUrl}/api/meter/history?${queryParams}`, { headers });
      if (!response.ok) {
        throw new Error('Failed to fetch meter history');
      }
      const result = await response.json();
      return result.data;
    },
    getNextPageParam: (lastPage) => {
      // If we have more pages, return the next page number
      if (lastPage.pagination && lastPage.pagination.page < lastPage.pagination.pages) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  // Combine all readings from all pages
  const allReadings = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap(page => page.readings || []);
  }, [data]);

  // Sorted meter readings (newest first)
  const sortedReadings = useMemo(() => {
    return [...allReadings].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [allReadings]);

  // Safe number formatting function
  const formatNumber = (value: number | undefined | null, decimals: number = 1): string => {
    if (value === undefined || value === null || isNaN(value)) {
      return '-';
    }
    const factor = Math.pow(10, decimals);
    return String(Math.round(value * factor) / factor);
  };

  // Add a function to convert UTC to IST (UTC+5:30)
  const convertToIST = (utcDateString: string): Date => {
    const date = new Date(utcDateString);
    // Add 5 hours and 30 minutes for IST
    return new Date(date.getTime() + (5 * 60 + 30) * 60 * 1000);
  };

  // Format time with IST conversion
  const formatTimeIST = (dateString: string): string => {
    const istDate = convertToIST(dateString);
    return istDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format full timestamp with IST conversion
  const formatTimestampIST = (dateString: string): string => {
    const istDate = convertToIST(dateString);
    return istDate.toLocaleDateString() + ' ' + 
           istDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };
  
  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);
  
  // Date picker handlers
  const handleStartDateChange = useCallback((event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      // Preserve the existing time
      newDate.setHours(startDate.getHours(), startDate.getMinutes(), startDate.getSeconds());
      setStartDate(newDate);
    }
  }, [startDate]);
  
  const handleEndDateChange = useCallback((event: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      // Preserve the existing time
      newDate.setHours(endDate.getHours(), endDate.getMinutes(), endDate.getSeconds());
      setEndDate(newDate);
    }
  }, [endDate]);

  // Time picker handlers
  const handleStartTimeChange = useCallback((event: any, selectedTime?: Date) => {
    setShowStartTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      const newDate = new Date(startDate);
      newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      setStartDate(newDate);
    }
  }, [startDate]);
  
  const handleEndTimeChange = useCallback((event: any, selectedTime?: Date) => {
    setShowEndTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      const newDate = new Date(endDate);
      newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      setEndDate(newDate);
    }
  }, [endDate]);
  
  // Reset page when filters change
  useEffect(() => {
    refetch();
  }, [timeFilter, startDate, endDate, refetch]);

  // Handle time filter change
  const handleTimeFilterChange = useCallback((newTimeFilter: TimeFilter) => {
    setTimeFilter(newTimeFilter);
  }, []);

  // Handle loading more items when reaching end of list
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Render time filter buttons
  const renderTimeFilters = () => {
    const filters: { label: string; value: TimeFilter }[] = [
      { label: '24h', value: '24h' },
      { label: '3d', value: '3d' },
      { label: '7d', value: '7d' },
      { label: '30d', value: '30d' },
      { label: 'Custom', value: 'custom' },
    ];
    
    return (
      <View style={styles.filtersContainer}>
        <View style={styles.filtersRow}>
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.value}
              style={[
                styles.filterButton,
                timeFilter === filter.value && styles.filterButtonActive,
                { 
                  backgroundColor: isDarkMode 
                    ? timeFilter === filter.value ? '#10B981' : '#374151'
                    : timeFilter === filter.value ? '#059669' : '#F3F4F6'
                }
              ]}
              onPress={() => handleTimeFilterChange(filter.value)}
            >
              <Text 
                style={[
                  styles.filterButtonText,
                  { 
                    color: isDarkMode
                      ? timeFilter === filter.value ? '#FFFFFF' : '#E5E7EB'
                      : timeFilter === filter.value ? '#FFFFFF' : '#4B5563' 
                  }
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {timeFilter === 'custom' && (
          <View style={styles.datePickerContainer}>
            <View style={styles.datePickerRow}>
              <Text style={[styles.datePickerLabel, { color: isDarkMode ? '#E5E7EB' : '#1F2937' }]}>
                From:
              </Text>
              <TouchableOpacity 
                style={[styles.datePickerButton, { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }]}
                onPress={() => setShowStartPicker(true)}
              >
                <Text style={{ color: isDarkMode ? '#E5E7EB' : '#1F2937' }}>
                  {formatDate(startDate, 'MMM d, yyyy')}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.datePickerButton, { 
                  backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                  marginLeft: 8 
                }]}
                onPress={() => setShowStartTimePicker(true)}
              >
                <Text style={{ color: isDarkMode ? '#E5E7EB' : '#1F2937' }}>
                  {formatDate(startDate, 'HH:mm')}
                </Text>
              </TouchableOpacity>
              
              {showStartPicker && (
                Platform.OS === 'ios' ? (
                  <Modal
                    transparent={true}
                    animationType="slide"
                    visible={showStartPicker}
                  >
                    <View style={styles.centeredView}>
                      <View style={[styles.modalView, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}>
                        <DateTimePicker
                          value={startDate}
                          mode="date"
                          display="spinner"
                          onChange={handleStartDateChange}
                          themeVariant={isDarkMode ? 'dark' : 'light'}
                        />
                        <TouchableOpacity
                          style={[styles.button, { backgroundColor: isDarkMode ? '#10B981' : '#059669' }]}
                          onPress={() => setShowStartPicker(false)}
                        >
                          <Text style={{ color: '#FFFFFF' }}>Done</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Modal>
                ) : (
                  <DateTimePicker
                    value={startDate}
                    mode="date"
                    display="default"
                    onChange={handleStartDateChange}
                  />
                )
              )}
              
              {showStartTimePicker && (
                Platform.OS === 'ios' ? (
                  <Modal
                    transparent={true}
                    animationType="slide"
                    visible={showStartTimePicker}
                  >
                    <View style={styles.centeredView}>
                      <View style={[styles.modalView, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}>
                        <DateTimePicker
                          value={startDate}
                          mode="time"
                          display="spinner"
                          onChange={handleStartTimeChange}
                          themeVariant={isDarkMode ? 'dark' : 'light'}
                        />
                        <TouchableOpacity
                          style={[styles.button, { backgroundColor: isDarkMode ? '#10B981' : '#059669' }]}
                          onPress={() => setShowStartTimePicker(false)}
                        >
                          <Text style={{ color: '#FFFFFF' }}>Done</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Modal>
                ) : (
                  <DateTimePicker
                    value={startDate}
                    mode="time"
                    display="default"
                    onChange={handleStartTimeChange}
                  />
                )
              )}
            </View>
            
            <View style={styles.datePickerRow}>
              <Text style={[styles.datePickerLabel, { color: isDarkMode ? '#E5E7EB' : '#1F2937' }]}>
                To:
              </Text>
              <TouchableOpacity 
                style={[styles.datePickerButton, { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }]}
                onPress={() => setShowEndPicker(true)}
              >
                <Text style={{ color: isDarkMode ? '#E5E7EB' : '#1F2937' }}>
                  {formatDate(endDate, 'MMM d, yyyy')}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.datePickerButton, { 
                  backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                  marginLeft: 8 
                }]}
                onPress={() => setShowEndTimePicker(true)}
              >
                <Text style={{ color: isDarkMode ? '#E5E7EB' : '#1F2937' }}>
                  {formatDate(endDate, 'HH:mm')}
                </Text>
              </TouchableOpacity>
              
              {showEndPicker && (
                Platform.OS === 'ios' ? (
                  <Modal
                    transparent={true}
                    animationType="slide"
                    visible={showEndPicker}
                  >
                    <View style={styles.centeredView}>
                      <View style={[styles.modalView, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}>
                        <DateTimePicker
                          value={endDate}
                          mode="date"
                          display="spinner"
                          onChange={handleEndDateChange}
                          themeVariant={isDarkMode ? 'dark' : 'light'}
                        />
                        <TouchableOpacity
                          style={[styles.button, { backgroundColor: isDarkMode ? '#10B981' : '#059669' }]}
                          onPress={() => setShowEndPicker(false)}
                        >
                          <Text style={{ color: '#FFFFFF' }}>Done</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Modal>
                ) : (
                  <DateTimePicker
                    value={endDate}
                    mode="date"
                    display="default"
                    onChange={handleEndDateChange}
                  />
                )
              )}
              
              {showEndTimePicker && (
                Platform.OS === 'ios' ? (
                  <Modal
                    transparent={true}
                    animationType="slide"
                    visible={showEndTimePicker}
                  >
                    <View style={styles.centeredView}>
                      <View style={[styles.modalView, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}>
                        <DateTimePicker
                          value={endDate}
                          mode="time"
                          display="spinner"
                          onChange={handleEndTimeChange}
                          themeVariant={isDarkMode ? 'dark' : 'light'}
                        />
                        <TouchableOpacity
                          style={[styles.button, { backgroundColor: isDarkMode ? '#10B981' : '#059669' }]}
                          onPress={() => setShowEndTimePicker(false)}
                        >
                          <Text style={{ color: '#FFFFFF' }}>Done</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Modal>
                ) : (
                  <DateTimePicker
                    value={endDate}
                    mode="time"
                    display="default"
                    onChange={handleEndTimeChange}
                  />
                )
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  // Render a meter reading item - memoized for performance
  const renderMeterReadingItem = useCallback(({ item }: { item: MeterReading }) => (
    <View style={[styles.readingItem, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}>
      <View style={styles.readingHeader}>
        <Text style={[styles.readingTimestamp, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
          {formatTimestampIST(item.created_at)}
        </Text>
        <View style={[styles.readingIdBadge, { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }]}>
          <Text style={[styles.readingIdText, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
            ID: {item.meter_id}
          </Text>
        </View>
      </View>
      
      <View style={styles.readingDetailsGrid}>
        <View style={styles.readingDetailItem}>
          <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : 'rgba(217, 119, 6, 0.1)' }]}>
            <Ionicons name="flash-outline" size={16} color={isDarkMode ? '#F59E0B' : '#D97706'} />
          </View>
          <View>
            <Text style={[styles.detailLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>Voltage</Text>
            <Text style={[styles.detailValue, { color: isDarkMode ? '#F8FAFC' : '#1E293B' }]}>
              {formatNumber(item.voltage)} V
            </Text>
          </View>
        </View>
        
        <View style={styles.readingDetailItem}>
          <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? 'rgba(6, 182, 212, 0.15)' : 'rgba(8, 145, 178, 0.1)' }]}>
            <Ionicons name="repeat-outline" size={16} color={isDarkMode ? '#06B6D4' : '#0891B2'} />
          </View>
          <View>
            <Text style={[styles.detailLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>Current</Text>
            <Text style={[styles.detailValue, { color: isDarkMode ? '#F8FAFC' : '#1E293B' }]}>
              {formatNumber(item.current)} A
            </Text>
          </View>
        </View>
        
        <View style={styles.readingDetailItem}>
          <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(5, 150, 105, 0.1)' }]}>
            <Ionicons name="pulse-outline" size={16} color={isDarkMode ? '#10B981' : '#059669'} />
          </View>
          <View>
            <Text style={[styles.detailLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>Frequency</Text>
            <Text style={[styles.detailValue, { color: isDarkMode ? '#F8FAFC' : '#1E293B' }]}>
              {formatNumber(item.frequency)} Hz
            </Text>
          </View>
        </View>
        
        <View style={styles.readingDetailItem}>
          <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? 'rgba(139, 92, 246, 0.15)' : 'rgba(124, 58, 237, 0.1)' }]}>
            <Ionicons name="options-outline" size={16} color={isDarkMode ? '#8B5CF6' : '#7C3AED'} />
          </View>
          <View>
            <Text style={[styles.detailLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>Power Factor</Text>
            <Text style={[styles.detailValue, { color: isDarkMode ? '#F8FAFC' : '#1E293B' }]}>
              {formatNumber(item.pf, 2)}
            </Text>
          </View>
        </View>
        
        <View style={styles.readingDetailItem}>
          <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? 'rgba(236, 72, 153, 0.15)' : 'rgba(219, 39, 119, 0.1)' }]}>
            <Ionicons name="battery-charging-outline" size={16} color={isDarkMode ? '#EC4899' : '#DB2777'} />
          </View>
          <View>
            <Text style={[styles.detailLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>Energy</Text>
            <Text style={[styles.detailValue, { color: isDarkMode ? '#F8FAFC' : '#1E293B' }]}>
              {formatNumber(item.energy)} kWh
            </Text>
          </View>
        </View>
        
        <View style={styles.readingDetailItem}>
          <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? 'rgba(249, 115, 22, 0.15)' : 'rgba(234, 88, 12, 0.1)' }]}>
            <Ionicons name="flash" size={16} color={isDarkMode ? '#F97316' : '#EA580C'} />
          </View>
          <View>
            <Text style={[styles.detailLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>Power</Text>
            <Text style={[styles.detailValue, { color: isDarkMode ? '#F8FAFC' : '#1E293B' }]}>
              {formatNumber(item.power)} kW
            </Text>
          </View>
        </View>
      </View>
    </View>
  ), [isDarkMode, formatNumber, formatTimestampIST]);
  
  // Render footer with loading indicator for pagination
  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={isDarkMode ? '#6EE7B7' : '#10B981'} />
        <Text style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280', marginLeft: 8 }}>
          Loading more...
        </Text>
      </View>
    );
  }, [isFetchingNextPage, isDarkMode]);
  
  // Render loading state
  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDarkMode ? '#6EE7B7' : '#10B981'} />
          <Text style={[styles.loadingText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Loading meter history...
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
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
            Meter Reading History
          </Text>
          <Text style={[styles.headerSubtitle, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Browse past meter readings and measurements
          </Text>
        </View>
      </View>
      
      {/* Time Filters */}
      <View style={styles.filters}>
        {renderTimeFilters()}
      </View>
      
      {/* Meter Readings List */}
      <View style={styles.listContainer}>
        <FlashList
          data={sortedReadings}
          renderItem={renderMeterReadingItem}
          estimatedItemSize={220}
          keyExtractor={(item) => item.meter_id}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#10B981']}
              tintColor={isDarkMode ? '#6EE7B7' : '#10B981'}
            />
          }
          ListEmptyComponent={
            <View style={[styles.emptyState, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}>
              <Ionicons
                name="analytics-outline"
                size={48}
                color={isDarkMode ? '#6B7280' : '#9CA3AF'}
              />
              <Text style={[styles.emptyStateText, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                {isLoading || isFetching ? 'Loading...' : 'No history available'}
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                No meter readings found for this time period.
              </Text>
            </View>
          }
          contentContainerStyle={styles.flashListContent}
        />
      </View>
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
  filters: {
    padding: 16,
    paddingTop: 8,
  },
  filtersContainer: {
    marginBottom: 8,
  },
  filtersRow: {
    flexDirection: 'row',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  filterButtonActive: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  datePickerContainer: {
    marginTop: 4,
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  datePickerLabel: {
    width: 50,
    fontSize: 14,
    fontWeight: '500',
  },
  datePickerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '80%',
  },
  button: {
    borderRadius: 8,
    padding: 10,
    marginTop: 15,
    minWidth: 100,
    alignItems: 'center',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  flashListContent: {
    paddingBottom: 16,
  },
  readingItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  readingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  readingTimestamp: {
    fontSize: 16,
    fontWeight: '600',
  },
  readingIdBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  readingIdText: {
    fontSize: 12,
    fontWeight: '500',
  },
  readingDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  readingDetailItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  detailLabel: {
    fontSize: 12,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: 12,
    marginTop: 24,
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
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
});