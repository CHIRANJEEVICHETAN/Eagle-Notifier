import { useTheme } from "../context/ThemeContext";
import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useOrganizations, Organization } from "../hooks/useOrganizations";

const OrganizationManagement: React.FC = () => {
  const { isDarkMode } = useTheme();
  const {
    organizations,
    isLoading,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    refetchOrganizations
  } = useOrganizations();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'add' | 'edit'>('add');
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [form, setForm] = useState({ name: '', scadaDbConfig: '', schemaConfig: '' });

  const openAddModal = () => {
    setModalType('add');
    setForm({ name: '', scadaDbConfig: '', schemaConfig: '' });
    setShowModal(true);
    setSelectedOrg(null);
  };

  const openEditModal = (org: Organization) => {
    setModalType('edit');
    setForm({ name: org.name, scadaDbConfig: org.scadaDbConfig, schemaConfig: org.schemaConfig });
    setShowModal(true);
    setSelectedOrg(org);
  };

  const handleDelete = (org: Organization) => {
    Alert.alert('Delete Organization', `Are you sure you want to delete ${org.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteOrganization(org.id);
        refetchOrganizations();
      } }
    ]);
  };

  const handleSubmit = async () => {
    if (!form.name) return;
    if (modalType === 'add') {
      await createOrganization(form);
    } else if (modalType === 'edit' && selectedOrg) {
      await updateOrganization(selectedOrg.id, form);
    }
    setShowModal(false);
    refetchOrganizations();
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold' }}>Organizations</Text>
        <TouchableOpacity onPress={openAddModal} style={{ backgroundColor: isDarkMode ? '#2563eb' : '#3b82f6', borderRadius: 8, padding: 8 }}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1 }}>
        {isLoading ? (
          <Text>Loading...</Text>
        ) : organizations.length === 0 ? (
          <Text>No organizations found.</Text>
        ) : organizations.map((org: Organization) => (
          <View key={org.id} style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f3f4f6', borderRadius: 10, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 18, fontWeight: '600' }}>{org.name}</Text>
              <Text style={{ fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#64748b' }}>
                SCADA Config: {typeof org.scadaDbConfig === 'object' ? JSON.stringify(org.scadaDbConfig) : org.scadaDbConfig}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => openEditModal(org)} style={{ marginRight: 8 }}>
                <Ionicons name="create-outline" size={22} color={isDarkMode ? '#fbbf24' : '#f59e42'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(org)}>
                <Ionicons name="trash-outline" size={22} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: 12, padding: 20, width: '90%' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>{modalType === 'add' ? 'Add Organization' : 'Edit Organization'}</Text>
            <TextInput
              placeholder="Organization Name"
              value={form.name}
              onChangeText={name => setForm(f => ({ ...f, name }))}
              style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 8, marginBottom: 10, backgroundColor: isDarkMode ? '#334155' : '#f9fafb', color: isDarkMode ? '#fff' : '#111827' }}
              placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
            />
            <TextInput
              placeholder="SCADA DB Config (JSON)"
              value={form.scadaDbConfig}
              onChangeText={scadaDbConfig => setForm(f => ({ ...f, scadaDbConfig }))}
              style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 8, marginBottom: 10, backgroundColor: isDarkMode ? '#334155' : '#f9fafb', color: isDarkMode ? '#fff' : '#111827' }}
              placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
            />
            <TextInput
              placeholder="Schema Config (JSON)"
              value={form.schemaConfig}
              onChangeText={schemaConfig => setForm(f => ({ ...f, schemaConfig }))}
              style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 8, marginBottom: 10, backgroundColor: isDarkMode ? '#334155' : '#f9fafb', color: isDarkMode ? '#fff' : '#111827' }}
              placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setShowModal(false)} style={{ padding: 8, borderRadius: 8, backgroundColor: '#e5e7eb', marginRight: 8 }}>
                <Text style={{ color: '#111827' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSubmit} style={{ padding: 8, borderRadius: 8, backgroundColor: isDarkMode ? '#2563eb' : '#3b82f6' }}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>{modalType === 'add' ? 'Add' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default OrganizationManagement;