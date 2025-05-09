import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { LineChart, BarChart } from 'react-native-gifted-charts';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, subDays, subHours, startOfDay, endOfDay } from 'date-fns';
import { useAlarmHistory } from '../../hooks/useAlarms';

// Get screen width
const screenWidth = Dimensions.get('window').width;

// TimeRange type for date filtering
type TimeRange = '1d' | '3d' | '7d' | '24h' | '12h' | '1h' | 'custom';

export default function AnalyticsScreen() {
  const { isDarkMode } = useTheme();
  
  // State for date range and time range
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'start' | 'end'>('start');
  
  // State for custom date range
  const [startDate, setStartDate] = useState(subHours(new Date(), 24));
  const [endDate, setEndDate] = useState(new Date());
  
  // Calculate actual date range based on selected timeRange
  const dateRange = useMemo(() => {
    const end = new Date();
    let start: Date;
    
    switch (timeRange) {
      case '1h':
        start = subHours(end, 1);
        break;
      case '12h':
        start = subHours(end, 12);
        break;
      case '24h':
        start = subHours(end, 24);
        break;
      case '1d':
        start = startOfDay(end);
        break;
      case '3d':
        start = subDays(end, 3);
        break;
      case '7d':
        start = subDays(end, 7);
        break;
      case 'custom':
        return { start: startDate, end: endDate };
      default:
        start = subHours(end, 24);
    }
    
    return { start, end };
  }, [timeRange, startDate, endDate]);
  
  // Calculate hours difference for the API call
  const hoursDiff = useMemo(() => {
    const diffMs = dateRange.end.getTime() - dateRange.start.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60));
  }, [dateRange]);
  
  // Fetch alarm history data
  const { data: alarmHistory, isLoading, error } = useAlarmHistory(hoursDiff);
  
  // Handle date picker change
  const onChangeDatePicker = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      if (pickerMode === 'start') {
        setStartDate(selectedDate);
      } else {
        setEndDate(selectedDate);
      }
    }
  };
  
  // Handle showing date picker
  const openDatePicker = (mode: 'start' | 'end') => {
    setPickerMode(mode);
    setShowDatePicker(true);
  };
  
  // Filter and prepare data for analog alarms chart
  const analogChartData = useMemo(() => {
    if (!alarmHistory) return null;
    
    // Filter for analog alarms (ones with numeric values)
    const analogAlarms = alarmHistory.filter(alarm => 
      ['temperature', 'carbon', 'pressure', 'level'].includes(alarm.type) &&
      !isNaN(Number(alarm.value))
    );
    
    // Group by type
    const groupedByType = analogAlarms.reduce((acc, alarm) => {
      const key = `${alarm.type}${alarm.zone ? `-${alarm.zone}` : ''}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push({
        ...alarm,
        value: Number(alarm.value),
        setPoint: Number(alarm.setPoint),
        timestamp: new Date(alarm.timestamp),
      });
      return acc;
    }, {} as Record<string, any[]>);
    
    // Prepare datasets for gifted-charts
    const dataSets: any[] = [];
    const allLabels: string[] = [];
    
    Object.entries(groupedByType).forEach(([key, alarms], index) => {
      // Sort by timestamp
      const sortedData = alarms.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      // Colors for different alarm types
      const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#8AC24A'
      ];
      const color = colors[index % colors.length];
      
      // Create data points for this series
      const dataPoints = sortedData.map(alarm => {
        const timeLabel = format(alarm.timestamp, 'HH:mm');
        if (!allLabels.includes(timeLabel)) {
          allLabels.push(timeLabel);
        }
        
        return {
          value: alarm.value,
          dataPointText: alarm.value.toString(),
          label: timeLabel,
          dataPointColor: color,
          showDataPoint: true,
        };
      });
      
      dataSets.push({
        seriesName: key,
        data: dataPoints,
        color,
      });
    });
    
    // Sort all labels chronologically
    allLabels.sort();
    
    // If too many labels, show fewer
    let displayLabels = allLabels;
    if (displayLabels.length > 6) {
      const step = Math.ceil(displayLabels.length / 6);
      displayLabels = displayLabels.filter((_, i) => i % step === 0);
    }
    
    return {
      dataSets,
      labels: displayLabels,
    };
  }, [alarmHistory]);
  
  // Filter and prepare data for binary alarms chart
  const binaryChartData = useMemo(() => {
    if (!alarmHistory) return null;
    
    // Filter for binary alarms (conveyor, motor, fan, heater)
    const binaryAlarms = alarmHistory.filter(alarm => 
      ['conveyor', 'motor', 'fan', 'heater'].includes(alarm.type)
    );
    
    // Group by type
    const groupedByType = binaryAlarms.reduce((acc, alarm) => {
      const key = `${alarm.type}${alarm.zone ? `-${alarm.zone}` : ''}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push({
        ...alarm,
        // Convert to 0 or 1 based on value (assuming "Running"/"Stopped" or similar text values)
        value: alarm.value === 'Running' ? 1 : 0,
        timestamp: new Date(alarm.timestamp),
      });
      return acc;
    }, {} as Record<string, any[]>);
    
    // Prepare data for gifted-charts
    const data: any[] = [];
    const legend: string[] = [];
    
    // Colors based on alarm type
    const colors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#8AC24A'
    ];
    
    // Convert grouped data to the format expected by BarChart
    Object.entries(groupedByType).forEach(([key, alarms], index) => {
      // Sort by timestamp
      const sortedData = alarms.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      // Add to legend
      legend.push(key);
      
      // Create stacked bar data
      sortedData.forEach(alarm => {
        const timeLabel = format(alarm.timestamp, 'HH:mm');
        
        // Find existing item with this timestamp or create new
        let item = data.find(d => d.label === timeLabel);
        if (!item) {
          item = { 
            label: timeLabel,
            value: 0,
            spacing: 8,
            labelWidth: 60,
            labelTextStyle: { 
              color: colors[index % colors.length],
              textAlign: 'center',
              fontSize: 10,
            },
            frontColor: colors[index % colors.length],
          };
          data.push(item);
        }
        
        // Set the value for this key
        item[key] = alarm.value;
        item.value += alarm.value; // For total height
      });
    });
    
    return {
      data,
      legend,
    };
  }, [alarmHistory]);
  
  // Handle generating report
  const handleGenerateReport = () => {
    // This would call the API to generate a report with the current date range
    console.log("Generating report for range:", {
      from: format(dateRange.start, 'yyyy-MM-dd HH:mm:ss'),
      to: format(dateRange.end, 'yyyy-MM-dd HH:mm:ss')
    });
  };
  
  // Render time range selector buttons
  const renderTimeRangeSelector = () => {
    const ranges: { label: string; value: TimeRange }[] = [
      { label: '1H', value: '1h' },
      { label: '12H', value: '12h' },
      { label: '24H', value: '24h' },
      { label: '1D', value: '1d' },
      { label: '3D', value: '3d' },
      { label: '7D', value: '7d' },
      { label: 'Custom', value: 'custom' },
    ];
    
    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.timeRangeContainer}
      >
        {ranges.map((range) => (
          <TouchableOpacity
            key={range.value}
            style={[
              styles.timeRangeButton,
              timeRange === range.value && styles.timeRangeButtonActive,
              { 
                backgroundColor: isDarkMode 
                  ? timeRange === range.value ? '#3B82F6' : '#1F2937'
                  : timeRange === range.value ? '#2563EB' : '#F3F4F6'
              }
            ]}
            onPress={() => setTimeRange(range.value)}
          >
            <Text 
              style={[
                styles.timeRangeButtonText,
                { 
                  color: isDarkMode
                    ? timeRange === range.value ? '#FFFFFF' : '#E5E7EB'
                    : timeRange === range.value ? '#FFFFFF' : '#4B5563' 
                }
              ]}
            >
              {range.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };
  
  // Render custom date range selector
  const renderCustomDateRange = () => {
    if (timeRange !== 'custom') return null;
    
    return (
      <View style={styles.customDateContainer}>
        <TouchableOpacity 
          style={[
            styles.dateButton,
            { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }
          ]}
          onPress={() => openDatePicker('start')}
        >
          <Ionicons 
            name="calendar-outline" 
            size={18} 
            color={isDarkMode ? '#E5E7EB' : '#4B5563'} 
            style={styles.dateIcon}
          />
          <Text style={[
            styles.dateText,
            { color: isDarkMode ? '#E5E7EB' : '#4B5563' }
          ]}>
            From: {format(startDate, 'yyyy-MM-dd HH:mm')}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.dateButton,
            { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }
          ]}
          onPress={() => openDatePicker('end')}
        >
          <Ionicons 
            name="calendar-outline" 
            size={18}
            color={isDarkMode ? '#E5E7EB' : '#4B5563'} 
            style={styles.dateIcon}
          />
          <Text style={[
            styles.dateText,
            { color: isDarkMode ? '#E5E7EB' : '#4B5563' }
          ]}>
            To: {format(endDate, 'yyyy-MM-dd HH:mm')}
          </Text>
        </TouchableOpacity>
        
        {showDatePicker && Platform.OS !== 'web' && (
          <DateTimePicker
            value={pickerMode === 'start' ? startDate : endDate}
            mode="datetime"
            display="default"
            onChange={onChangeDatePicker}
          />
        )}
      </View>
    );
  };
  
  // Chart configuration for line chart
  const lineChartConfig = {
    backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
    textColor: isDarkMode ? '#E5E7EB' : '#4B5563',
    axisColor: isDarkMode ? 'rgba(229, 231, 235, 0.3)' : 'rgba(75, 85, 99, 0.3)',
    showDataPointOnFocus: true,
    hideRules: false,
    hideYAxisText: false,
    yAxisTextStyle: {
      color: isDarkMode ? '#9CA3AF' : '#6B7280',
      fontSize: 10,
    },
    xAxisLabelTextStyle: {
      color: isDarkMode ? '#9CA3AF' : '#6B7280',
      fontSize: 10,
      textAlign: 'center',
      width: 60,
    },
    spacing: 40,
  };
  
  // Define colors for different chart series
  const chartColors = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#8AC24A'
  ];

  // Render Analog Alarms Chart
  const renderAnalogChart = () => {
    if (!analogChartData || analogChartData.dataSets.length === 0) {
      return (
        <View style={styles.noDataContainer}>
          <Ionicons
            name="analytics-outline"
            size={48}
            color={isDarkMode ? '#4B5563' : '#9CA3AF'}
          />
          <Text style={[styles.noDataText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            No analog alarm data available for the selected time range.
          </Text>
        </View>
      );
    }

    // Flatten all data points
    const allData = analogChartData.dataSets.flatMap(set => set.data);

    return (
      <LineChart
        data={allData}
        height={220}
        width={screenWidth - 40}
        noOfSections={5}
        spacing={lineChartConfig.spacing}
        color={isDarkMode ? '#FFFFFF' : '#111827'}
        thickness={2}
        startFillColor="rgba(20,105,81,0.3)"
        endFillColor="rgba(20,85,81,0.01)"
        startOpacity={0.6}
        endOpacity={0.1}
        initialSpacing={10}
        yAxisThickness={1}
        xAxisThickness={1}
        yAxisTextStyle={lineChartConfig.yAxisTextStyle}
        xAxisLabelTextStyle={lineChartConfig.xAxisLabelTextStyle}
        yAxisColor={lineChartConfig.axisColor}
        xAxisColor={lineChartConfig.axisColor}
        backgroundColor={lineChartConfig.backgroundColor}
        curved
      />
    );
  };

  // Render Binary Alarms Chart
  const renderBinaryChart = () => {
    if (!binaryChartData || binaryChartData.data.length === 0) {
      return (
        <View style={styles.noDataContainer}>
          <Ionicons
            name="pulse-outline"
            size={48}
            color={isDarkMode ? '#4B5563' : '#9CA3AF'}
          />
          <Text style={[styles.noDataText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            No binary alarm data available for the selected time range.
          </Text>
        </View>
      );
    }

    return (
      <BarChart
        data={binaryChartData.data}
        height={220}
        width={screenWidth - 40}
        noOfSections={2}
        barWidth={22}
        spacing={lineChartConfig.spacing}
        color={isDarkMode ? '#FFFFFF' : '#111827'}
        yAxisThickness={1}
        xAxisThickness={1}
        yAxisTextStyle={lineChartConfig.yAxisTextStyle}
        xAxisLabelTextStyle={lineChartConfig.xAxisLabelTextStyle}
        yAxisColor={lineChartConfig.axisColor}
        xAxisColor={lineChartConfig.axisColor}
        showLine
        maxValue={1}
        initialSpacing={10}
        backgroundColor={lineChartConfig.backgroundColor}
      />
    );
  };

  // Render the legend
  const renderLegend = () => {
    const legendItems: React.ReactNode[] = [];
    
    // Add analog chart legend items
    if (analogChartData && analogChartData.dataSets.length > 0) {
      analogChartData.dataSets.forEach((dataset, index) => {
        legendItems.push(
          <View key={`analog-${index}`} style={styles.legendItem}>
            <View 
              style={[
                styles.legendColorBox, 
                { backgroundColor: dataset.color }
              ]} 
            />
            <Text style={[styles.legendText, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
              {dataset.seriesName}
            </Text>
          </View>
        );
      });
    }
    
    // Add binary chart legend items
    if (binaryChartData && binaryChartData.legend.length > 0) {
      binaryChartData.legend.forEach((key, index) => {
        legendItems.push(
          <View key={`binary-${index}`} style={styles.legendItem}>
            <View 
              style={[
                styles.legendColorBox, 
                { backgroundColor: chartColors[index % chartColors.length] }
              ]} 
            />
            <Text style={[styles.legendText, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
              {key} (Binary)
            </Text>
          </View>
        );
      });
    }
    
    return (
      <View style={styles.legendItems}>
        {legendItems}
      </View>
    );
  };
  
  // Render loading state
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' }]}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDarkMode ? '#60A5FA' : '#2563EB'} />
          <Text style={[styles.loadingText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Loading analytics...
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' }]}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={64}
            color={isDarkMode ? '#F87171' : '#EF4444'}
          />
          <Text style={[styles.errorTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            Error Loading Data
          </Text>
          <Text style={[styles.errorMessage, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            {error instanceof Error ? error.message : 'Failed to load alarm history'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
          Analytics
        </Text>
        <Text style={[styles.headerSubtitle, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
          Visualize alarm trends and patterns
        </Text>
      </View>
      
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Time Range Selector */}
        {renderTimeRangeSelector()}
        
        {/* Custom Date Range */}
        {renderCustomDateRange()}
        
        {/* Date Range Display */}
        <View style={styles.dateRangeDisplay}>
          <Text style={[styles.dateRangeText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Showing data from {format(dateRange.start, 'MMM d, yyyy HH:mm')} to {format(dateRange.end, 'MMM d, yyyy HH:mm')}
          </Text>
        </View>
        
        {/* Report Generation Button */}
        <TouchableOpacity
          style={[styles.reportButton, { backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB' }]}
          onPress={handleGenerateReport}
        >
          <Ionicons name="download-outline" size={18} color="#FFFFFF" style={styles.reportButtonIcon} />
          <Text style={styles.reportButtonText}>Generate Report</Text>
        </TouchableOpacity>
        
        {/* Analog Alarms Chart */}
        <View style={[styles.chartContainer, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}>
          <Text style={[styles.chartTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            Analog Alarms
          </Text>
          
          {renderAnalogChart()}
        </View>
        
        {/* Binary Alarms Chart */}
        <View style={[styles.chartContainer, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}>
          <Text style={[styles.chartTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            Binary Alarms
          </Text>
          
          {renderBinaryChart()}
        </View>
        
        {/* Legend */}
        <View style={[styles.legendContainer, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}>
          <Text style={[styles.legendTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            Legend
          </Text>
          
          {renderLegend()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  timeRangeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  timeRangeButtonActive: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  timeRangeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  customDateContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  dateText: {
    fontSize: 14,
  },
  dateIcon: {
    marginRight: 4,
  },
  dateRangeDisplay: {
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  dateRangeText: {
    fontSize: 12,
    textAlign: 'center',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 16,
  },
  reportButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  reportButtonIcon: {
    marginRight: 8,
  },
  chartContainer: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  chart: {
    borderRadius: 12,
    marginVertical: 8,
  },
  legendContainer: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    marginBottom: 8,
  },
  legendColorBox: {
    width: 12,
    height: 12,
    borderRadius: 4,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  noDataText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
}); 