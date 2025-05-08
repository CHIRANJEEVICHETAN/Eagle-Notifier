import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { AlarmCountSummary } from '../../components/AlarmCountSummary';
import { AlarmCard } from '../../components/AlarmCard';
import { AlarmDetails } from '../../components/AlarmDetails';
import { useActiveAlarms, useUpdateAlarmStatus } from '../../hooks/useAlarms';
import { Alarm, AlarmSeverity } from '../../types/alarm';

export default function OperatorDashboard() {
  const { isDarkMode, toggleTheme } = useTheme();
  const { authState, logout } = useAuth();
  const router = useRouter();
  
  const { data: activeAlarms, isLoading, isError, error, refetch } = useActiveAlarms();
  
  const [selectedAlarm, setSelectedAlarm] = useState<Alarm | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const updateAlarmStatus = useUpdateAlarmStatus();
  
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
  
  // Filter alarms by severity
  const highPriorityAlarms = activeAlarms?.filter(alarm => alarm.severity === 'critical') || [];
  const mediumPriorityAlarms = activeAlarms?.filter(alarm => alarm.severity === 'warning') || [];
  const lowPriorityAlarms = activeAlarms?.filter(alarm => alarm.severity === 'info') || [];
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            Operator Dashboard
          </Text>
          <Text style={[styles.headerSubtitle, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            {authState.user?.name ? `Welcome, ${authState.user.name}` : 'Monitor and respond to alarms'}
          </Text>
        </View>
        
        <View style={styles.headerActions}>
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
          
          <TouchableOpacity 
            style={[styles.iconButton, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}
            onPress={logout}
          >
            <Ionicons 
              name="log-out-outline" 
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
        <FlatList
          data={[]}
          keyExtractor={() => 'main-content'}
          renderItem={null}
          ListHeaderComponent={() => (
            <View>
              {/* Alarm Count Summary */}
              <View style={styles.summaryContainer}>
                <AlarmCountSummary
                  alarms={activeAlarms || []}
                  onPress={() => console.log('View all alarms')}
                />
              </View>
              
              {/* High Priority Alarms */}
              {highPriorityAlarms.length > 0 && (
                <View style={styles.alarmSection}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleContainer}>
                      <View style={[styles.severityDot, { backgroundColor: '#EF4444' }]} />
                      <Text style={[styles.sectionTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                        Critical Priority
                      </Text>
                    </View>
                    <Text style={[styles.alarmCount, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                      {highPriorityAlarms.length}
                    </Text>
                  </View>
                  
                  {highPriorityAlarms.map((alarm) => (
                    <AlarmCard
                      key={alarm.id}
                      alarm={alarm}
                      onAcknowledge={() => handleAcknowledge(alarm.id)}
                      onResolve={() => handleResolve(alarm.id)}
                      onPress={() => handleAlarmPress(alarm.id)}
                    />
                  ))}
                </View>
              )}
              
              {/* Medium Priority Alarms */}
              {mediumPriorityAlarms.length > 0 && (
                <View style={styles.alarmSection}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleContainer}>
                      <View style={[styles.severityDot, { backgroundColor: '#F59E0B' }]} />
                      <Text style={[styles.sectionTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                        Warning Priority
                      </Text>
                    </View>
                    <Text style={[styles.alarmCount, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                      {mediumPriorityAlarms.length}
                    </Text>
                  </View>
                  
                  {mediumPriorityAlarms.map((alarm) => (
                    <AlarmCard
                      key={alarm.id}
                      alarm={alarm}
                      onAcknowledge={() => handleAcknowledge(alarm.id)}
                      onResolve={() => handleResolve(alarm.id)}
                      onPress={() => handleAlarmPress(alarm.id)}
                    />
                  ))}
                </View>
              )}
              
              {/* Low Priority Alarms */}
              {lowPriorityAlarms.length > 0 && (
                <View style={styles.alarmSection}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleContainer}>
                      <View style={[styles.severityDot, { backgroundColor: '#3B82F6' }]} />
                      <Text style={[styles.sectionTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                        Info Priority
                      </Text>
                    </View>
                    <Text style={[styles.alarmCount, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                      {lowPriorityAlarms.length}
                    </Text>
                  </View>
                  
                  {lowPriorityAlarms.map((alarm) => (
                    <AlarmCard
                      key={alarm.id}
                      alarm={alarm}
                      onAcknowledge={() => handleAcknowledge(alarm.id)}
                      onResolve={() => handleResolve(alarm.id)}
                      onPress={() => handleAlarmPress(alarm.id)}
                    />
                  ))}
                </View>
              )}
              
              {/* No Alarms State */}
              {activeAlarms?.length === 0 && (
                <View style={[styles.emptyState, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={48}
                    color={isDarkMode ? '#4ADE80' : '#22C55E'}
                  />
                  <Text style={[styles.emptyStateText, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                    All Clear
                  </Text>
                  <Text style={[styles.emptyStateSubtext, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                    No active alarms at the moment
                  </Text>
                </View>
              )}
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#3B82F6']}
              tintColor={isDarkMode ? '#60A5FA' : '#3B82F6'}
            />
          }
          contentContainerStyle={styles.flatListContent}
        />
      )}
      
      {/* Alarm Details Modal */}
      <AlarmDetails
        alarm={selectedAlarm}
        visible={detailsVisible}
        onClose={handleCloseDetails}
        onAcknowledge={selectedAlarm?.status === 'active' ? handleSelectedAcknowledge : undefined}
        onResolve={selectedAlarm?.status === 'active' || selectedAlarm?.status === 'acknowledged' ? 
          handleSelectedResolve : undefined}
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
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
  },
  headerActions: {
    flexDirection: 'row',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  summaryContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  alarmSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  severityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  alarmCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  flatListContent: {
    paddingBottom: 24,
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
    marginHorizontal: 16,
    marginTop: 16,
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
}); 