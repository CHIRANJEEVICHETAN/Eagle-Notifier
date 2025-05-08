import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AlarmCard } from './components/AlarmCard';
import { AlarmCountSummary } from './components/AlarmCountSummary';
import { AlarmDetails } from './components/AlarmDetails';
import { useActiveAlarms } from './hooks/useAlarms';
import { useUpdateAlarmStatus } from './hooks/useAlarms';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './context/ThemeContext';
import { useAuth } from './context/AuthContext';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Alarm } from './types/alarm';

export default function Dashboard() {
  const { isDarkMode, toggleTheme } = useTheme();
  const { authState, logout } = useAuth();
  const { data: activeAlarms, isLoading, isError, error, refetch } = useActiveAlarms();
  
  const [selectedAlarm, setSelectedAlarm] = useState<Alarm | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  
  const updateAlarmStatus = useUpdateAlarmStatus();
  
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
  
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);
  
  const renderEmptyState = () => (
    <View className="flex-1 justify-center items-center p-8">
      <Ionicons
        name="checkmark-circle-outline"
        size={64}
        color={isDarkMode ? '#4ADE80' : '#22C55E'}
      />
      <Text className="text-xl font-bold text-gray-800 dark:text-white mt-4 text-center">
        All Clear
      </Text>
      <Text className="text-gray-600 dark:text-gray-300 text-center mt-2">
        No active alarms at the moment. Pull down to refresh.
      </Text>
    </View>
  );
  
  const renderHeader = () => (
    <View className="flex-row justify-between items-center px-4 py-2">
      <View className="flex-row items-center">
        <Text className="text-2xl font-bold text-gray-900 dark:text-white">
          Eagle Notifier
        </Text>
        {authState.user && (
          <View className="bg-blue-100 dark:bg-blue-900 rounded-full px-3 py-0.5 ml-2">
            <Text className="text-xs text-blue-800 dark:text-blue-200">
              {authState.user.role}
            </Text>
          </View>
        )}
      </View>
      
      <View className="flex-row">
        <TouchableOpacity 
          onPress={toggleTheme}
          className="p-2 mr-2"
        >
          <Ionicons 
            name={isDarkMode ? 'sunny-outline' : 'moon-outline'} 
            size={24} 
            color={isDarkMode ? '#E5E7EB' : '#374151'}
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={logout}
          className="p-2"
        >
          <Ionicons 
            name="log-out-outline" 
            size={24} 
            color={isDarkMode ? '#E5E7EB' : '#374151'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      {renderHeader()}
      
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="text-gray-600 dark:text-gray-300 mt-4">
            Loading alarms...
          </Text>
        </View>
      ) : isError ? (
        <View className="flex-1 justify-center items-center p-4">
          <Ionicons
            name="alert-circle-outline"
            size={64}
            color={isDarkMode ? '#F87171' : '#EF4444'}
          />
          <Text className="text-xl font-bold text-gray-800 dark:text-white mt-4 text-center">
            Error Loading Alarms
          </Text>
          <Text className="text-gray-600 dark:text-gray-300 text-center mt-2">
            {error instanceof Error ? error.message : 'Failed to load alarms'}
          </Text>
          <TouchableOpacity
            className="bg-blue-500 rounded-lg px-4 py-2 mt-4"
            onPress={handleRefresh}
          >
            <Text className="text-white font-medium">Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={activeAlarms}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View className="px-4">
              <AlarmCard
                alarm={item}
                onAcknowledge={() => handleAcknowledge(item.id)}
                onResolve={() => handleResolve(item.id)}
                onPress={() => handleAlarmPress(item.id)}
              />
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={handleRefresh}
              colors={['#3B82F6']}
              tintColor={isDarkMode ? '#E5E7EB' : '#3B82F6'}
            />
          }
          ListHeaderComponent={
            <View className="px-4 pt-2">
              <AlarmCountSummary
                alarms={activeAlarms || []}
                onPress={() => console.log('View all alarms')}
              />
            </View>
          }
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={{ flexGrow: 1 }}
        />
      )}
      
      <AlarmDetails
        alarm={selectedAlarm}
        visible={detailsVisible}
        onClose={handleCloseDetails}
        onAcknowledge={selectedAlarm?.status === 'active' ? () => handleAcknowledge(selectedAlarm.id) : undefined}
        onResolve={selectedAlarm?.status === 'active' ? () => handleResolve(selectedAlarm.id) : undefined}
      />
    </SafeAreaView>
  );
}
