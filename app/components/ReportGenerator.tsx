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
  onGenerate: (format: ReportFormat, timeRange: ReportTimeRange) => Promise<string>;
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
    defaultTimeRange?.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  );
  const [endDate, setEndDate] = useState<Date>(
    defaultTimeRange?.endDate || new Date()
  );
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Alarm filters state
  const [alarmTypes, setAlarmTypes] = useState<string[]>([]);
  const [severityLevels, setSeverityLevels] = useState<string[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [includeThresholds, setIncludeThresholds] = useState(true);
  const [includeStatusFields, setIncludeStatusFields] = useState(true);
  const [grouping, setGrouping] = useState<ColumnGrouping>(ColumnGrouping.CHRONOLOGICAL);

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

  // Handle date change
  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(false);
    if (selectedDate) {
      setStartDate(selectedDate);
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndPicker(false);
    if (selectedDate) {
      setEndDate(selectedDate);
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

    try {
      setIsGenerating(true);

      if (format === 'excel') {
        // Fetch report data
        const result = await fetchReportData();
        
        if (!result.data || !result.data.data || result.data.data.length === 0) {
          Alert.alert('No Data', 'No data found for the specified filters.');
          setIsGenerating(false);
          return;
        }

        // Generate Excel report
        const filePath = await ExcelReportService.generateExcelReport({
          alarmData: result.data.data,
          title: reportTitle,
          grouping,
          includeThresholds,
          includeStatusFields
        });

        // Share the file
        await ExcelReportService.shareExcelFile(filePath);
      } else if (format === 'pdf') {
        // Use the existing onGenerate for PDF (if implemented)
        await onGenerate(format, { startDate, endDate });
      }
    } catch (error) {
      console.error('Error generating report:', error);
      Alert.alert('Error', 'Failed to generate report. Please try again.');
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
                  {formatDate(startDate, 'PPP')}
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
                  {formatDate(endDate, 'PPP')}
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
              />
            )}
            {showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="default"
                onChange={handleEndDateChange}
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
                    'Chronological', 
                    grouping === ColumnGrouping.CHRONOLOGICAL, 
                    () => setReportGrouping(ColumnGrouping.CHRONOLOGICAL)
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
}); 