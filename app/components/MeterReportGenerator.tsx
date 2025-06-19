import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Switch,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format as formatDate } from 'date-fns';
import { useTheme } from '../context/ThemeContext';
import { useMeterReports, ReportTimeRange, ReportFormat } from '../hooks/useMeterReports';

export enum SortOrder {
  NEWEST_FIRST = 'newest_first',
  OLDEST_FIRST = 'oldest_first'
}

export interface MeterReportGeneratorProps {
  visible: boolean;
  onClose: () => void;
  onGenerate: (format: ReportFormat, timeRange: ReportTimeRange, parameters: string[], sortOrder?: SortOrder, title?: string) => Promise<string>;
  defaultTimeRange?: ReportTimeRange;
}

export function MeterReportGenerator({
  visible,
  onClose,
  onGenerate,
  defaultTimeRange,
}: MeterReportGeneratorProps) {
  const { isDarkMode } = useTheme();
  
  // Get today's date to prevent future date selection
  const today = new Date();
  
  // State for report generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [format, setFormat] = useState<ReportFormat>(ReportFormat.EXCEL);
  
  // Time range state
  const [startDate, setStartDate] = useState<Date>(
    defaultTimeRange?.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  );
  const [endDate, setEndDate] = useState<Date>(
    defaultTimeRange?.endDate || today
  );
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Parameters to include in report
  const [selectedParameters, setSelectedParameters] = useState<string[]>([
    'voltage', 'current', 'frequency', 'pf', 'power', 'energy'
  ]);

  // Sort order (newest first by default)
  const [sortOrder, setSortOrder] = useState<SortOrder>(SortOrder.NEWEST_FIRST);

  // Report title
  const [reportTitle, setReportTitle] = useState('Meter_Readings_Report');

  // Update title with date range on date change
  useEffect(() => {
    const startFormatted = formatDate(startDate, 'MMM_d_yyyy');
    const endFormatted = formatDate(endDate, 'MMM_d_yyyy');
    setReportTitle(`Meter_Readings_${startFormatted}_to_${endFormatted}`);
  }, [startDate, endDate]);

  // Handle date change
  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(false);
    if (selectedDate) {
      // Ensure selected date is not in the future
      const validDate = selectedDate > today ? today : selectedDate;
      setStartDate(validDate);
      
      // If start date is after end date, update end date
      if (validDate > endDate) {
        setEndDate(validDate);
      }
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndPicker(false);
    if (selectedDate) {
      // Ensure selected date is not in the future and not before start date
      const validDate = selectedDate > today ? today : selectedDate;
      
      // If end date is before start date, update start date
      if (validDate < startDate) {
        setStartDate(validDate);
      }
      
      setEndDate(validDate);
    }
  };

  // Toggle parameter selection
  const toggleParameter = (parameter: string) => {
    setSelectedParameters(prev => 
      prev.includes(parameter) 
        ? prev.filter(p => p !== parameter) 
        : [...prev, parameter]
    );
  };

  // Handle report generation
  const handleGenerateReport = async () => {
    if (endDate < startDate) {
      Alert.alert('Invalid Date Range', 'End date must be after start date.');
      return;
    }

    // Must select at least one parameter
    if (selectedParameters.length === 0) {
      Alert.alert('Invalid Parameters', 'Please select at least one parameter to include in the report.');
      return;
    }

    try {
      setIsGenerating(true);
      console.log('Generating report with parameters:', {
        format,
        timeRange: { startDate, endDate },
        parameters: selectedParameters,
        sortOrder,
        title: reportTitle
      });
      await onGenerate(format, { startDate, endDate }, selectedParameters, sortOrder, reportTitle);
      onClose();
    } catch (error) {
      console.error('Error generating report:', error);
      Alert.alert('Error', 'Failed to generate report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const renderParameterButton = (
    label: string,
    parameter: string,
    isSelected: boolean,
    onPress: () => void
  ) => {
    return (
      <TouchableOpacity
        style={[
          styles.filterButton,
          {
            backgroundColor: isSelected
              ? isDarkMode
                ? '#10B981'
                : '#059669'
              : isDarkMode
              ? '#374151'
              : '#F3F4F6',
          },
        ]}
        onPress={onPress}
      >
        <Text
          style={[
            styles.filterButtonText,
            {
              color: isSelected
                ? '#FFFFFF'
                : isDarkMode
                ? '#D1D5DB'
                : '#4B5563',
            },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' },
          ]}
        >
          <View style={styles.header}>
            <Text
              style={[
                styles.title,
                { color: isDarkMode ? '#F9FAFB' : '#111827' },
              ]}
            >
              Generate Meter Report
            </Text>
            <TouchableOpacity
              style={[
                styles.closeButton,
                { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' },
              ]}
              onPress={onClose}
            >
              <Ionicons
                name="close"
                size={20}
                color={isDarkMode ? '#9CA3AF' : '#6B7280'}
              />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Report Title */}
            <Text
              style={[
                styles.sectionTitle,
                { color: isDarkMode ? '#E5E7EB' : '#1F2937' },
              ]}
            >
              Report Title
            </Text>
            <TextInput
              style={[
                styles.titleInput,
                {
                  backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                  color: isDarkMode ? '#E5E7EB' : '#1F2937',
                  borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                }
              ]}
              value={reportTitle}
              onChangeText={setReportTitle}
              placeholder="Enter report title"
              placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
            />

            {/* Format Selection */}
            <Text
              style={[
                styles.sectionTitle,
                { color: isDarkMode ? '#E5E7EB' : '#1F2937' },
              ]}
            >
              Report Format
            </Text>
            <View style={styles.formatButtons}>
              <TouchableOpacity
                style={[
                  styles.formatButton,
                  {
                    backgroundColor:
                      format === ReportFormat.EXCEL
                        ? isDarkMode
                          ? '#10B981'
                          : '#059669'
                        : isDarkMode
                        ? '#374151'
                        : '#F3F4F6',
                  },
                ]}
                onPress={() => setFormat(ReportFormat.EXCEL)}
              >
                <Ionicons
                  name="grid-outline"
                  size={24}
                  color={
                    format === ReportFormat.EXCEL
                      ? '#FFFFFF'
                      : isDarkMode
                      ? '#9CA3AF'
                      : '#6B7280'
                  }
                  style={styles.formatButtonIcon}
                />
                <Text
                  style={[
                    styles.formatButtonText,
                    {
                      color:
                        format === ReportFormat.EXCEL
                          ? '#FFFFFF'
                          : isDarkMode
                          ? '#D1D5DB'
                          : '#4B5563',
                    },
                  ]}
                >
                  Excel (.xlsx)
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.formatButton,
                  {
                    backgroundColor:
                      format === ReportFormat.PDF
                        ? isDarkMode
                          ? '#EF4444'
                          : '#DC2626'
                        : isDarkMode
                        ? '#374151'
                        : '#F3F4F6',
                    opacity: 0.5, // Disabled for now
                  },
                ]}
                onPress={() => Alert.alert('Coming Soon', 'PDF generation will be available in a future update.')}
                disabled={true}
              >
                <Ionicons
                  name="document-text-outline"
                  size={24}
                  color={
                    format === ReportFormat.PDF
                      ? '#FFFFFF'
                      : isDarkMode
                      ? '#9CA3AF'
                      : '#6B7280'
                  }
                  style={styles.formatButtonIcon}
                />
                <Text
                  style={[
                    styles.formatButtonText,
                    {
                      color:
                        format === ReportFormat.PDF
                          ? '#FFFFFF'
                          : isDarkMode
                          ? '#D1D5DB'
                          : '#4B5563',
                    },
                  ]}
                >
                  PDF (Coming Soon)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Date Range */}
            <Text
              style={[
                styles.sectionTitle,
                { color: isDarkMode ? '#E5E7EB' : '#1F2937' },
              ]}
            >
              Date Range
            </Text>
            <View style={styles.dateRangeContainer}>
              <TouchableOpacity
                style={[
                  styles.dateButton,
                  { borderColor: isDarkMode ? '#4B5563' : '#D1D5DB' },
                ]}
                onPress={() => setShowStartPicker(true)}
              >
                <Text
                  style={[
                    styles.dateButtonLabel,
                    { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
                  ]}
                >
                  Start Date:
                </Text>
                <Text
                  style={[
                    styles.dateButtonText,
                    { color: isDarkMode ? '#E5E7EB' : '#1F2937' },
                  ]}
                >
                  {formatDate(startDate, 'PPP')} ({formatDate(startDate, 'p')})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.dateButton,
                  { borderColor: isDarkMode ? '#4B5563' : '#D1D5DB' },
                ]}
                onPress={() => setShowEndPicker(true)}
              >
                <Text
                  style={[
                    styles.dateButtonLabel,
                    { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
                  ]}
                >
                  End Date:
                </Text>
                <Text
                  style={[
                    styles.dateButtonText,
                    { color: isDarkMode ? '#E5E7EB' : '#1F2937' },
                  ]}
                >
                  {formatDate(endDate, 'PPP')} ({formatDate(endDate, 'p')})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Date Pickers (Visible conditionally) */}
            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="default"
                onChange={handleStartDateChange}
                maximumDate={today}
              />
            )}
            {showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="default"
                onChange={handleEndDateChange}
                maximumDate={today}
                minimumDate={startDate}
              />
            )}

            {/* Parameters Selection */}
            <Text
              style={[
                styles.sectionTitle,
                { color: isDarkMode ? '#E5E7EB' : '#1F2937' },
              ]}
            >
              Parameters to Include
            </Text>
            <View style={styles.filterContainer}>
              {renderParameterButton(
                'Voltage (V)', 
                'voltage', 
                selectedParameters.includes('voltage'), 
                () => toggleParameter('voltage')
              )}
              {renderParameterButton(
                'Current (A)', 
                'current', 
                selectedParameters.includes('current'), 
                () => toggleParameter('current')
              )}
              {renderParameterButton(
                'Frequency (Hz)', 
                'frequency', 
                selectedParameters.includes('frequency'), 
                () => toggleParameter('frequency')
              )}
              {renderParameterButton(
                'Power Factor', 
                'pf', 
                selectedParameters.includes('pf'), 
                () => toggleParameter('pf')
              )}
              {renderParameterButton(
                'Power (kW)', 
                'power', 
                selectedParameters.includes('power'), 
                () => toggleParameter('power')
              )}
              {renderParameterButton(
                'Energy (kWh)', 
                'energy', 
                selectedParameters.includes('energy'), 
                () => toggleParameter('energy')
              )}
            </View>

            {/* Sort Order */}
            <Text
              style={[
                styles.sectionTitle,
                { color: isDarkMode ? '#E5E7EB' : '#1F2937' },
              ]}
            >
              Sort Order
            </Text>
            <View style={styles.sortOrderContainer}>
              <TouchableOpacity
                style={[
                  styles.sortOrderButton,
                  {
                    backgroundColor:
                      sortOrder === SortOrder.NEWEST_FIRST
                        ? isDarkMode
                          ? '#10B981'
                          : '#059669'
                        : isDarkMode
                        ? '#374151'
                        : '#F3F4F6',
                  },
                ]}
                onPress={() => setSortOrder(SortOrder.NEWEST_FIRST)}
              >
                <Ionicons
                  name="arrow-down"
                  size={18}
                  color={
                    sortOrder === SortOrder.NEWEST_FIRST
                      ? '#FFFFFF'
                      : isDarkMode
                      ? '#9CA3AF'
                      : '#6B7280'
                  }
                  style={styles.sortButtonIcon}
                />
                <Text
                  style={[
                    styles.sortOrderButtonText,
                    {
                      color:
                        sortOrder === SortOrder.NEWEST_FIRST
                          ? '#FFFFFF'
                          : isDarkMode
                          ? '#D1D5DB'
                          : '#4B5563',
                    },
                  ]}
                >
                  Newest First
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.sortOrderButton,
                  {
                    backgroundColor:
                      sortOrder === SortOrder.OLDEST_FIRST
                        ? isDarkMode
                          ? '#10B981'
                          : '#059669'
                        : isDarkMode
                        ? '#374151'
                        : '#F3F4F6',
                  },
                ]}
                onPress={() => setSortOrder(SortOrder.OLDEST_FIRST)}
              >
                <Ionicons
                  name="arrow-up"
                  size={18}
                  color={
                    sortOrder === SortOrder.OLDEST_FIRST
                      ? '#FFFFFF'
                      : isDarkMode
                      ? '#9CA3AF'
                      : '#6B7280'
                  }
                  style={styles.sortButtonIcon}
                />
                <Text
                  style={[
                    styles.sortOrderButtonText,
                    {
                      color:
                        sortOrder === SortOrder.OLDEST_FIRST
                          ? '#FFFFFF'
                          : isDarkMode
                          ? '#D1D5DB'
                          : '#4B5563',
                    },
                  ]}
                >
                  Oldest First
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.cancelButton,
                {
                  backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                },
              ]}
              onPress={onClose}
              disabled={isGenerating}
            >
              <Text
                style={[
                  styles.cancelButtonText,
                  { color: isDarkMode ? '#E5E7EB' : '#4B5563' },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.generateButton,
                {
                  backgroundColor:
                    format === ReportFormat.EXCEL
                      ? isDarkMode
                        ? '#10B981'
                        : '#059669'
                      : isDarkMode
                      ? '#EF4444'
                      : '#DC2626',
                  opacity: isGenerating ? 0.7 : 1,
                },
              ]}
              onPress={handleGenerateReport}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.generateButtonText}>
                  {`Generate ${format === ReportFormat.EXCEL ? 'Excel' : 'PDF'}`}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '90%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(107, 114, 128, 0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    maxHeight: 500,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  formatButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  formatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  formatButtonIcon: {
    marginRight: 8,
  },
  formatButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dateRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 4,
  },
  dateButtonLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  dateButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    margin: 4,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  sortOrderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  sortOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  sortButtonIcon: {
    marginRight: 6,
  },
  sortOrderButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(107, 114, 128, 0.1)',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  generateButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  generateButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  titleInput: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 16,
    fontSize: 14,
  },
}); 