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
import { format as formatDate, subDays, subHours, startOfDay, endOfDay } from 'date-fns';
import { useAlarmHistory } from '../../hooks/useAlarms';

// Mock data for analog alarms
const sampleAnalogAlarms = [
  {
    id: 'analog-1',
    description: 'HARDENING ZONE 1 TEMPERATURE (LOW/HIGH)',
    severity: 'warning',
    status: 'active',
    type: 'temperature',
    value: '860',
    unit: '°C',
    setPoint: '870°C (-30/+10)',
    lowLimit: '850°C',
    highLimit: '880°C',
    timestamp: new Date().toISOString(),
    zone: 'zone1'
  },
  {
    id: 'analog-2',
    description: 'HARDENING ZONE 2 TEMPERATURE (LOW/HIGH)',
    severity: 'critical',
    status: 'active',
    type: 'temperature',
    value: '895',
    unit: '°C',
    setPoint: '880°C (-10/+10)',
    lowLimit: '870°C',
    highLimit: '890°C',
    timestamp: new Date().toISOString(),
    zone: 'zone2'
  },
  {
    id: 'analog-3',
    description: 'CARBON POTENTIAL (CP %)',
    severity: 'info',
    status: 'active',
    type: 'carbon',
    value: '0.42',
    unit: '%',
    setPoint: '0.40% (±0.05)',
    lowLimit: '0.35%',
    highLimit: '0.45%',
    timestamp: new Date().toISOString()
  },
  {
    id: 'analog-4',
    description: 'OIL TEMPERATURE (LOW/HIGH)',
    severity: 'warning',
    status: 'active',
    type: 'temperature',
    value: '72',
    unit: '°C',
    setPoint: '60°C',
    lowLimit: '-',
    highLimit: '80°C',
    timestamp: new Date().toISOString()
  },
  {
    id: 'analog-5',
    description: 'TEMPERING ZONE1 TEMPERATURE (LOW/HIGH)',
    severity: 'warning',
    status: 'active',
    type: 'temperature',
    value: '435',
    unit: '°C',
    setPoint: '450°C (-30/+10°C)',
    lowLimit: '420°C',
    highLimit: '460°C',
    timestamp: new Date().toISOString(),
    zone: 'zone1'
  },
  {
    id: 'analog-6',
    description: 'TEMPERING ZONE2 TEMPERATURE (LOW/HIGH)',
    severity: 'info',
    status: 'active',
    type: 'temperature',
    value: '455',
    unit: '°C',
    setPoint: '460°C (±10°C)',
    lowLimit: '450°C',
    highLimit: '470°C',
    timestamp: new Date().toISOString(),
    zone: 'zone2'
  }
];

// Mock data for binary alarms
const sampleBinaryAlarms = [
  {
    id: 'binary-1',
    description: 'OIL LEVEL (LOW/HIGH)',
    severity: 'critical',
    status: 'active',
    type: 'level',
    value: 'Normal',
    setPoint: 'Normal',
    timestamp: new Date().toISOString()
  },
  {
    id: 'binary-2',
    description: 'HARDENING HEATER FAILURE (ZONE 1)',
    severity: 'critical',
    status: 'active',
    type: 'heater',
    value: 'Normal',
    setPoint: 'Normal',
    timestamp: new Date().toISOString(),
    zone: 'zone1'
  },
  {
    id: 'binary-3',
    description: 'HARDENING HEATER FAILURE (ZONE 2)',
    severity: 'critical',
    status: 'active',
    type: 'heater',
    value: 'FAILURE',
    setPoint: 'Normal',
    timestamp: new Date().toISOString(),
    zone: 'zone2'
  },
  {
    id: 'binary-4',
    description: 'HARDENING CONVEYOR (NOT ROTATING)',
    severity: 'warning',
    status: 'active',
    type: 'conveyor',
    value: 'NOT ROTATING',
    setPoint: 'Rotating',
    timestamp: new Date().toISOString()
  },
  {
    id: 'binary-5',
    description: 'OIL QUECH CONVEYOR (NOT ROTATING)',
    severity: 'warning',
    status: 'active',
    type: 'conveyor',
    value: 'NOT ROTATING',
    setPoint: 'Rotating',
    timestamp: new Date().toISOString()
  },
  {
    id: 'binary-6',
    description: 'HARDENING FAN MOTOR NOT RUNNING (ZONE 1)',
    severity: 'warning',
    status: 'active',
    type: 'fan',
    value: 'NOT RUNNING',
    setPoint: 'Running',
    timestamp: new Date().toISOString(),
    zone: 'zone1'
  },
  {
    id: 'binary-7',
    description: 'HARDENING FAN MOTOR NOT RUNNING (ZONE 2)',
    severity: 'warning',
    status: 'active',
    type: 'fan',
    value: 'NOT RUNNING',
    setPoint: 'Running',
    timestamp: new Date().toISOString(),
    zone: 'zone2'
  },
  {
    id: 'binary-8',
    description: 'TEMPERING CONVEYOR (NOT ROTATING)',
    severity: 'warning',
    status: 'active',
    type: 'conveyor',
    value: 'NOT ROTATING',
    setPoint: 'Rotating',
    timestamp: new Date().toISOString()
  },
  {
    id: 'binary-9',
    description: 'TEMPERING FAN MOTOR NOT RUNNING (ZONE 1)',
    severity: 'warning',
    status: 'active',
    type: 'fan',
    value: 'NOT RUNNING',
    setPoint: 'Running',
    timestamp: new Date().toISOString(),
    zone: 'zone1'
  },
  {
    id: 'binary-10',
    description: 'TEMPERING FAN MOTOR NOT RUNNING (ZONE 2)',
    severity: 'warning',
    status: 'active',
    type: 'fan',
    value: 'NOT RUNNING',
    setPoint: 'Running',
    timestamp: new Date().toISOString(),
    zone: 'zone2'
  }
];

// Get screen width
const screenWidth = Dimensions.get('window').width;

// TimeRange type for date filtering
type TimeRange = '1d' | '3d' | '7d' | '24h' | '12h' | '1h' | 'custom';

// Define types for our chart data
type AnalogDataPoint = {
  value: number;
  label: string;
  dataPointText: string;
};

type AnalogDataset = {
  data: AnalogDataPoint[];
  color: string;
  dataPointsColor: string;
  textColor: string;
  textFontSize: number;
};

type BinaryDataPoint = {
  value: number;
  label: string;
  frontColor: string;
  topLabelComponent?: () => React.ReactNode;
  side?: number;
};

export default function AnalyticsScreen() {
  const { isDarkMode } = useTheme();
  
  // State for date range and time range
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'start' | 'end'>('start');
  
  // State for custom date range
  const [startDate, setStartDate] = useState(subHours(new Date(), 24));
  const [endDate, setEndDate] = useState(new Date());

  // Colors for different alarm types
  const alarmColors = {
    temperature: '#FF6384',
    carbon: '#36A2EB',
    level: '#FFCE56',
    heater: '#4BC0C0',
    fan: '#9966FF',
    conveyor: '#FF9F40',
  };
  
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
  
  // Format data for LineChart component with multiple lines (one for each alarm)
  const prepareLineChartData = useMemo(() => {
    // Create a dataset with data points for all alarms with different time points
    const now = new Date();
    const colors = [
      '#FF6384', // Red
      '#36A2EB', // Blue
      '#FFCE56', // Yellow
      '#4BC0C0', // Teal
      '#9966FF', // Purple
      '#FF9F40', // Orange
    ];

    // Create separate datasets for each alarm type
    const datasets: AnalogDataset[] = [];
    
    // Loop through each analog alarm to create its dataset
    sampleAnalogAlarms.forEach((alarm, alarmIndex) => {
      const baseValue = parseFloat(alarm.value);
      const alarmData: AnalogDataPoint[] = [];
      
      // Create 12 data points for each alarm (over 24 hours)
      for (let i = 0; i < 12; i++) {
        const time = new Date(now);
        time.setHours(now.getHours() - (11 - i) * 2);
        
        // Create variation for demo purposes
        const variation = Math.sin(i / 2) * baseValue * 0.15 + 
                          (Math.random() - 0.5) * baseValue * 0.05;
        
        alarmData.push({
          value: baseValue + variation,
          label: formatDate(time, 'HH:mm'),
          dataPointText: `${(baseValue + variation).toFixed(1)}${alarm.unit}`,
        });
      }
      
      // Add this alarm's dataset to the collection
      datasets.push({
        data: alarmData,
        color: colors[alarmIndex % colors.length],
        dataPointsColor: colors[alarmIndex % colors.length],
        textColor: colors[alarmIndex % colors.length],
        textFontSize: 8,
      });
    });
    
    return datasets;
  }, []);

  // Prepare binary alarms data
  const prepareBinaryChartData = useMemo(() => {
    const binaryData: BinaryDataPoint[] = [];
    const now = new Date();
    
    // Create data for 6 time points
    for (let i = 0; i < 6; i++) {
      const time = new Date(now);
      time.setHours(now.getHours() - (5 - i) * 4);
      
      // For each binary alarm type, create a value
      sampleBinaryAlarms.forEach((alarm, index) => {
        if (index < 4) { // Limit to 4 types for cleaner display
          const isActive = Math.random() > 0.5; // Randomly active or inactive
          binaryData.push({
            value: isActive ? 1 : 0,
            label: formatDate(time, 'HH:mm'),
            frontColor: alarmColors[alarm.type as keyof typeof alarmColors],
            topLabelComponent: () => (
              <Text style={{
                color: isDarkMode ? '#E5E7EB' : '#4B5563',
                fontSize: 8,
                transform: [{ rotate: '-45deg' }]
              }}>
                {alarm.type}
              </Text>
            ),
          });
        }
      });
    }
    
    return binaryData;
  }, [isDarkMode]);
  
  // Format data for a single-line chart (fallback for multiple lines)
  const analogLineData = useMemo(() => {
    if (prepareLineChartData.length === 0) return [];
    
    // Use first alarm's data to define data points
    const firstDataset = prepareLineChartData[0];
    return firstDataset.data.map((point, index) => {
      return {
        ...point,
        color: firstDataset.color,
        dataPointColor: firstDataset.color,
      };
    });
  }, [prepareLineChartData]);
  
  // Handle generating report
  const handleGenerateReport = () => {
    // This would call the API to generate a report with the current date range
    console.log("Generating report for range:", {
      from: formatDate(dateRange.start, 'yyyy-MM-dd HH:mm:ss'),
      to: formatDate(dateRange.end, 'yyyy-MM-dd HH:mm:ss')
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
            From: {formatDate(startDate, 'yyyy-MM-dd HH:mm')}
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
            To: {formatDate(endDate, 'yyyy-MM-dd HH:mm')}
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
  
  // Chart configuration
  const chartConfig = {
    backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
    textColor: isDarkMode ? '#E5E7EB' : '#4B5563',
    axisColor: isDarkMode ? 'rgba(229, 231, 235, 0.3)' : 'rgba(75, 85, 99, 0.3)',
    yAxisTextStyle: {
      color: isDarkMode ? '#9CA3AF' : '#6B7280',
      fontSize: 10,
    },
    xAxisLabelTextStyle: {
      color: isDarkMode ? '#9CA3AF' : '#6B7280',
      fontSize: 10,
      width: 60,
      textAlign: 'center',
    },
  };

  // Render analog alarms chart with multiple lines
  const renderAnalogChart = () => (
    <View style={[styles.chartContainer, { backgroundColor: chartConfig.backgroundColor }]}>
      <Text style={[styles.chartTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
        Analog Alarms
      </Text>
      
      {/* Use multiple LineChart components for multiple lines */}
      <View style={{ position: 'relative' }}>
        {prepareLineChartData.map((dataset, index) => (
          <View key={index} style={{ position: index === 0 ? 'relative' : 'absolute', top: 0, left: 0, right: 0 }}>
            <LineChart
              data={dataset.data}
              height={300}
              width={screenWidth - 40}
              spacing={30}
              initialSpacing={20}
              color={dataset.color}
              thickness={2}
              noOfSections={5}
              yAxisThickness={index === 0 ? 1 : 0}
              xAxisThickness={index === 0 ? 1 : 0}
              yAxisTextStyle={chartConfig.yAxisTextStyle}
              xAxisLabelTextStyle={chartConfig.xAxisLabelTextStyle}
              yAxisColor={chartConfig.axisColor}
              xAxisColor={chartConfig.axisColor}
              rulesColor={index === 0 ? chartConfig.axisColor : 'transparent'}
              dataPointsRadius={3}
              hideDataPoints={false}
              hideRules={index !== 0}
              hideYAxisText={index !== 0}
              showDataPointOnFocus
              disableScroll
              isAnimated
              animationDuration={1000}
              curved
            />
          </View>
        ))}
        
        {/* Legend for the analog alarms */}
        <View style={styles.inlineChartLegend}>
          {sampleAnalogAlarms.map((alarm, index) => (
            <View key={alarm.id} style={styles.inlineLegendItem}>
              <View style={[
                styles.legendColorBox, 
                { backgroundColor: prepareLineChartData[index]?.color || '#ccc' }
              ]} />
              <Text style={[styles.inlineLegendText, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                {alarm.description.split(' ')[0]}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  // Render binary alarms as bar chart
  const renderBinaryChart = () => (
    <View style={[styles.chartContainer, { backgroundColor: chartConfig.backgroundColor }]}>
      <Text style={[styles.chartTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
        Binary Alarms
      </Text>
      <BarChart
        data={prepareBinaryChartData}
        height={300}
        width={screenWidth - 40}
        spacing={20}
        initialSpacing={20}
        barWidth={20}
        noOfSections={1}
        barBorderRadius={4}
        yAxisThickness={1}
        xAxisThickness={1}
        yAxisTextStyle={chartConfig.yAxisTextStyle}
        xAxisLabelTextStyle={chartConfig.xAxisLabelTextStyle}
        yAxisColor={chartConfig.axisColor}
        xAxisColor={chartConfig.axisColor}
        hideRules
        isAnimated
      />
    </View>
  );
  
  // Updated legend with time series explanation
  const renderLegend = () => (
    <View style={[styles.legendContainer, { backgroundColor: chartConfig.backgroundColor }]}>
      <Text style={[styles.legendTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
        Legend
      </Text>
      
      {/* Analog Alarms Legend */}
      <View style={styles.legendSection}>
        <Text style={[styles.legendSectionTitle, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
          Analog Alarms
        </Text>
        <View style={styles.legendItems}>
          {sampleAnalogAlarms.map((alarm) => (
            <View key={alarm.id} style={styles.legendItem}>
              <View 
                style={[
                  styles.legendColorBox, 
                  { backgroundColor: alarmColors[alarm.type as keyof typeof alarmColors] }
                ]} 
              />
              <View style={styles.legendItemText}>
                <Text 
                  style={[styles.legendText, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}
                  numberOfLines={2}
                >
                  {alarm.description}
                </Text>
                <Text 
                  style={[styles.legendSubText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}
                >
                  {`Current: ${alarm.value}${alarm.unit} (${alarm.status})`}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
      
      {/* Binary Alarms Legend */}
      <View style={[styles.legendSection, styles.legendSectionBorder]}>
        <Text style={[styles.legendSectionTitle, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
          Binary Alarms
        </Text>
        <View style={styles.legendItems}>
          {Object.entries(alarmColors)
            .filter(([type]) => ['level', 'heater', 'fan', 'conveyor'].includes(type))
            .map(([type, color]) => (
              <View key={type} style={styles.legendItem}>
                <View 
                  style={[
                    styles.legendColorBox, 
                    { backgroundColor: color }
                  ]} 
                />
                <View style={styles.legendItemText}>
                  <Text 
                    style={[styles.legendText, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                  <Text 
                    style={[styles.legendSubText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}
                  >
                    1 = Active, 0 = Inactive
                  </Text>
                </View>
              </View>
            ))}
        </View>
      </View>

      {/* Time Series Explanation */}
      <View style={[styles.legendSection, styles.legendSectionBorder]}>
        <Text style={[styles.legendSectionTitle, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
          Time Series Data
        </Text>
        <Text style={[styles.legendNote, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
          Charts show simulated data over the selected time period. 
          X-axis displays time in HH:MM format. Each analog alarm has 
          its own trend line with a unique color.
        </Text>
      </View>
    </View>
  );
  
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
            Showing data from {formatDate(dateRange.start, 'MMM d, yyyy HH:mm')} to {formatDate(dateRange.end, 'MMM d, yyyy HH:mm')}
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
  legendSection: {
    marginBottom: 16,
  },
  legendSectionBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(156, 163, 175, 0.1)',
    paddingTop: 16,
  },
  legendSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  legendItems: {
    flexDirection: 'column',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  legendColorBox: {
    width: 12,
    height: 12,
    borderRadius: 4,
    marginRight: 8,
    marginTop: 4,
  },
  legendItemText: {
    flex: 1,
  },
  legendText: {
    fontSize: 12,
    marginBottom: 2,
  },
  legendSubText: {
    fontSize: 11,
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
  xAxisLabel: {
    fontSize: 10,
    textAlign: 'center',
    width: 40,
    transform: [{ rotate: '-45deg' }],
  },
  legendNote: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  inlineChartLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 8,
  },
  inlineLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 4,
  },
  inlineLegendText: {
    fontSize: 10,
    marginLeft: 4,
  },
}); 