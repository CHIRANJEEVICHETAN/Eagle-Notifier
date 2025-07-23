import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Alarm } from '../types/alarm';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { useTheme } from '../context/ThemeContext';

interface PredictiveAlertCardProps {
  alarm: Alarm;
  onAcknowledge?: () => void;
  onResolve?: () => void;
  onPress?: () => void;
  onFeedback?: (isAccurate: boolean) => void;
}

export const PredictiveAlertCard: React.FC<PredictiveAlertCardProps> = ({
  alarm,
  onAcknowledge,
  onResolve,
  onPress,
  onFeedback,
}) => {
  const { isDarkMode } = useTheme();
  const [feedbackGiven, setFeedbackGiven] = useState(!!alarm.feedbackAt);

  // Blue color scheme for predictive alerts
  const predictiveColors = useMemo(() => ({
    light: {
      background: '#EBF8FF', // Very light blue
      border: '#3B82F6', // Blue-500
      text: '#1E40AF', // Blue-800
      accent: '#2563EB', // Blue-600
      confidence: '#0EA5E9', // Sky-500
      timeToFailure: '#8B5CF6', // Purple-500
    },
    dark: {
      background: '#1E3A8A', // Blue-800
      border: '#60A5FA', // Blue-400
      text: '#DBEAFE', // Blue-100
      accent: '#3B82F6', // Blue-500
      confidence: '#38BDF8', // Sky-400
      timeToFailure: '#A78BFA', // Purple-400
    }
  }), []);

  const colors = isDarkMode ? predictiveColors.dark : predictiveColors.light;

  // Format confidence score as percentage
  const confidencePercentage = useMemo(() => {
    if (typeof alarm.confidence === 'number') {
      return Math.round(alarm.confidence * 100);
    }
    return 0;
  }, [alarm.confidence]);

  // Format time to failure
  const formattedTimeToFailure = useMemo(() => {
    if (typeof alarm.timeToFailure === 'number') {
      if (alarm.timeToFailure < 60) {
        return `${alarm.timeToFailure} min`;
      } else {
        const hours = Math.floor(alarm.timeToFailure / 60);
        const minutes = alarm.timeToFailure % 60;
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
      }
    }
    return 'Unknown';
  }, [alarm.timeToFailure]);

  // Format timestamp to relative time
  const formattedTime = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(alarm.timestamp), { addSuffix: true });
    } catch (error) {
      return 'Unknown time';
    }
  }, [alarm.timestamp]);

  // Get confidence color based on percentage
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return '#EF4444'; // Red for very high confidence
    if (confidence >= 80) return '#F59E0B'; // Amber for high confidence
    if (confidence >= 70) return '#10B981'; // Green for medium confidence
    return '#6B7280'; // Gray for low confidence
  };

  // Handle feedback submission
  const handleFeedback = (isAccurate: boolean) => {
    Alert.alert(
      'Prediction Feedback',
      `Was this prediction ${isAccurate ? 'accurate' : 'inaccurate'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            onFeedback?.(isAccurate);
            setFeedbackGiven(true);
          }
        }
      ]
    );
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
        }
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header with predictive indicator */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.predictiveIndicator, { backgroundColor: colors.border }]}>
            <Ionicons name="analytics-outline" size={16} color="#FFFFFF" />
          </View>
          <Text style={[styles.predictiveLabel, { color: colors.accent }]}>
            PREDICTIVE ALERT
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Ionicons 
            name="time-outline" 
            size={14} 
            color={colors.text} 
          />
          <Text style={[styles.timestamp, { color: colors.text }]}>
            {formattedTime}
          </Text>
        </View>
      </View>

      {/* Main content */}
      <View style={styles.content}>
        <View style={styles.mainInfo}>
          <Text style={[styles.description, { color: colors.text }]}>
            {alarm.description}
          </Text>
          {alarm.predictedComponent && (
            <Text style={[styles.component, { color: colors.accent }]}>
              Component: {alarm.predictedComponent}
            </Text>
          )}
        </View>

        {/* Metrics row */}
        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={[styles.metricLabel, { color: colors.text }]}>
              Confidence
            </Text>
            <View style={styles.confidenceContainer}>
              <View 
                style={[
                  styles.confidenceBar,
                  { backgroundColor: isDarkMode ? '#374151' : '#E5E7EB' }
                ]}
              >
                <View 
                  style={[
                    styles.confidenceFill,
                    { 
                      width: `${confidencePercentage}%`,
                      backgroundColor: getConfidenceColor(confidencePercentage)
                    }
                  ]}
                />
              </View>
              <Text style={[styles.confidenceText, { color: colors.confidence }]}>
                {confidencePercentage}%
              </Text>
            </View>
          </View>

          <View style={styles.metric}>
            <Text style={[styles.metricLabel, { color: colors.text }]}>
              Time to Failure
            </Text>
            <Text style={[styles.timeToFailureText, { color: colors.timeToFailure }]}>
              {formattedTimeToFailure}
            </Text>
          </View>
        </View>

        {/* Model version */}
        {alarm.modelVersion && (
          <Text style={[styles.modelVersion, { color: colors.text }]}>
            Model: v{alarm.modelVersion}
          </Text>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <View style={styles.actionButtonsRow}>
          {alarm.status === 'active' && onAcknowledge && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.accent }]}
              onPress={onAcknowledge}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Acknowledge</Text>
            </TouchableOpacity>
          )}

          {(alarm.status === 'active' || alarm.status === 'acknowledged') && onResolve && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#10B981' }]}
              onPress={onResolve}
            >
              <Ionicons name="checkmark-done-circle-outline" size={16} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Resolve</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Feedback buttons */}
        {!feedbackGiven && onFeedback && (
          <View style={styles.feedbackRow}>
            <Text style={[styles.feedbackLabel, { color: colors.text }]}>
              Was this prediction accurate?
            </Text>
            <View style={styles.feedbackButtons}>
              <TouchableOpacity
                style={[styles.feedbackButton, { backgroundColor: '#10B981' }]}
                onPress={() => handleFeedback(true)}
              >
                <Ionicons name="thumbs-up-outline" size={14} color="#FFFFFF" />
                <Text style={styles.feedbackButtonText}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.feedbackButton, { backgroundColor: '#EF4444' }]}
                onPress={() => handleFeedback(false)}
              >
                <Ionicons name="thumbs-down-outline" size={14} color="#FFFFFF" />
                <Text style={styles.feedbackButtonText}>No</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {feedbackGiven && (
          <View style={styles.feedbackGiven}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={[styles.feedbackGivenText, { color: '#10B981' }]}>
              Feedback submitted
            </Text>
          </View>
        )}
      </View>

      {/* Zone indicator */}
      {alarm.zone && (
        <View style={styles.zoneContainer}>
          <Text style={[styles.zoneText, { color: colors.text }]}>
            Zone: {alarm.zone === 'zone1' ? 'Zone 1' : 'Zone 2'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  predictiveIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  predictiveLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 12,
    marginLeft: 4,
  },
  content: {
    marginBottom: 16,
  },
  mainInfo: {
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  component: {
    fontSize: 14,
    fontWeight: '500',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metric: {
    flex: 1,
    marginRight: 16,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 3,
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 35,
  },
  timeToFailureText: {
    fontSize: 16,
    fontWeight: '700',
  },
  modelVersion: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  actions: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: 12,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  feedbackRow: {
    marginBottom: 8,
  },
  feedbackLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  feedbackButtons: {
    flexDirection: 'row',
  },
  feedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    marginRight: 8,
  },
  feedbackButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 3,
  },
  feedbackGiven: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedbackGivenText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  zoneContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  zoneText: {
    fontSize: 11,
    fontWeight: '500',
  },
});

export default PredictiveAlertCard;