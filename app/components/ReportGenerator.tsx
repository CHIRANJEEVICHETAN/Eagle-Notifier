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
import { format as formatDate } from 'date-fns';
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
  const [reportFormat, setReportFormat] = useState<ReportFormat>('pdf');
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
      const fileUrl = await onGenerate(reportFormat, timeRange);
      
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
        
        const fileName = `alarm-report-${reportFormat}-${formatDate(new Date(), 'yyyy-MM-dd-HH-mm')}`;
        const newFileUri = `${downloadDir}${fileName}.${reportFormat}`;
        
        await FileSystem.copyAsync({
          from: fileUrl,
          to: newFileUri,
        });
        
        Alert.alert(
          'Report Generated',
          `Report has been saved to your downloads folder as ${fileName}.${reportFormat}`
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
  }, [reportFormat, timeRange, onGenerate, onClose]);
  
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
                    reportFormat === 'pdf' && styles.formatOptionActive,
                    {
                      backgroundColor: reportFormat === 'pdf'
                        ? (isDarkMode ? '#3B82F6' : '#2563EB')
                        : (isDarkMode ? '#374151' : '#F3F4F6'),
                    }
                  ]}
                  onPress={() => setReportFormat('pdf')}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={24}
                    color={reportFormat === 'pdf' ? '#FFFFFF' : (isDarkMode ? '#E5E7EB' : '#4B5563')}
                    style={styles.formatIcon}
                  />
                  <Text
                    style={[
                      styles.formatText,
                      {
                        color: reportFormat === 'pdf'
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
                    reportFormat === 'excel' && styles.formatOptionActive,
                    {
                      backgroundColor: reportFormat === 'excel'
                        ? (isDarkMode ? '#3B82F6' : '#2563EB')
                        : (isDarkMode ? '#374151' : '#F3F4F6'),
                    }
                  ]}
                  onPress={() => setReportFormat('excel')}
                >
                  <Ionicons
                    name="grid-outline"
                    size={24}
                    color={reportFormat === 'excel' ? '#FFFFFF' : (isDarkMode ? '#E5E7EB' : '#4B5563')}
                    style={styles.formatIcon}
                  />
                  <Text
                    style={[
                      styles.formatText,
                      {
                        color: reportFormat === 'excel'
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
              
              {/* Show selected time range */}
              <View style={styles.selectedTimeRange}>
                <View style={[styles.selectedRange, { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }]}>
                  <Text style={[styles.rangeText, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                    From: {formatDate(timeRange.startDate, 'MMM d, yyyy HH:mm')}
                  </Text>
                  <Text style={[styles.rangeText, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                    To: {formatDate(timeRange.endDate, 'MMM d, yyyy HH:mm')}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[
                styles.cancelButton,
                { borderColor: isDarkMode ? '#4B5563' : '#D1D5DB' }
              ]}
              onPress={onClose}
              disabled={isGenerating}
            >
              <Text style={[styles.cancelButtonText, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.generateButton,
                { backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB' },
                isGenerating && { opacity: 0.7 }
              ]}
              onPress={handleGenerateReport}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.generateButtonText}>
                  Generate
                </Text>
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
  selectedTimeRange: {
    marginTop: 12,
  },
  selectedRange: {
    padding: 12,
    borderRadius: 8,
  },
  rangeText: {
    fontSize: 14,
    marginBottom: 4,
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
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  generateButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 120,
    justifyContent: 'center',
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
}); 