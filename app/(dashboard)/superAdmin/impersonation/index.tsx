import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { useRouter } from 'expo-router';
import { useOrganizations, Organization } from '../../../hooks/useOrganizations';
import { useSuperAdminUsers, SuperAdminUser } from '../../../hooks/useSuperAdminUsers';

const ImpersonationPage: React.FC = () => {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const { organizations, isLoading: orgLoading } = useOrganizations();
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>(undefined);
  const { users, isLoading: usersLoading } = useSuperAdminUsers(selectedOrgId);
  const [impersonatedUser, setImpersonatedUser] = useState<SuperAdminUser | null>(null);

  const handleImpersonate = (user: SuperAdminUser) => {
    setImpersonatedUser(user);
    Alert.alert('Impersonation', `Now impersonating ${user.name} (${user.email})`);
  };

  const handleRevert = () => {
    setImpersonatedUser(null);
    Alert.alert('Impersonation', 'Reverted to Super Admin');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#60A5FA' : '#2563EB'} />
        </TouchableOpacity>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: isDarkMode ? '#F8FAFC' : '#1E293B' }}>Impersonation / Switch Context</Text>
      </View>
      <View style={{ padding: 16 }}>
        {impersonatedUser ? (
          <View style={{ marginBottom: 16, backgroundColor: isDarkMode ? '#1e293b' : '#f3f4f6', borderRadius: 10, padding: 14 }}>
            <Text style={{ color: isDarkMode ? '#fbbf24' : '#b45309', fontWeight: 'bold' }}>Currently Impersonating:</Text>
            <Text style={{ color: isDarkMode ? '#F8FAFC' : '#1E293B', fontSize: 16 }}>{impersonatedUser.name} ({impersonatedUser.email})</Text>
            <TouchableOpacity onPress={handleRevert} style={{ marginTop: 8, backgroundColor: isDarkMode ? '#ef4444' : '#dc2626', borderRadius: 8, padding: 8, alignSelf: 'flex-end' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Revert</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <Text style={{ fontWeight: '600', marginBottom: 8, color: isDarkMode ? '#60A5FA' : '#2563EB' }}>Select Organization:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 12 }}>
          <TouchableOpacity onPress={() => setSelectedOrgId(undefined)} style={{ marginRight: 8, padding: 8, borderRadius: 8, backgroundColor: !selectedOrgId ? (isDarkMode ? '#2563eb' : '#3b82f6') : '#e5e7eb' }}>
            <Text style={{ color: !selectedOrgId ? '#fff' : '#111827' }}>All</Text>
          </TouchableOpacity>
          {organizations.map(org => (
            <TouchableOpacity key={org.id} onPress={() => setSelectedOrgId(org.id)} style={{ marginRight: 8, padding: 8, borderRadius: 8, backgroundColor: selectedOrgId === org.id ? (isDarkMode ? '#2563eb' : '#3b82f6') : '#e5e7eb' }}>
              <Text style={{ color: selectedOrgId === org.id ? '#fff' : '#111827' }}>{org.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={{ fontWeight: '600', marginBottom: 8, color: isDarkMode ? '#60A5FA' : '#2563EB' }}>Select User to Impersonate:</Text>
        <ScrollView style={{ maxHeight: 300 }}>
          {orgLoading || usersLoading ? (
            <Text style={{ color: isDarkMode ? '#94A3B8' : '#475569' }}>Loading users...</Text>
          ) : users.length === 0 ? (
            <Text style={{ color: isDarkMode ? '#94A3B8' : '#475569' }}>No users found.</Text>
          ) : users.map(user => (
            <TouchableOpacity key={user.id} onPress={() => handleImpersonate(user)} style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f3f4f6', borderRadius: 10, padding: 12, marginBottom: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: isDarkMode ? '#F8FAFC' : '#1E293B' }}>{user.name}</Text>
              <Text style={{ fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#64748b' }}>{user.email}</Text>
              <Text style={{ fontSize: 12, color: isDarkMode ? '#fbbf24' : '#2563eb' }}>Role: {user.role}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default ImpersonationPage; 