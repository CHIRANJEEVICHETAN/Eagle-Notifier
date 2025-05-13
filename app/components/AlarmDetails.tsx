import React, { useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { Alarm } from '../types/alarm';
import { Ionicons } from '@expo/vector-icons';
import { format as formatDate } from 'date-fns';
import { useTheme } from '../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

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
        <SafeAreaView edges={["bottom"]} style={{ width: '100%' }}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: isDarkMode
                  ? 'rgba(30,41,59,0.98)'
                  : 'rgba(255,255,255,0.98)',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                shadowColor: isDarkMode ? '#000' : '#1E293B',
                shadowOpacity: 0.18,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: -8 },
                elevation: 24,
                borderWidth: 1,
                borderColor: isDarkMode ? 'rgba(71,85,105,0.25)' : 'rgba(203,213,225,0.25)',
              },
            ]}
          >
            {/* Top indicator */}
            <View style={styles.indicatorWrapper}>
              <View style={styles.indicatorBar} />
            </View>
            {/* Header with close button */}
            <View className="flex-row justify-between items-center mb-4">
              <Text className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Alarm Details</Text>
              <TouchableOpacity onPress={onClose} className="p-2">
                <Ionicons name="close" size={24} color={isDarkMode ? '#E5E7EB' : '#374151'} />
              </TouchableOpacity>
            </View>
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              {/* Title and description */}
              <View className="mb-4">
                <Text className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{alarm.description}</Text>
                <View className="flex-row items-center mt-1">
                  <View className={`w-2 h-2 rounded-full mr-2`} style={{ backgroundColor: severityColor }} />
                  <Text className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{alarm.severity.charAt(0).toUpperCase() + alarm.severity.slice(1)} Severity</Text>
                </View>
              </View>
              {/* Timestamp */}
              <View className="mb-4 border-b border-gray-200 dark:border-gray-700 pb-4">
                <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Detected:</Text>
                <Text className={`text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{formattedTime}</Text>
              </View>
              {/* Status */}
              <View className="mb-4 border-b border-gray-200 dark:border-gray-700 pb-4">
                <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Status:</Text>
                <Text className={`text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{statusText}</Text>
              </View>
              {/* Value */}
              <View className="mb-4 border-b border-gray-200 dark:border-gray-700 pb-4">
                <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Current Value:</Text>
                <Text className={`text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{alarm.value}{alarm.unit || ''}</Text>
              </View>
              {/* Set Point */}
              <View className="mb-4 border-b border-gray-200 dark:border-gray-700 pb-4">
                <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Set Point:</Text>
                <Text className={`text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{alarm.setPoint}{alarm.unit || ''}</Text>
              </View>
              {/* Limits */}
              {(alarm.lowLimit !== undefined || alarm.highLimit !== undefined) && (
                <View className="mb-4 border-b border-gray-200 dark:border-gray-700 pb-4">
                  <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Limits:</Text>
                  <View className="flex-row">
                    {alarm.lowLimit !== undefined && (
                      <Text className={`text-base mr-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Low: {alarm.lowLimit}{alarm.unit || ''}</Text>
                    )}
                    {alarm.highLimit !== undefined && (
                      <Text className={`text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>High: {alarm.highLimit}{alarm.unit || ''}</Text>
                    )}
                  </View>
                </View>
              )}
              {/* Zone */}
              {alarm.zone && (
                <View className="mb-4 border-b border-gray-200 dark:border-gray-700 pb-4">
                  <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Zone:</Text>
                  <Text className={`text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{alarm.zone === 'zone1' ? 'Zone 1' : 'Zone 2'}</Text>
                </View>
              )}
            </ScrollView>
            {/* Action buttons */}
            {(alarm.status === 'active' || alarm.status === 'acknowledged') && (
              <View style={styles.actionRow}>
                {onAcknowledge && alarm.status === 'active' && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: isDarkMode ? '#2563EB' : '#3B82F6' }]}
                    onPress={onAcknowledge}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="checkmark-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.actionButtonText}>Acknowledge</Text>
                  </TouchableOpacity>
                )}
                {onResolve && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: isDarkMode ? '#059669' : '#10B981' }]}
                    onPress={onResolve}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="checkmark-done-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.actionButtonText}>Resolve</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheet: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    maxHeight: '88%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
      },
      android: {
        elevation: 24,
      },
    }),
  },
  indicatorWrapper: {
    alignItems: 'center',
    marginBottom: 10,
  },
  indicatorBar: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(156,163,175,0.35)',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 18,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginLeft: 0,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
  },
});