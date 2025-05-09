import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../context/ThemeContext';

// Report types
export type ReportFormat = 'pdf' | 'excel';
export type ReportTimeRange = {
  startDate: Date;
  endDate: Date;
};

interface ReportGeneratorProps {
  visible: boolean;
  onClose: () => void;
  onGenerate: (format: ReportFormat, timeRange: ReportTimeRange) => Promise<string>;
  defaultTimeRange?: ReportTimeRange;
}

export const ReportGenerator: React.FC<ReportGeneratorProps> = ({
  visible,
  onClose,
  onGenerate,
  defaultTimeRange,
}) => {
  const { isDarkMode } = useTheme();
  
  // State for report options
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [timeRange, setTimeRange] = useState<ReportTimeRange>(
    defaultTimeRange || {
      startDate: new Date(new Date().setHours(0, 0, 0, 0)),
      endDate: new Date(),
    }
  );
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Predefined time ranges
  const timeRanges = [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'Last 7 Days', value: 'week' },
    { label: 'Last 30 Days', value: 'month' },
    { label: 'Custom', value: 'custom' },
  ];
  
  // Handle time range selection
  const handleTimeRangeSelect = useCallback((value: string) => {
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));
    
    switch (value) {
      case 'today':
        setTimeRange({
          startDate: today,
          endDate: new Date(),
        });
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        setTimeRange({
          startDate: yesterday,
          endDate: new Date(today.getTime() - 1),
        });
        break;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        setTimeRange({
          startDate: weekAgo,
          endDate: new Date(),
        });
        break;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 30);
        setTimeRange({
          startDate: monthAgo,
          endDate: new Date(),
        });
        break;
      case 'custom':
        // Custom would typically open a date picker
        // For now, we'll just use a 14-day range as an example
        const twoWeeksAgo = new Date(today);
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        setTimeRange({
          startDate: twoWeeksAgo,
          endDate: new Date(),
        });
        break;
    }
  }, []);
  
  // Handle generate report
  const handleGenerateReport = useCallback(async () => {
    try {
      setIsGenerating(true);
      
      // Call the onGenerate function passed as props
      const fileUrl = await onGenerate(format, timeRange);
      
      // Check if sharing is available
      const isSharingAvailable = await Sharing.isAvailableAsync();
      
      if (isSharingAvailable) {
        // Share the file
        await Sharing.shareAsync(fileUrl);
      } else {
        // Copy file to downloads directory if sharing is not available
        const downloadDir = FileSystem.documentDirectory + 'downloads/';
        const dirInfo = await FileSystem.getInfoAsync(downloadDir);
        
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
        }
        
        const fileName = `alarm-report-${format}-${format(new Date(), 'yyyy-MM-dd-HH-mm')}`;
        const newFileUri = `${downloadDir}${fileName}.${format}`;
        
        await FileSystem.copyAsync({
          from: fileUrl,
          to: newFileUri,
        });
        
        Alert.alert(
          'Report Generated',
          `Report has been saved to your downloads folder as ${fileName}.${format}`
        );
      }
      
      // Close the modal
      onClose();
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to generate report'
      );
    } finally {
      setIsGenerating(false);
    }
  }, [format, timeRange, onGenerate, onClose]);
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
              Generate Report
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons
                name="close"
                size={24}
                color={isDarkMode ? '#E5E7EB' : '#4B5563'}
              />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalBody}>
            {/* Format Selection */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                Format
              </Text>
              <View style={styles.formatOptions}>
                <TouchableOpacity
                  style={[
                    styles.formatOption,
                    format === 'pdf' && styles.formatOptionActive,
                    {
                      backgroundColor: format === 'pdf'
                        ? (isDarkMode ? '#3B82F6' : '#2563EB')
                        : (isDarkMode ? '#374151' : '#F3F4F6'),
                    }
                  ]}
                  onPress={() => setFormat('pdf')}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={24}
                    color={format === 'pdf' ? '#FFFFFF' : (isDarkMode ? '#E5E7EB' : '#4B5563')}
                    style={styles.formatIcon}
                  />
                  <Text
                    style={[
                      styles.formatText,
                      {
                        color: format === 'pdf'
                          ? '#FFFFFF'
                          : (isDarkMode ? '#E5E7EB' : '#4B5563'),
                      }
                    ]}
                  >
                    PDF
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.formatOption,
                    format === 'excel' && styles.formatOptionActive,
                    {
                      backgroundColor: format === 'excel'
                        ? (isDarkMode ? '#3B82F6' : '#2563EB')
                        : (isDarkMode ? '#374151' : '#F3F4F6'),
                    }
                  ]}
                  onPress={() => setFormat('excel')}
                >
                  <Ionicons
                    name="grid-outline"
                    size={24}
                    color={format === 'excel' ? '#FFFFFF' : (isDarkMode ? '#E5E7EB' : '#4B5563')}
                    style={styles.formatIcon}
                  />
                  <Text
                    style={[
                      styles.formatText,
                      {
                        color: format === 'excel'
                          ? '#FFFFFF'
                          : (isDarkMode ? '#E5E7EB' : '#4B5563'),
                      }
                    ]}
                  >
                    Excel
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Time Range Selection */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                Time Range
              </Text>
              <View style={styles.timeRangeOptions}>
                {timeRanges.map((range) => (
                  <TouchableOpacity
                    key={range.value}
                    style={[
                      styles.timeRangeOption,
                      {
                        backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                      }
                    ]}
                    onPress={() => handleTimeRangeSelect(range.value)}
                  >
                    <Text
                      style={[
                        styles.timeRangeText,
                        { color: isDarkMode ? '#E5E7EB' : '#4B5563' }
                      ]}
                    >
                      {range.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            {/* Selected Range Display */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                Selected Range
              </Text>
              <View style={[styles.selectedRange, { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }]}>
                <Text style={[styles.rangeText, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                  From: {format(timeRange.startDate, 'MMM d, yyyy HH:mm')}
                </Text>
                <Text style={[styles.rangeText, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                  To: {format(timeRange.endDate, 'MMM d, yyyy HH:mm')}
                </Text>
              </View>
            </View>
            
            {/* Report Description */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                Report Contents
              </Text>
              <View style={[styles.reportInfo, { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }]}>
                <View style={styles.reportInfoItem}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={isDarkMode ? '#4ADE80' : '#22C55E'}
                    style={styles.reportInfoIcon}
                  />
                  <Text style={[styles.reportInfoText, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                    Alarm events and status changes
                  </Text>
                </View>
                <View style={styles.reportInfoItem}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={isDarkMode ? '#4ADE80' : '#22C55E'}
                    style={styles.reportInfoIcon}
                  />
                  <Text style={[styles.reportInfoText, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                    Analog value charts and statistics
                  </Text>
                </View>
                <View style={styles.reportInfoItem}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={isDarkMode ? '#4ADE80' : '#22C55E'}
                    style={styles.reportInfoIcon}
                  />
                  <Text style={[styles.reportInfoText, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                    Binary state transitions
                  </Text>
                </View>
                <View style={styles.reportInfoItem}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={isDarkMode ? '#4ADE80' : '#22C55E'}
                    style={styles.reportInfoIcon}
                  />
                  <Text style={[styles.reportInfoText, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                    Response time analytics
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }]}
              onPress={onClose}
            >
              <Text style={[styles.cancelButtonText, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.generateButton,
                { 
                  backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB',
                  opacity: isGenerating ? 0.7 : 1,
                }
              ]}
              onPress={handleGenerateReport}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name="download-outline"
                    size={18}
                    color="#FFFFFF"
                    style={styles.generateButtonIcon}
                  />
                  <Text style={styles.generateButtonText}>
                    Generate {format.toUpperCase()}
                  </Text>
                </>
              )}
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
    overflow: 'hidden',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalBody: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  formatOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  formatOption: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 6,
  },
  formatOptionActive: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  formatIcon: {
    marginBottom: 8,
  },
  formatText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeRangeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  timeRangeOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    margin: 4,
  },
  timeRangeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  selectedRange: {
    padding: 12,
    borderRadius: 8,
  },
  rangeText: {
    fontSize: 14,
    marginBottom: 4,
  },
  reportInfo: {
    padding: 12,
    borderRadius: 8,
  },
  reportInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportInfoIcon: {
    marginRight: 8,
  },
  reportInfoText: {
    fontSize: 14,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
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
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 120,
    justifyContent: 'center',
  },
  generateButtonIcon: {
    marginRight: 8,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
}); 