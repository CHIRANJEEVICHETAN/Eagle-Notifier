import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Animated,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoginCredentials } from '../types/auth';

export default function LoginScreen() {
  const { login, authState } = useAuth();
  const { isDarkMode } = useTheme();
  const router = useRouter();
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Error state
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  // Animation values
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  
  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);
  
  // Validate email
  const validateEmail = (text: string) => {
    setEmail(text);
    if (text.trim() === '') {
      setEmailError('Email is required');
    } else if (!/\S+@\S+\.\S+/.test(text)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };
  
  // Validate password
  const validatePassword = (text: string) => {
    setPassword(text);
    if (text.trim() === '') {
      setPasswordError('Password is required');
    } else if (text.length < 6) {
      setPasswordError('Password must be at least 6 characters');
    } else {
      setPasswordError('');
    }
  };
  
  // Handle login
  const handleLogin = async () => {
    // Validate inputs before submitting
    validateEmail(email);
    validatePassword(password);
    
    if (emailError || passwordError || !email || !password) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Call login function
      await login({ email, password } as LoginCredentials);
      
      // Check user role for routing
      if (authState.user?.role === 'admin') {
        router.replace("/(dashboard)/admin" as any);
      } else {
        router.replace("/(dashboard)/operator" as any);
      }
    } catch (error) {
      Alert.alert(
        'Login Failed',
        error instanceof Error ? error.message : 'Failed to login. Please check your credentials and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.formContainer, { opacity: fadeAnim }]}>
            <View style={styles.headerContainer}>
              <View style={[styles.logoContainer, { backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB' }]}>
                <Ionicons name="shield-checkmark-outline" size={32} color="#FFFFFF" />
              </View>
              
              <Text style={[styles.title, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                Welcome Back
              </Text>
              <Text style={[styles.subtitle, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                Log in to access your dashboard
              </Text>
            </View>
            
            <View style={styles.inputsContainer}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
                  Email
                </Text>
                <View style={[
                  styles.inputWrapper,
                  { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' },
                  emailError ? styles.inputError : null,
                ]}>
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[
                      styles.input,
                      { color: isDarkMode ? '#FFFFFF' : '#1F2937' },
                    ]}
                    placeholder="your.email@example.com"
                    placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                    value={email}
                    onChangeText={validateEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </View>
                {emailError ? (
                  <Text style={styles.errorText}>{emailError}</Text>
                ) : null}
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
                  Password
                </Text>
                <View style={[
                  styles.inputWrapper,
                  { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' },
                  passwordError ? styles.inputError : null,
                ]}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[
                      styles.input,
                      { color: isDarkMode ? '#FFFFFF' : '#1F2937' },
                    ]}
                    placeholder="********"
                    placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={validatePassword}
                    autoCapitalize="none"
                    autoComplete="password"
                  />
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                    />
                  </TouchableOpacity>
                </View>
                {passwordError ? (
                  <Text style={styles.errorText}>{passwordError}</Text>
                ) : null}
              </View>
            </View>
            
            <TouchableOpacity
              style={[
                styles.loginButton,
                { backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB' },
                isLoading ? { opacity: 0.7 } : null,
              ]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  formContainer: {
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  inputsContainer: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: 52,
    paddingHorizontal: 16,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
  },
  passwordToggle: {
    padding: 4,
  },
  loginButton: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 4,
    marginLeft: 4,
  },
});