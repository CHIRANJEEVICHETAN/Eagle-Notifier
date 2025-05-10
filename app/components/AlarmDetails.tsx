import React, { useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Alarm } from '../types/alarm';
import { Ionicons } from '@expo/vector-icons';
import { format as formatDate } from 'date-fns';
import { useTheme } from '../context/ThemeContext';

interface AlarmDetailsProps {
  alarm: Alarm | null;
  visible: boolean;
  onClose: () => void;
  onAcknowledge?: () => void;
  onResolve?: () => void;
}

export const AlarmDetails: React.FC<AlarmDetailsProps> = ({
  alarm,
  visible,
  onClose,
  onAcknowledge,
  onResolve,
}) => {
  const { isDarkMode } = useTheme();
  
  // Format timestamp to readable date/time
  const formattedTime = useMemo(() => {
    if (!alarm) return '';
    try {
      return formatDate(new Date(alarm.timestamp), 'PPpp'); // e.g., "Apr 29, 2023, 1:30 PM"
    } catch (error) {
      return 'Unknown time';
    }
  }, [alarm?.timestamp]);
  
  // Determine severity color
  const severityColor = useMemo(() => {
    if (!alarm) return '#6B7280';
    
    switch (alarm.severity) {
      case 'critical':
        return isDarkMode ? '#EF4444' : '#B91C1C';
      case 'warning':
        return isDarkMode ? '#F59E0B' : '#D97706';
      case 'info':
        return isDarkMode ? '#3B82F6' : '#2563EB';
      default:
        return '#6B7280';
    }
  }, [alarm?.severity, isDarkMode]);
  
  // Convert status to readable format
  const statusText = useMemo(() => {
    if (!alarm) return '';
    switch (alarm.status) {
      case 'active':
        return 'Active';
      case 'acknowledged':
        return 'Acknowledged';
      case 'resolved':
        return 'Resolved';
      default:
        return alarm.status;
    }
  }, [alarm?.status]);
  
  const formatTimestamp = (timestamp: Date | string) => {
    if (!timestamp) return 'N/A';
    return formatDate(new Date(timestamp), 'PPpp'); // e.g., "Apr 29, 2023, 1:30 PM"
  };
  
  if (!alarm) return null;
  
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View className={`rounded-t-xl ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-5 max-h-[80%]`}>
          {/* Header with close button */}
          <View className="flex-row justify-between items-center mb-4">
            <Text className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Alarm Details
            </Text>
            <TouchableOpacity onPress={onClose} className="p-2">
              <Ionicons name="close" size={24} color={isDarkMode ? '#E5E7EB' : '#374151'} />
            </TouchableOpacity>
          </View>
          
          <ScrollView className="flex-1">
            {/* Title and description */}
            <View className="mb-4">
              <Text className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {alarm.description}
              </Text>
              <View className="flex-row items-center mt-1">
                <View className={`w-2 h-2 rounded-full mr-2`} style={{ backgroundColor: severityColor }} />
                <Text className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {alarm.severity.charAt(0).toUpperCase() + alarm.severity.slice(1)} Severity
                </Text>
              </View>
            </View>
            
            {/* Timestamp */}
            <View className="mb-4 border-b border-gray-200 dark:border-gray-700 pb-4">
              <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Detected:
              </Text>
              <Text className={`text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {formattedTime}
              </Text>
            </View>
            
            {/* Status */}
            <View className="mb-4 border-b border-gray-200 dark:border-gray-700 pb-4">
              <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Status:
              </Text>
              <Text className={`text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {statusText}
              </Text>
            </View>
            
            {/* Value */}
            <View className="mb-4 border-b border-gray-200 dark:border-gray-700 pb-4">
              <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Current Value:
              </Text>
              <Text className={`text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {alarm.value}{alarm.unit || ''}
              </Text>
            </View>
            
            {/* Set Point */}
            <View className="mb-4 border-b border-gray-200 dark:border-gray-700 pb-4">
              <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Set Point:
              </Text>
              <Text className={`text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {alarm.setPoint}{alarm.unit || ''}
              </Text>
            </View>
            
            {/* Limits */}
            {(alarm.lowLimit !== undefined || alarm.highLimit !== undefined) && (
              <View className="mb-4 border-b border-gray-200 dark:border-gray-700 pb-4">
                <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Limits:
                </Text>
                <View className="flex-row">
                  {alarm.lowLimit !== undefined && (
                    <Text className={`text-base mr-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Low: {alarm.lowLimit}{alarm.unit || ''}
                    </Text>
                  )}
                  {alarm.highLimit !== undefined && (
                    <Text className={`text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      High: {alarm.highLimit}{alarm.unit || ''}
                    </Text>
                  )}
                </View>
              </View>
            )}
            
            {/* Zone */}
            {alarm.zone && (
              <View className="mb-4 border-b border-gray-200 dark:border-gray-700 pb-4">
                <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Zone:
                </Text>
                <Text className={`text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {alarm.zone === 'zone1' ? 'Zone 1' : 'Zone 2'}
                </Text>
              </View>
            )}
          </ScrollView>
          
          {/* Action buttons */}
          {alarm.status === 'active' && (
            <View className="flex-row justify-end mt-4 space-x-3">
              {onAcknowledge && (
                <TouchableOpacity
                  className="bg-blue-500 py-2 px-4 rounded-lg"
                  onPress={onAcknowledge}
                >
                  <Text className="text-white font-medium">Acknowledge</Text>
                </TouchableOpacity>
              )}
              
              {onResolve && (
                <TouchableOpacity
                  className="bg-green-500 py-2 px-4 rounded-lg"
                  onPress={onResolve}
                >
                  <Text className="text-white font-medium">Resolve</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}; 