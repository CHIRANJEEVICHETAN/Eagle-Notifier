import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const { login, authState, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    await login({ email, password });
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <StatusBar style="auto" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView 
          contentContainerClassName="flex-grow justify-center"
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex items-center justify-center p-8">
            <Image
              source={require('../../assets/images/icon.png')}
              className="h-32 w-32 mb-6"
              resizeMode="contain"
            />
            
            <Text className="text-3xl font-bold text-blue-800 dark:text-blue-400 mb-8">
              Eagle Notifier
            </Text>
            
            {authState.error && (
              <View className="bg-red-100 dark:bg-red-900 p-3 rounded-lg mb-4 w-full">
                <Text className="text-red-800 dark:text-red-200">{authState.error}</Text>
                <TouchableOpacity 
                  onPress={clearError}
                  className="absolute top-2 right-2"
                >
                  <Ionicons name="close" size={18} color="#B91C1C" />
                </TouchableOpacity>
              </View>
            )}
            
            <View className="w-full space-y-4">
              <View>
                <Text className="text-gray-700 dark:text-gray-300 mb-1 font-medium">Email</Text>
                <View className="flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2">
                  <Ionicons name="mail-outline" size={20} color="#6B7280" className="mr-2" />
                  <TextInput
                    className="flex-1 h-10 text-gray-900 dark:text-white"
                    placeholder="Enter your email"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
              </View>
              
              <View>
                <Text className="text-gray-700 dark:text-gray-300 mb-1 font-medium">Password</Text>
                <View className="flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2">
                  <Ionicons name="lock-closed-outline" size={20} color="#6B7280" className="mr-2" />
                  <TextInput
                    className="flex-1 h-10 text-gray-900 dark:text-white"
                    placeholder="Enter your password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons 
                      name={showPassword ? "eye-off-outline" : "eye-outline"} 
                      size={20} 
                      color="#6B7280" 
                    />
                  </TouchableOpacity>
                </View>
              </View>
              
              <TouchableOpacity
                className={`bg-blue-700 dark:bg-blue-600 rounded-lg py-3 ${authState.isLoading ? 'opacity-70' : ''}`}
                onPress={handleLogin}
                disabled={authState.isLoading}
              >
                {authState.isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-white font-semibold text-center text-lg">
                    Sign In
                  </Text>
                )}
              </TouchableOpacity>
              
              <View className="flex-row justify-center mt-4">
                <Text className="text-gray-600 dark:text-gray-400">
                  Demo credentials:
                </Text>
              </View>
              <View className="flex-row justify-center">
                <Text className="text-gray-600 dark:text-gray-400">
                  admin@example.com / password
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}