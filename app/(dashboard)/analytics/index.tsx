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
import { format as formatDate, subDays, subHours, startOfDay, endOfDay, parseISO, addHours, addDays } from 'date-fns';
import { useAlarmHistory } from '../../hooks/useAlarms';
import { useRouter } from 'expo-router';

// Types
type GraphType = 'analog' | 'binary';
type TimeRange = '1h' | '12h' | '24h' | '7d' | 'custom';
type AlarmType = keyof typeof GRAPH_COLORS;

interface BaseAlarm {
  id: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'active' | 'acknowledged' | 'resolved';
  timestamp: string;
  zone?: 'zone1' | 'zone2';
}

interface AnalogAlarm extends BaseAlarm {
  type: 'temperature' | 'carbon' | 'pressure';
  value: string;
  unit: string;
  setPoint: string;
  lowLimit: string;
  highLimit: string;
}

interface BinaryAlarm extends BaseAlarm {
  type: 'level' | 'heater' | 'conveyor' | 'fan';
  value: 'Normal' | 'Failure' | 'Running' | 'Not Running' | 'Rotating' | 'Not Rotating';
  expectedValue: 'Normal' | 'Running' | 'Rotating';
}

interface DataPoint {
  value: number;
  label: string;
  dataPointText: string;
}

interface LineDataItem {
  value: number;
  label: string;
  dataPointText: string;
  customDataPoint?: Function;
  color?: string;
  date?: Date;
  alarmId?: string;
  alarmDescription?: string;
  showTooltip?: boolean;
}

interface BinaryDataPoint {
  value: number;
  label: string;
  frontColor: string;
  topLabelComponent: () => React.ReactNode;
  date?: Date;
  alarmId?: string;
  alarmDescription?: string;
}

interface LineDataSet {
  data: LineDataItem[];
  color: string;
  dataPointsColor: string;
  thickness: number;
  legendLabel: string;
  hideDataPoints?: boolean;
  dataPointsRadius?: number;
  textColor?: string;
  curved?: boolean;
}

// Constants
const GRAPH_COLORS = {
  temperature: '#FF6384', // Red
  carbon: '#36A2EB',     // Blue
  pressure: '#4BC0C0',   // Teal
  level: '#FFCE56',      // Yellow
  heater: '#9966FF',     // Purple
  conveyor: '#FF9F40',   // Orange
  fan: '#4CAF50',        // Green
} as const;

// Colors for individual alarms - matching the image more closely
const ALARM_SPECIFIC_COLORS = {
  'analog-1': '#FFC107', // Golden yellow - HARDENING ZONE 1 TEMPERATURE
  'analog-2': '#FF9800', // Orange - HARDENING ZONE 2 TEMPERATURE
  'analog-3': '#F44336', // Red - CARBON POTENTIAL
  'analog-4': '#E91E63', // Pink - OIL TEMPERATURE
  'analog-5': '#2196F3', // Light blue - TEMPERING ZONE1 TEMPERATURE
  'analog-6': '#009688', // Teal - TEMPERING ZONE2 TEMPERATURE
} as const;

// Additional colors for multiple alarms of the same type
const EXTENDED_COLORS = [
  '#FF6384', // Red
  '#36A2EB', // Blue
  '#4BC0C0', // Teal
  '#FFCE56', // Yellow
  '#9966FF', // Purple
  '#FF9F40', // Orange
  '#4CAF50', // Green
  '#E91E63', // Pink
  '#2196F3', // Light Blue
  '#00BCD4', // Cyan
  '#FFC107', // Amber
  '#795548', // Brown
  '#607D8B', // Blue Grey
  '#9C27B0', // Deep Purple
] as const;

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

export default function AnalyticsScreen() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  
  // State
  const [activeGraph, setActiveGraph] = useState<GraphType>('analog');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [isLoading, setIsLoading] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(new Date());
  const [customEndDate, setCustomEndDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'start' | 'end'>('start');
  const [selectedDataPoint, setSelectedDataPoint] = useState<string | null>(null);
  const [selectedAlarmIndex, setSelectedAlarmIndex] = useState<number | null>(null);

  // Theme colors
  const theme = useMemo(() => ({
    background: isDarkMode ? '#111827' : '#F9FAFB',
    surface: isDarkMode ? '#1F2937' : '#FFFFFF',
    text: isDarkMode ? '#F3F4F6' : '#1F2937',
    subtext: isDarkMode ? '#9CA3AF' : '#6B7280',
    border: isDarkMode ? 'rgba(75, 85, 99, 0.4)' : 'rgba(229, 231, 235, 0.4)',
    primary: isDarkMode ? '#3B82F6' : '#2563EB',
  }), [isDarkMode]);

  // Get time range based on selected filter
  const getTimeRange = useCallback(() => {
    const now = new Date();
    let startDate;
    let endDate = now;
    
    switch(timeRange) {
      case '1h':
        startDate = subHours(now, 1);
        break;
      case '12h':
        startDate = subHours(now, 12);
        break;
      case '24h':
        startDate = subHours(now, 24);
        break;
      case '7d':
        startDate = subDays(now, 7);
        break;
      case 'custom':
        startDate = customStartDate;
        endDate = customEndDate;
        break;
      default:
        startDate = subHours(now, 24);
    }
    
    return { startDate, endDate };
  }, [timeRange, customStartDate, customEndDate]);

  // Generate mock timestamps within the selected time range
  const generateTimestamps = useCallback((count: number) => {
    const { startDate, endDate } = getTimeRange();
    const timestamps = [];
    const totalMs = endDate.getTime() - startDate.getTime();
    
    for (let i = 0; i < count; i++) {
      // Distribute timestamps evenly across the range
      const time = new Date(startDate.getTime() + (totalMs * i / (count - 1)));
      timestamps.push(time);
    }
    
    return timestamps;
  }, [getTimeRange]);

  // Format timestamp for x-axis based on the selected time range
  const formatTimestamp = useCallback((date: Date) => {
    if (timeRange === '1h' || timeRange === '12h') {
      return formatDate(date, 'HH:mm');
    } else if (timeRange === '24h') {
      return formatDate(date, 'HH:mm');
    } else {
      return formatDate(date, 'MM/dd');
    }
  }, [timeRange]);

  // Toggle between graph types
  const toggleGraph = useCallback(() => {
    setActiveGraph(prev => prev === 'analog' ? 'binary' : 'analog');
  }, []);

  // Render graph toggle button
  const renderGraphToggle = () => (
    <TouchableOpacity
      style={[
        styles.toggleButton,
        { 
          backgroundColor: theme.surface,
          borderColor: theme.border,
        }
      ]}
      onPress={toggleGraph}
    >
      <View style={styles.toggleContent}>
        <Ionicons
          name={activeGraph === 'analog' ? 'analytics' : 'toggle'}
          size={20}
          color={theme.primary}
          style={styles.toggleIcon}
        />
        <Text style={[styles.toggleText, { color: theme.text }]}>
          {activeGraph === 'analog' ? 'Switch to Binary View' : 'Switch to Analog View'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Render time range selector
  const renderTimeRangeSelector = () => {
    const ranges: { label: string; value: TimeRange }[] = [
      { label: '1H', value: '1h' },
      { label: '12H', value: '12h' },
      { label: '24H', value: '24h' },
      { label: '7D', value: '7d' },
      { label: 'Custom', value: 'custom' },
    ];

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.timeRangeScroll}
        contentContainerStyle={styles.timeRangeContainer}
      >
        {ranges.map((range) => (
          <TouchableOpacity
            key={range.value}
            style={[
              styles.timeRangeButton,
              timeRange === range.value && styles.timeRangeButtonActive,
              {
                backgroundColor: timeRange === range.value ? theme.primary : theme.surface,
                borderColor: theme.border,
              }
            ]}
            onPress={() => setTimeRange(range.value)}
          >
            <Text
              style={[
                styles.timeRangeText,
                {
                  color: timeRange === range.value ? '#FFFFFF' : theme.text,
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

  // Date picker handlers
  const onChangeDatePicker = useCallback((event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      if (pickerMode === 'start') {
        setCustomStartDate(selectedDate);
      } else {
        setCustomEndDate(selectedDate);
      }
    }
  }, [pickerMode]);

  const openDatePicker = useCallback((mode: 'start' | 'end') => {
    setPickerMode(mode);
    setShowDatePicker(true);
  }, []);

  // Render custom date range selector
  const renderCustomDateRange = () => {
    if (timeRange !== 'custom') return null;

    return (
      <View style={styles.customDateContainer}>
        <TouchableOpacity
          style={[styles.dateButton, { backgroundColor: theme.surface }]}
          onPress={() => openDatePicker('start')}
        >
          <Ionicons
            name="calendar-outline"
            size={18}
            color={theme.text}
            style={styles.dateIcon}
          />
          <Text style={[styles.dateText, { color: theme.text }]}>
            From: {formatDate(customStartDate, 'yyyy-MM-dd HH:mm')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dateButton, { backgroundColor: theme.surface }]}
          onPress={() => openDatePicker('end')}
        >
          <Ionicons
            name="calendar-outline"
            size={18}
            color={theme.text}
            style={styles.dateIcon}
          />
          <Text style={[styles.dateText, { color: theme.text }]}>
            To: {formatDate(customEndDate, 'yyyy-MM-dd HH:mm')}
          </Text>
        </TouchableOpacity>

        {showDatePicker && Platform.OS !== 'web' && (
          <DateTimePicker
            value={pickerMode === 'start' ? customStartDate : customEndDate}
            mode="datetime"
            display="default"
            onChange={onChangeDatePicker}
          />
        )}
      </View>
    );
  };

  // Prepare graph data
  const prepareAnalogData = useCallback(() => {
    // Generate timestamps for the selected time range
    const timestamps = generateTimestamps(10);
    
    // Create datasets for each individual analog alarm
    const datasets: LineDataSet[] = sampleAnalogAlarms.map((alarm, index) => {
      // Create data points with timestamps
      const dataPoints = timestamps.map((timestamp, i) => {
        // Simulate values with some variation based on the original value
        const baseValue = parseFloat(alarm.value);
        // Use smaller variation to keep lines more stable like in the image
        const variation = baseValue * 0.02 * (Math.random() - 0.5);
        const simulatedValue = baseValue + variation;
        
        return {
          value: simulatedValue,
          label: formatTimestamp(timestamp),
          dataPointText: `${simulatedValue.toFixed(1)}${alarm.unit}`,
          date: new Date(timestamp),
          alarmId: alarm.id,
          alarmDescription: alarm.description,
          showTooltip: selectedDataPoint === `${alarm.id}-${i}`,
        };
      });
      
      // Use the specific color for this alarm ID, or fall back to extended colors
      const alarmColor = ALARM_SPECIFIC_COLORS[alarm.id as keyof typeof ALARM_SPECIFIC_COLORS] || 
                         EXTENDED_COLORS[index % EXTENDED_COLORS.length];
      
      return {
        data: dataPoints,
        color: alarmColor,
        dataPointsColor: alarmColor,
        textColor: alarmColor,
        thickness: 2,
        hideDataPoints: index !== selectedAlarmIndex, // Show data points only for selected alarm
        dataPointsRadius: 5,
        curved: true,
        legendLabel: alarm.description,
      };
    });

    return datasets;
  }, [formatTimestamp, generateTimestamps, selectedDataPoint, selectedAlarmIndex]);

  const prepareBinaryData = useCallback(() => {
    // Generate timestamps for the selected time range
    const timestamps = generateTimestamps(10);
    
    // Create datasets for each binary alarm
    const datasets = sampleBinaryAlarms.map((alarm, index) => {
      // Create data points with timestamps
      const dataPoints = timestamps.map((timestamp, i) => {
        // Simulate binary values with occasional changes
        const isNormal = alarm.value === alarm.setPoint; 
        const randomChange = Math.random() > 0.8;
        const simulatedValue = (isNormal !== randomChange) ? 1 : 0;
        
        return {
          value: simulatedValue,
          label: formatTimestamp(timestamp),
          date: new Date(timestamp),
          alarmId: alarm.id,
          alarmDescription: alarm.description,
          frontColor: EXTENDED_COLORS[index % EXTENDED_COLORS.length],
          topLabelComponent: () => (
            <View>
              <Text style={[styles.graphLabel, { color: theme.subtext }]}>
                {alarm.type.charAt(0).toUpperCase()}
              </Text>
              {selectedDataPoint === `${alarm.id}-${i}` && (
                <View style={[styles.dataPointTooltip, { backgroundColor: theme.surface }]}>
                  <Text style={[styles.tooltipText, { color: theme.text }]}>
                    {alarm.description}
                  </Text>
                  <Text style={[styles.tooltipText, { color: theme.subtext }]}>
                    {simulatedValue === 1 ? 'Normal' : 'Failure'}
                  </Text>
                </View>
              )}
            </View>
          )
        };
      });
      
      return {
        data: dataPoints,
        color: EXTENDED_COLORS[index % EXTENDED_COLORS.length],
        legendLabel: alarm.description,
      };
    });

    return datasets;
  }, [formatTimestamp, generateTimestamps, selectedDataPoint, theme.subtext, theme.surface, theme.text]);

  // Handle data point press
  const handleDataPointPress = useCallback((item: any, index: number) => {
    if (item.alarmId) {
      setSelectedDataPoint(`${item.alarmId}-${index}`);
      
      // Find the alarm index to highlight its data points
      const alarmIndex = sampleAnalogAlarms.findIndex(alarm => alarm.id === item.alarmId);
      setSelectedAlarmIndex(alarmIndex >= 0 ? alarmIndex : null);
    }
  }, []);

  // Render active graph
  const renderGraph = () => {
    if (isLoading) {
      return (
        <View style={[styles.graphContainer, { backgroundColor: theme.surface }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.subtext }]}>
            Loading data...
          </Text>
        </View>
      );
    }

    const chartWidth = Dimensions.get('window').width - 64;
    const analogData = prepareAnalogData();

    // Make sure we have data to display
    if (analogData.length === 0 && activeGraph === 'analog') {
      return (
        <View style={[styles.graphContainer, { backgroundColor: theme.surface }]}>
          <Text style={[styles.loadingText, { color: theme.subtext }]}>
            No data available
          </Text>
        </View>
      );
    }

    // Prepare data for LineChart
    const primaryData = activeGraph === 'analog' && analogData.length > 0 
      ? analogData[0].data 
      : [];
      
    // Prepare secondary datasets for multiple lines
    const secondaryData = activeGraph === 'analog' 
      ? analogData.slice(1).map(dataset => ({
          data: dataset.data,
          color: dataset.color,
          dataPointsColor: dataset.color,
          textColor: dataset.color,
          thickness: 2,
          hideDataPoints: selectedAlarmIndex !== null && selectedAlarmIndex !== analogData.indexOf(dataset),
          dataPointsRadius: 5,
          curved: true
        }))
      : [];

    return (
      <View style={[styles.graphContainer, { backgroundColor: theme.surface }]}>
        <Text style={[styles.graphTitle, { color: theme.text }]}>
          {activeGraph === 'analog' ? 'Analog Alarms Trend' : 'Binary Alarms Status'}
        </Text>
        
        <View style={styles.chartWrapper}>
          {activeGraph === 'analog' ? (
            <>
              <LineChart
                areaChart={false}
                data={primaryData}
                height={300}
                width={chartWidth}
                spacing={40}
                initialSpacing={20}
                noOfSections={6}
                yAxisThickness={1}
                xAxisThickness={1}
                yAxisTextStyle={styles.axisText}
                xAxisLabelTextStyle={{
                  ...styles.axisText,
                  transform: [{ rotate: '-45deg' }],
                  width: 100,
                }}
                yAxisColor={theme.border}
                xAxisColor={theme.border}
                rulesType="dashed"
                rulesColor="lightgray"
                showValuesAsDataPointsText={false}
                hideDataPoints={selectedAlarmIndex !== null && selectedAlarmIndex !== 0}
                dataPointsRadius={5}
                dataPointsColor={analogData.length > 0 ? analogData[0].color : theme.primary}
                onPress={handleDataPointPress}
                curved
                color={analogData.length > 0 ? analogData[0].color : theme.primary}
                thickness={2}
                hideRules={false}
                yAxisLabelWidth={50}
                yAxisTextNumberOfLines={1}
                formatYLabel={(label: string) => {
                  const value = parseFloat(label);
                  return Number.isNaN(value) ? label : Math.round(value).toString();
                }}
                isAnimated
                animationDuration={500}
                data2={secondaryData}
                endSpacing={20}
                maxValue={1000}
                stepValue={200}
                stepHeight={50}
                pointerConfig={{
                  pointerStripHeight: 160,
                  pointerStripColor: 'lightgray',
                  pointerStripWidth: 1,
                  pointerColor: 'lightgray',
                  radius: 6,
                  pointerLabelWidth: 140,
                  pointerLabelHeight: 90,
                  activatePointersOnLongPress: true,
                  autoAdjustPointerLabelPosition: true,
                  pointerLabelComponent: (item: any) => {
                    return (
                      <View style={[styles.dataPointTooltip, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.tooltipText, { color: theme.text, fontWeight: '600' }]}>{item.alarmDescription}</Text>
                        <Text style={[styles.tooltipText, { color: theme.subtext }]}>{item.dataPointText}</Text>
                      </View>
                    );
                  },
                }}
              />
            </>
          ) : (
            <View>
              {prepareBinaryData().map((dataset, index) => (
                <BarChart
                  key={`binary-chart-${index}`}
                  data={dataset.data}
                  height={50}
                  width={chartWidth}
                  spacing={40}
                  initialSpacing={20}
                  barWidth={24}
                  noOfSections={1}
                  maxValue={1}
                  yAxisThickness={index === 0 ? 1 : 0}
                  xAxisThickness={index === prepareBinaryData().length - 1 ? 1 : 0}
                  yAxisTextStyle={styles.axisText}
                  xAxisLabelTextStyle={index === prepareBinaryData().length - 1 ? styles.axisText : { height: 0 }}
                  yAxisColor={theme.border}
                  xAxisColor={theme.border}
                  showLine
                  hideRules
                  showFractionalValues
                  onPress={handleDataPointPress}
                />
              ))}
            </View>
          )}
        </View>

        {/* Legend */}
        <View style={styles.legendContainer}>
          <Text style={[styles.legendTitle, { color: theme.text }]}>Legend</Text>
          <View style={styles.legendItems}>
            {activeGraph === 'analog' ? (
              // Analog alarms legend
              prepareAnalogData().map((dataset, index) => (
                <TouchableOpacity 
                  key={`legend-${index}`} 
                  style={styles.legendItem}
                  onPress={() => {
                    setSelectedAlarmIndex(selectedAlarmIndex === index ? null : index);
                  }}
                >
                  <View
                    style={[
                      styles.legendColor,
                      { backgroundColor: dataset.color }
                    ]}
                  />
                  <Text 
                    style={[
                      styles.legendText, 
                      { 
                        color: theme.text,
                        fontWeight: selectedAlarmIndex === index ? '700' : '400'
                      }
                    ]} 
                    numberOfLines={1}
                  >
                    {dataset.legendLabel}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              // Binary alarms legend
              prepareBinaryData().map((dataset, index) => (
                <View key={`legend-${index}`} style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendColor,
                      { backgroundColor: dataset.color }
                    ]}
                  />
                  <Text style={[styles.legendText, { color: theme.text }]} numberOfLines={1}>
                    {dataset.legendLabel}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[
        styles.header,
        { 
          backgroundColor: theme.surface,
          borderBottomColor: theme.border,
          borderBottomWidth: 1,
        }
      ]}>
        <TouchableOpacity
          style={[
            styles.backButton,
            { backgroundColor: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : 'rgba(243, 244, 246, 0.7)' }
          ]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Analytics</Text>
          <Text style={[styles.headerSubtitle, { color: theme.subtext }]}>
            Alarm Trends & Patterns
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {renderGraphToggle()}
        {renderTimeRangeSelector()}
        {renderCustomDateRange()}
        {renderGraph()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  toggleContainer: {
    marginBottom: 16,
  },
  toggleButton: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  toggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  toggleIcon: {
    marginRight: 8,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '500',
  },
  timeRangeScroll: {
    marginBottom: 16,
  },
  timeRangeContainer: {
    paddingHorizontal: 4,
  },
  timeRangeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
    borderWidth: 1,
  },
  timeRangeButtonActive: {
    borderColor: 'transparent',
  },
  timeRangeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  customDateContainer: {
    marginBottom: 16,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  dateIcon: {
    marginRight: 8,
  },
  dateText: {
    fontSize: 14,
  },
  graphContainer: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  chartWrapper: {
    alignItems: 'center',
    marginVertical: 16,
  },
  graphTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 24,
    color: '#1F2937',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  legendContainer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(156, 163, 175, 0.1)',
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    color: '#1F2937',
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
    flex: 1,
  },
  graphLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    width: 30,
  },
  axisText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
  },
  dataPointTooltip: {
    position: 'absolute',
    top: -80,
    left: -60,
    width: 150,
    padding: 8,
    borderRadius: 8,
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  tooltipText: {
    fontSize: 12,
    marginBottom: 4,
  },
}); 