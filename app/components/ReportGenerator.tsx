import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format as formatDate } from 'date-fns';
import { useTheme } from '../context/ThemeContext';
import { ColumnGrouping, ExcelReportService } from '../services/ExcelReportService';
import { AlarmReportFilters, useAlarmReportData } from '../hooks/useAlarmReportData';

export interface ReportTimeRange {
  startDate: Date;
  endDate: Date;
}

export type ReportFormat = 'excel' | 'pdf';

interface ReportGeneratorProps {
  visible: boolean;
  onClose: () => void;
  onGenerate: (
    format: ReportFormat, 
    timeRange: ReportTimeRange,
    filters: {
      alarmTypes: string[];
      severityLevels: string[];
      zones: string[];
      grouping: ColumnGrouping;
      includeThresholds: boolean;
      includeStatusFields: boolean;
      shouldSplit?: boolean;
    }
  ) => Promise<string>;
  defaultTimeRange?: ReportTimeRange;
}

export function ReportGenerator({
  visible,
  onClose,
  onGenerate,
  defaultTimeRange,
}: ReportGeneratorProps) {
  const { isDarkMode } = useTheme();
  
  // State for report generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [format, setFormat] = useState<ReportFormat>('excel');
  
  // Time range state
  const [startDate, setStartDate] = useState<Date>(
    defaultTimeRange?.startDate || new Date(Date.now() - 1 * 60 * 60 * 1000) // Default to 1 hour ago
  );
  const [endDate, setEndDate] = useState<Date>(
    defaultTimeRange?.endDate || new Date()
  );
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Alarm filters state
  const [alarmTypes, setAlarmTypes] = useState<string[]>([]);
  const [severityLevels, setSeverityLevels] = useState<string[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [includeThresholds, setIncludeThresholds] = useState(true);
  const [includeStatusFields, setIncludeStatusFields] = useState(true);
  const [grouping, setGrouping] = useState<ColumnGrouping>(ColumnGrouping.NEWEST_FIRST);

  // Report title
  const [reportTitle, setReportTitle] = useState('Alarm Report');

  // Use the hook to fetch report data
  const { refetch: fetchReportData, isLoading, isFetching } = useAlarmReportData({
    startDate,
    endDate,
    alarmTypes: alarmTypes.length > 0 ? alarmTypes : undefined,
    severityLevels: severityLevels.length > 0 ? severityLevels : undefined,
    zones: zones.length > 0 ? zones : undefined
  }, false);

  // Handle date and time changes
  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartDatePicker(false);
    if (selectedDate) {
      // Preserve the time when changing date
      const newDate = new Date(selectedDate);
      newDate.setHours(startDate.getHours(), startDate.getMinutes(), startDate.getSeconds());
      setStartDate(newDate);
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      // Preserve the time when changing date
      const newDate = new Date(selectedDate);
      newDate.setHours(endDate.getHours(), endDate.getMinutes(), endDate.getSeconds());
      setEndDate(newDate);
    }
  };

  const handleStartTimeChange = (event: any, selectedTime?: Date) => {
    setShowStartTimePicker(false);
    if (selectedTime) {
      // Preserve the date when changing time
      const newDate = new Date(startDate);
      newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes(), selectedTime.getSeconds());
      setStartDate(newDate);
    }
  };

  const handleEndTimeChange = (event: any, selectedTime?: Date) => {
    setShowEndTimePicker(false);
    if (selectedTime) {
      // Preserve the date when changing time
      const newDate = new Date(endDate);
      newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes(), selectedTime.getSeconds());
      setEndDate(newDate);
    }
  };

  // Toggle filter items
  const toggleAlarmType = (type: string) => {
    setAlarmTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type) 
        : [...prev, type]
    );
  };

  const toggleSeverity = (severity: string) => {
    setSeverityLevels(prev => 
      prev.includes(severity) 
        ? prev.filter(s => s !== severity) 
        : [...prev, severity]
    );
  };

  const toggleZone = (zone: string) => {
    setZones(prev => 
      prev.includes(zone) 
        ? prev.filter(z => z !== zone) 
        : [...prev, zone]
    );
  };

  // Set grouping
  const setReportGrouping = (selectedGrouping: ColumnGrouping) => {
    setGrouping(selectedGrouping);
  };

  // Handle report generation
  const handleGenerateReport = async () => {
    if (endDate < startDate) {
      Alert.alert('Invalid Date Range', 'End date must be after start date.');
      return;
    }

    // Calculate time difference in hours
    const timeDifferenceMs = endDate.getTime() - startDate.getTime();
    const timeDifferenceHours = timeDifferenceMs / (1000 * 60 * 60);

    // Check if the time range is too large (>2 hours) and suggest splitting
    if (timeDifferenceHours > 2) {
      Alert.alert(
        'Large Time Range Detected',
        `You've selected ${timeDifferenceHours.toFixed(1)} hours of data. This will be automatically split into multiple reports for optimal performance.\n\nReports will be generated in 1-hour chunks to stay within Excel limits.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Proceed with Split Reports', 
            onPress: () => proceedWithSplitReports() 
          }
        ]
      );
      return;
    }

    try {
      setIsGenerating(true);

      // Call the parent's onGenerate function with the current state and filters
      await onGenerate(format, { startDate, endDate }, {
        alarmTypes,
        severityLevels,
        zones,
        grouping,
        includeThresholds,
        includeStatusFields
      });
      
      // Close the modal after successful generation
      onClose();
    } catch (error) {
      console.error('Error generating report:', error);
      // Don't show alert here as it's handled in parent
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle split report generation
  const proceedWithSplitReports = async () => {
    try {
      setIsGenerating(true);

      // Call the parent's onGenerate function with split flag
      await onGenerate(format, { startDate, endDate }, {
        alarmTypes,
        severityLevels,
        zones,
        grouping,
        includeThresholds,
        includeStatusFields,
        shouldSplit: true
      });
      
      // Close the modal after successful generation
      onClose();
    } catch (error) {
      console.error('Error generating split reports:', error);
      Alert.alert('Error', 'Failed to generate split reports. Please try a smaller time range.');
    } finally {
      setIsGenerating(false);
    }
  };

  const renderFilterButton = (
    label: string,
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
                ? '#3B82F6'
                : '#2563EB'
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
              Generate Report
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
                      format === 'excel'
                        ? isDarkMode
                          ? '#3B82F6'
                          : '#2563EB'
                        : isDarkMode
                        ? '#374151'
                        : '#F3F4F6',
                  },
                ]}
                onPress={() => setFormat('excel')}
              >
                <Ionicons
                  name="grid-outline"
                  size={24}
                  color={
                    format === 'excel'
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
                        format === 'excel'
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
                      format === 'pdf'
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
                // onPress={() => setFormat('pdf')}
                disabled={true}
              >
                <Ionicons
                  name="document-text-outline"
                  size={24}
                  color={
                    format === 'pdf'
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
                        format === 'pdf'
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
            <View style={[
              styles.warningContainer,
              { backgroundColor: isDarkMode ? '#374151' : '#FEF3C7' }
            ]}>
              <Text style={[
                styles.warningText,
                { color: isDarkMode ? '#FCD34D' : '#D97706' }
              ]}>
                ⚠️ SCADA Data: Recommended maximum 30 minutes to 2 hours (3,600 records/hour)
              </Text>
            </View>

            {/* Recommended Time Ranges */}
            <View style={[
              styles.recommendationsContainer,
              { backgroundColor: isDarkMode ? '#1F2937' : '#F9FAFB' }
            ]}>
              <Text style={[
                styles.recommendationTitle,
                { color: isDarkMode ? '#E5E7EB' : '#1F2937' }
              ]}>
                📊 Recommended Time Ranges
              </Text>
              <View style={styles.recommendationRow}>
                <Text style={[styles.recommendationLabel, { color: isDarkMode ? '#10B981' : '#059669' }]}>
                  ✅ 30 minutes: Fast & Reliable (1,800 records)
                </Text>
              </View>
              <View style={styles.recommendationRow}>
                <Text style={[styles.recommendationLabel, { color: isDarkMode ? '#10B981' : '#059669' }]}>
                  ✅ 1 hour: Good Performance (3,600 records)
                </Text>
              </View>
              <View style={styles.recommendationRow}>
                <Text style={[styles.recommendationLabel, { color: isDarkMode ? '#F59E0B' : '#D97706' }]}>
                  ⚠️ 2 hours: Slower but works (7,200 records)
                </Text>
              </View>
              <View style={styles.recommendationRow}>
                <Text style={[styles.recommendationLabel, { color: isDarkMode ? '#EF4444' : '#DC2626' }]}>
                  ❌ 3+ hours: May hit Excel limits
                </Text>
              </View>
            </View>
            <View style={styles.dateRangeContainer}>
              {/* Start Date and Time */}
              <View style={styles.dateTimeGroup}>
                <TouchableOpacity
                  style={[
                    styles.dateButton,
                    { borderColor: isDarkMode ? '#4B5563' : '#D1D5DB' },
                  ]}
                  onPress={() => setShowStartDatePicker(true)}
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
                    {formatDate(startDate, 'PPP')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.timeButton,
                    { borderColor: isDarkMode ? '#4B5563' : '#D1D5DB' },
                  ]}
                  onPress={() => setShowStartTimePicker(true)}
                >
                  <Text
                    style={[
                      styles.dateButtonLabel,
                      { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
                    ]}
                  >
                    Time:
                  </Text>
                  <Text
                    style={[
                      styles.dateButtonText,
                      { color: isDarkMode ? '#E5E7EB' : '#1F2937' },
                    ]}
                  >
                    {formatDate(startDate, 'HH:mm')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* End Date and Time */}
              <View style={styles.dateTimeGroup}>
                <TouchableOpacity
                  style={[
                    styles.dateButton,
                    { borderColor: isDarkMode ? '#4B5563' : '#D1D5DB' },
                  ]}
                  onPress={() => setShowEndDatePicker(true)}
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
                    {formatDate(endDate, 'PPP')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.timeButton,
                    { borderColor: isDarkMode ? '#4B5563' : '#D1D5DB' },
                  ]}
                  onPress={() => setShowEndTimePicker(true)}
                >
                  <Text
                    style={[
                      styles.dateButtonLabel,
                      { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
                    ]}
                  >
                    Time:
                  </Text>
                  <Text
                    style={[
                      styles.dateButtonText,
                      { color: isDarkMode ? '#E5E7EB' : '#1F2937' },
                    ]}
                  >
                    {formatDate(endDate, 'HH:mm')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Date and Time Pickers (Visible conditionally) */}
            {showStartDatePicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="default"
                onChange={handleStartDateChange}
                maximumDate={new Date()} // Prevent future dates
              />
            )}
            {showStartTimePicker && (
              <DateTimePicker
                value={startDate}
                mode="time"
                display="default"
                onChange={handleStartTimeChange}
                // Disable future times if startDate is today
                maximumDate={(() => {
                  const now = new Date();
                  const isToday = startDate.getFullYear() === now.getFullYear() &&
                    startDate.getMonth() === now.getMonth() &&
                    startDate.getDate() === now.getDate();
                  return isToday ? now : undefined;
                })()}
              />
            )}
            {showEndDatePicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="default"
                onChange={handleEndDateChange}
                maximumDate={new Date()} // Prevent future dates
                minimumDate={startDate} // End date cannot be before start date
              />
            )}
            {showEndTimePicker && (
              <DateTimePicker
                value={endDate}
                mode="time"
                display="default"
                onChange={handleEndTimeChange}
                // Disable future times if endDate is today
                maximumDate={(() => {
                  const now = new Date();
                  const isToday = endDate.getFullYear() === now.getFullYear() &&
                    endDate.getMonth() === now.getMonth() &&
                    endDate.getDate() === now.getDate();
                  return isToday ? now : undefined;
                })()}
                minimumDate={startDate}
              />
            )}

            {/* Alarm Types Filter */}
            <Text
              style={[
                styles.sectionTitle,
                { color: isDarkMode ? '#E5E7EB' : '#1F2937' },
              ]}
            >
              Alarm Types
            </Text>
            <View style={styles.filterContainer}>
              {renderFilterButton(
                'Predictive', 
                alarmTypes.includes('predictive'), 
                () => toggleAlarmType('predictive')
              )}
              {renderFilterButton(
                'Temperature', 
                alarmTypes.includes('temperature'), 
                () => toggleAlarmType('temperature')
              )}
              {renderFilterButton(
                'Carbon', 
                alarmTypes.includes('carbon'), 
                () => toggleAlarmType('carbon')
              )}
              {renderFilterButton(
                'Oil', 
                alarmTypes.includes('oil'), 
                () => toggleAlarmType('oil')
              )}
              {renderFilterButton(
                'Fan', 
                alarmTypes.includes('fan'), 
                () => toggleAlarmType('fan')
              )}
              {renderFilterButton(
                'Conveyor', 
                alarmTypes.includes('conveyor'), 
                () => toggleAlarmType('conveyor')
              )}
            </View>

            {/* Severity Filter */}
            <Text
              style={[
                styles.sectionTitle,
                { color: isDarkMode ? '#E5E7EB' : '#1F2937' },
              ]}
            >
              Severity
            </Text>
            <View style={styles.filterContainer}>
              {renderFilterButton(
                'Critical', 
                severityLevels.includes('critical'), 
                () => toggleSeverity('critical')
              )}
              {renderFilterButton(
                'Warning', 
                severityLevels.includes('warning'), 
                () => toggleSeverity('warning')
              )}
            </View>

            {/* Zone Filter */}
            <Text
              style={[
                styles.sectionTitle,
                { color: isDarkMode ? '#E5E7EB' : '#1F2937' },
              ]}
            >
              Zones
            </Text>
            <View style={styles.filterContainer}>
              {renderFilterButton(
                'Zone 1', 
                zones.includes('zone1'), 
                () => toggleZone('zone1')
              )}
              {renderFilterButton(
                'Zone 2', 
                zones.includes('zone2'), 
                () => toggleZone('zone2')
              )}
            </View>

            {/* Excel Report Options */}
            {format === 'excel' && (
              <>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: isDarkMode ? '#E5E7EB' : '#1F2937' },
                  ]}
                >
                  Data Grouping
                </Text>
                <View style={styles.filterContainer}>
                  {renderFilterButton(
                    'Newest First', 
                    grouping === ColumnGrouping.NEWEST_FIRST, 
                    () => setReportGrouping(ColumnGrouping.NEWEST_FIRST)
                  )}
                  {renderFilterButton(
                    'Oldest First', 
                    grouping === ColumnGrouping.OLDEST_FIRST, 
                    () => setReportGrouping(ColumnGrouping.OLDEST_FIRST)
                  )}
                  {renderFilterButton(
                    'By Type', 
                    grouping === ColumnGrouping.BY_TYPE, 
                    () => setReportGrouping(ColumnGrouping.BY_TYPE)
                  )}
                  {renderFilterButton(
                    'By Zone', 
                    grouping === ColumnGrouping.BY_ZONE, 
                    () => setReportGrouping(ColumnGrouping.BY_ZONE)
                  )}
                </View>

                <Text
                  style={[
                    styles.sectionTitle,
                    { color: isDarkMode ? '#E5E7EB' : '#1F2937' },
                  ]}
                >
                  Additional Options
                </Text>
                <View style={styles.optionsContainer}>
                  <View style={styles.optionRow}>
                    <Text
                      style={[
                        styles.optionText,
                        { color: isDarkMode ? '#D1D5DB' : '#4B5563' },
                      ]}
                    >
                      Include Threshold Values
                    </Text>
                    <Switch
                      value={includeThresholds}
                      onValueChange={setIncludeThresholds}
                      trackColor={{
                        false: isDarkMode ? '#4B5563' : '#D1D5DB',
                        true: isDarkMode ? '#3B82F6' : '#2563EB',
                      }}
                      thumbColor={isDarkMode ? '#E5E7EB' : '#FFFFFF'}
                    />
                  </View>

                  <View style={styles.optionRow}>
                    <Text
                      style={[
                        styles.optionText,
                        { color: isDarkMode ? '#D1D5DB' : '#4B5563' },
                      ]}
                    >
                      Include Status Fields
                    </Text>
                    <Switch
                      value={includeStatusFields}
                      onValueChange={setIncludeStatusFields}
                      trackColor={{
                        false: isDarkMode ? '#4B5563' : '#D1D5DB',
                        true: isDarkMode ? '#3B82F6' : '#2563EB',
                      }}
                      thumbColor={isDarkMode ? '#E5E7EB' : '#FFFFFF'}
                    />
                  </View>
                </View>
              </>
            )}
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
                    format === 'excel'
                      ? isDarkMode
                        ? '#3B82F6'
                        : '#2563EB'
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
                  {`Generate ${format === 'excel' ? 'Excel' : 'PDF'}`}
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
    flexDirection: 'column',
    gap: 12,
  },
  dateTimeGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  dateButton: {
    flex: 2,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  timeButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
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
  optionsContainer: {
    marginVertical: 8,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(107, 114, 128, 0.1)',
  },
  optionText: {
    fontSize: 14,
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
  warningContainer: {
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  recommendationsContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(107, 114, 128, 0.2)',
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  recommendationRow: {
    marginVertical: 2,
  },
  recommendationLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
}); 