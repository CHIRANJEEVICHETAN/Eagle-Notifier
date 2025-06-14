import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Dimensions, Platform, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from './context/ThemeContext';
import { useAuth } from './context/AuthContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH * 0.85;

const SELECTED_APP_KEY = 'selected_app_type';

export default function Onboarding() {
  const { isDarkMode } = useTheme();
  const { authState, selectedAppType } = useAuth();
  const [selectedOption, setSelectedOption] = useState<string | null>(selectedAppType);
  
  // Check if user is authenticated
  if (!authState.isAuthenticated) {
    router.replace('/');
    return null;
  }
  
  // Effect to highlight previous selection if it exists
  useEffect(() => {
    if (selectedAppType) {
      setSelectedOption(selectedAppType);
    }
  }, [selectedAppType]);

  const handleSelection = (option: string) => {
    setSelectedOption(option);
  };
  
  const handleContinue = async () => {
    if (!selectedOption) return;
    
    try {
      // Store the user's selection
      await SecureStore.setItemAsync(SELECTED_APP_KEY, selectedOption);
      
      // Navigate based on selection using route objects instead of strings
      if (selectedOption === 'furnace') {
        router.replace({
          pathname: '/(dashboard)/operator'
        });
      } else {
        router.replace({
          pathname: '/(dashboard)/meterReadings/index'
        });
      }
    } catch (error) {
      console.error('Error saving app selection:', error);
      Alert.alert(
        "Error",
        "Failed to save your selection. Please try again.",
        [{ text: "OK" }]
      );
    }
  };

  return (
    <SafeAreaView style={[
      styles.container, 
      { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }
    ]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      <View style={styles.header}>
        <Image 
          source={require('../assets/images/Eagle-Logo.png')} 
          style={styles.logo} 
          resizeMode="contain"
        />
        <Text style={[
          styles.headerTitle,
          { color: isDarkMode ? '#F8FAFC' : '#1E293B' }
        ]}>
          Eagle Notifier
        </Text>
        <Text style={[
          styles.headerSubtitle,
          { color: isDarkMode ? '#94A3B8' : '#64748B' }
        ]}>
          Select your monitoring application
        </Text>
      </View>

      <View style={styles.optionsContainer}>
        <TouchableOpacity
          style={[
            styles.optionCard,
            selectedOption === 'furnace' && styles.selectedCard,
            { 
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: selectedOption === 'furnace' 
                ? '#3B82F6' 
                : isDarkMode ? '#334155' : '#E2E8F0',
            }
          ]}
          onPress={() => handleSelection('furnace')}
        >
          <View style={[
            styles.iconContainer,
            { 
              backgroundColor: isDarkMode 
                ? 'rgba(239, 68, 68, 0.15)' 
                : 'rgba(239, 68, 68, 0.1)' 
            }
          ]}>
            <Ionicons 
              name="flame-outline" 
              size={44} 
              color={isDarkMode ? '#F87171' : '#EF4444'} 
            />
          </View>
          <Text style={[
            styles.optionTitle,
            { color: isDarkMode ? '#F8FAFC' : '#1E293B' }
          ]}>
            Furnace Notifier
          </Text>
          <Text style={[
            styles.optionDescription,
            { color: isDarkMode ? '#94A3B8' : '#64748B' }
          ]}>
            Monitor temperature, pressure, and alarms for furnace systems
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.optionCard,
            selectedOption === 'meter' && styles.selectedCard,
            { 
              backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
              borderColor: selectedOption === 'meter' 
                ? '#3B82F6' 
                : isDarkMode ? '#334155' : '#E2E8F0',
            }
          ]}
          onPress={() => handleSelection('meter')}
        >
          <View style={[
            styles.iconContainer,
            { 
              backgroundColor: isDarkMode 
                ? 'rgba(16, 185, 129, 0.15)' 
                : 'rgba(16, 185, 129, 0.1)' 
            }
          ]}>
            <Ionicons 
              name="speedometer-outline" 
              size={44} 
              color={isDarkMode ? '#6EE7B7' : '#10B981'} 
            />
          </View>
          <Text style={[
            styles.optionTitle,
            { color: isDarkMode ? '#F8FAFC' : '#1E293B' }
          ]}>
            Meter Notifier
          </Text>
          <Text style={[
            styles.optionDescription,
            { color: isDarkMode ? '#94A3B8' : '#64748B' }
          ]}>
            Monitor electrical parameters like voltage, current, and power consumption
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Continue Button */}
      <TouchableOpacity
        style={[
          styles.continueButton,
          { 
            backgroundColor: selectedOption 
              ? (isDarkMode ? '#3B82F6' : '#2563EB') 
              : (isDarkMode ? '#6B7280' : '#94A3B8'),
            opacity: selectedOption ? 1 : 0.6,
          }
        ]}
        onPress={handleContinue}
        disabled={!selectedOption}
      >
        <Text style={styles.continueButtonText}>Continue</Text>
        <Ionicons 
          name="arrow-forward" 
          size={22} 
          color="#FFFFFF" 
          style={styles.continueButtonIcon}
        />
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={[
          styles.footerText,
          { color: isDarkMode ? '#64748B' : '#94A3B8' }
        ]}>
          You can change this selection later in settings
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 40,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  optionsContainer: {
    paddingHorizontal: 16,
    gap: 20,
  },
  optionCard: {
    width: CARD_WIDTH,
    alignSelf: 'center',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  selectedCard: {
    borderWidth: 2,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  optionDescription: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginTop: 30,
    marginHorizontal: 32,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  continueButtonIcon: {
    marginLeft: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
  },
});
