import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Dimensions,
  Alert,
  GestureResponderEvent,
  PanResponder,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { 
  useLatestMeterReading, 
  useMeterHistory, 
  useMeterLimits, 
  MeterReading,
  MeterLimit
} from '../../hooks/useMeterReadings';
import { useUnreadCount } from '../../hooks/useNotifications';
import { 
  convertToIST, 
  formatTimeIST, 
  formatTimestampIST, 
  formatChartLabelIST 
} from '../../utils/timezoneUtils';

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

const highDPIPhones = 380;
const lowDPIPhones = 365;

// Add interface for Line component props
interface LineProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  thickness?: number;
}

// Add the Line component
const Line = ({ startX, startY, endX, endY, color, thickness = 1 }: LineProps) => {
  // Calculate the length and angle of the line
  const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
  const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;
  
  return (
    <View
      style={{
        position: 'absolute',
        left: startX,
        top: startY,
        width: length,
        height: thickness,
        backgroundColor: color,
        transform: [
          { translateY: -thickness / 2 },
          { rotate: `${angle}deg` },
          { translateY: thickness / 2 },
        ],
      }}
    />
  );
};

// Update the interface for the custom chart
interface MeterDataSeries {
  name: string;
  color: string;
  data: (number | null)[];  // Updated to allow null values
  unit: string;
  maxValue?: number; 
  scale?: number; 
}

// Add interface for the custom chart component
interface CustomChartProps {
  meterData: MeterDataSeries[];
  timeLabels: string[];
  isDarkMode: boolean;
  axisRange: {
    min: number;
    max: number;
    ticks: number[];
  };
}

// Add the CustomChart component
const CustomChart = ({ meterData, timeLabels, isDarkMode, axisRange }: CustomChartProps) => {
  const textColor = isDarkMode ? '#F3F4F6' : '#1F2937';
  const gridColor = isDarkMode ? 'rgba(156, 163, 175, 0.2)' : 'rgba(107, 114, 128, 0.2)';
  const surfaceColor = isDarkMode ? '#1F2937' : '#FFFFFF';
  
  // State for touch interaction
  const [touchedPoint, setTouchedPoint] = useState<{
    seriesIndex: number;
    pointIndex: number;
    x: number;
    y: number;
    value: number | null;
    time: string;
    name: string;
    unit: string;
    color: string;
  } | null>(null);
  
  const chartWidth = windowWidth - 40;
  const chartHeight = 220;
  
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;
  
  // Use the provided axis range for Y-axis scaling
  const minValue = axisRange.min;
  const maxScaledValue = axisRange.max;
  const yAxisLabels = axisRange.ticks;
  
  const valueRange = useMemo(() => {
    return maxScaledValue - minValue;
  }, [minValue, maxScaledValue]);
  
  // Functions to calculate x and y positions
  const getX = useCallback((index: number, totalPoints: number) => {
    // Calculate x position ensuring points stay within the graph boundaries
    const xPadding = 0;
    return padding.left + xPadding + ((index) * (graphWidth - xPadding)) / (totalPoints - 1);
  }, [graphWidth, padding.left]);
  
  const getY = useCallback((value: number | null) => {
    if (value === undefined || value === null) {
      return padding.top + graphHeight;
    }
    
    if (isNaN(Number(value))) {
      return padding.top + graphHeight;
    }
    
    // Clamp value between min and max to prevent rendering outside the chart area
    const clampedValue = Math.max(minValue, Math.min(maxScaledValue, value));
    return padding.top + graphHeight - ((clampedValue - minValue) / valueRange) * graphHeight;
  }, [graphHeight, maxScaledValue, minValue, valueRange, padding.top]);

  // Function to find the closest data point to touch coordinates
  const findClosestPoint = useCallback((touchX: number, touchY: number) => {
    let closestDistance = Infinity;
    let closestPoint = null;
    
    meterData.forEach((series, seriesIndex) => {
      series.data.forEach((value, pointIndex) => {
        if (value === undefined || value === null || Number.isNaN(Number(value))) return;
        
        const pointX = getX(pointIndex, series.data.length);
        const pointY = getY(value);
        
        // Place extra weight on x-distance to make vertical proximity less important
        const xDistance = Math.abs(touchX - pointX);
        const yDistance = Math.abs(touchY - pointY);
        
        // Use weighted distance calculation - x distance matters more than y
        const distance = xDistance * 2 + yDistance;
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPoint = { seriesIndex, pointIndex, value };
        }
      });
    });
    
    // Increased the detection range to 50px to be more forgiving
    if (closestDistance < 50 && closestPoint) {
      return closestPoint;
    }
    
    return null;
  }, [getX, getY, meterData]);

  // Handle touch on graph
  const handleTouch = useCallback((event: GestureResponderEvent) => {
    try {
      // Get touch location relative to the chart
      const touchX = event.nativeEvent.locationX;
      const touchY = event.nativeEvent.locationY;
      
      // Find closest data point
      const closestPoint = findClosestPoint(touchX, touchY);
      
      if (closestPoint) {
        const { seriesIndex, pointIndex, value } = closestPoint;
        const series = meterData[seriesIndex];
        
        setTouchedPoint({
          seriesIndex,
          pointIndex,
          x: getX(pointIndex, series.data.length),
          y: getY(value),
          value,
          time: timeLabels[pointIndex],
          name: series.name,
          unit: series.unit,
          color: series.color
        });
      } else {
        // Touch was not near any point
        setTouchedPoint(null);
      }
    } catch (error) {
      console.log('Error in touch handling:', error);
      setTouchedPoint(null);
    }
  }, [findClosestPoint, getX, getY, meterData, timeLabels]);

  // Clear touch when touching outside points
  const handleTouchOutside = useCallback(() => {
    setTouchedPoint(null);
  }, []);
  
  // Create PanResponder for handling touch gestures
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      handleTouch(evt);
    },
    onPanResponderMove: (evt) => {
      handleTouch(evt);
    },
    onPanResponderRelease: () => {
      // Keep tooltip visible after touch release
    },
    onPanResponderTerminate: () => {
      // Keep tooltip visible after touch terminate
    },
  }), [handleTouch]);
  
  // Format a number for display with proper handling of undefined/null values
  const formatDisplayValue = useCallback((value: any) => {
    if (value === undefined || value === null || isNaN(value)) {
      return "-";
    }
    
    // Convert to string with 2 decimal places
    let numStr = String(Math.round(value * 100) / 100);
    
    // Add decimal places if needed
    if (!numStr.includes('.')) {
      numStr += '.00';
    } else if (numStr.split('.')[1].length === 1) {
      numStr += '0';
    }
    
    return numStr;
  }, []);

  return (
    <View style={[styles.chartContainer, { backgroundColor: surfaceColor }]}>
      <View style={{ height: chartHeight, position: 'relative' }}>
        {/* Grid Lines */}
        {yAxisLabels.map((yValue, i) => {
          const yPosition = getY(yValue);
          return (
            <View 
              key={`h-grid-${i}`}
              style={{
                position: 'absolute',
                left: padding.left,
                top: yPosition,
                width: graphWidth,
                height: 1,
                backgroundColor: gridColor,
              }}
            />
          );
        })}
        
        {/* Add vertical grid lines */}
        {[...Array(6)].map((_, i) => {
          const xPosition = padding.left + (i * graphWidth) / 5;
          return (
            <View 
              key={`v-grid-${i}`}
              style={{
                position: 'absolute',
                left: xPosition,
                top: padding.top,
                width: 1,
                height: graphHeight,
                backgroundColor: gridColor,
              }}
            />
          );
        })}
        
        {/* Y-axis labels */}
        {yAxisLabels.map((value, i) => {
          return (
            <Text 
              key={`y-label-${i}`}
              style={{
                position: 'absolute',
                left: 10,
                top: getY(value) - 10,
                color: textColor,
                fontSize: 10,
              }}
            >
              {formatDisplayValue(value)}
            </Text>
          );
        })}
        
        {/* X-axis labels - using actual data points */}
        {timeLabels.map((label, i) => {
          // Skip some labels if we have too many to display
          if (timeLabels.length > 6 && i % Math.ceil(timeLabels.length / 6) !== 0 && i !== timeLabels.length - 1) {
            return null;
          }
          
          // Calculate position ensuring points stay within the graph
          const position = getX(i, timeLabels.length);
          
          return (
            <Text 
              key={`x-label-${i}`}
              style={{
                position: 'absolute',
                left: position - 15,
                top: padding.top + graphHeight + 10,
                color: textColor,
                fontSize: 10,
                width: 30,
                textAlign: 'center',
              }}
            >
              {label}
            </Text>
          );
        })}
        
        {/* Draw lines for each data series with increased thickness */}
        {meterData.map((series, seriesIndex) => (
          series.data.map((value, i) => {
            // Skip if current point or next point is invalid or if we're at the last point
            if (i === series.data.length - 1 || 
                value === undefined || value === null || isNaN(Number(value)) || 
                series.data[i + 1] === undefined || series.data[i + 1] === null || isNaN(Number(series.data[i + 1]))) 
              return null;
            
            const startX = getX(i, series.data.length);
            const startY = getY(value);
            const endX = getX(i + 1, series.data.length);
            const endY = getY(series.data[i + 1]);
            
            // Only draw line if both points are within a reasonable range and within the graph boundaries
            if (startX < padding.left || endX < padding.left || 
                startX > padding.left + graphWidth || endX > padding.left + graphWidth ||
                startY < padding.top || endY < padding.top || 
                startY > padding.top + graphHeight || endY > padding.top + graphHeight ||
                Math.abs(endY - startY) > graphHeight * 0.9) { // Skip extreme jumps
              return null;
            }
            
            return (
              <Line
                key={`line-${seriesIndex}-${i}`}
                startX={startX}
                startY={startY}
                endX={endX}
                endY={endY}
                color={series.color}
                thickness={2} // Increased line thickness
              />
            );
          })
        ))}
        
        {/* Touch overlay for the entire chart area */}
        <View
          {...panResponder.panHandlers}
          style={{
            position: 'absolute',
            left: padding.left,
            top: padding.top,
            width: graphWidth,
            height: graphHeight,
            zIndex: 10,
          }}
        />
        
        {/* Tooltip for selected point */}
        {touchedPoint && (
          <View
            style={{
              position: 'absolute',
              left: (touchedPoint.x < chartWidth / 2) ? touchedPoint.x + 10 : touchedPoint.x - 160,
              top: (touchedPoint.y < chartHeight / 2) ? touchedPoint.y + 10 : touchedPoint.y - 80,
              width: 150,
              backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              borderRadius: 12,
              padding: 12,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 6,
              elevation: 8,
              zIndex: 100,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: touchedPoint.color, marginRight: 8 }} />
                <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 14 }} numberOfLines={1}>
                  {touchedPoint.name}
                </Text>
              </View>
              <TouchableOpacity onPress={handleTouchOutside} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={20} color={textColor} />
              </TouchableOpacity>
            </View>

            <View style={{ marginBottom: 8 }}>
              <Text style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: 12 }}>Value</Text>
              <Text style={{ color: touchedPoint.color, fontSize: 18, fontWeight: '600' }}>
                {formatDisplayValue(touchedPoint.value)} {touchedPoint.unit}
              </Text>
            </View>

            <View>
              <Text style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: 12 }}>Time</Text>
              <Text style={{ color: textColor, fontSize: 14 }}>
                {touchedPoint.time}
              </Text>
            </View>
          </View>
        )}
        
        {/* Axes */}
        <View 
          style={{
            position: 'absolute',
            left: padding.left,
            top: padding.top + graphHeight,
            width: graphWidth,
            height: 1,
            backgroundColor: textColor,
          }}
        />
        <View 
          style={{
            position: 'absolute',
            left: padding.left,
            top: padding.top,
            width: 1,
            height: graphHeight,
            backgroundColor: textColor,
          }}
        />
      </View>
      
      {/* Legend */}
      <View style={styles.chartLegend}>
        {meterData.map((series, index) => (
          <View key={series.name} style={styles.legendItem}>
            <View
              style={[
                styles.legendColor,
                { backgroundColor: series.color }
              ]}
            />
            <Text
              style={[
                styles.legendText,
                { color: isDarkMode ? '#94A3B8' : '#64748B' },
              ]}>
              {series.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export default function MeterReadingsScreen() {
  // Theme and Auth Context
  const { isDarkMode, toggleTheme } = useTheme();
  const { authState } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAdmin = authState?.user?.role === 'ADMIN';
  
  // UI State
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<number>(1); // Default 1 hour
  const [graphView, setGraphView] = useState<'primary' | 'secondary'>('primary'); // New state for graph view
  const [limitModalVisible, setLimitModalVisible] = useState(false);
  const [selectedLimit, setSelectedLimit] = useState<MeterLimit | null>(null);
  
  // Get unread notifications count
  const { data: unreadCount = 0, isLoading: isUnreadLoading, error: unreadError } = useUnreadCount();
  
  // Debug log for unread count
  useEffect(() => {
    console.log('📊 Meter readings - Unread count:', unreadCount, 'Loading:', isUnreadLoading, 'Error:', unreadError);
  }, [unreadCount, isUnreadLoading, unreadError]);

  // Fetch data using custom hooks
  const { 
    data: latestReadingData, 
    isLoading: isLatestLoading, 
    isError: isLatestError,
    error: latestError,
    refetch: refetchLatest
  } = useLatestMeterReading();

  const { 
    data: historyData, 
    isLoading: isHistoryLoading,
    isError: isHistoryError,
    refetch: refetchHistory
  } = useMeterHistory(selectedTimeframe);

  const { 
    data: limitsData,
    isLoading: isLimitsLoading,
    refetch: refetchLimits
  } = useMeterLimits();

  // Add safe number formatting function at the top of the component
  const formatNumber = (value: number | undefined | null, decimals: number = 1): string => {
    if (value === undefined || value === null || isNaN(value)) {
      return '-';
    }
    // Use Math.round to handle the decimal places instead of toFixed
    const factor = Math.pow(10, decimals);
    return String(Math.round(value * factor) / factor);
  };

  // Format meter parameters for display
  const meterParameters = useMemo(() => {
    if (!latestReadingData) return [];

    return [
      { 
        id: 'voltage', 
        name: 'Voltage', 
        value: latestReadingData.voltage, 
        unit: 'V',
        icon: 'flash-outline',
        color: isDarkMode ? '#F59E0B' : '#D97706'
      },
      { 
        id: 'current', 
        name: 'Current', 
        value: latestReadingData.current, 
        unit: 'A',
        icon: 'repeat-outline',
        color: isDarkMode ? '#06B6D4' : '#0891B2'
      },
      { 
        id: 'frequency', 
        name: 'Frequency', 
        value: latestReadingData.frequency, 
        unit: 'Hz',
        icon: 'pulse-outline',
        color: isDarkMode ? '#10B981' : '#059669'
      },
      { 
        id: 'pf', 
        name: 'Power Factor', 
        value: latestReadingData.pf, 
        unit: '',
        icon: 'options-outline',
        color: isDarkMode ? '#8B5CF6' : '#7C3AED'
      },
      { 
        id: 'energy', 
        name: 'Energy', 
        value: latestReadingData.energy, 
        unit: 'kWh',
        icon: 'battery-charging-outline',
        color: isDarkMode ? '#EC4899' : '#DB2777'
      },
      { 
        id: 'power', 
        name: 'Power', 
        value: latestReadingData.power, 
        unit: 'kW',
        icon: 'flash',
        color: isDarkMode ? '#F97316' : '#EA580C'
      },
    ];
  }, [latestReadingData, isDarkMode]);

  // Improve the sanitizeOutliers function to better handle data gaps
  const sanitizeOutliers = (data: number[], timestamps: string[]): (number | null)[] => {
    if (data.length <= 2) return data as (number | null)[];
    
    const validValues = data.filter(v => v !== undefined && v !== null && !isNaN(v));
    if (validValues.length <= 2) return data as (number | null)[];
    
    // Calculate mean and standard deviation
    const mean = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
    const stdDev = Math.sqrt(
      validValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / validValues.length
    );
    
    // Filter out extreme values (more than 3 standard deviations from the mean)
    const threshold = 3 * stdDev;
    
    // Also handle time gaps - don't connect points that are too far apart in time
    const result = data.map((v, i) => {
      if (v === undefined || v === null || isNaN(Number(v))) return null;
      
      // Check for large time gaps if we have timestamp data
      if (i > 0 && timestamps && timestamps[i] && timestamps[i-1]) {
        const currentTime = new Date(timestamps[i]).getTime();
        const prevTime = new Date(timestamps[i-1]).getTime();
        const timeDiff = Math.abs(currentTime - prevTime);
        
        // If time difference is more than 15 minutes, don't connect these points
        if (timeDiff > 15 * 60 * 1000) {
          return null;
        }
      }
      
      return Math.abs(v - mean) > threshold ? null : v;
    });
    
    return result;
  };

  // Timezone conversion functions are now imported from utils/timezoneUtils

  // Update the chart data processing to handle time gaps and convert timestamps
  const chartData = useMemo(() => {
    if (!historyData || !historyData.readings || historyData.readings.length === 0) {
      return null;
    }
    
    // Sort by timestamp ascending for chart
    const sortedData = [...historyData.readings].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Format time labels based on the actual timestamps in the data with IST conversion
    const formatTimeLabels = () => {
      return sortedData.map(item => formatChartLabelIST(item.created_at, selectedTimeframe));
    };

    // Get time labels from actual data
    const labels = formatTimeLabels();
    const timestamps = sortedData.map(d => d.created_at);

    // Define color mapping for each parameter as string values
    const paramColors = {
      voltage: isDarkMode ? '#F59E0B' : '#D97706', // Amber
      current: isDarkMode ? '#06B6D4' : '#0891B2', // Cyan
      frequency: isDarkMode ? '#10B981' : '#059669', // Green
      pf: isDarkMode ? '#8B5CF6' : '#7C3AED', // Purple
      power: isDarkMode ? '#F97316' : '#EA580C', // Orange
      energy: isDarkMode ? '#EC4899' : '#DB2777', // Pink
    };

    // Define units for each parameter
    const paramUnits = {
      voltage: 'V',
      current: 'A',
      frequency: 'Hz',
      pf: '',
      power: 'kW',
      energy: 'kWh',
    };

    // Create datasets based on the selected view with sanitized data and time-gap handling
    const primaryDatasets = [
      {
        name: 'Power Factor',
        color: paramColors.pf,
        data: sanitizeOutliers(sortedData.map(d => d.pf), timestamps),
        unit: paramUnits.pf
      },
      {
        name: 'Power',
        color: paramColors.power,
        data: sanitizeOutliers(sortedData.map(d => d.power), timestamps),
        unit: paramUnits.power
      },
      {
        name: 'Current',
        color: paramColors.current,
        data: sanitizeOutliers(sortedData.map(d => d.current), timestamps),
        unit: paramUnits.current
      },
      {
        name: 'Energy',
        color: paramColors.energy,
        data: sanitizeOutliers(sortedData.map(d => d.energy), timestamps),
        unit: paramUnits.energy
      }
    ];
    
    const secondaryDatasets = [
      {
        name: 'Frequency',
        color: paramColors.frequency,
        data: sanitizeOutliers(sortedData.map(d => d.frequency), timestamps),
        unit: paramUnits.frequency
      },
      {
        name: 'Voltage',
        color: paramColors.voltage,
        data: sanitizeOutliers(sortedData.map(d => d.voltage), timestamps),
        unit: paramUnits.voltage
      }
    ];
    
    // Return the chart data based on selected view
    return {
      labels,
      primaryDatasets,
      secondaryDatasets,
      rawData: sortedData
    };
  }, [historyData, isDarkMode, selectedTimeframe]);

  // Refresh all data
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchLatest(),
        refetchHistory(),
        refetchLimits()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refetchLatest, refetchHistory, refetchLimits]);

  // Set up auto-refresh every 3 minutes
  useEffect(() => {
    const intervalId = setInterval(() => {
      refetchLatest();
      refetchHistory();
    }, 3 * 60 * 1000); // 3 minutes
    
    return () => clearInterval(intervalId);
  }, [refetchLatest, refetchHistory]);

  // Handle parameter card press (admin only)
  const handleParameterPress = useCallback((parameterId: string) => {
    if (!isAdmin) return;
    
    const limit = limitsData?.find(l => l.parameter === parameterId);
    if (!limit) return;
    
    setSelectedLimit(limit);
    setLimitModalVisible(true);
  }, [isAdmin, limitsData]);

  // Handle limit configuration navigation
  const handleConfigureLimit = useCallback(() => {
    if (!selectedLimit) return;
    
    setLimitModalVisible(false);
    router.push({
      pathname: `/(dashboard)/screens/admin/meter-limits/${selectedLimit.id}` as any,
    });
  }, [selectedLimit, router]);

  // Close limit modal
  const handleCloseLimitModal = useCallback(() => {
    setLimitModalVisible(false);
    setSelectedLimit(null);
  }, []);

  // Check if a value exceeds its limit
  const isValueExceeded = (value: number, parameter: string, limits: MeterLimit[] | undefined): boolean => {
    if (!limits) return false;
    const limit = limits.find(l => l.parameter === parameter);
    return limit ? value > limit.highLimit : false;
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(248, 250, 252, 0.95)',
            borderBottomColor: isDarkMode ? 'rgba(51, 65, 85, 0.3)' : 'rgba(226, 232, 240, 0.8)',
          },
        ]}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.logoContainer,
              {
                backgroundColor: isDarkMode
                  ? 'rgba(16, 185, 129, 0.15)'
                  : 'rgba(16, 185, 129, 0.1)',
              },
            ]}>
            <Ionicons
              name="speedometer-outline"
              size={24}
              color={isDarkMode ? '#6EE7B7' : '#10B981'}
            />
          </View>
          <View style={styles.titleContainer}>
            <Text
              style={[
                styles.headerTitle,
                {
                  color: isDarkMode ? '#F8FAFC' : '#1E293B',
                },
              ]}>
              Meter Notifier
            </Text>
            <Text
              style={[
                styles.headerSubtitle,
                {
                  color: isDarkMode ? '#94A3B8' : '#64748B',
                },
              ]}>
              {isAdmin ? 'Admin Dashboard' : 'Operator Dashboard'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.headerButton,
              {
                backgroundColor: isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(241, 245, 249, 0.8)',
              },
            ]}
            onPress={() => router.push({
              pathname: '/notifications',
              params: { source: 'Meter' }
            })}>
            <Ionicons
              name="notifications-outline"
              size={windowWidth > highDPIPhones ? 20 : 18}
              color={isDarkMode ? '#94A3B8' : '#475569'}
            />
            <Text style={[
              styles.headerButtonLabel,
              { color: isDarkMode ? '#94A3B8' : '#475569' }
            ]}>
              Alerts
            </Text>
            {unreadCount > 0 && (
              <View
                style={[
                  styles.notificationBadge,
                  {
                    backgroundColor: isDarkMode ? '#10B981' : '#059669',
                  },
                ]}>
                <Text style={styles.notificationBadgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerButton,
              {
                backgroundColor: isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(241, 245, 249, 0.8)',
              },
            ]}
            onPress={() => router.push('/(dashboard)/operator')}>
            <Ionicons
              name="flame-outline"
              size={windowWidth > highDPIPhones ? 20 : 18}
              color={isDarkMode ? '#F87171' : '#EF4444'}
            />
            <Text style={[
              styles.headerButtonLabel,
              { color: isDarkMode ? '#F87171' : '#EF4444' }
            ]}>
              Furnace
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerButton,
              {
                backgroundColor: isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(241, 245, 249, 0.8)',
              },
            ]}
            onPress={() => toggleTheme()}>
            <Ionicons
              name={isDarkMode ? 'sunny-outline' : 'moon-outline'}
              size={windowWidth > highDPIPhones ? 20 : 18}
              color={isDarkMode ? '#94A3B8' : '#475569'}
            />
            <Text style={[
              styles.headerButtonLabel,
              { color: isDarkMode ? '#94A3B8' : '#475569' }
            ]}>
              Theme
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      {isLatestLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDarkMode ? '#6EE7B7' : '#10B981'} />
          <Text style={[styles.loadingText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Loading meter readings...
          </Text>
        </View>
      ) : isLatestError ? (
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={64}
            color={isDarkMode ? '#F87171' : '#EF4444'}
          />
          <Text style={[styles.errorTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            Error Loading Meter Data
          </Text>
          <Text style={[styles.errorMessage, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            {latestError instanceof Error ? latestError.message : 'Failed to load meter data'}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: isDarkMode ? '#10B981' : '#059669' }]}
            onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !latestReadingData ? (
        <View style={styles.emptyStateContainer}>
          <Ionicons
            name="analytics-outline"
            size={64}
            color={isDarkMode ? '#6B7280' : '#9CA3AF'}
          />
          <Text style={[styles.emptyStateTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            No Meter Data Available
          </Text>
          <Text style={[styles.emptyStateMessage, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            No meter readings have been recorded yet. Please ensure your meter device is connected and sending data.
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: isDarkMode ? '#10B981' : '#059669' }]}
            onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#10B981']}
              tintColor={isDarkMode ? '#6EE7B7' : '#10B981'}
            />
          }>
          {/* Live Parameters Grid */}
          <View style={styles.sectionHeader}>
            <Text
              style={[
                styles.sectionTitle,
                { color: isDarkMode ? '#F8FAFC' : '#1E293B' },
              ]}>
              Live Meter Readings
            </Text>
            <Text
              style={[
                styles.sectionSubtitle,
                { color: isDarkMode ? '#94A3B8' : '#64748B' },
              ]}>
              Last updated: {latestReadingData ? formatTimestampIST(latestReadingData.created_at) : 'N/A'}
            </Text>
          </View>

          <View style={styles.parametersGrid}>
            {meterParameters.map((param) => (
              <TouchableOpacity
                key={param.id}
                style={[
                  styles.parameterCard,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                  },
                ]}
                onPress={() => handleParameterPress(param.id)}
                disabled={!isAdmin}
              >
                <View
                  style={[
                    styles.paramIconContainer,
                    {
                      backgroundColor: `${param.color}20`, // 20% opacity
                    },
                  ]}>
                  <Ionicons name={param.icon as any} size={24} color={param.color} />
                </View>
                <Text
                  style={[
                    styles.paramName,
                    { color: isDarkMode ? '#94A3B8' : '#64748B' },
                  ]}>
                  {param.name}
                </Text>
                <Text
                  style={[
                    styles.paramValue,
                    { color: isDarkMode ? '#F8FAFC' : '#1E293B' },
                  ]}>
                  {param.value} {param.unit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Timeframe Selector */}
          <View style={styles.timeframeContainer}>
            {[
              { value: 1, label: '1 Hour' },
              { value: 6, label: '6 Hours' },
              { value: 24, label: '24 Hours' },
            ].map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.timeframeButton,
                  selectedTimeframe === option.value && styles.timeframeSelected,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                    borderColor:
                      selectedTimeframe === option.value
                        ? isDarkMode ? '#6EE7B7' : '#10B981'
                        : isDarkMode ? '#334155' : '#E2E8F0',
                  },
                ]}
                onPress={() => setSelectedTimeframe(option.value)}>
                <Text
                  style={[
                    styles.timeframeButtonText,
                    {
                      color:
                        selectedTimeframe === option.value
                          ? isDarkMode ? '#6EE7B7' : '#10B981'
                          : isDarkMode ? '#94A3B8' : '#64748B',
                    },
                  ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Chart Section */}
          <View style={styles.chartSection}>
            <View style={[styles.sectionHeader, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
              <Text style={[
                styles.sectionTitle,
                { color: isDarkMode ? '#F8FAFC' : '#1E293B' },
              ]}>
                Parameter History
              </Text>
              
              {/* Toggle Switch for Graph View */}
              <View style={[
                styles.toggleContainer,
                { borderColor: isDarkMode ? '#334155' : '#E2E8F0' }
              ]}>
                <TouchableOpacity 
                  style={[
                    styles.toggleButton,
                    { backgroundColor: isDarkMode 
                      ? graphView === 'primary' ? '#10B981' : '#1E293B' 
                      : graphView === 'primary' ? '#059669' : '#F8FAFC' 
                    }
                  ]}
                  onPress={() => setGraphView('primary')}
                >
                  <Text style={[
                    styles.toggleText,
                    { color: graphView === 'primary' 
                      ? '#FFFFFF' 
                      : isDarkMode ? '#94A3B8' : '#64748B' 
                    }
                  ]}>
                    0-20
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[
                    styles.toggleButton,
                    { backgroundColor: isDarkMode 
                      ? graphView === 'secondary' ? '#10B981' : '#1E293B' 
                      : graphView === 'secondary' ? '#059669' : '#F8FAFC' 
                    }
                  ]}
                  onPress={() => setGraphView('secondary')}
                >
                  <Text style={[
                    styles.toggleText,
                    { color: graphView === 'secondary' 
                      ? '#FFFFFF' 
                      : isDarkMode ? '#94A3B8' : '#64748B' 
                    }
                  ]}>
                    0-200
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {isHistoryLoading ? (
              <View style={styles.chartLoadingContainer}>
                <ActivityIndicator size="large" color={isDarkMode ? '#6EE7B7' : '#10B981'} />
                <Text style={{ color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 8 }}>Loading chart data...</Text>
              </View>
            ) : chartData ? (
              <CustomChart 
                meterData={graphView === 'primary' ? chartData.primaryDatasets : chartData.secondaryDatasets} 
                timeLabels={chartData.labels} 
                isDarkMode={isDarkMode}
                axisRange={graphView === 'primary' 
                  ? { min: 0, max: 20, ticks: [0, 5, 10, 15, 20] }
                  : { min: 0, max: 200, ticks: [0, 50, 100, 150, 200] }
                }
              />
            ) : (
              <View style={styles.noDataContainer}>
                <Ionicons name="analytics-outline" size={48} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
                <Text style={{ color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 8 }}>No historical data available</Text>
              </View>
            )}
          </View>

          {/* Recent Readings Table */}
          <View style={styles.recentReadingsSection}>
            <View style={styles.sectionHeader}>
              <Text style={[
                styles.sectionTitle,
                { color: isDarkMode ? '#F8FAFC' : '#1E293B' },
              ]}>
                Recent Readings
              </Text>
            </View>
            
            {/* Table Header */}
            <View
              style={[
                styles.tableHeader,
                { backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(241, 245, 249, 0.8)' },
              ]}>
              <Text style={[styles.tableHeaderText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Time</Text>
              <Text style={[styles.tableHeaderText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>V</Text>
              <Text style={[styles.tableHeaderText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>A</Text>
              <Text style={[styles.tableHeaderText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Hz</Text>
              <Text style={[styles.tableHeaderText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>PF</Text>
              <Text style={[styles.tableHeaderText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>kW</Text>
            </View>
            
            {/* Table Rows */}
            {isHistoryLoading ? (
              <View style={styles.tableLoadingContainer}>
                <ActivityIndicator size="small" color={isDarkMode ? '#6EE7B7' : '#10B981'} />
              </View>
            ) : historyData && historyData.readings && historyData.readings.length > 0 ? (
              historyData.readings.slice(0, 10).map((reading, index) => {
                // Check if any value exceeds limits
                const limitExceeded = limitsData && limitsData.some(limit => {
                  const value = reading[limit.parameter as keyof MeterReading] as number;
                  return limit.highLimit && value > limit.highLimit;
                });
                
                return (
                  <View
                    key={reading.meter_id + index}
                    style={[
                      styles.tableRow,
                      {
                        backgroundColor: limitExceeded 
                          ? isDarkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(254, 226, 226, 0.6)'
                          : index % 2 === 0
                          ? isDarkMode ? 'rgba(30, 41, 59, 0.4)' : 'rgba(248, 250, 252, 0.6)'
                          : isDarkMode ? 'rgba(15, 23, 42, 0.3)' : 'rgba(241, 245, 249, 0.4)',
                      },
                    ]}>
                    <Text style={[styles.tableCell, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                      {formatTimeIST(reading.created_at)}
                    </Text>
                    <Text style={[
                      styles.tableCell, 
                      { 
                        color: isValueExceeded(reading.voltage, 'voltage', limitsData)
                          ? isDarkMode ? '#F87171' : '#DC2626' 
                          : isDarkMode ? '#F8FAFC' : '#1E293B' 
                      }
                    ]}>
                      {formatNumber(reading.voltage)}
                    </Text>
                    <Text style={[
                      styles.tableCell, 
                      { 
                        color: isValueExceeded(reading.current, 'current', limitsData)
                          ? isDarkMode ? '#F87171' : '#DC2626' 
                          : isDarkMode ? '#F8FAFC' : '#1E293B' 
                      }
                    ]}>
                      {formatNumber(reading.current)}
                    </Text>
                    <Text style={[
                      styles.tableCell, 
                      { 
                        color: isValueExceeded(reading.frequency, 'frequency', limitsData)
                          ? isDarkMode ? '#F87171' : '#DC2626' 
                          : isDarkMode ? '#F8FAFC' : '#1E293B' 
                      }
                    ]}>
                      {formatNumber(reading.frequency)}
                    </Text>
                    <Text style={[
                      styles.tableCell, 
                      { 
                        color: isValueExceeded(reading.pf, 'pf', limitsData)
                          ? isDarkMode ? '#F87171' : '#DC2626' 
                          : isDarkMode ? '#F8FAFC' : '#1E293B'
                      }
                    ]}>
                      {formatNumber(reading.pf, 2)}
                    </Text>
                    <Text style={[
                      styles.tableCell, 
                      { 
                        color: isValueExceeded(reading.power, 'power', limitsData)
                          ? isDarkMode ? '#F87171' : '#DC2626' 
                          : isDarkMode ? '#F8FAFC' : '#1E293B' 
                      }
                    ]}>
                      {formatNumber(reading.power)}
                    </Text>
                  </View>
                );
              })
            ) : (
              <View style={styles.tableLoadingContainer}>
                <Text style={{ color: isDarkMode ? '#94A3B8' : '#64748B' }}>No recent readings available</Text>
              </View>
            )}
            
            {/* Table footer with info */}
            <View style={styles.tableFooter}>
              <Text style={{ color: isDarkMode ? '#94A3B8' : '#64748B', fontSize: 11 }}>
                <Ionicons name="information-circle-outline" size={12} /> Values highlighted in red exceed their limits
              </Text>
            </View>
          </View>

          {/* Admin Meter Settings Section */}
          {isAdmin && (
            <View style={styles.adminSection}>
              <View style={styles.sectionHeader}>
                <Text style={[
                  styles.sectionTitle,
                  { color: isDarkMode ? '#F8FAFC' : '#1E293B' },
                ]}>
                  Admin Settings
                </Text>
              </View>
              
              <TouchableOpacity
                style={[
                  styles.adminButton,
                  { 
                    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                  }
                ]}
                onPress={() => router.push('/(dashboard)/screens/admin/meter-limits' as any)}
              >
                <Ionicons 
                  name="settings-outline" 
                  size={22} 
                  color={isDarkMode ? '#6EE7B7' : '#10B981'} 
                  style={styles.adminButtonIcon} 
                />
                <Text style={[
                  styles.adminButtonText,
                  { color: isDarkMode ? '#F8FAFC' : '#1E293B' }
                ]}>
                  Configure Parameter Limits
                </Text>
                <Ionicons 
                  name="chevron-forward" 
                  size={18} 
                  color={isDarkMode ? '#64748B' : '#94A3B8'} 
                />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* Bottom Navigation */}
      <SafeAreaView
        edges={['bottom']}
        style={[
          styles.bottomNavContainer,
          { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' },
        ]}>
        <View
          style={[
            styles.bottomNav,
            {
              backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
              borderTopColor: isDarkMode ? '#374151' : '#E5E7EB',
            },
          ]}>
          {[
            {
              name: 'Dashboard',
              icon: 'home',
              route: '/(dashboard)/meter-readings/index',
              active: true,
            },
            {
              name: 'History',
              icon: 'alarm-outline',
              route: '/(dashboard)/meter-readings/History',
              active: false,
            },
            {
              name: 'Reports',
              icon: 'document-text-outline',
              route: '/(dashboard)/meter-readings/Reports',
              active: false,
            },
            {
              name: 'Settings',
              icon: 'settings-outline',
              route: '/(dashboard)/profile',
              active: false,
            },
          ].map((item) => (
            <TouchableOpacity
              key={item.name}
              style={styles.navItem}
              onPress={() => router.push(item.route as any)}
              accessibilityRole="button"
              accessibilityLabel={item.name}>
              <Ionicons
                name={item.icon as any}
                size={22}
                color={
                  item.active
                    ? isDarkMode
                      ? '#6EE7B7'
                      : '#10B981'
                    : isDarkMode
                      ? '#9CA3AF'
                      : '#6B7280'
                }
              />
              <Text
                style={[
                  styles.navLabel,
                  {
                    color: item.active
                      ? isDarkMode
                        ? '#6EE7B7'
                        : '#10B981'
                      : isDarkMode
                        ? '#9CA3AF'
                        : '#6B7280',
                  },
                ]}
                numberOfLines={1}>
                {item.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {/* Parameter Limit Modal */}
      <Modal
        visible={limitModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseLimitModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContent,
            { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }
          ]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={[
                styles.modalIconContainer,
                { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)' }
              ]}>
                <Ionicons
                  name="settings-outline"
                  size={24}
                  color={isDarkMode ? '#6EE7B7' : '#10B981'}
                />
              </View>
              <TouchableOpacity
                style={[
                  styles.modalCloseButton,
                  { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }
                ]}
                onPress={handleCloseLimitModal}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                />
              </TouchableOpacity>
            </View>

            {/* Modal Title */}
            <Text style={[
              styles.modalTitle,
              { color: isDarkMode ? '#F9FAFB' : '#111827' }
            ]}>
              Parameter Limits
            </Text>
            
            {selectedLimit && (
              <>
                {/* Parameter Name */}
                <Text style={[
                  styles.modalParameterName,
                  { color: isDarkMode ? '#E5E7EB' : '#374151' }
                ]}>
                  {selectedLimit.description}
                </Text>

                {/* Limit Information */}
                <View style={styles.modalLimitContainer}>
                  {/* High Limit */}
                  <View style={[
                    styles.modalLimitItem,
                    { backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'rgba(254, 226, 226, 0.6)' }
                  ]}>
                    <View style={styles.modalLimitHeader}>
                      <Ionicons
                        name="arrow-up-circle"
                        size={20}
                        color={isDarkMode ? '#F87171' : '#DC2626'}
                      />
                      <Text style={[
                        styles.modalLimitLabel,
                        { color: isDarkMode ? '#F87171' : '#DC2626' }
                      ]}>
                        High Limit
                      </Text>
                    </View>
                    <Text style={[
                      styles.modalLimitValue,
                      { color: isDarkMode ? '#F87171' : '#DC2626' }
                    ]}>
                      {selectedLimit.highLimit} {selectedLimit.unit}
                    </Text>
                  </View>

                  {/* Low Limit */}
                  <View style={[
                    styles.modalLimitItem,
                    { backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(219, 234, 254, 0.6)' }
                  ]}>
                    <View style={styles.modalLimitHeader}>
                      <Ionicons
                        name="arrow-down-circle"
                        size={20}
                        color={isDarkMode ? '#60A5FA' : '#2563EB'}
                      />
                      <Text style={[
                        styles.modalLimitLabel,
                        { color: isDarkMode ? '#60A5FA' : '#2563EB' }
                      ]}>
                        Low Limit
                      </Text>
                    </View>
                    <Text style={[
                      styles.modalLimitValue,
                      { color: isDarkMode ? '#60A5FA' : '#2563EB' }
                    ]}>
                      {selectedLimit.lowLimit !== null 
                        ? `${selectedLimit.lowLimit} ${selectedLimit.unit}` 
                        : 'Not Set'
                      }
                    </Text>
                  </View>
                </View>

                {/* Modal Actions */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.modalCancelButton,
                      { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }
                    ]}
                    onPress={handleCloseLimitModal}
                  >
                    <Text style={[
                      styles.modalButtonText,
                      { color: isDarkMode ? '#E5E7EB' : '#374151' }
                    ]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.modalConfigureButton,
                      { backgroundColor: isDarkMode ? '#10B981' : '#059669' }
                    ]}
                    onPress={handleConfigureLimit}
                  >
                    <Ionicons
                      name="settings"
                      size={16}
                      color="#FFFFFF"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.modalConfigureButtonText}>
                      Configure
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    padding: 8,
    borderRadius: 14,
  },
  titleContainer: {
    marginLeft: 14,
  },
  headerTitle: {
    fontSize: windowWidth > highDPIPhones ? 20 : 18,
    fontWeight: windowWidth > highDPIPhones ? 'bold' : '800',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: windowWidth > highDPIPhones ? 13 : 11,
    marginTop: 2,
    fontWeight: '400',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: windowWidth > highDPIPhones ? 10 : 50,
    paddingLeft: windowWidth < lowDPIPhones ? 5 : 12,
  },
  headerButton: {
    width: windowWidth > highDPIPhones ? 52 : 48,
    height: windowWidth > highDPIPhones ? 52 : 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 4,
  },
  headerButtonLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: windowWidth > highDPIPhones ? 18 : 16,
    height: windowWidth > highDPIPhones ? 18 : 16,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: windowWidth > highDPIPhones ? 10 : 9,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
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
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  sectionHeader: {
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
    paddingLeft: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  parametersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: 2,
  },
  parameterCard: {
    width: '48%',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  paramIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  paramName: {
    fontSize: 14,
    marginBottom: 4,
  },
  paramValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  timeframeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 16,
    paddingHorizontal: 2,
  },
  timeframeButton: {
    flex: 1,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  timeframeSelected: {
    borderWidth: 2,
  },
  timeframeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  chartSection: {
    marginVertical: 8,
  },
  chartContainer: {
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  chartLoadingContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
  },
  recentReadingsSection: {
    marginTop: 24,
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 8,
    marginBottom: 4,
  },
  tableHeaderText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginBottom: 2,
  },
  tableCell: {
    flex: 1,
    fontSize: 12,
    textAlign: 'center',
  },
  tableLoadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  tableFooter: {
    padding: 10,
    alignItems: 'center',
  },
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    width: '100%',
  },
  navItem: {
    flex: 1,
    minWidth: 64,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  navLabel: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
  },
  adminSection: {
    marginTop: 24,
    marginBottom: 24,
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  adminButtonIcon: {
    marginRight: 12,
  },
  adminButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'gray', // We'll apply the dynamic color in the component
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalParameterName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalLimitContainer: {
    marginBottom: 24,
  },
  modalLimitItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  modalLimitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalLimitLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  modalLimitValue: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    borderWidth: 1,
    borderColor: 'rgba(156, 163, 175, 0.3)',
  },
  modalConfigureButton: {
    flexDirection: 'row',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalConfigureButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});
