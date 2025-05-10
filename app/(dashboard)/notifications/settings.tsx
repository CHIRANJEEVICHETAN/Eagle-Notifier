import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Switch,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../../context/ThemeContext';
import { updateNotificationSettings, updatePushToken, sendTestNotification } from '../../api/notificationsApi';
import { useUpdateNotificationSettings } from '../../hooks/useNotifications';
import TimeRangePicker from '../../components/TimeRangePicker';
import * as SecureStore from 'expo-secure-store';

export default function NotificationSettingsScreen() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  
  // Notification settings state
  const [settings, setSettings] = useState({
    pushEnabled: true,
    emailEnabled: false,
    criticalOnly: false,
    muteFrom: undefined as number | undefined,
    muteTo: undefined as number | undefined,
  });
  
  // Time range picker state
  const [showTimeRange, setShowTimeRange] = useState(false);
  const [muteEnabled, setMuteEnabled] = useState(false);
  
  // TanStack Query hooks
  const updateSettingsMutation = useUpdateNotificationSettings();
  
  // Add state for tracking API operations
  const [isTestingSending, setIsTestingSending] = useState(false);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  
  // Request notification permissions and update token
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          
          // Update push enabled based on permission status
          if (status !== 'granted') {
            setSettings(prev => ({ ...prev, pushEnabled: false }));
          }
        }
        
        // Get push token and update on server
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
        });
        
        if (tokenData.data) {
          await updatePushToken(tokenData.data);
        }
      } catch (error) {
        console.error('Error setting up notifications:', error);
      }
    };
    
    requestPermissions();
  }, []);
  
  // Load saved settings from server
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // In a real app, we would fetch the user's notification settings from the server
        // For now, we'll use the default settings
        
        // Set mute enabled if mute times are set
        if (settings.muteFrom !== undefined && settings.muteTo !== undefined) {
          setMuteEnabled(true);
        }
      } catch (error) {
        console.error('Error loading notification settings:', error);
      }
    };
    
    loadSettings();
  }, []);
  
  // Handle settings toggle with local fallback
  const handleToggleSetting = useCallback((setting: keyof typeof settings) => {
    setSettings(prev => {
      const newSettings = { ...prev, [setting]: !prev[setting] };
      
      // Update settings on server
      setIsUpdatingSettings(true);
      updateSettingsMutation.mutate(newSettings, {
        onError: (error) => {
          // Show error toast or notification
          console.error(`Failed to update ${setting}:`, error);
          Alert.alert(
            'Settings Update Failed',
            'Your settings will be saved locally but may not sync with the server. Please check your connection.'
          );
        },
        onSettled: () => {
          setIsUpdatingSettings(false);
        }
      });
      
      // Save setting locally as fallback
      SecureStore.setItemAsync(`notification_${setting}`, (!prev[setting]).toString())
        .catch(error => console.error('Error saving setting to secure storage:', error));
      
      return newSettings;
    });
  }, [updateSettingsMutation]);
  
  // Handle mute hours toggle
  const handleToggleMute = useCallback(() => {
    if (muteEnabled) {
      // Disable mute hours
      setMuteEnabled(false);
      setSettings(prev => {
        const newSettings = {
          ...prev,
          muteFrom: undefined,
          muteTo: undefined
        };
        
        // Update settings on server
        updateSettingsMutation.mutate(newSettings);
        
        return newSettings;
      });
    } else {
      // Enable mute hours and show time picker
      setMuteEnabled(true);
      setShowTimeRange(true);
    }
  }, [muteEnabled, updateSettingsMutation]);
  
  // Handle time range selection
  const handleTimeRangeSelected = useCallback((from: number, to: number) => {
    setShowTimeRange(false);
    setSettings(prev => {
      const newSettings = {
        ...prev,
        muteFrom: from,
        muteTo: to
      };
      
      // Update settings on server
      updateSettingsMutation.mutate(newSettings);
      
      return newSettings;
    });
  }, [updateSettingsMutation]);
  
  // Handle send test notification
  const handleSendTestNotification = useCallback(async () => {
    try {
      setIsTestingSending(true);
      await sendTestNotification();
      Alert.alert('Test Notification Sent', 'A test notification has been sent to your device.');
    } catch (error) {
      Alert.alert(
        'Error', 
        'Failed to send test notification. Please check your network connection and try again.'
      );
    } finally {
      setIsTestingSending(false);
    }
  }, []);
  
  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' }
    ]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[
            styles.backButton,
            { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }
          ]}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color={isDarkMode ? '#E5E7EB' : '#4B5563'}
          />
        </TouchableOpacity>
        
        <View>
          <Text style={[
            styles.headerTitle,
            { color: isDarkMode ? '#FFFFFF' : '#1F2937' }
          ]}>
            Notification Settings
          </Text>
          <Text style={[
            styles.headerSubtitle,
            { color: isDarkMode ? '#9CA3AF' : '#6B7280' }
          ]}>
            Customize how you receive alerts
          </Text>
        </View>
      </View>
      
      <ScrollView style={styles.content}>
        {/* Notification Channels */}
        <View style={[
          styles.section,
          { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }
        ]}>
          <Text style={[
            styles.sectionTitle,
            { color: isDarkMode ? '#FFFFFF' : '#1F2937' }
          ]}>
            Notification Channels
          </Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[
                styles.settingTitle,
                { color: isDarkMode ? '#FFFFFF' : '#1F2937' }
              ]}>
                Push Notifications
              </Text>
              <Text style={[
                styles.settingDescription,
                { color: isDarkMode ? '#9CA3AF' : '#6B7280' }
              ]}>
                Receive alerts on your device
              </Text>
            </View>
            <Switch
              value={settings.pushEnabled}
              onValueChange={() => handleToggleSetting('pushEnabled')}
              trackColor={{ false: isDarkMode ? '#4B5563' : '#D1D5DB', true: '#3B82F6' }}
              thumbColor={isDarkMode ? '#FFFFFF' : '#FFFFFF'}
              disabled={isUpdatingSettings || updateSettingsMutation.isPending}
            />
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[
                styles.settingTitle,
                { color: isDarkMode ? '#FFFFFF' : '#1F2937' }
              ]}>
                Email Notifications
              </Text>
              <Text style={[
                styles.settingDescription,
                { color: isDarkMode ? '#9CA3AF' : '#6B7280' }
              ]}>
                Receive alerts via email
              </Text>
            </View>
            <Switch
              value={settings.emailEnabled}
              onValueChange={() => handleToggleSetting('emailEnabled')}
              trackColor={{ false: isDarkMode ? '#4B5563' : '#D1D5DB', true: '#3B82F6' }}
              thumbColor={isDarkMode ? '#FFFFFF' : '#FFFFFF'}
              disabled={isUpdatingSettings || updateSettingsMutation.isPending}
            />
          </View>
        </View>
        
        {/* Notification Preferences */}
        <View style={[
          styles.section,
          { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }
        ]}>
          <Text style={[
            styles.sectionTitle,
            { color: isDarkMode ? '#FFFFFF' : '#1F2937' }
          ]}>
            Notification Preferences
          </Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[
                styles.settingTitle,
                { color: isDarkMode ? '#FFFFFF' : '#1F2937' }
              ]}>
                Critical Alarms Only
              </Text>
              <Text style={[
                styles.settingDescription,
                { color: isDarkMode ? '#9CA3AF' : '#6B7280' }
              ]}>
                Only receive alerts for critical alarms
              </Text>
            </View>
            <Switch
              value={settings.criticalOnly}
              onValueChange={() => handleToggleSetting('criticalOnly')}
              trackColor={{ false: isDarkMode ? '#4B5563' : '#D1D5DB', true: '#3B82F6' }}
              thumbColor={isDarkMode ? '#FFFFFF' : '#FFFFFF'}
              disabled={isUpdatingSettings || updateSettingsMutation.isPending}
            />
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[
                styles.settingTitle,
                { color: isDarkMode ? '#FFFFFF' : '#1F2937' }
              ]}>
                Mute Hours
              </Text>
              <Text style={[
                styles.settingDescription,
                { color: isDarkMode ? '#9CA3AF' : '#6B7280' }
              ]}>
                {muteEnabled && settings.muteFrom !== undefined && settings.muteTo !== undefined
                  ? `Muted from ${settings.muteFrom}:00 to ${settings.muteTo}:00`
                  : 'Silence notifications during specific hours'
                }
              </Text>
            </View>
            <Switch
              value={muteEnabled}
              onValueChange={handleToggleMute}
              trackColor={{ false: isDarkMode ? '#4B5563' : '#D1D5DB', true: '#3B82F6' }}
              thumbColor={isDarkMode ? '#FFFFFF' : '#FFFFFF'}
              disabled={isUpdatingSettings || updateSettingsMutation.isPending}
            />
          </View>
          
          {muteEnabled && (
            <TouchableOpacity
              style={[
                styles.timePickerButton,
                { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }
              ]}
              onPress={() => setShowTimeRange(true)}
            >
              <Ionicons
                name="time-outline"
                size={18}
                color={isDarkMode ? '#60A5FA' : '#3B82F6'}
                style={styles.timePickerIcon}
              />
              <Text style={[
                styles.timePickerText,
                { color: isDarkMode ? '#E5E7EB' : '#4B5563' }
              ]}>
                {settings.muteFrom !== undefined && settings.muteTo !== undefined
                  ? `${settings.muteFrom}:00 - ${settings.muteTo}:00`
                  : 'Set mute hours'
                }
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={isDarkMode ? '#9CA3AF' : '#6B7280'}
              />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Test Notifications */}
        <View style={[
          styles.section,
          { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }
        ]}>
          <Text style={[
            styles.sectionTitle,
            { color: isDarkMode ? '#FFFFFF' : '#1F2937' }
          ]}>
            Test Notifications
          </Text>
          
          <Text style={[
            styles.testDescription,
            { color: isDarkMode ? '#9CA3AF' : '#6B7280' }
          ]}>
            Send a test notification to verify your settings are working correctly.
          </Text>
          
          <TouchableOpacity
            style={[
              styles.testButton,
              { backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB' },
              (isTestingSending) && { opacity: 0.7 }
            ]}
            onPress={handleSendTestNotification}
            disabled={isTestingSending}
          >
            {isTestingSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name="paper-plane-outline"
                  size={18}
                  color="#FFFFFF"
                  style={styles.testButtonIcon}
                />
                <Text style={styles.testButtonText}>
                  Send Test Notification
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* Time Range Picker Modal */}
      {showTimeRange && (
        <TimeRangePicker
          visible={showTimeRange}
          onClose={() => setShowTimeRange(false)}
          onTimeSelected={handleTimeRangeSelected}
          initialFrom={settings.muteFrom}
          initialTo={settings.muteTo}
        />
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
    paddingVertical: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
    padding: 16,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  timePickerIcon: {
    marginRight: 8,
  },
  timePickerText: {
    fontSize: 14,
    flex: 1,
  },
  testDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  testButtonIcon: {
    marginRight: 8,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
}); 