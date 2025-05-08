import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Alarm } from '../types/alarm';

interface AlarmCountSummaryProps {
  alarms: Alarm[];
  onPress?: () => void;
}

export const AlarmCountSummary: React.FC<AlarmCountSummaryProps> = ({
  alarms,
  onPress,
}) => {
  // Count alarms by severity
  const criticalCount = alarms.filter(alarm => alarm.severity === 'critical' && alarm.status === 'active').length;
  const warningCount = alarms.filter(alarm => alarm.severity === 'warning' && alarm.status === 'active').length;
  const infoCount = alarms.filter(alarm => alarm.severity === 'info' && alarm.status === 'active').length;
  
  // Total active alarms
  const totalActive = criticalCount + warningCount + infoCount;
  
  return (
    <TouchableOpacity 
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-4"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="flex-row justify-between items-center">
        <Text className="text-lg font-bold text-gray-800 dark:text-white">
          Active Alarms
        </Text>
        <View className="bg-blue-100 dark:bg-blue-900 px-3 py-1 rounded-full">
          <Text className="text-blue-800 dark:text-blue-100 font-bold">
            {totalActive}
          </Text>
        </View>
      </View>
      
      <View className="flex-row justify-between mt-4">
        <View className="flex-row items-center">
          <View className="w-3 h-3 rounded-full bg-red-500 mr-2" />
          <Text className="text-sm text-gray-700 dark:text-gray-300">
            Critical: {criticalCount}
          </Text>
        </View>
        
        <View className="flex-row items-center">
          <View className="w-3 h-3 rounded-full bg-yellow-500 mr-2" />
          <Text className="text-sm text-gray-700 dark:text-gray-300">
            Warning: {warningCount}
          </Text>
        </View>
        
        <View className="flex-row items-center">
          <View className="w-3 h-3 rounded-full bg-blue-500 mr-2" />
          <Text className="text-sm text-gray-700 dark:text-gray-300">
            Info: {infoCount}
          </Text>
        </View>
      </View>
      
      {totalActive > 0 && (
        <View className="mt-3 items-end">
          <View className="flex-row items-center">
            <Text className="text-xs text-gray-500 dark:text-gray-400 mr-1">
              Tap to view all
            </Text>
            <Ionicons name="chevron-forward" size={14} color="#6B7280" />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}; 