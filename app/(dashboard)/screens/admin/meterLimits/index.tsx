import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../../context/ThemeContext';
import { useAuth } from '../../../../context/AuthContext';
import { useMeterLimits, MeterLimit } from '../../../../hooks/useMeterReadings';

export default function MeterLimitsScreen() {
  const { isDarkMode } = useTheme();
  const { authState } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  
  // Check if user is admin
  const isAdmin = authState?.user?.role === 'ADMIN';
  
  // Fetch all meter limits
  const { data: limitsData, isLoading, isError, refetch } = useMeterLimits();
  
  // Group limits by category
  const electricalParams = limitsData?.filter(limit => 
    ['voltage', 'current', 'frequency'].includes(limit.parameter)
  ) || [];
  
  const powerParams = limitsData?.filter(limit => 
    ['power', 'energy', 'pf'].includes(limit.parameter)
  ) || [];
  
  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Redirect if not admin
  if (authState?.isLoading === false && !isAdmin) {
    router.replace('/(dashboard)/meterReadings');
    return null;
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]}
    >
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
        <TouchableOpacity
          style={[
            styles.backButton,
            {
              backgroundColor: isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(241, 245, 249, 0.8)',
            }
          ]}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDarkMode ? '#94A3B8' : '#475569'}
          />
        </TouchableOpacity>
        
        <View style={styles.headerTitle}>
          <Text
            style={[
              styles.title,
              {
                color: isDarkMode ? '#F8FAFC' : '#1E293B',
              },
            ]}>
            Parameter Limits
          </Text>
          <Text
            style={[
              styles.subtitle,
              {
                color: isDarkMode ? '#94A3B8' : '#64748B',
              },
            ]}>
            Configure thresholds for meter readings
          </Text>
        </View>
      </View>

      {/* Main Content */}
      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDarkMode ? '#6EE7B7' : '#10B981'} />
          <Text style={[styles.loadingText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Loading parameter limits...
          </Text>
        </View>
      ) : isError ? (
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={64}
            color={isDarkMode ? '#F87171' : '#EF4444'}
          />
          <Text style={[styles.errorTitle, { color: isDarkMode ? '#F8FAFC' : '#1E293B' }]}>
            Error Loading Limits
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: isDarkMode ? '#10B981' : '#059669' }]}
            onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
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
          }
        >
          {/* Electrical Parameters Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons 
                name="flash-outline" 
                size={20} 
                color={isDarkMode ? '#6EE7B7' : '#10B981'}
                style={styles.sectionIcon} 
              />
              <Text style={[
                styles.sectionTitle, 
                { color: isDarkMode ? '#F8FAFC' : '#1E293B' }
              ]}>
                Electrical Parameters
              </Text>
            </View>
            
            {electricalParams.map((limit) => (
              <TouchableOpacity
                key={limit.id}
                style={[
                  styles.limitCard,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                  }
                ]}
                onPress={() => router.push(`/(dashboard)/screens/admin/meter-limits/${limit.id}` as any)}
              >
                <View style={styles.limitInfo}>
                  <Text style={[
                    styles.parameterName,
                    { color: isDarkMode ? '#F8FAFC' : '#1E293B' }
                  ]}>
                    {limit.description}
                  </Text>
                  <Text style={[
                    styles.parameterDetail,
                    { color: isDarkMode ? '#94A3B8' : '#64748B' }
                  ]}>
                    High Limit: <Text style={{ fontWeight: '600' }}>{limit.highLimit} {limit.unit}</Text>
                    {limit.lowLimit !== null && ` • Low Limit: ${limit.lowLimit} ${limit.unit}`}
                  </Text>
                </View>
                
                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color={isDarkMode ? '#64748B' : '#94A3B8'}
                />
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Power Parameters Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons 
                name="battery-charging-outline" 
                size={20} 
                color={isDarkMode ? '#6EE7B7' : '#10B981'}
                style={styles.sectionIcon} 
              />
              <Text style={[
                styles.sectionTitle, 
                { color: isDarkMode ? '#F8FAFC' : '#1E293B' }
              ]}>
                Power Parameters
              </Text>
            </View>
            
            {powerParams.map((limit) => (
              <TouchableOpacity
                key={limit.id}
                style={[
                  styles.limitCard,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                  }
                ]}
                onPress={() => router.push(`/(dashboard)/screens/admin/meterLimits/${limit.id}` as any)}
              >
                <View style={styles.limitInfo}>
                  <Text style={[
                    styles.parameterName,
                    { color: isDarkMode ? '#F8FAFC' : '#1E293B' }
                  ]}>
                    {limit.description}
                  </Text>
                  <Text style={[
                    styles.parameterDetail,
                    { color: isDarkMode ? '#94A3B8' : '#64748B' }
                  ]}>
                    High Limit: <Text style={{ fontWeight: '600' }}>{limit.highLimit} {limit.unit}</Text>
                    {limit.lowLimit !== null && ` • Low Limit: ${limit.lowLimit} ${limit.unit}`}
                  </Text>
                </View>
                
                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color={isDarkMode ? '#64748B' : '#94A3B8'}
                />
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Help Section */}
          <View style={[
            styles.helpCard,
            {
              backgroundColor: isDarkMode ? 'rgba(6, 95, 70, 0.2)' : 'rgba(220, 252, 231, 0.6)',
              borderColor: isDarkMode ? '#065F46' : '#10B981',
            }
          ]}>
            <Ionicons
              name="information-circle-outline"
              size={24}
              color={isDarkMode ? '#6EE7B7' : '#10B981'}
              style={styles.helpIcon}
            />
            <Text style={[
              styles.helpText,
              { color: isDarkMode ? '#A7F3D0' : '#065F46' }
            ]}>
              Configure thresholds to trigger notifications when meter readings exceed their limits.
              Tap on any parameter to edit its high and low limits.
            </Text>
          </View>
        </ScrollView>
      )}
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
    paddingVertical: 14,
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  limitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  limitInfo: {
    flex: 1,
  },
  parameterName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  parameterDetail: {
    fontSize: 14,
  },
  helpCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 24,
  },
  helpIcon: {
    marginRight: 12,
    alignSelf: 'flex-start',
  },
  helpText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
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
    marginBottom: 16,
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
}); 