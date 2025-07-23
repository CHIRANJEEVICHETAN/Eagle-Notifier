import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Alarm } from '../types/alarm';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { PredictiveAlertCard } from './PredictiveAlertCard';

interface AlarmCardProps {
  alarm: Alarm;
  onAcknowledge?: () => void;
  onResolve?: () => void;
  onPress?: () => void;
  onFeedback?: (isAccurate: boolean) => void;
}

export const AlarmCard: React.FC<AlarmCardProps> = ({
  alarm,
  onAcknowledge,
  onResolve,
  onPress,
  onFeedback,
}) => {
  // If this is a predictive alert, use the specialized component
  if (alarm.alarmType === 'predictive' || alarm.type === 'predictive') {
    return (
      <PredictiveAlertCard
        alarm={alarm}
        onAcknowledge={onAcknowledge}
        onResolve={onResolve}
        onPress={onPress}
        onFeedback={onFeedback}
      />
    );
  }
  // Determine color based on severity and type
  const severityColor = useMemo(() => {
    // Special styling for predictive alerts
    if (alarm.alarmType === 'predictive' || alarm.type === 'predictive') {
      return 'bg-blue-50 dark:bg-blue-900 border-blue-400';
    }
    
    switch (alarm.severity) {
      case 'critical':
        return 'bg-red-100 dark:bg-red-900 border-red-500';
      case 'warning':
        return 'bg-yellow-100 dark:bg-yellow-900 border-yellow-500';
      case 'info':
        return 'bg-blue-100 dark:bg-blue-900 border-blue-500';
      default:
        return 'bg-gray-100 dark:bg-gray-800 border-gray-400';
    }
  }, [alarm.severity, alarm.alarmType, alarm.type]);
  
  // Determine icon based on alarm type
  const typeIcon = useMemo(() => {
    switch (alarm.type) {
      case 'temperature':
        return 'thermometer-outline';
      case 'level':
        return 'water-outline';
      case 'pressure':
        return 'speedometer-outline';
      case 'motor':
        return 'construct-outline';
      case 'conveyor':
        return 'git-network-outline';
      case 'fan':
        return 'aperture-outline';
      case 'heater':
        return 'flame-outline';
      case 'carbon':
        return 'flask-outline';
      case 'oil':
        return 'color-fill-outline';
      case 'predictive':
        return 'analytics-outline';
      default:
        return 'alert-circle-outline';
    }
  }, [alarm.type]);
  
  // Format timestamp to relative time
  const formattedTime = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(alarm.timestamp), { addSuffix: true });
    } catch (error) {
      return 'Unknown time';
    }
  }, [alarm.timestamp]);
  
  // Format alarm value and units
  const formattedValue = useMemo(() => {
    if (typeof alarm.value === 'number') {
      return `${alarm.value}${alarm.unit || ''}`;
    }
    return alarm.value;
  }, [alarm.value, alarm.unit]);
  
  // Get status icon
  const statusIcon = useMemo(() => {
    switch (alarm.status) {
      case 'acknowledged':
        return 'checkmark-circle-outline';
      case 'resolved':
        return 'checkmark-done-circle-outline';
      default:
        return 'alert-circle-outline';
    }
  }, [alarm.status]);

  return (
    <TouchableOpacity
      className={`rounded-lg p-4 mb-3 border ${severityColor}`}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-row items-center flex-1">
          <Ionicons name={typeIcon as any} size={24} color="#4B5563" className="mr-3" />
          <View className="flex-1">
            <Text className="font-bold text-gray-900 dark:text-white text-base">
              {alarm.description}
            </Text>
            <Text className="text-gray-600 dark:text-gray-300 text-sm mt-1">
              Value: {formattedValue}
              {alarm.setPoint ? ` (Set: ${alarm.setPoint}${alarm.unit || ''})` : ''}
            </Text>
            <View className="flex-row items-center mt-1">
              <Ionicons name="time-outline" size={14} color="#6B7280" />
              <Text className="text-gray-500 dark:text-gray-400 text-xs ml-1">
                {formattedTime}
              </Text>
            </View>
          </View>
        </View>
        
        <View className="flex-col items-end justify-between">
          <Ionicons name={statusIcon as any} size={20} color="#4B5563" />
          
          {alarm.status === 'active' && (
            <View className="flex-row mt-2 space-x-2">
              {onAcknowledge && (
                <TouchableOpacity
                  className="bg-blue-500 rounded-full p-1"
                  onPress={onAcknowledge}
                >
                  <Ionicons name="checkmark-outline" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              
              {onResolve && (
                <TouchableOpacity
                  className="bg-green-500 rounded-full p-1"
                  onPress={onResolve}
                >
                  <Ionicons name="checkmark-done-outline" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
      
      {alarm.zone && (
        <View className="mt-2">
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            Zone: {alarm.zone === 'zone1' ? 'Zone 1' : 'Zone 2'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Add default export
export default AlarmCard; 