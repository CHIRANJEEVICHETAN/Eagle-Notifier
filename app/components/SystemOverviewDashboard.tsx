import React from 'react';
import { View, Text, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { SystemStats } from '../hooks/usePredictiveMaintenanceData';
import { Organization } from '../hooks/useOrganizations';

interface SystemOverviewDashboardProps {
  systemStats: SystemStats | undefined;
  isLoading: boolean;
  organizations: Organization[];
  mlEnabledOrgs: Organization[];
}

const { width: screenWidth } = Dimensions.get('window');

const SystemOverviewDashboard: React.FC<SystemOverviewDashboardProps> = ({
  systemStats,
  isLoading,
  organizations,
  mlEnabledOrgs
}) => {
  const { isDarkMode } = useTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <ActivityIndicator size="large" color={isDarkMode ? '#60A5FA' : '#2563EB'} />
        <Text style={{ 
          color: isDarkMode ? '#F8FAFC' : '#1E293B', 
          marginTop: 16,
          fontSize: 16
        }}>
          Loading system statistics...
        </Text>
      </View>
    );
  }

  const MetricCard = ({ 
    icon, 
    title, 
    value, 
    subtitle, 
    color,
    trend 
  }: {
    icon: string;
    title: string;
    value: string | number;
    subtitle?: string;
    color: string;
    trend?: 'up' | 'down' | 'stable';
  }) => (
    <View style={{
      backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? '#374155' : '#e5e7eb',
      shadowColor: color,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <View style={{
          backgroundColor: color + '20',
          borderRadius: 8,
          padding: 8,
          marginRight: 12
        }}>
          <Ionicons name={icon as any} size={24} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 14,
            color: isDarkMode ? '#94a3b8' : '#64748b',
            marginBottom: 2
          }}>
            {title}
          </Text>
          <Text style={{
            fontSize: 24,
            fontWeight: 'bold',
            color: isDarkMode ? '#F8FAFC' : '#1E293B'
          }}>
            {value}
          </Text>
        </View>
        {trend && (
          <Ionicons 
            name={
              trend === 'up' ? 'trending-up' : 
              trend === 'down' ? 'trending-down' : 
              'remove'
            } 
            size={20} 
            color={
              trend === 'up' ? '#22c55e' : 
              trend === 'down' ? '#ef4444' : 
              '#94a3b8'
            } 
          />
        )}
      </View>
      {subtitle && (
        <Text style={{
          fontSize: 12,
          color: isDarkMode ? '#94a3b8' : '#64748b'
        }}>
          {subtitle}
        </Text>
      )}
    </View>
  );

  const systemAccuracy = systemStats?.predictions.systemAccuracy || 0;
  const trainingSuccessRate = systemStats?.training.successRate || 0;
  const cacheUtilization = systemStats ? (systemStats.cache.size / systemStats.cache.maxSize) * 100 : 0;

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{
          fontSize: 24,
          fontWeight: 'bold',
          color: isDarkMode ? '#F8FAFC' : '#1E293B',
          marginBottom: 8
        }}>
          System Overview
        </Text>
        <Text style={{
          fontSize: 14,
          color: isDarkMode ? '#94a3b8' : '#64748b'
        }}>
          {systemStats ? `Last 24 hours • Updated ${new Date().toLocaleTimeString()}` : 'Loading...'}
        </Text>
      </View>

      {/* Key Metrics Grid */}
      <View style={{ 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        justifyContent: 'space-between',
        marginBottom: 20
      }}>
        <View style={{ width: '48%' }}>
          <MetricCard
            icon="business-outline"
            title="Organizations"
            value={organizations.length}
            subtitle={`${mlEnabledOrgs.length} with ML enabled`}
            color="#3b82f6"
            trend="stable"
          />
        </View>
        <View style={{ width: '48%' }}>
          <MetricCard
            icon="analytics-outline"
            title="System Accuracy"
            value={`${systemAccuracy.toFixed(1)}%`}
            subtitle="Overall prediction accuracy"
            color="#10b981"
            trend={systemAccuracy > 85 ? 'up' : systemAccuracy < 75 ? 'down' : 'stable'}
          />
        </View>
      </View>

      <View style={{ 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        justifyContent: 'space-between',
        marginBottom: 20
      }}>
        <View style={{ width: '48%' }}>
          <MetricCard
            icon="pulse-outline"
            title="Predictions Today"
            value={systemStats?.predictions.total || 0}
            subtitle={`${systemStats?.predictions.withFeedback || 0} with feedback`}
            color="#8b5cf6"
            trend="up"
          />
        </View>
        <View style={{ width: '48%' }}>
          <MetricCard
            icon="school-outline"
            title="Training Success"
            value={`${trainingSuccessRate.toFixed(0)}%`}
            subtitle={`${systemStats?.training.completed || 0} completed`}
            color="#f59e0b"
            trend={trainingSuccessRate > 90 ? 'up' : 'stable'}
          />
        </View>
      </View>

      {/* System Health */}
      <View style={{
        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: isDarkMode ? '#374155' : '#e5e7eb',
      }}>
        <Text style={{
          fontSize: 18,
          fontWeight: '600',
          color: isDarkMode ? '#F8FAFC' : '#1E293B',
          marginBottom: 16
        }}>
          System Health
        </Text>

        {/* Cache Utilization */}
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
              Model Cache Utilization
            </Text>
            <Text style={{ color: isDarkMode ? '#F8FAFC' : '#1E293B', fontWeight: '600' }}>
              {cacheUtilization.toFixed(0)}%
            </Text>
          </View>
          <View style={{
            height: 8,
            backgroundColor: isDarkMode ? '#374155' : '#e5e7eb',
            borderRadius: 4,
            overflow: 'hidden'
          }}>
            <View style={{
              height: '100%',
              width: `${cacheUtilization}%`,
              backgroundColor: cacheUtilization > 80 ? '#ef4444' : cacheUtilization > 60 ? '#f59e0b' : '#22c55e',
              borderRadius: 4
            }} />
          </View>
        </View>

        {/* Active Organizations */}
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
              Active ML Organizations
            </Text>
            <Text style={{ color: isDarkMode ? '#F8FAFC' : '#1E293B', fontWeight: '600' }}>
              {systemStats?.organizations.withPredictions || 0} / {systemStats?.organizations.total || 0}
            </Text>
          </View>
          <View style={{
            height: 8,
            backgroundColor: isDarkMode ? '#374155' : '#e5e7eb',
            borderRadius: 4,
            overflow: 'hidden'
          }}>
            <View style={{
              height: '100%',
              width: `${((systemStats?.organizations.withPredictions || 0) / (systemStats?.organizations.total || 1)) * 100}%`,
              backgroundColor: '#3b82f6',
              borderRadius: 4
            }} />
          </View>
        </View>

        {/* Prediction Accuracy */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
              Prediction Accuracy
            </Text>
            <Text style={{ color: isDarkMode ? '#F8FAFC' : '#1E293B', fontWeight: '600' }}>
              {systemAccuracy.toFixed(1)}%
            </Text>
          </View>
          <View style={{
            height: 8,
            backgroundColor: isDarkMode ? '#374155' : '#e5e7eb',
            borderRadius: 4,
            overflow: 'hidden'
          }}>
            <View style={{
              height: '100%',
              width: `${systemAccuracy}%`,
              backgroundColor: systemAccuracy > 85 ? '#22c55e' : systemAccuracy > 75 ? '#f59e0b' : '#ef4444',
              borderRadius: 4
            }} />
          </View>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={{
        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: isDarkMode ? '#374155' : '#e5e7eb',
      }}>
        <Text style={{
          fontSize: 18,
          fontWeight: '600',
          color: isDarkMode ? '#F8FAFC' : '#1E293B',
          marginBottom: 16
        }}>
          Quick Stats
        </Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
            Total Predictions (24h)
          </Text>
          <Text style={{ color: isDarkMode ? '#F8FAFC' : '#1E293B', fontWeight: '600' }}>
            {systemStats?.predictions.total || 0}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
            Accurate Predictions
          </Text>
          <Text style={{ color: isDarkMode ? '#F8FAFC' : '#1E293B', fontWeight: '600' }}>
            {systemStats?.predictions.accurate || 0}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
            Training Jobs Completed
          </Text>
          <Text style={{ color: isDarkMode ? '#F8FAFC' : '#1E293B', fontWeight: '600' }}>
            {systemStats?.training.completed || 0}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
            Models in Cache
          </Text>
          <Text style={{ color: isDarkMode ? '#F8FAFC' : '#1E293B', fontWeight: '600' }}>
            {systemStats?.cache.size || 0} / {systemStats?.cache.maxSize || 10}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default SystemOverviewDashboard;