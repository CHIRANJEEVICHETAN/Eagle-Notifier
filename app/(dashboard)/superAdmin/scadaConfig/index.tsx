import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { useRouter } from 'expo-router';
import { useOrganizations, Organization } from '../../../hooks/useOrganizations';

const ScadaConfigPage: React.FC = () => {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const { organizations, isLoading, updateOrganization, refetchOrganizations } = useOrganizations();
  const [showModal, setShowModal] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [form, setForm] = useState({ scadaDbConfig: '', schemaConfig: '' });
  const [saving, setSaving] = useState(false);

  const openEditModal = (org: Organization) => {
    setSelectedOrg(org);
    setForm({
      scadaDbConfig: typeof org.scadaDbConfig === 'object' ? JSON.stringify(org.scadaDbConfig, null, 2) : org.scadaDbConfig,
      schemaConfig: typeof org.schemaConfig === 'object' ? JSON.stringify(org.schemaConfig, null, 2) : org.schemaConfig,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!selectedOrg) return;
    setSaving(true);
    try {
      await updateOrganization(selectedOrg.id, {
        name: selectedOrg.name,
        scadaDbConfig: form.scadaDbConfig,
        schemaConfig: form.schemaConfig,
      });
      setShowModal(false);
      refetchOrganizations();
      Alert.alert('Success', 'SCADA config updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update SCADA config');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#60A5FA' : '#2563EB'} />
        </TouchableOpacity>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: isDarkMode ? '#F8FAFC' : '#1E293B' }}>SCADA Config & Schema</Text>
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }}>
        {isLoading ? (
          <Text style={{ color: isDarkMode ? '#94A3B8' : '#475569' }}>Loading organizations...</Text>
        ) : organizations.length === 0 ? (
          <Text style={{ color: isDarkMode ? '#94A3B8' : '#475569' }}>No organizations found.</Text>
        ) : organizations.map(org => (
          <View key={org.id} style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f3f4f6', borderRadius: 10, padding: 16, marginBottom: 14 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: isDarkMode ? '#F8FAFC' : '#1E293B' }}>{org.name}</Text>
            <Text style={{ fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#64748b', marginTop: 4 }}>SCADA Config: {typeof org.scadaDbConfig === 'object' ? JSON.stringify(org.scadaDbConfig) : org.scadaDbConfig}</Text>
            <Text style={{ fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#64748b', marginTop: 2 }}>Schema Config: {typeof org.schemaConfig === 'object' ? JSON.stringify(org.schemaConfig) : org.schemaConfig}</Text>
            <TouchableOpacity onPress={() => openEditModal(org)} style={{ marginTop: 10, alignSelf: 'flex-end', backgroundColor: isDarkMode ? '#2563eb' : '#3b82f6', borderRadius: 8, padding: 8 }}>
              <Ionicons name="create-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: 12, padding: 20, width: '90%' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: isDarkMode ? '#F8FAFC' : '#1E293B' }}>Edit SCADA Config</Text>
            <TextInput
              placeholder="SCADA DB Config (JSON)"
              value={form.scadaDbConfig}
              onChangeText={scadaDbConfig => setForm(f => ({ ...f, scadaDbConfig }))}
              style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 8, marginBottom: 10, backgroundColor: isDarkMode ? '#334155' : '#f9fafb', color: isDarkMode ? '#fff' : '#111827', minHeight: 60 }}
              placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
              multiline
            />
            <TextInput
              placeholder="Schema Config (JSON)"
              value={form.schemaConfig}
              onChangeText={schemaConfig => setForm(f => ({ ...f, schemaConfig }))}
              style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 8, marginBottom: 10, backgroundColor: isDarkMode ? '#334155' : '#f9fafb', color: isDarkMode ? '#fff' : '#111827', minHeight: 60 }}
              placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
              multiline
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setShowModal(false)} style={{ padding: 8, borderRadius: 8, backgroundColor: '#e5e7eb', marginRight: 8 }}>
                <Text style={{ color: '#111827' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={{ padding: 8, borderRadius: 8, backgroundColor: isDarkMode ? '#2563eb' : '#3b82f6' }} disabled={saving}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default ScadaConfigPage; 