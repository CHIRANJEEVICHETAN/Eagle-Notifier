import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { useRouter, usePathname } from 'expo-router';
import OrganizationManagement from '../../../components/OrganizationManagement';

const OrgManagementPage = () => {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  // Debug logging
  console.log('🎯 OrgManagementPage rendered!');
  console.log('- isDarkMode:', isDarkMode);
  console.log('- Current pathname:', pathname);
  console.log('- Component mounted successfully');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#60A5FA' : '#2563EB'} />
        </TouchableOpacity>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: isDarkMode ? '#F8FAFC' : '#1E293B' }}>Organization Management</Text>
      </View>
      <OrganizationManagement />
    </SafeAreaView>
  );
};

export default OrgManagementPage; 