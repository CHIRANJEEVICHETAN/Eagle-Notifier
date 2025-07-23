import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Platform,
  PanResponder,
  GestureResponderEvent,
  Animated,
  Easing,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useRouter } from 'expo-router';
import { useAnalyticsData } from '../../hooks/useAlarms';
import { usePredictiveAlerts } from '../../hooks/usePredictiveAlerts';
import { formatTimestampIST } from '../../utils/timezoneUtils';
import { useQueryClient } from '@tanstack/react-query';

// Types
type GraphType = 'analog' | 'binary' | 'predictive';
type TimeRange = '10s' | '15s' | '20s' | '1m' | '2m';

// Binary alarm interfaces
interface BinaryAlarmSeries {
  name: string;
  color: string;
  data: number[];
  description?: string;
}

// Constants
const GRAPH_COLORS = {
  zone1: '#FFC107', // Golden yellow
  zone2: '#FF9800', // Orange
  carbon: '#F44336', // Red
  oil: '#E91E63', // Pink
  tempering1: '#2196F3', // Light blue
  tempering2: '#009688', // Teal
};

// Add interface for Line component props
interface LineProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
}

// Predictive Chart Component
interface PredictiveChartProps {
  predictiveData: any[];
  timeRange: TimeRange;
}

const PredictiveChart: React.FC<PredictiveChartProps> = ({ predictiveData, timeRange }) => {
  const { isDarkMode } = useTheme();
  
  const theme = {
    background: isDarkMode ? '#1F2937' : '#FFFFFF',
    text: isDarkMode ? '#F3F4F6' : '#1F2937',
    subtext: isDarkMode ? '#9CA3AF' : '#6B7280',
    border: isDarkMode ? '#374151' : '#E5E7EB',
  };

  // Group alerts by confidence level
  const confidenceGroups = useMemo(() => {
    const groups = {
      high: predictiveData.filter(alert => (alert.confidence || 0) >= 0.9),
      medium: predictiveData.filter(alert => (alert.confidence || 0) >= 0.7 && (alert.confidence || 0) < 0.9),
      low: predictiveData.filter(alert => (alert.confidence || 0) < 0.7),
    };
    return groups;
  }, [predictiveData]);

  return (
    <View style={[styles.chartContainer, { backgroundColor: theme.background }]}>
      <Text style={[styles.chartTitle, { color: theme.text }]}>
        Predictive Alerts Analytics
      </Text>
      
      <View style={styles.predictiveStatsContainer}>
        <View style={[styles.statCard, { backgroundColor: '#EF4444' }]}>
          <Text style={styles.statNumber}>{confidenceGroups.high.length}</Text>
          <Text style={styles.statLabel}>High Confidence</Text>
          <Text style={styles.statSubLabel}>≥90%</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: '#F59E0B' }]}>
          <Text style={styles.statNumber}>{confidenceGroups.medium.length}</Text>
          <Text style={styles.statLabel}>Medium Confidence</Text>
          <Text style={styles.statSubLabel}>70-89%</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: '#10B981' }]}>
          <Text style={styles.statNumber}>{confidenceGroups.low.length}</Text>
          <Text style={styles.statLabel}>Low Confidence</Text>
          <Text style={styles.statSubLabel}>&lt;70%</Text>
        </View>
      </View>

      {predictiveData.length === 0 ? (
        <View style={styles.emptyPredictiveState}>
          <Ionicons name="analytics-outline" size={48} color={theme.subtext} />
          <Text style={[styles.emptyStateText, { color: theme.subtext }]}>
            No predictive alerts in selected time range
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.predictiveAlertsList}>
          {predictiveData.slice(0, 10).map((alert, index) => (
            <View key={alert.id || index} style={[styles.predictiveAlertItem, { borderColor: theme.border }]}>
              <View style={styles.predictiveAlertHeader}>
                <Text style={[styles.predictiveAlertTitle, { color: theme.text }]}>
                  {alert.description || 'Predictive Alert'}
                </Text>
                <View style={[
                  styles.confidenceBadge,
                  { 
                    backgroundColor: (alert.confidence || 0) >= 0.9 ? '#EF4444' : 
                                   (alert.confidence || 0) >= 0.7 ? '#F59E0B' : '#10B981'
                  }
                ]}>
                  <Text style={styles.confidenceText}>
                    {Math.round((alert.confidence || 0) * 100)}%
                  </Text>
                </View>
              </View>
              
              <Text style={[styles.predictiveAlertComponent, { color: theme.subtext }]}>
                Component: {alert.predictedComponent || 'Unknown'}
              </Text>
              
              <Text style={[styles.predictiveAlertTime, { color: theme.subtext }]}>
                Time to failure: {alert.timeToFailure ? `${alert.timeToFailure} min` : 'Unknown'}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

// Update Line component with better visibility
const Line = ({ startX, startY, endX, endY, color }: LineProps) => {
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
        height: 3, // Increased thickness from 2 to 3
        backgroundColor: color,
        transform: [
          { translateY: -1.5 }, // Adjusted for center alignment
          { rotate: `${angle}deg` },
          { translateY: 0 },
        ],
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 1,
        elevation: 2, // Better visibility on Android
      }}
    />
  );
};

// Add type definitions at the top
interface AlarmSeries {
  name: string;
  color: string;
  data: number[];
  setpoint: number[]; // Add setpoint array
  thresholds: {
    critical: {
      low: number[];
      high: number[];
    };
    warning: {
      low: number[];
      high: number[];
    };
  };
  unit: string;
}

// Update the status calculation function
const calculateStatus = (value: number, index: number, series: AlarmSeries): 'normal' | 'warning' | 'critical' => {
  const criticalLow = series.thresholds.critical.low[index];
  const criticalHigh = series.thresholds.critical.high[index];
  const warningLow = series.thresholds.warning.low[index];
  const warningHigh = series.thresholds.warning.high[index];

  if (value <= criticalLow || value >= criticalHigh) {
    return 'critical';
  }
  if (value <= warningLow || value >= warningHigh) {
    return 'warning';
  }
  return 'normal';
};

// Add this helper function before the AnalogChart component
const getTimeIntervalConfig = (timeRange: TimeRange) => {
  switch (timeRange) {
    case '10s':
      return { interval: 5, total: 3 }; // 5 second intervals
    case '15s':
      return { interval: 5, total: 4 }; // 5 second intervals
    case '20s':
      return { interval: 5, total: 5 }; // 5 second intervals
    case '1m':
      return { interval: 15, total: 5 }; // 15 second intervals
    case '2m':
      return { interval: 30, total: 5 }; // 30 second intervals
    default:
      return { interval: 5, total: 5 };
  }
};

// Update AnalogChart component props to include timeRange
interface AnalogChartProps {
  alarmData: AlarmSeries[];
  timeLabels: string[];
  timeRange: TimeRange;
}

// Update the AnalogChart component to accept timeRange
const AnalogChart = ({ alarmData, timeLabels, timeRange }: AnalogChartProps) => {
  const { isDarkMode } = useTheme();
  const textColor = isDarkMode ? '#F3F4F6' : '#1F2937';
  const gridColor = isDarkMode ? 'rgba(156, 163, 175, 0.2)' : 'rgba(107, 114, 128, 0.2)';
  const surfaceColor = isDarkMode ? '#1F2937' : '#FFFFFF';
  
  // Add state for touch interaction
  const [touchedPoint, setTouchedPoint] = useState<{
    seriesIndex: number;
    pointIndex: number;
    x: number;
    y: number;
    value: number;
    time: string;
    status?: 'normal' | 'warning' | 'critical';
  } | null>(null);
  
  const chartWidth = Dimensions.get('window').width - 32;
  const chartHeight = 300;
  
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;
  
  // Smart Y-axis range based on actual data with better handling for different value ranges
  const allValues = alarmData.flatMap(series => series.data).filter(val => !isNaN(val) && val !== null && val !== undefined);
  
  let dataMinValue = allValues.length > 0 ? Math.min(...allValues) : 0;
  let dataMaxValue = allValues.length > 0 ? Math.max(...allValues) : 1000;
  
  // Handle edge cases for very small ranges or values close to zero
  const dataRange = dataMaxValue - dataMinValue;
  
  // If range is very small (all values are similar), add artificial range
  if (dataRange < 10) {
    const midPoint = (dataMaxValue + dataMinValue) / 2;
    dataMinValue = midPoint - 25;
    dataMaxValue = midPoint + 25;
  }
  
  // Add dynamic padding based on the range (minimum 20 units, maximum 20% of range)
  const basePadding = Math.max(20, dataRange * 0.15);
  const minValue = Math.max(0, dataMinValue - basePadding);
  const maxValue = dataMaxValue + basePadding;
  const valueRange = maxValue - minValue;
  
  // Functions to calculate x and y positions
  const getX = (index: number) => padding.left + (index * graphWidth) / (timeLabels.length - 1);
  const getY = (value: number) => {
    // Clamp value between min and max to prevent rendering outside the chart area
    const clampedValue = Math.max(minValue, Math.min(maxValue, value));
    return padding.top + graphHeight - ((clampedValue - minValue) / valueRange) * graphHeight;
  };

  // Function to find the closest data point to touch coordinates
  const findClosestPoint = (touchX: number, touchY: number) => {
    let closestDistance = Infinity;
    let closestPoint = { seriesIndex: 0, pointIndex: 0, value: 0 };
    
    alarmData.forEach((series, seriesIndex) => {
      series.data.forEach((value, pointIndex) => {
        const pointX = getX(pointIndex);
        const pointY = getY(value);
        
        // Place extra weight on x-distance to make vertical proximity less important
        // This helps with values near the x-axis
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
    if (closestDistance < 50) {
      return closestPoint;
    }
    
    return null;
  };

  // Handle touch on graph
  const handleTouch = (event: GestureResponderEvent) => {
    // Get touch location relative to the chart
    const touchX = event.nativeEvent.locationX;
    const touchY = event.nativeEvent.locationY;
    
    // Find closest data point
    const closestPoint = findClosestPoint(touchX, touchY);
    
    if (closestPoint) {
      const { seriesIndex, pointIndex, value } = closestPoint;
      
      // Determine status based on thresholds
      let status: 'normal' | 'warning' | 'critical' = 'normal';
      const series = alarmData[seriesIndex];
      if (series.thresholds) {
        const { critical, warning } = series.thresholds;
        if (value <= critical.low[pointIndex] || value >= critical.high[pointIndex]) {
          status = 'critical';
        } else if (value <= warning.low[pointIndex] || value >= warning.high[pointIndex]) {
          status = 'warning';
        }
      }

      setTouchedPoint({
        seriesIndex,
        pointIndex,
        x: getX(pointIndex),
        y: getY(value),
        value,
        time: timeLabels[pointIndex],
        status
      });
    } else {
      // Touch was not near any point
      setTouchedPoint(null);
    }
  };

  // Clear touch when touching outside points
  const handleTouchOutside = () => {
    setTouchedPoint(null);
  };
  
  // Create PanResponder for handling touch gestures
  const panResponder = React.useMemo(() => PanResponder.create({
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
  }), [alarmData, timeLabels]);
  
  // Replace the existing getVisibleTimeLabels function with this updated version
  const getVisibleTimeLabels = () => {
    const { interval, total } = getTimeIntervalConfig(timeRange);
    const labelCount = Math.min(total, timeLabels.length);
    const step = Math.floor(timeLabels.length / labelCount);
    
    const visibleLabels: string[] = [];
    for (let i = 0; i < timeLabels.length; i += step) {
      if (visibleLabels.length < labelCount) {
        visibleLabels.push(timeLabels[i]);
      }
    }
    
    // Ensure we always show the last label
    if (visibleLabels[visibleLabels.length - 1] !== timeLabels[timeLabels.length - 1]) {
      visibleLabels[visibleLabels.length - 1] = timeLabels[timeLabels.length - 1];
    }
    
    return visibleLabels;
  };

  return (
    <View style={[styles.graphContainer, { backgroundColor: surfaceColor }]}>
      <Text style={[styles.graphTitle, { color: textColor }]}>
        Analog Alarm Trend
      </Text>
      
      <View 
        style={{ height: chartHeight, position: 'relative' }}
      >
        {/* Grid Lines */}
        {(() => {
          // Generate 6 evenly spaced grid lines based on data range
          const gridValues = [];
          for (let i = 0; i <= 5; i++) {
            gridValues.push(minValue + (i * (maxValue - minValue)) / 5);
          }
          return gridValues.map((yValue, i) => {
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
          });
        })()}
        
        {timeLabels.map((_, i) => (
          <View 
            key={`v-grid-${i}`}
            style={{
              position: 'absolute',
              left: getX(i),
              top: padding.top,
              width: 1,
              height: graphHeight,
              backgroundColor: gridColor,
            }}
          />
        ))}
        
        {/* Y-axis labels */}
        {(() => {
          // Generate 6 evenly spaced labels based on data range
          const labelValues = [];
          for (let i = 0; i <= 5; i++) {
            labelValues.push(minValue + (i * (maxValue - minValue)) / 5);
          }
          return labelValues.map((value, i) => {
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
                {value.toFixed(0)}
              </Text>
            );
          });
        })()}
        
        {/* X-axis labels */}
        {getVisibleTimeLabels().map((label, i) => {
          // Find the actual index in the original timeLabels array
          const actualIndex = timeLabels.indexOf(label);
          return (
            <Text 
              key={`x-label-${i}`}
              style={{
                position: 'absolute',
                left: getX(actualIndex) - 15,
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
        
        {/* Draw lines for each data series */}
        {alarmData.map((series: AlarmSeries, seriesIndex: number) => (
          series.data.map((value: number, i: number) => {
            if (i === series.data.length - 1) return null;
            const startX = getX(i);
            const startY = getY(value);
            const endX = getX(i + 1);
            const endY = getY(series.data[i + 1]);
            return (
              <Line
                key={`line-${seriesIndex}-${i}`}
                startX={startX}
                startY={startY}
                endX={endX}
                endY={endY}
                color={series.color}
              />
            );
          })
        ))}
        
        {/* Data points for each series */}
        {alarmData.map((series: AlarmSeries, seriesIndex: number) => (
          series.data.map((value: number, i: number) => (
            <View
              key={`point-${seriesIndex}-${i}`}
              style={{
                position: 'absolute',
                left: getX(i) - 5,
                top: getY(value) - 5,
                width: 10, // Increased from 8 to 10
                height: 10, // Increased from 8 to 10
                borderRadius: 5, // Adjusted for new size
                backgroundColor: series.color,
                borderWidth: 2, // Added border for better visibility
                borderColor: isDarkMode ? '#FFFFFF' : '#000000',
                zIndex: 5,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 2,
                elevation: 3,
              }}
            />
          ))
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
              left: (touchedPoint.x < chartWidth / 2) ? touchedPoint.x + 10 : touchedPoint.x - 220,
              top: (touchedPoint.y < chartHeight / 2) ? touchedPoint.y + 10 : touchedPoint.y - 170,
              width: 210,
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
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: alarmData[touchedPoint.seriesIndex].color, marginRight: 8 }} />
                <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 14 }}>
                  {alarmData[touchedPoint.seriesIndex].name}
                </Text>
              </View>
              <TouchableOpacity onPress={handleTouchOutside} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={20} color={textColor} />
              </TouchableOpacity>
            </View>

            {/* Status indicator */}
            {(() => {
              const series = alarmData[touchedPoint.seriesIndex];
              const status = calculateStatus(touchedPoint.value, touchedPoint.pointIndex, series);
              return (
                <View 
                  style={{ 
                    paddingVertical: 4,
                    paddingHorizontal: 8, 
                    borderRadius: 4, 
                    backgroundColor: status === 'critical' ? 'rgba(239, 68, 68, 0.2)' : 
                                   status === 'warning' ? 'rgba(245, 158, 11, 0.2)' : 
                                   'rgba(34, 197, 94, 0.2)',
                    marginBottom: 10,
                    alignSelf: 'flex-start'
                  }}
                >
                  <Text 
                    style={{ 
                      color: status === 'critical' ? '#EF4444' : 
                             status === 'warning' ? '#F59E0B' : 
                             '#22C55E',
                      fontWeight: '600',
                      fontSize: 12,
                      textTransform: 'uppercase'
                    }}
                  >
                    {status}
                  </Text>
                </View>
              );
            })()}

            <View style={{ marginBottom: 8 }}>
              <Text style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: 12 }}>Current Value</Text>
              <Text style={{ color: textColor, fontSize: 18, fontWeight: '600' }}>
                {touchedPoint.value.toFixed(1)} {alarmData[touchedPoint.seriesIndex].unit}
              </Text>
            </View>

            <View style={{ marginBottom: 8 }}>
              <Text style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: 12 }}>Set Point</Text>
              <Text style={{ color: textColor, fontSize: 14 }}>
                {alarmData[touchedPoint.seriesIndex].setpoint[touchedPoint.pointIndex].toFixed(1)} {alarmData[touchedPoint.seriesIndex].unit}
              </Text>
            </View>

            <View style={{ marginBottom: 8 }}>
              <Text style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: 12 }}>Time</Text>
              <Text style={{ color: textColor, fontSize: 14 }}>
                {touchedPoint.time}
              </Text>
            </View>

            {/* Threshold information */}
            <View style={{ height: 1, backgroundColor: isDarkMode ? 'rgba(75, 85, 99, 0.4)' : 'rgba(229, 231, 235, 0.8)', marginVertical: 8 }} />
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: 12 }}>Warning Range:</Text>
              <Text style={{ color: textColor, fontSize: 12, fontWeight: '500' }}>
                {alarmData[touchedPoint.seriesIndex].thresholds.warning.low[touchedPoint.pointIndex].toFixed(1)} - {alarmData[touchedPoint.seriesIndex].thresholds.warning.high[touchedPoint.pointIndex].toFixed(1)} {alarmData[touchedPoint.seriesIndex].unit}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: 12 }}>Critical Range:</Text>
              <Text style={{ color: textColor, fontSize: 12, fontWeight: '500' }}>
                {alarmData[touchedPoint.seriesIndex].thresholds.critical.low[touchedPoint.pointIndex].toFixed(1)} - {alarmData[touchedPoint.seriesIndex].thresholds.critical.high[touchedPoint.pointIndex].toFixed(1)} {alarmData[touchedPoint.seriesIndex].unit}
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
      <View style={styles.legendContainer}>
        <Text style={[styles.legendTitle, { color: textColor }]}>Legend</Text>
        <View style={styles.legendItems}>
          {alarmData.map((series, index) => (
            <View 
              key={`legend-${index}`} 
              style={[
                styles.legendItem,
                { width: '100%', marginBottom: 6 } // Change from 50% to 100% width
              ]}
            >
              <View
                style={[
                  styles.legendColor,
                  { backgroundColor: series.color }
                ]}
              />
              <Text 
                style={[
                  styles.legendText, 
                  { 
                    color: textColor,
                    fontSize: 10, // Smaller font size
                    flexShrink: 1, // Allow text to shrink if needed
                  }
                ]} 
                numberOfLines={2} // Allow 2 lines for longer titles
              >
                {series.name}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

// Update the BinaryChart component to include proper touch handling
interface BinaryChartProps {
  alarmData: BinaryAlarmSeries[];
  timeLabels: string[];
  timeRange: TimeRange;
}

const BinaryChart = ({ alarmData, timeLabels, timeRange }: BinaryChartProps) => {
  const { isDarkMode } = useTheme();
  const textColor = isDarkMode ? '#F3F4F6' : '#1F2937';
  const gridColor = isDarkMode ? 'rgba(156, 163, 175, 0.2)' : 'rgba(107, 114, 128, 0.2)';
  const surfaceColor = isDarkMode ? '#1F2937' : '#FFFFFF';
  
  const [touchedPoint, setTouchedPoint] = useState<{
    seriesIndex: number;
    pointIndex: number;
    x: number;
    y: number;
    value: number;
    time: string;
  } | null>(null);
  
  const chartWidth = Dimensions.get('window').width - 32;
  const singleChartHeight = 50; // Height for each binary alarm row
  const totalHeight = alarmData.length * singleChartHeight + 100; // Add space for title and labels
  
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const graphWidth = chartWidth - padding.left - padding.right;
  
  // Functions to calculate x and y positions
  const getX = (index: number) => padding.left + (index * graphWidth) / (timeLabels.length - 1);
  const getRowY = (rowIndex: number) => padding.top + rowIndex * singleChartHeight + singleChartHeight / 2;
  
  // Calculate bar height based on value (0 or 1)
  const getBarHeight = (value: number) => value * (singleChartHeight * 0.8);
  
  // Function to find the closest data point to touch coordinates
  const findClosestPoint = (touchX: number, touchY: number) => {
    let closestDistance = Infinity;
    let closestPoint = { seriesIndex: 0, pointIndex: 0, value: 0 };
    
    alarmData.forEach((series, seriesIndex) => {
      const rowY = getRowY(seriesIndex);
      
      // Only consider touches near the row
      if (Math.abs(touchY - rowY) > singleChartHeight) return;
      
      series.data.forEach((value, pointIndex) => {
        const pointX = getX(pointIndex);
        
        // Calculate distance (primarily horizontal since we're in a row)
        const distance = Math.abs(touchX - pointX);
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPoint = { seriesIndex, pointIndex, value };
        }
      });
    });
    
    // Increased detection range to 30px
    if (closestDistance < 30) {
      return closestPoint;
    }
    
    return null;
  };

  // Handle touch on graph
  const handleTouch = (event: GestureResponderEvent) => {
    const touchX = event.nativeEvent.locationX;
    const touchY = event.nativeEvent.locationY;
    
    const closestPoint = findClosestPoint(touchX, touchY);
    
    if (closestPoint) {
      const { seriesIndex, pointIndex, value } = closestPoint;
      
      setTouchedPoint({
        seriesIndex,
        pointIndex,
        x: getX(pointIndex),
        y: getRowY(seriesIndex),
        value,
        time: timeLabels[pointIndex]
      });
    } else {
      setTouchedPoint(null);
    }
  };

  // Clear touch when touching outside points
  const handleTouchOutside = () => {
    setTouchedPoint(null);
  };
  
  // Create PanResponder for handling touch gestures
  const panResponder = React.useMemo(() => PanResponder.create({
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
  }), [alarmData, timeLabels]);
  
  // Replace the existing getVisibleTimeLabels function with this updated version
  const getVisibleTimeLabels = () => {
    const { interval, total } = getTimeIntervalConfig(timeRange);
    const labelCount = Math.min(total, timeLabels.length);
    const step = Math.floor(timeLabels.length / labelCount);
    
    const visibleLabels: string[] = [];
    for (let i = 0; i < timeLabels.length; i += step) {
      if (visibleLabels.length < labelCount) {
        visibleLabels.push(timeLabels[i]);
      }
    }
    
    // Ensure we always show the last label
    if (visibleLabels[visibleLabels.length - 1] !== timeLabels[timeLabels.length - 1]) {
      visibleLabels[visibleLabels.length - 1] = timeLabels[timeLabels.length - 1];
    }
    
    return visibleLabels;
  };

  return (
    <View style={[styles.graphContainer, { backgroundColor: surfaceColor }]}>
      <Text style={[styles.graphTitle, { color: textColor }]}>
        Binary Alarms Status
      </Text>
      
      <View style={{ height: totalHeight, position: 'relative' }}>
        {/* Y-axis line */}
        <View 
          style={{
            position: 'absolute',
            left: padding.left,
            top: padding.top,
            width: 1,
            height: alarmData.length * singleChartHeight,
            backgroundColor: textColor,
          }}
        />
        
        {/* X-axis line at the bottom */}
        <View 
          style={{
            position: 'absolute',
            left: padding.left,
            top: padding.top + alarmData.length * singleChartHeight,
            width: graphWidth,
            height: 1,
            backgroundColor: textColor,
          }}
        />
        
        {/* Horizontal grid lines for each alarm */}
        {alarmData.map((_, rowIndex) => {
          const yPosition = getRowY(rowIndex);
          return (
            <React.Fragment key={`row-${rowIndex}`}>
              {/* Base value line (0.0) */}
              <View 
                style={{
                  position: 'absolute',
                  left: padding.left,
                  top: padding.top + (rowIndex + 1) * singleChartHeight,
                  width: graphWidth,
                  height: 1,
                  backgroundColor: gridColor,
                }}
              />
              
              {/* Value of 1.0 line */}
              <Text 
                style={{
                  position: 'absolute',
                  left: 10,
                  top: padding.top + rowIndex * singleChartHeight,
                  color: textColor,
                  fontSize: 10,
                }}
              >
                1.0
              </Text>
              
              {/* Value of 0.0 line */}
              <Text 
                style={{
                  position: 'absolute',
                  left: 10,
                  top: padding.top + (rowIndex + 1) * singleChartHeight - 10,
                  color: textColor,
                  fontSize: 10,
                }}
              >
                0.0
              </Text>
            </React.Fragment>
          );
        })}
        
        {/* Vertical grid lines */}
        {timeLabels.map((_, i) => (
          <View 
            key={`v-grid-${i}`}
            style={{
              position: 'absolute',
              left: getX(i),
              top: padding.top,
              width: 1,
              height: alarmData.length * singleChartHeight,
              backgroundColor: gridColor,
            }}
          />
        ))}
        
        {/* X-axis labels */}
        {getVisibleTimeLabels().map((label, i) => {
          const actualIndex = timeLabels.indexOf(label);
          return (
            <Text 
              key={`x-label-${i}`}
              style={{
                position: 'absolute',
                left: getX(actualIndex) - 15,
                top: padding.top + alarmData.length * singleChartHeight + 10,
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
        
        {/* Draw lines connecting the points for each alarm */}
        {alarmData.map((series, seriesIndex) => (
          series.data.map((value, i) => {
            if (i === series.data.length - 1) return null;
            const startX = getX(i);
            const startY = getRowY(seriesIndex) + (value === 0 ? 0 : -singleChartHeight * 0.3);
            const endX = getX(i + 1);
            const endY = getRowY(seriesIndex) + (series.data[i + 1] === 0 ? 0 : -singleChartHeight * 0.3);
            return (
              <Line
                key={`line-${seriesIndex}-${i}`}
                startX={startX}
                startY={startY}
                endX={endX}
                endY={endY}
                color={series.color}
              />
            );
          })
        ))}
        
        {/* Draw bars for each data point */}
        {alarmData.map((series, seriesIndex) => (
          series.data.map((value, i) => {
            if (value === 0) return null; // Don't draw bars for zero values
            // For the first data point, make sure the bar doesn't overlap with y-axis
            const barWidth = 24;
            const barLeftPosition = i === 0 
              ? Math.max(padding.left, getX(i) - barWidth/2) // Don't go left of y-axis
              : getX(i) - barWidth/2; // Center the bar on other points
            
            return (
              <View
                key={`bar-${seriesIndex}-${i}`}
                style={{
                  position: 'absolute',
                  left: barLeftPosition,
                  top: getRowY(seriesIndex) - getBarHeight(value),
                  width: barWidth,
                  height: getBarHeight(value),
                  backgroundColor: series.color,
                }}
              />
            );
          })
        ))}
        
        {/* Data points (small circles) */}
        {alarmData.map((series, seriesIndex) => (
          series.data.map((value, i) => (
            <View
              key={`point-${seriesIndex}-${i}`}
              style={{
                position: 'absolute',
                left: getX(i) - 4,
                top: getRowY(seriesIndex) + (value === 0 ? 0 : -singleChartHeight * 0.3) - 4,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: 'black',
                borderWidth: 1,
                borderColor: 'white',
              }}
            />
          ))
        ))}
        
        {/* Touch overlay */}
        <View
          {...panResponder.panHandlers}
          style={{
            position: 'absolute',
            left: padding.left,
            top: padding.top,
            width: graphWidth,
            height: alarmData.length * singleChartHeight,
            zIndex: 10,
          }}
        />
        
        {/* Tooltip for selected point */}
        {touchedPoint && (
          <View
            style={{
              position: 'absolute',
              left: (touchedPoint.x < chartWidth / 2) ? touchedPoint.x + 10 : touchedPoint.x - 160,
              top: touchedPoint.y - 60,
              width: 150,
              backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              borderRadius: 8,
              padding: 8,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              elevation: 5,
              zIndex: 100,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: alarmData[touchedPoint.seriesIndex].color, marginRight: 6 }} />
                <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 12 }} numberOfLines={1}>
                  {alarmData[touchedPoint.seriesIndex].name}
                </Text>
              </View>
              <TouchableOpacity onPress={handleTouchOutside}>
                <Ionicons name="close-circle" size={16} color={textColor} />
              </TouchableOpacity>
            </View>
            <View style={{ marginBottom: 4 }}>
              <Text style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: 10 }}>Status</Text>
              <Text style={{ color: textColor, fontSize: 12, fontWeight: '600' }}>
                {touchedPoint.value === 1 ? 'Failure' : 'Normal'}
              </Text>
            </View>
            <View>
              <Text style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: 10 }}>Time</Text>
              <Text style={{ color: textColor, fontSize: 12 }}>
                {touchedPoint.time}
              </Text>
            </View>
          </View>
        )}
      </View>
      
      {/* Legend */}
      <View style={styles.legendContainer}>
        <Text style={[styles.legendTitle, { color: textColor }]}>Legend</Text>
        <View style={styles.legendItems}>
          {alarmData.map((series, index) => (
            <View 
              key={`legend-${index}`} 
              style={[
                styles.legendItem,
                { width: '100%', marginBottom: 6 }
              ]}
            >
              <View
                style={[
                  styles.legendColor,
                  { backgroundColor: series.color }
                ]}
              />
              <Text 
                style={[
                  styles.legendText, 
                  { 
                    color: textColor,
                    fontSize: 10,
                    flexShrink: 1,
                  }
                ]} 
                numberOfLines={2}
              >
                {series.name}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

export default function AnalyticsScreen() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // Animation value for toggle button
  const animatedValue = useRef(new Animated.Value(0)).current;
  
  // State
  const [activeGraph, setActiveGraph] = useState<GraphType>('analog');
  const [timeRange, setTimeRange] = useState<TimeRange>('20s');
  const [refreshing, setRefreshing] = useState(false);
  
  // Fetch real-time analytics data
  const { data: analyticsData, isLoading, error, refetch } = useAnalyticsData(timeRange);
  
  // Import predictive alerts hook
  const { data: predictiveData, refetch: refetchPredictive } = usePredictiveAlerts();

  // Invalidate cache immediately when timeRange changes for instant switching
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['scada-analytics'] });
  }, [timeRange, queryClient]);

  // Theme colors
  const theme = useMemo(() => ({
    background: isDarkMode ? '#111827' : '#F9FAFB',
    surface: isDarkMode ? '#1F2937' : '#FFFFFF',
    text: isDarkMode ? '#F3F4F6' : '#1F2937',
    subtext: isDarkMode ? '#9CA3AF' : '#6B7280',
    border: isDarkMode ? 'rgba(75, 85, 99, 0.4)' : 'rgba(229, 231, 235, 0.4)',
    primary: isDarkMode ? '#3B82F6' : '#2563EB',
  }), [isDarkMode]);

  // Toggle between graph types
  const toggleGraph = useCallback(() => {
    // Update graph type - cycle through analog -> binary -> predictive -> analog
    setActiveGraph(prev => {
      if (prev === 'analog') return 'binary';
      if (prev === 'binary') return 'predictive';
      return 'analog';
    });
  }, []);

  // Pull to refresh functionality
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), refetchPredictive()]);
      // Also invalidate the query to force a fresh fetch
      queryClient.invalidateQueries({ queryKey: ['scada-analytics', timeRange] });
      queryClient.invalidateQueries({ queryKey: ['predictive-alerts'] });
    } catch (error) {
      console.error('Error refreshing analytics data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refetchPredictive, queryClient, timeRange]);

  // Update animation when graph type changes
  useEffect(() => {
    let toValue = 0;
    if (activeGraph === 'binary') toValue = 1;
    if (activeGraph === 'predictive') toValue = 2;
    
    Animated.timing(animatedValue, {
      toValue,
      duration: 300,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [activeGraph, animatedValue]);

  // Compute IST time labels
  const istTimeLabels = useMemo(() => {
    // Only format if the label looks like a date, otherwise use as-is
    return (analyticsData?.timeLabels || []).map((t: string) => {
      // Simple check: if it contains '-' or 'T', treat as date, else use as-is
      if (t.includes('-') || t.includes('T')) {
        return formatTimestampIST(t);
      }
      return t;
    });
  }, [analyticsData?.timeLabels]);

  // Render graph toggle button
  const renderGraphToggle = () => {
    // Calculate animated values for the button
    const scale = animatedValue.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [1, 0.95, 1]
    });
    
    const rotate = animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '180deg']
    });

    // Icon animation
    const iconOpacity = animatedValue.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [1, 0, 1]
    });
    
    const iconScale = animatedValue.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [1, 0.5, 1]
    });
    
    // Background color animation
    const backgroundColor = animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [theme.primary, '#6366f1'] // Blue to indigo transition
    });
    
    return (
      <Animated.View 
        style={[
          styles.toggleButtonContainer,
          { 
            transform: [{ scale }]
          }
        ]}
      >
        <Animated.View
          style={[
            styles.toggleButtonBackground,
            {
              backgroundColor: backgroundColor
            }
          ]}
        />
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={toggleGraph}
          activeOpacity={0.8}
        >
          <View style={{ 
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center' 
          }}>
            <Animated.View style={[
              styles.iconContainer,
              {
                transform: [{ rotate }, { scale: iconScale }],
                opacity: iconOpacity
              }
            ]}>
              <Ionicons
                name={
                  activeGraph === 'analog' ? 'analytics' : 
                  activeGraph === 'binary' ? 'toggle' : 
                  'trending-up'
                }
                size={22}
                color="#FFFFFF"
                style={styles.toggleIcon}
              />
            </Animated.View>
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' }}>
              {
                activeGraph === 'analog' ? 'Switch to Binary View' : 
                activeGraph === 'binary' ? 'Switch to Predictive View' : 
                'Switch to Analog View'
              }
            </Text>
          </View>
          
          {/* Button shine effect */}
          <Animated.View 
            style={[
              styles.toggleShine,
              {
                opacity: animatedValue.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 0.8, 0]
                }),
                transform: [{
                  translateX: animatedValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-100, 100]
                  })
                }]
              }
            ]}
          />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Render time range selector
  const renderTimeRangeSelector = () => {
    const ranges: { label: string; value: TimeRange }[] = [
      { label: '10S', value: '10s' },
      { label: '15S', value: '15s' },
      { label: '20S', value: '20s' },
      { label: '1M', value: '1m' },
      { label: '2M', value: '2m' },
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
                opacity: isLoading && timeRange === range.value ? 0.7 : 1, // Visual feedback when loading
              }
            ]}
            onPress={() => setTimeRange(range.value)}
            disabled={isLoading} // Prevent rapid clicking while loading
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
              {isLoading && timeRange === range.value && (
                <ActivityIndicator 
                  size="small" 
                  color="#FFFFFF" 
                  style={{ marginLeft: 4 }} 
                />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  // Render error state
  const renderError = () => (
    <View style={[styles.loadingContainer, { backgroundColor: theme.surface }]}>
      <Ionicons name="warning-outline" size={48} color={theme.subtext} />
      <Text style={[styles.emptyStateTitle, { color: theme.text }]}>Error Loading Data</Text>
      <Text style={[styles.emptyStateText, { color: theme.subtext }]}>
        Unable to fetch analytics data for {timeRange.toUpperCase()}. Please check SCADA connection.
      </Text>
      <TouchableOpacity
        style={[styles.retryButton, { backgroundColor: theme.primary }]}
        onPress={onRefresh}
      >
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  // Render empty state
  const renderEmptyState = () => (
    <View style={[styles.loadingContainer, { backgroundColor: theme.surface }]}>
      <Ionicons name="analytics-outline" size={48} color={theme.subtext} />
      <Text style={[styles.emptyStateTitle, { color: theme.text }]}>No Data Available</Text>
      <Text style={[styles.emptyStateText, { color: theme.subtext }]}>
        No SCADA data found for the last {timeRange.toUpperCase()}. Try a different time range or pull to refresh.
      </Text>
      <TouchableOpacity
        style={[styles.retryButton, { backgroundColor: theme.primary }]}
        onPress={onRefresh}
      >
        <Text style={styles.retryButtonText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );

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
            Real-time Alarm Trends & Patterns
          </Text>
        </View>
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        {renderGraphToggle()}
        {renderTimeRangeSelector()}
        
        {/* Main Content */}
        {isLoading ? (
          <View style={[styles.loadingContainer, { backgroundColor: theme.surface }]}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.subtext }]}>Loading real-time data...</Text>
          </View>
        ) : error ? (
          renderError()
        ) : !analyticsData || (!analyticsData.analogData?.length && !analyticsData.binaryData?.length) || analyticsData.message ? (
          renderEmptyState()
        ) : (
          activeGraph === 'analog' ? (
            <AnalogChart 
              alarmData={analyticsData.analogData || []} 
              timeLabels={istTimeLabels}
              timeRange={timeRange}
            />
          ) : activeGraph === 'binary' ? (
            <BinaryChart 
              alarmData={analyticsData.binaryData || []} 
              timeLabels={istTimeLabels}
              timeRange={timeRange}
            />
          ) : (
            <PredictiveChart 
              predictiveData={predictiveData?.predictiveAlerts || []}
              timeRange={timeRange}
            />
          )
        )}
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
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  activeToggle: {
    borderRadius: 6,
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

  graphContainer: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
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
  graphTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
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
    marginBottom: 12,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingRight: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 11,
    flex: 1,
  },
  loadingContainer: {
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyState: {
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
  },
  toggleIcon: {
    marginRight: 0,
  },
  toggleButtonContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
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
  toggleButtonBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
  },
  toggleButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  iconContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  toggleShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 60,
    transform: [{ skewX: '-20deg' }],
  },
  retryButton: {
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Predictive Chart Styles
  predictiveStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 16,
  },
  statCard: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 80,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 4,
    textAlign: 'center',
  },
  statSubLabel: {
    fontSize: 10,
    color: '#FFFFFF',
    opacity: 0.8,
    marginTop: 2,
  },
  emptyPredictiveState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  predictiveAlertsList: {
    maxHeight: 300,
  },
  predictiveAlertItem: {
    padding: 12,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  predictiveAlertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  predictiveAlertTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  predictiveAlertComponent: {
    fontSize: 12,
    marginBottom: 4,
  },
  predictiveAlertTime: {
    fontSize: 12,
  },
  chartContainer: {
    padding: 16,
    margin: 8,
    borderRadius: 8,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
}); 