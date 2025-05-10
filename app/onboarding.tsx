import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Animated, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useTheme } from './context/ThemeContext';
import { updatePushToken } from './api/notificationsApi';
import * as SecureStore from 'expo-secure-store';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Define interface for FeatureItem props
interface FeatureItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  isDarkMode: boolean;
}

export default function OnboardingScreen() {
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [isLoading, setLoading] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  
  React.useEffect(() => {
    // Start animations when component mounts
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  
  const requestNotificationPermission = useCallback(async () => {
    try {
      // Set loading state
      setLoading(true);
      
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      // Only ask for permission if not already granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus === 'granted') {
        // Get push token
        try {
          const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
          });
          
          console.log("Expo push token:", tokenData.data);
          
          // Save token for when user logs in
          await SecureStore.setItemAsync('tempPushToken', tokenData.data);
        } catch (tokenError) {
          console.error('Error getting push token:', tokenError);
        }
      } else {
        // Permission not granted, but continue anyway
        Alert.alert(
          "Notification Permission",
          "You won't receive push notifications. You can enable them later in app settings.",
          [{ text: "OK" }]
        );
        console.log('Notification permission not granted');
      }
      
      // Mark onboarding as seen
      await SecureStore.setItemAsync('hasSeenOnboarding', 'true');
      
      // Navigate to login screen regardless of permission status
      router.replace("/(auth)/login");
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      // Mark onboarding as seen even if there's an error with notifications
      await SecureStore.setItemAsync('hasSeenOnboarding', 'true');
      
      // Navigate to login even if there's an error
      router.replace("/(auth)/login");
    } finally {
      setLoading(false);
    }
  }, [router]);
  
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDarkMode ? '#111827' : '#F3F4F6' },
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          <View style={[styles.iconWrapper, { backgroundColor: isDarkMode ? '#3B82F6' : '#FFFFFF' }]}>
            <Image className='mt-3' source={require('../assets/images/Eagle-Logo.png')} style={{ width: 110, height: 110 }} />
          </View>
          
          <Animated.Text
            style={[
              styles.appName,
              { color: isDarkMode ? '#FFFFFF' : '#1F2937' },
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            Eagle Notifier
          </Animated.Text>
          
          <Animated.Text
            style={[
              styles.tagline,
              { color: isDarkMode ? '#D1D5DB' : '#4B5563' },
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            Industrial Alarm Monitoring Made Simple
          </Animated.Text>
        </Animated.View>
        
        <Animated.View
          style={[
            styles.featureContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <FeatureItem
            icon="checkmark-circle-outline"
            title="Real-time Alerts"
            description="Get instant notifications for critical alarms"
            isDarkMode={isDarkMode}
          />
          <FeatureItem
            icon="stats-chart-outline"
            title="Comprehensive Insights"
            description="Track and analyze alarm history and patterns"
            isDarkMode={isDarkMode}
          />
          <FeatureItem
            icon="shield-checkmark-outline"
            title="Reliable & Secure"
            description="Enterprise-grade security for your industrial data"
            isDarkMode={isDarkMode}
          />
        </Animated.View>
      </View>
      
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB' }]}
          onPress={requestNotificationPermission}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.buttonText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
        
        <Text style={[styles.poweredBy, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
          Powered by Loginware.ai
        </Text>
      </View>
    </View>
  );
}

// Feature item component
function FeatureItem({ icon, title, description, isDarkMode }: FeatureItemProps) {
  return (
    <View style={styles.featureItem}>
      <View style={[styles.featureIcon, { backgroundColor: isDarkMode ? '#374151' : '#E5E7EB' }]}>
        <Ionicons name={icon} size={24} color={isDarkMode ? '#60A5FA' : '#2563EB'} />
      </View>
      <View style={styles.featureText}>
        <Text style={[styles.featureTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
          {title}
        </Text>
        <Text style={[styles.featureDescription, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
          {description}
        </Text>
      </View>
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconWrapper: {
    width: 130,
    height: 130,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    textAlign: 'center',
    maxWidth: width * 0.8,
  },
  featureContainer: {
    width: '100%',
    marginTop: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
  },
  footer: {
    width: '100%',
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  poweredBy: {
    fontSize: 14,
    marginTop: 8,
  },
}); 