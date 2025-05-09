import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface TimeRangePickerProps {
  visible: boolean;
  onClose: () => void;
  onTimeSelected: (fromHour: number, toHour: number) => void;
  initialFrom?: number;
  initialTo?: number;
}

const TimeRangePicker: React.FC<TimeRangePickerProps> = ({
  visible,
  onClose,
  onTimeSelected,
  initialFrom = 22,
  initialTo = 7,
}) => {
  const { isDarkMode } = useTheme();
  const [fromHour, setFromHour] = useState<number>(initialFrom);
  const [toHour, setToHour] = useState<number>(initialTo);
  
  // Generate hours for picker
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  // Format hour for display (12-hour format with AM/PM)
  const formatHour = useCallback((hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  }, []);
  
  // Handle save
  const handleSave = useCallback(() => {
    onTimeSelected(fromHour, toHour);
  }, [fromHour, toHour, onTimeSelected]);
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={[
          styles.modalContent,
          { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }
        ]}>
          <View style={styles.header}>
            <Text style={[
              styles.title,
              { color: isDarkMode ? '#FFFFFF' : '#1F2937' }
            ]}>
              Set Mute Hours
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons
                name="close"
                size={24}
                color={isDarkMode ? '#9CA3AF' : '#6B7280'}
              />
            </TouchableOpacity>
          </View>
          
          <Text style={[
            styles.subtitle,
            { color: isDarkMode ? '#9CA3AF' : '#6B7280' }
          ]}>
            Notifications will be silenced between these hours
          </Text>
          
          <View style={styles.timeSelectionContainer}>
            <View style={styles.timeSection}>
              <Text style={[
                styles.timeLabel,
                { color: isDarkMode ? '#FFFFFF' : '#1F2937' }
              ]}>
                From
              </Text>
              <ScrollView
                style={[
                  styles.timeScrollView,
                  { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }
                ]}
                contentContainerStyle={styles.timeScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {hours.map((hour) => (
                  <TouchableOpacity
                    key={`from-${hour}`}
                    style={[
                      styles.timeItem,
                      fromHour === hour && styles.selectedTimeItem,
                      fromHour === hour && {
                        backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB'
                      }
                    ]}
                    onPress={() => setFromHour(hour)}
                  >
                    <Text style={[
                      styles.timeText,
                      fromHour === hour && styles.selectedTimeText,
                      {
                        color: fromHour === hour
                          ? '#FFFFFF'
                          : isDarkMode ? '#E5E7EB' : '#4B5563'
                      }
                    ]}>
                      {formatHour(hour)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            
            <View style={styles.timeSeparator}>
              <Ionicons
                name="arrow-forward"
                size={20}
                color={isDarkMode ? '#9CA3AF' : '#6B7280'}
              />
            </View>
            
            <View style={styles.timeSection}>
              <Text style={[
                styles.timeLabel,
                { color: isDarkMode ? '#FFFFFF' : '#1F2937' }
              ]}>
                To
              </Text>
              <ScrollView
                style={[
                  styles.timeScrollView,
                  { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }
                ]}
                contentContainerStyle={styles.timeScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {hours.map((hour) => (
                  <TouchableOpacity
                    key={`to-${hour}`}
                    style={[
                      styles.timeItem,
                      toHour === hour && styles.selectedTimeItem,
                      toHour === hour && {
                        backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB'
                      }
                    ]}
                    onPress={() => setToHour(hour)}
                  >
                    <Text style={[
                      styles.timeText,
                      toHour === hour && styles.selectedTimeText,
                      {
                        color: toHour === hour
                          ? '#FFFFFF'
                          : isDarkMode ? '#E5E7EB' : '#4B5563'
                      }
                    ]}>
                      {formatHour(hour)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
          
          <View style={styles.summary}>
            <Text style={[
              styles.summaryText,
              { color: isDarkMode ? '#E5E7EB' : '#4B5563' }
            ]}>
              Notifications will be muted from {formatHour(fromHour)} to {formatHour(toHour)}
            </Text>
          </View>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.cancelButton,
                { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }
              ]}
              onPress={onClose}
            >
              <Text style={[
                styles.cancelButtonText,
                { color: isDarkMode ? '#E5E7EB' : '#4B5563' }
              ]}>
                Cancel
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB' }
              ]}
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>
                Save
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 12,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  timeSelectionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  timeSection: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  timeScrollView: {
    height: 200,
    borderRadius: 8,
  },
  timeScrollContent: {
    paddingVertical: 8,
  },
  timeItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 4,
    marginHorizontal: 8,
  },
  selectedTimeItem: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  timeText: {
    fontSize: 16,
    textAlign: 'center',
  },
  selectedTimeText: {
    fontWeight: '600',
  },
  timeSeparator: {
    width: 40,
    alignItems: 'center',
  },
  summary: {
    marginBottom: 24,
  },
  summaryText: {
    fontSize: 14,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default TimeRangePicker; 