import { useTheme } from "../context/ThemeContext";
import { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, Alert, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useOrganizations, Organization } from "../hooks/useOrganizations";

// Types for form fields
interface ScadaDbConfigForm {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  sslmode: string;
  table: string;
}
interface SchemaConfigForm {
  columns: string; // comma-separated
}
interface OrgForm {
  name: string;
  scadaDbConfig: ScadaDbConfigForm;
  schemaConfig: SchemaConfigForm;
}

const defaultScadaDbConfig: ScadaDbConfigForm = {
  host: '',
  port: '',
  user: '',
  password: '',
  database: '',
  sslmode: '',
  table: '',
};
const defaultSchemaConfig: SchemaConfigForm = {
  columns: '',
};

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
  const [search, setSearch] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<OrgForm>({
    name: '',
    scadaDbConfig: { ...defaultScadaDbConfig },
    schemaConfig: { ...defaultSchemaConfig },
  });
  const [modalType, setModalType] = useState<'add' | 'edit'>('add');

  // Parse org config to form
  const orgToForm = (org: Organization): OrgForm => {
    let scadaDbConfig: ScadaDbConfigForm = { ...defaultScadaDbConfig };
    let schemaConfig: SchemaConfigForm = { ...defaultSchemaConfig };
    try {
      const scada = typeof org.scadaDbConfig === 'string' ? JSON.parse(org.scadaDbConfig) : org.scadaDbConfig;
      scadaDbConfig = {
        host: scada.host || '',
        port: scada.port ? String(scada.port) : '',
        user: scada.user || '',
        password: scada.password || '',
        database: scada.database || '',
        sslmode: scada.sslmode || '',
        table: scada.table || '',
      };
    } catch {}
    try {
      const schema = typeof org.schemaConfig === 'string' ? JSON.parse(org.schemaConfig) : org.schemaConfig;
      schemaConfig = {
        columns: Array.isArray(schema.columns) ? schema.columns.join(', ') : '',
      };
    } catch {}
    return {
      name: org.name,
      scadaDbConfig,
      schemaConfig,
    };
  };

  // Filtered orgs
  const filteredOrgs = useMemo(() => {
    if (!search) return organizations;
    return organizations.filter(org => org.name.toLowerCase().includes(search.toLowerCase()));
  }, [organizations, search]);

  // Handlers
  const handleSelectOrg = (org: Organization) => {
    setSelectedOrg(org);
    setForm(orgToForm(org));
    setIsEditing(false);
    setShowModal(true);
    setModalType('edit');
  };
  const handleAddOrg = () => {
    setSelectedOrg(null);
    setForm({
      name: '',
      scadaDbConfig: { ...defaultScadaDbConfig },
      schemaConfig: { ...defaultSchemaConfig },
    });
    setIsEditing(true);
    setShowModal(true);
    setModalType('add');
  };
  const handleEdit = () => setIsEditing(true);
  const handleCancel = () => {
    if (modalType === 'add') setShowModal(false);
    else {
      setForm(selectedOrg ? orgToForm(selectedOrg) : form);
      setIsEditing(false);
    }
  };
  const handleDelete = () => {
    if (!selectedOrg) return;
    Alert.alert('Delete Organization', `Are you sure you want to delete ${selectedOrg.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteOrganization(selectedOrg.id);
        setShowModal(false);
        refetchOrganizations();
      } }
    ]);
  };
  const handleSave = async () => {
    // Validate required fields
    if (!form.name || !form.scadaDbConfig.host || !form.scadaDbConfig.port || !form.scadaDbConfig.user || !form.scadaDbConfig.password || !form.scadaDbConfig.database) {
      Alert.alert('Validation Error', 'Please fill all required fields.');
      return;
    }
    const scadaDbConfig = {
      ...form.scadaDbConfig,
      port: Number(form.scadaDbConfig.port),
    };
    const schemaConfig = {
      columns: form.schemaConfig.columns.split(',').map(s => s.trim()).filter(Boolean),
    };
    if (modalType === 'add') {
      await createOrganization({
        name: form.name,
        scadaDbConfig: JSON.stringify(scadaDbConfig),
        schemaConfig: JSON.stringify(schemaConfig),
      });
    } else if (selectedOrg) {
      await updateOrganization(selectedOrg.id, {
        name: form.name,
        scadaDbConfig: JSON.stringify(scadaDbConfig),
        schemaConfig: JSON.stringify(schemaConfig),
      });
    }
    setShowModal(false);
    refetchOrganizations();
  };

  // Render
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: isDarkMode ? '#F8FAFC' : '#1E293B' }}>Organizations</Text>
        <TouchableOpacity onPress={handleAddOrg} style={{ backgroundColor: isDarkMode ? '#2563eb' : '#3b82f6', borderRadius: 8, padding: 8 }}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      {/* Search bar with icon */}
      <View style={{ position: 'relative', marginBottom: 12 }}>
        <Ionicons
          name="search"
          size={20}
          color={isDarkMode ? '#94a3b8' : '#64748b'}
          style={{ position: 'absolute', left: 12, top: '50%', transform: [{ translateY: -10 }], zIndex: 1 }}
        />
        <TextInput
          placeholder="Search organizations..."
          value={search}
          onChangeText={setSearch}
          style={{
            borderWidth: 1,
            borderColor: '#e5e7eb',
            borderRadius: 8,
            padding: 8,
            paddingLeft: 38, // space for icon
            backgroundColor: isDarkMode ? '#334155' : '#f9fafb',
            color: isDarkMode ? '#fff' : '#111827',
          }}
          placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
        />
      </View>
      <ScrollView style={{ flex: 1 }}>
        {isLoading ? (
          <Text style={{ color: isDarkMode ? '#F8FAFC' : '#1E293B' }}>Loading...</Text>
        ) : filteredOrgs.length === 0 ? (
          <Text style={{ color: isDarkMode ? '#F8FAFC' : '#1E293B' }}>No organizations found.</Text>
        ) : filteredOrgs.map((org: Organization) => {
          let scada: Partial<ScadaDbConfigForm> = {};
          try {
            scada = typeof org.scadaDbConfig === 'string' ? JSON.parse(org.scadaDbConfig) : org.scadaDbConfig;
          } catch {}
          return (
            <TouchableOpacity key={org.id} onPress={() => handleSelectOrg(org)} style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f3f4f6', borderRadius: 10, padding: 16, marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: isDarkMode ? '#F8FAFC' : '#1E293B' }}>{org.name}</Text>
              <Text style={{ fontSize: 13, color: isDarkMode ? '#cbd5e1' : '#64748b', marginTop: 2 }}>
                Host: {scada.host || '-'}  |  Port: {scada.port || '-'}
              </Text>
              <Text style={{ fontSize: 13, color: isDarkMode ? '#cbd5e1' : '#64748b', marginTop: 2 }}>
                Database: {scada.database || '-'}  |  User: {scada.user || '-'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: 12, padding: 20, width: '95%', maxHeight: '90%' }}>
            <ScrollView style={{ maxHeight: 500 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: isDarkMode ? '#F8FAFC' : '#1E293B' }}>{modalType === 'add' ? 'Add Organization' : isEditing ? 'Edit Organization' : 'Organization Details'}</Text>
              {/* Name */}
              <Text style={{ fontWeight: '600', color: isDarkMode ? '#F8FAFC' : '#1E293B' }}>Name</Text>
              <TextInput
                value={form.name}
                editable={isEditing}
                onChangeText={name => setForm(f => ({ ...f, name }))}
                style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 8, marginBottom: 10, backgroundColor: isDarkMode ? '#334155' : '#f9fafb', color: isDarkMode ? '#fff' : '#111827' }}
                placeholder="Organization Name"
                placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
              />
              {/* SCADA DB Config Fields */}
              <Text style={{ fontWeight: '600', color: isDarkMode ? '#F8FAFC' : '#1E293B', marginTop: 8 }}>SCADA DB Config</Text>
              {['host', 'port', 'user', 'password', 'database', 'sslmode', 'table '].map((field) => (
                <View key={field} style={{ marginBottom: 8 }}>
                  <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b', fontSize: 13 }}>{field.charAt(0).toUpperCase() + field.slice(1)}</Text>
                  <TextInput
                    value={form.scadaDbConfig[field as keyof ScadaDbConfigForm]}
                    editable={isEditing}
                    onChangeText={val => setForm(f => ({ ...f, scadaDbConfig: { ...f.scadaDbConfig, [field]: val } }))}
                    style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 8, backgroundColor: isDarkMode ? '#334155' : '#f9fafb', color: isDarkMode ? '#fff' : '#111827' }}
                    placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                    placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
                    secureTextEntry={field === 'password'}
                  />
                </View>
              ))}
              {/* Schema Config Fields */}
              <Text style={{ fontWeight: '600', color: isDarkMode ? '#F8FAFC' : '#1E293B', marginTop: 8 }}>Schema Config</Text>
              <View style={{ marginBottom: 8 }}>
                <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b', fontSize: 13 }}>Columns (comma separated)</Text>
                <TextInput
                  value={form.schemaConfig.columns}
                  editable={isEditing}
                  onChangeText={val => setForm(f => ({ ...f, schemaConfig: { ...f.schemaConfig, columns: val } }))}
                  style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 8, backgroundColor: isDarkMode ? '#334155' : '#f9fafb', color: isDarkMode ? '#fff' : '#111827' }}
                  placeholder="hz1sv, hz1pv, ..."
                  placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
                />
              </View>
            </ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
              {isEditing ? (
                <>
                  <TouchableOpacity onPress={handleCancel} style={{ padding: 8, borderRadius: 8, backgroundColor: '#e5e7eb', marginRight: 8 }}>
                    <Text style={{ color: '#111827' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSave} style={{ padding: 8, borderRadius: 8, backgroundColor: isDarkMode ? '#2563eb' : '#3b82f6' }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {modalType === 'edit' && (
                    <TouchableOpacity onPress={handleEdit} style={{ padding: 8, borderRadius: 8, backgroundColor: isDarkMode ? '#fbbf24' : '#f59e42', marginRight: 8 }}>
                      <Text style={{ color: '#fff', fontWeight: 'bold' }}>Edit</Text>
                    </TouchableOpacity>
                  )}
                  {modalType === 'edit' && (
                    <TouchableOpacity onPress={handleDelete} style={{ padding: 8, borderRadius: 8, backgroundColor: '#ef4444' }}>
                      <Text style={{ color: '#fff', fontWeight: 'bold' }}>Delete</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setShowModal(false)} style={{ padding: 8, borderRadius: 8, backgroundColor: '#e5e7eb', marginLeft: 8 }}>
                    <Text style={{ color: '#111827' }}>Close</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default OrganizationManagement;