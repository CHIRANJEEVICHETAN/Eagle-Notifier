import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, TouchableOpacity, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useRouter } from 'expo-router';
import { useOrganizations } from '../../hooks/useOrganizations';

const TABS = [
  { key: 'alarms', label: 'Alarms' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'reports', label: 'Reports' },
];

const GlobalSearchPage: React.FC = () => {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const { organizations } = useOrganizations();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('alarms');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    // TODO: Implement backend search API calls for each tab
    setTimeout(() => {
      setLoading(false);
      setResults([{ id: '1', name: `Sample ${activeTab} result for "${search}"` }]);
    }, 1000);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#60A5FA' : '#2563EB'} />
        </TouchableOpacity>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: isDarkMode ? '#F8FAFC' : '#1E293B' }}>Global Search & Analytics</Text>
      </View>
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          <TextInput
            placeholder="Search across all organizations..."
            value={search}
            onChangeText={setSearch}
            style={{ flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 8, backgroundColor: isDarkMode ? '#334155' : '#f9fafb', color: isDarkMode ? '#fff' : '#111827' }}
            placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity onPress={handleSearch} style={{ marginLeft: 8, backgroundColor: isDarkMode ? '#2563eb' : '#3b82f6', borderRadius: 8, padding: 10 }}>
            <Ionicons name="search" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          {TABS.map(tab => (
            <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)} style={{ marginRight: 8, padding: 8, borderRadius: 8, backgroundColor: activeTab === tab.key ? (isDarkMode ? '#2563eb' : '#3b82f6') : '#e5e7eb' }}>
              <Text style={{ color: activeTab === tab.key ? '#fff' : '#111827' }}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView style={{ maxHeight: 400 }}>
          {loading ? (
            <ActivityIndicator size="small" color={isDarkMode ? '#60A5FA' : '#2563EB'} />
          ) : error ? (
            <Text style={{ color: '#ef4444' }}>{error}</Text>
          ) : results.length === 0 ? (
            <Text style={{ color: isDarkMode ? '#94A3B8' : '#475569' }}>No results found.</Text>
          ) : results.map(item => (
            <View key={item.id} style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f3f4f6', borderRadius: 10, padding: 12, marginBottom: 8 }}>
              <Text style={{ color: isDarkMode ? '#F8FAFC' : '#1E293B', fontWeight: '600' }}>{item.name}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default GlobalSearchPage;