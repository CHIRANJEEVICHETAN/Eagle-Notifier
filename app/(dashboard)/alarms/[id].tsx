import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Dimensions,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { format as formatDate, parseISO, subDays } from 'date-fns';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '../../context/ThemeContext';
import { AlarmDetails } from '../../components/AlarmDetails';
import { useSpecificAlarmHistory } from '../../hooks/useAlarms';
import { Alarm } from '../../types/alarm';
import DateTimePicker from '@react-native-community/datetimepicker';

// Filter types for alarm history
type AlarmFilter = 'active' | 'acknowledged' | 'resolved' | 'all';
type TimeFilter = '24h' | '3d' | '7d' | '30d' | 'custom';
type SortOrder = 'desc' | 'asc';

// Define the shape of alarm history records
interface AlarmHistoryRecord {
  analogAlarms: Alarm[];
  binaryAlarms: Alarm[];
  timestamp: string;
  id: string;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

// Helper function to correctly format timestamps to show IST time consistently in 12-hour format
const formatTimestamp = (timestamp: string): string => {
  try {
    // Always display in IST (Asia/Kolkata), regardless of device timezone
    const date = new Date(timestamp);
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return '';
  }
};

export default function AlarmDetailScreen() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const alarmId = params.id as string;
  
  // UI State
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedAlarm, setSelectedAlarm] = useState<Alarm | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filter and search state
  const [statusFilter, setStatusFilter] = useState<AlarmFilter>('active');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('7d');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  // Custom date range state
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [dateRangeError, setDateRangeError] = useState<string | null>(null);
  
  // Validate date range and show error if invalid
  const validateDateRange = useCallback(() => {
    if (timeFilter === 'custom') {
      if (endDate <= startDate) {
        const error = 'End date must be after start date';
        setDateRangeError(error);
        return false;
      }
      
      // Check if date range is too large (more than 90 days)
      const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 90) {
        const error = 'Date range cannot exceed 90 days';
        setDateRangeError(error);
        return false;
      }
      
      setDateRangeError(null);
      return true;
    }
    
    setDateRangeError(null);
    return true;
  }, [timeFilter, startDate, endDate]);
  
  // Convert date range to hours if using custom range
  const hoursDiff = useMemo(() => {
    if (timeFilter === 'custom') {
      if (!validateDateRange()) {
        return 168; // Fallback to 7 days
      }
      
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
      default: return 168; // Default to 7d
    }
  }, [timeFilter, startDate, endDate, validateDateRange]);

  // Build startTime and endTime parameters for custom date range
  const { startTimeParam, endTimeParam } = useMemo(() => {
    if (timeFilter === 'custom' && validateDateRange()) {
      return {
        startTimeParam: startDate.toISOString(),
        endTimeParam: endDate.toISOString()
      };
    }
    return {
      startTimeParam: undefined,
      endTimeParam: undefined
    };
  }, [timeFilter, startDate, endDate, validateDateRange]);

  // Fetch history for this specific alarm with all filter parameters (excluding search)
  const {
    data: specificAlarmData,
    isLoading,
    refetch,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSpecificAlarmHistory(alarmId, {
    limit: 50,
    status: statusFilter,
    hours: hoursDiff,
    startTime: startTimeParam,
    endTime: endTimeParam
  });

  // Process alarm history items - flatten all pages, filter by search, and apply sort
  const alarmHistoryItems = useMemo(() => {
    if (!specificAlarmData?.pages) {
      return [];
    }
    
    // Extract all instances of the selected alarm from all pages
    const items: Alarm[] = [];
    specificAlarmData.pages.forEach((page) => {
      if (page?.alarms) {
        page.alarms.forEach((record: AlarmHistoryRecord) => {
          const findInAnalog = record.analogAlarms?.find(
            (alarm: Alarm) => alarm.id.includes(alarmId)
          );
          const findInBinary = record.binaryAlarms?.find(
            (alarm: Alarm) => alarm.id.includes(alarmId)
          );
          
          if (findInAnalog) items.push(findInAnalog);
          if (findInBinary) items.push(findInBinary);
        });
      }
    });
    
    // Apply frontend search filter if search query exists
    let filteredItems = items;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filteredItems = items.filter((item) => {
        // Search in value, description, and formatted timestamp
        const valueStr = typeof item.value === 'string' ? item.value.toLowerCase() : String(item.value).toLowerCase();
        const descriptionStr = item.description.toLowerCase();
        const timestampStr = (formatDate(parseISO(item.timestamp), 'MMM d, yyyy') + ' ' + formatTimestamp(item.timestamp)).toLowerCase();
        
        return valueStr.includes(query) || 
               descriptionStr.includes(query) ||
               timestampStr.includes(query);
      });
    }
    
    // Apply frontend sort order
    const sortedItems = filteredItems.sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      
      return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
    });
    
    return sortedItems;
  }, [specificAlarmData, alarmId, searchQuery, sortOrder]);

  // Get total count of this specific alarm instances
  const totalCount = useMemo(() => {
    return alarmHistoryItems.length;
  }, [alarmHistoryItems]);
  
  // Get alarm summary information (first item to show details)
  const alarmSummary = useMemo(() => {
    if (alarmHistoryItems.length === 0) return null;
    return alarmHistoryItems[0];
  }, [alarmHistoryItems]);
  
  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);
  
  // Handle view alarm details
  const handleViewAlarm = useCallback((alarm: Alarm) => {
    setSelectedAlarm(alarm);
    setDetailsVisible(true);
  }, []);
  
  // Handle close details
  const handleCloseDetails = useCallback(() => {
    setDetailsVisible(false);
  }, []);
  
  // Date picker handlers
  const handleStartDateChange = useCallback((event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      // Preserve the existing time
      newDate.setHours(startDate.getHours(), startDate.getMinutes(), startDate.getSeconds());
      setStartDate(newDate);
      
      // Validate date range after change
      setTimeout(() => validateDateRange(), 100);
    }
  }, [startDate, validateDateRange]);
  
  const handleEndDateChange = useCallback((event: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      // Preserve the existing time
      newDate.setHours(endDate.getHours(), endDate.getMinutes(), endDate.getSeconds());
      setEndDate(newDate);
      
      // Validate date range after change
      setTimeout(() => validateDateRange(), 100);
    }
  }, [endDate, validateDateRange]);

  // Time picker handlers
  const handleStartTimeChange = useCallback((event: any, selectedTime?: Date) => {
    setShowStartTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      const newDate = new Date(startDate);
      newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      setStartDate(newDate);
      
      // Validate date range after change
      setTimeout(() => validateDateRange(), 100);
    }
  }, [startDate, validateDateRange]);
  
  const handleEndTimeChange = useCallback((event: any, selectedTime?: Date) => {
    setShowEndTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      const newDate = new Date(endDate);
      newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      setEndDate(newDate);
      
      // Validate date range after change
      setTimeout(() => validateDateRange(), 100);
    }
  }, [endDate, validateDateRange]);
  
  // Reset filters when they change (but not search - search is frontend only now)
  useEffect(() => {
    refetch();
  }, [statusFilter, timeFilter, startDate, endDate, refetch]);

  // Handle status filter change
  const handleStatusFilterChange = useCallback((newStatus: AlarmFilter) => {
    setStatusFilter(newStatus);
  }, []);

  // Handle time filter change
  const handleTimeFilterChange = useCallback((newTimeFilter: TimeFilter) => {
    setTimeFilter(newTimeFilter);
  }, []);

  // Handle load more data
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle sort order change
  const handleSortOrderChange = useCallback((newOrder: SortOrder) => {
    setSortOrder(newOrder);
  }, []);

  // Auto-correct invalid date ranges
  const handleDateRangeCorrection = useCallback(() => {
    if (timeFilter === 'custom' && endDate <= startDate) {
      // Auto-correct by setting end date to start date + 1 hour
      const correctedEndDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      setEndDate(correctedEndDate);
      setDateRangeError(null);
    }
  }, [timeFilter, startDate, endDate]);
  
  // Render status badge
  const renderStatusBadge = useCallback((status: string) => {
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
  }, [isDarkMode]);
  
  // Render alarm item
  const renderAlarmItem = useCallback(({ item }: { item: Alarm }) => (
    <TouchableOpacity
      style={[styles.alarmItem, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}
      onPress={() => handleViewAlarm(item)}
    >
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
            {item.type}{item.zone ? ` (${item.zone})` : ''}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Value:
          </Text>
          <Text style={[styles.detailValue, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
            {item.value} {item.unit}
          </Text>
        </View>
        
        {item.acknowledgedBy && (
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
              Ack by:
            </Text>
            <Text style={[styles.detailValue, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
              {item.acknowledgedBy.name} • {item.acknowledgedAt ? formatDate(parseISO(item.acknowledgedAt), 'MMM d') + ', ' + formatTimestamp(item.acknowledgedAt).split(' ').slice(0, 2).join(' ') : ''}
            </Text>
          </View>
        )}
        
        {item.resolvedBy && (
          <>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                Resolved:
              </Text>
              <Text style={[styles.detailValue, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                {item.resolvedBy.name} • {item.resolvedAt ? formatDate(parseISO(item.resolvedAt), 'MMM d') + ', ' + formatTimestamp(item.resolvedAt).split(' ').slice(0, 2).join(' ') : ''}
              </Text>
            </View>
            
            {item.resolutionMessage && (
              <View style={[styles.resolutionBox, { 
                backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                borderColor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)'
              }]}>
                <Text style={[styles.resolutionText, { color: isDarkMode ? '#93C5FD' : '#2563EB' }]}>
                  {item.resolutionMessage}
                </Text>
              </View>
            )}
          </>
        )}
        
        <View style={styles.timeWrapper}>
          <Ionicons name="time-outline" size={10} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
          <Text style={[styles.timeText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            {formatDate(parseISO(item.timestamp), 'MMM d, yyyy')} {formatTimestamp(item.timestamp)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  ), [isDarkMode, handleViewAlarm, renderStatusBadge]);
  
  // Render status filter buttons
  const renderStatusFilters = () => {
    const filters: { label: string; value: AlarmFilter }[] = [
      { label: 'Active', value: 'active' },
      { label: 'Acknowledged', value: 'acknowledged' },
      { label: 'Resolved', value: 'resolved' },
      { label: 'All', value: 'all' },
    ];
    
    return (
      <View style={styles.filtersRow}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.value}
            style={[
              styles.filterButton,
              statusFilter === filter.value && styles.filterButtonActive,
              { 
                backgroundColor: isDarkMode 
                  ? statusFilter === filter.value ? '#3B82F6' : '#374151'
                  : statusFilter === filter.value ? '#2563EB' : '#F3F4F6'
              }
            ]}
            onPress={() => handleStatusFilterChange(filter.value)}
          >
            <Text 
              style={[
                styles.filterButtonText,
                { 
                  color: isDarkMode
                    ? statusFilter === filter.value ? '#FFFFFF' : '#E5E7EB'
                    : statusFilter === filter.value ? '#FFFFFF' : '#4B5563' 
                }
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };
  
  // Render sort order buttons
  const renderSortFilters = () => {
    const filters: { label: string; value: SortOrder }[] = [
      { label: 'Newest First', value: 'desc' },
      { label: 'Oldest First', value: 'asc' },
    ];
    
    return (
      <View style={styles.filtersRow}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.value}
            style={[
              styles.filterButton,
              sortOrder === filter.value && styles.filterButtonActive,
              { 
                backgroundColor: isDarkMode 
                  ? sortOrder === filter.value ? '#10B981' : '#374151'
                  : sortOrder === filter.value ? '#059669' : '#F3F4F6'
              }
            ]}
            onPress={() => handleSortOrderChange(filter.value)}
          >
            <Text 
              style={[
                styles.filterButtonText,
                { 
                  color: isDarkMode
                    ? sortOrder === filter.value ? '#FFFFFF' : '#E5E7EB'
                    : sortOrder === filter.value ? '#FFFFFF' : '#4B5563' 
                }
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };
  
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
                    ? timeFilter === filter.value ? '#3B82F6' : '#374151'
                    : timeFilter === filter.value ? '#2563EB' : '#F3F4F6'
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
        
        {dateRangeError && (
          <View style={[styles.errorContainer, { 
            backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
            borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)'
          }]}>
            <Text style={[styles.errorText, { color: isDarkMode ? '#FCA5A5' : '#DC2626' }]}>
              {dateRangeError}
            </Text>
            <TouchableOpacity 
              style={[styles.correctButton, { backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB' }]}
              onPress={handleDateRangeCorrection}
            >
              <Text style={styles.correctButtonText}>Auto-correct</Text>
            </TouchableOpacity>
          </View>
        )}

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
                  {formatDate(startDate, 'h:mm a')}
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
                          style={[styles.button, { backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB' }]}
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
                          style={[styles.button, { backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB' }]}
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
                  {formatDate(endDate, 'h:mm a')}
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
                          style={[styles.button, { backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB' }]}
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
                          style={[styles.button, { backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB' }]}
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
  
  // Render loading state
  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' }]}>
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' }]}>
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
        
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            {alarmSummary?.description || 'Alarm History'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            {alarmSummary ? `${alarmSummary.type}${alarmSummary.zone ? ` (${alarmSummary.zone})` : ''} alarm history` : 'Loading...'}
          </Text>
        </View>
      </View>
      
      {/* Alarm details summary */}
      {alarmSummary && (
        <View style={[styles.alarmDetailSummary, { 
          backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
          borderColor: isDarkMode ? '#374151' : '#E5E7EB'
        }]}>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
              Current Value:
            </Text>
            <Text style={[styles.detailValue, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
              {alarmSummary.value} {alarmSummary.unit}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
              Set Point:
            </Text>
            <Text style={[styles.detailValue, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
              {alarmSummary.setPoint}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
              Status:
            </Text>
            {renderStatusBadge(alarmSummary.status)}
          </View>
          
          {alarmSummary.acknowledgedBy && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                Acknowledged:
              </Text>
              <Text style={[styles.detailValue, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                {alarmSummary.acknowledgedBy.name} • {alarmSummary.acknowledgedAt ? formatDate(parseISO(alarmSummary.acknowledgedAt), 'MMM d') + ', ' + formatTimestamp(alarmSummary.acknowledgedAt).split(' ').slice(0, 2).join(' ') : ''}
              </Text>
            </View>
          )}
        </View>
      )}
      
      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}>
        <Ionicons
          name="search-outline"
          size={20}
          color={isDarkMode ? '#6B7280' : '#9CA3AF'}
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.searchInput, { color: isDarkMode ? '#E5E7EB' : '#1F2937' }]}
          placeholder="Search for values..."
          placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons
              name="close-circle"
              size={20}
              color={isDarkMode ? '#6B7280' : '#9CA3AF'}
            />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Filters */}
      <View style={styles.filters}>
        {renderStatusFilters()}
        {renderTimeFilters()}
        {renderSortFilters()}
      </View>
      
      {/* History List */}
      <View style={styles.listSection}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, {
            color: isDarkMode ? '#E5E7EB' : '#1F2937',
          }]}>
            Value History ({searchQuery ? `${totalCount} filtered` : totalCount})
          </Text>
          
          {(isLoading || isFetching) && 
            <ActivityIndicator 
              size="small" 
              color={isDarkMode ? '#60A5FA' : '#3B82F6'} 
              style={styles.loadingIndicator}
            />
          }
        </View>
        
        <FlashList
          data={alarmHistoryItems}
          renderItem={renderAlarmItem}
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
          ListFooterComponent={() => {
            if (isFetchingNextPage) {
              return (
                <View style={styles.footerLoader}>
                  <ActivityIndicator 
                    size="small" 
                    color={isDarkMode ? '#60A5FA' : '#3B82F6'} 
                  />
                  <Text style={[styles.footerLoaderText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                    Loading more...
                  </Text>
                </View>
              );
            }
            return null;
          }}
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
                {searchQuery ? 
                  `No results found for "${searchQuery}".` : 
                  statusFilter !== 'all' ? 
                    `No ${statusFilter} alarms found for this period.` : 
                    'This alarm doesn\'t have any recorded history.'}
              </Text>
            </View>
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
        />
      </View>
      
      {/* Alarm Details Modal */}
      <AlarmDetails
        alarm={selectedAlarm}
        visible={detailsVisible}
        onClose={handleCloseDetails}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
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
  listSection: {
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
    width: 80,
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
  resolutionBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  resolutionText: {
    fontSize: 13,
    fontStyle: 'italic',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingIndicator: {
    marginLeft: 8,
  },
  alarmDetailSummary: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  footerLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  footerLoaderText: {
    marginTop: 8,
    fontSize: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 14,
    flex: 1,
    marginRight: 12,
  },
  correctButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  correctButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
}); 