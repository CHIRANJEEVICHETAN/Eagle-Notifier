import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { useRouter } from 'expo-router';
import SuperAdminUserManagement from '../../../components/SuperAdminUserManagement';

const UserManagementPage = () => {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);

  const handleAddUser = () => {
    setShowAddModal(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}
          onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={isDarkMode ? '#60A5FA' : '#2563EB'} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: isDarkMode ? '#60A5FA' : '#2563EB' }]}>User Management</Text>
          <Text style={[styles.headerSubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Manage users across all organizations</Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: isDarkMode ? '#2563eb' : '#3b82f6' }]}
          onPress={handleAddUser}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <SuperAdminUserManagement showAddModal={showAddModal} setShowAddModal={setShowAddModal} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flex: 1,
  },
});

export default UserManagementPage; 