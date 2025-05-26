import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { format as formatDate, subDays } from 'date-fns';
import { useTheme } from '../../context/ThemeContext';
import { AlarmDetails } from '../../components/AlarmDetails';
import { useAlarmHistory } from '../../hooks/useAlarms';
import { Alarm } from '../../types/alarm';

// Filter types for alarm history
type AlarmFilter = 'all' | 'active' | 'acknowledged' | 'resolved';
type TimeFilter = '24h' | '3d' | '7d' | '30d' | 'all';

export default function AlarmHistoryScreen() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  
  // State for filters and search
  const [statusFilter, setStatusFilter] = useState<AlarmFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('7d');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAlarm, setSelectedAlarm] = useState<Alarm | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  
  // Get time range based on filter
  const timeRange = useMemo(() => {
    const endDate = new Date();
    let startDate = new Date();
    
    switch (timeFilter) {
      case '24h':
        startDate = subDays(endDate, 1);
        break;
      case '3d':
        startDate = subDays(endDate, 3);
        break;
      case '7d':
        startDate = subDays(endDate, 7);
        break;
      case '30d':
        startDate = subDays(endDate, 30);
        break;
      case 'all':
        startDate = new Date(0); // Beginning of time
        break;
    }
    
    return { startDate, endDate };
  }, [timeFilter]);
  
  // Calculate hours difference for API parameter
  const hoursDiff = useMemo(() => {
    if (timeFilter === 'all') return undefined;
    const diffMs = timeRange.endDate.getTime() - timeRange.startDate.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60));
  }, [timeRange, timeFilter]);
  
  // Fetch alarm history
  const { data: alarmHistory, isLoading, isError, error, refetch } = useAlarmHistory(hoursDiff);
  
  // Filter and search alarms
  const filteredAlarms = useMemo(() => {
    if (!alarmHistory) return [];
    
    return alarmHistory.filter(alarm => {
      // Apply status filter
      if (statusFilter !== 'all' && alarm.status !== statusFilter) {
        return false;
      }
      
      // Apply time filter
      const alarmDate = new Date(alarm.timestamp);
      if (timeFilter !== 'all' && alarmDate < timeRange.startDate) {
        return false;
      }
      
      // Apply search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          alarm.description.toLowerCase().includes(query) ||
          alarm.zone?.toLowerCase().includes(query) ||
          alarm.type.toLowerCase().includes(query) ||
          alarm.value.toString().toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [alarmHistory, statusFilter, searchQuery, timeFilter, timeRange]);
  
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
              {item.acknowledgedBy.name} • {formatDate(new Date(item.acknowledgedAt!), 'MMM d, HH:mm')}
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
                {item.resolvedBy.name} • {formatDate(new Date(item.resolvedAt!), 'MMM d, HH:mm')}
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
            {formatDate(new Date(item.timestamp), 'MMM d, yyyy HH:mm:ss')}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  ), [isDarkMode, handleViewAlarm, renderStatusBadge]);
  
  // Render status filter buttons
  const renderStatusFilters = () => {
    const filters: { label: string; value: AlarmFilter }[] = [
      { label: 'All', value: 'all' },
      { label: 'Active', value: 'active' },
      { label: 'Acknowledged', value: 'acknowledged' },
      { label: 'Resolved', value: 'resolved' },
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
            onPress={() => setStatusFilter(filter.value)}
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
  
  // Render time filter buttons
  const renderTimeFilters = () => {
    const filters: { label: string; value: TimeFilter }[] = [
      { label: '24h', value: '24h' },
      { label: '3d', value: '3d' },
      { label: '7d', value: '7d' },
      { label: '30d', value: '30d' },
      { label: 'All', value: 'all' },
    ];
    
    return (
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
            onPress={() => setTimeFilter(filter.value)}
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
        
        <View>
          <Text style={[styles.headerTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            Alarm History
          </Text>
          <Text style={[styles.headerSubtitle, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Browse past alarms and events
          </Text>
        </View>
      </View>
      
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
          placeholder="Search alarms..."
          placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
          value={searchQuery}
          onChangeText={setSearchQuery}
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
      </View>
      
      {/* Alarm List */}
      <FlatList
        data={filteredAlarms}
        keyExtractor={(item) => item.id}
        renderItem={renderAlarmItem}
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
          <View style={[styles.emptyState, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}>
            <Ionicons
              name="alert-circle-outline"
              size={48}
              color={isDarkMode ? '#6B7280' : '#9CA3AF'}
            />
            <Text style={[styles.emptyStateText, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
              No alarms found
            </Text>
            <Text style={[styles.emptyStateSubtext, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
              {isError
                ? 'Error loading alarms. Please try again.'
                : 'Try adjusting your filters or search criteria.'}
            </Text>
          </View>
        }
      />
      
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
  listContainer: {
    padding: 16,
    paddingTop: 0,
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
  },
  detailLabel: {
    fontSize: 14,
    width: 50,
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
    padding: 32,
    borderRadius: 12,
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
}); 