import { useTheme } from "../context/ThemeContext";
import { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, Alert, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from 'expo-document-picker';
import { useOrganizations, Organization } from "../hooks/useOrganizations";
import { checkAndFixJsonSyntax, validateJsonSchema } from "../services/geminiService";

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
  columnConfigs: string; // JSON string for column configurations
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
  columnConfigs: '',
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
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [isCheckingSyntax, setIsCheckingSyntax] = useState(false);
  const [showSyntaxModal, setShowSyntaxModal] = useState(false);
  const [syntaxResult, setSyntaxResult] = useState<{ success: boolean; correctedJson?: string; error?: string } | null>(null);

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
        columnConfigs: schema.columnConfigs ? JSON.stringify(schema.columnConfigs, null, 2) : '',
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

  // Auto-generate column configurations
  const handleAutoGenerate = () => {
    const columns = form.schemaConfig.columns.split(',').map(s => s.trim()).filter(Boolean);
    
    if (columns.length === 0) {
      Alert.alert('No Columns', 'Please enter column names first (comma-separated)');
      return;
    }
    
    const autoConfig: any = {};
    
    columns.forEach(col => {
      const colLower = col.toLowerCase();
      let config: any = {};
      // --- Analog Temperature (with zone detection) ---
      if (/^(hz|tz)\d+(sv|pv)$/.test(colLower)) {
        // e.g., hz1sv, hz1pv, tz2sv, tz2pv
        const zoneMatch = colLower.match(/^(hz|tz)(\d+)/);
        const zoneType = zoneMatch ? (zoneMatch[1] === 'hz' ? 'HARDENING' : 'TEMPERING') : '';
        const zoneNum = zoneMatch ? zoneMatch[2] : '';
        const isSetpoint = colLower.endsWith('sv');
        config = {
          name: `${zoneType} ZONE ${zoneNum} ${isSetpoint ? 'SETPOINT' : 'TEMPERATURE'}`,
          type: 'temperature',
          zone: `zone${zoneNum}`,
          unit: '°C',
          isAnalog: true,
          isBinary: false,
          lowDeviation: -30.0,
          highDeviation: 10.0
        };
      }
      // --- Analog Carbon ---
      else if (/^cp[sp]v$/.test(colLower)) {
        // e.g., cpsv, cppv
        config = {
          name: colLower === 'cpsv' ? 'CARBON POTENTIAL SETPOINT' : 'CARBON POTENTIAL',
          type: 'carbon',
          unit: '%',
          isAnalog: true,
          isBinary: false,
          lowDeviation: -0.05,
          highDeviation: 0.05
        };
      }
      // --- Analog Oil Temperature ---
      else if (colLower === 'oilpv') {
        config = {
          name: 'OIL TEMPERATURE',
          type: 'temperature',
          unit: '°C',
          isAnalog: true,
          isBinary: false,
          lowDeviation: -10.0,
          highDeviation: 20.0
        };
      }
      // --- Binary Oil Temperature High ---
      else if (colLower === 'oiltemphigh') {
        config = {
          name: 'OIL TEMPERATURE HIGH',
          type: 'temperature',
          isAnalog: false,
          isBinary: true
        };
      }
      // --- Binary Oil Level High/Low ---
      else if (colLower === 'oillevelhigh') {
        config = {
          name: 'OIL LEVEL HIGH',
          type: 'level',
          isAnalog: false,
          isBinary: true
        };
      } else if (colLower === 'oillevellow') {
        config = {
          name: 'OIL LEVEL LOW',
          type: 'level',
          isAnalog: false,
          isBinary: true
        };
      }
      // --- Binary Heater Failure ---
      else if (/^hz\d+hfail$/.test(colLower)) {
        const zoneNum = colLower.match(/^hz(\d+)hfail$/)?.[1];
        config = {
          name: `HARDENING ZONE ${zoneNum} HEATER FAILURE`,
          type: 'heater',
          zone: `zone${zoneNum}`,
          isAnalog: false,
          isBinary: true
        };
      }
      // --- Binary Conveyor Failure/Trip ---
      else if (colLower === 'hardconfail') {
        config = {
          name: 'HARDENING CONVEYOR FAILURE',
          type: 'conveyor',
          isAnalog: false,
          isBinary: true
        };
      } else if (colLower === 'hardcontraip') {
        config = {
          name: 'HARDENING CONVEYOR TRIP',
          type: 'conveyor',
          isAnalog: false,
          isBinary: true
        };
      } else if (colLower === 'oilconfail') {
        config = {
          name: 'OIL CONVEYOR FAILURE',
          type: 'conveyor',
          isAnalog: false,
          isBinary: true
        };
      } else if (colLower === 'oilcontraip') {
        config = {
          name: 'OIL CONVEYOR TRIP',
          type: 'conveyor',
          isAnalog: false,
          isBinary: true
        };
      }
      // --- Binary Fan Failure/Trip (HARDENING) ---
      else if (/^hz\d+fanfail$/.test(colLower)) {
        const zoneNum = colLower.match(/^hz(\d+)fanfail$/)?.[1];
        config = {
          name: `HARDENING ZONE ${zoneNum} FAN FAILURE`,
          type: 'fan',
          zone: `zone${zoneNum}`,
          isAnalog: false,
          isBinary: true
        };
      } else if (/^hz\d+fantrip$/.test(colLower)) {
        const zoneNum = colLower.match(/^hz(\d+)fantrip$/)?.[1];
        config = {
          name: `HARDENING ZONE ${zoneNum} FAN TRIP`,
          type: 'fan',
          zone: `zone${zoneNum}`,
          isAnalog: false,
          isBinary: true
        };
      }
      // --- Binary Fan Failure/Trip (TEMPERING) ---
      else if (/^tz\d+fanfail$/.test(colLower)) {
        const zoneNum = colLower.match(/^tz(\d+)fanfail$/)?.[1];
        config = {
          name: `TEMPERING ZONE ${zoneNum} FAN FAILURE`,
          type: 'fan',
          zone: `zone${zoneNum}`,
          isAnalog: false,
          isBinary: true
        };
      } else if (/^tz\d+fantrip$/.test(colLower)) {
        const zoneNum = colLower.match(/^tz(\d+)fantrip$/)?.[1];
        config = {
          name: `TEMPERING ZONE ${zoneNum} FAN TRIP`,
          type: 'fan',
          zone: `zone${zoneNum}`,
          isAnalog: false,
          isBinary: true
        };
      }
      // --- Binary Temp Controller Failure/Trip ---
      else if (colLower === 'tempconfail') {
        config = {
          name: 'TEMPERATURE CONTROLLER FAILURE',
          type: 'controller',
          isAnalog: false,
          isBinary: true
        };
      } else if (colLower === 'tempcontraip') {
        config = {
          name: 'TEMPERATURE CONTROLLER TRIP',
          type: 'controller',
          isAnalog: false,
          isBinary: true
        };
      }
      // --- Default: Analog value ---
      else {
        config = {
          name: col.toUpperCase().replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim(),
          type: 'value',
          isAnalog: true,
          isBinary: false,
          lowDeviation: -10.0,
          highDeviation: 10.0
        };
      }
      autoConfig[col] = config;
    });
    
    setForm(f => ({
      ...f,
      schemaConfig: {
        ...f.schemaConfig,
        columnConfigs: JSON.stringify(autoConfig, null, 2)
      }
    }));
    
    Alert.alert('Auto-Generated', `Generated configuration for ${Object.keys(autoConfig).length} columns`);
  };

  // Handle JSON file upload
  const handleFileUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      
      if (!file) {
        Alert.alert('Error', 'No file selected');
        return;
      }

      // Read the file content
      const response = await fetch(file.uri);
      const fileContent = await response.text();
      
      // Try to parse the JSON
      try {
        const parsed = JSON.parse(fileContent);
        
        // Validate the schema
        const validation = validateJsonSchema(fileContent);
        if (!validation.isValid) {
          Alert.alert('Validation Error', `Invalid JSON schema:\n${validation.errors.join('\n')}`);
          return;
        }
        
        setForm(f => ({
          ...f,
          schemaConfig: {
            ...f.schemaConfig,
            columnConfigs: JSON.stringify(parsed, null, 2)
          }
        }));
        
        Alert.alert('Success', 'JSON file loaded successfully!');
        
      } catch (parseError) {
        Alert.alert('Parse Error', 'The selected file is not valid JSON');
      }
      
    } catch (error) {
      console.error('File upload error:', error);
      Alert.alert('Error', 'Failed to read the selected file');
    }
  };

  // Handle syntax checking with Gemini AI
  const handleSyntaxCheck = async () => {
    if (!form.schemaConfig.columnConfigs.trim()) {
      Alert.alert('No Content', 'Please enter JSON configuration to check');
      return;
    }

    setIsCheckingSyntax(true);
    try {
      const result = await checkAndFixJsonSyntax(form.schemaConfig.columnConfigs);
      
      if (!result.success) {
        // Show specific error message
        if (result.error?.includes('API key not configured')) {
          Alert.alert(
            'Gemini API Not Configured', 
            'The Gemini API key is not configured. Please contact your administrator to set up the GEMINI_API_KEY environment variable.',
            [
              { text: 'OK', style: 'default' },
              { text: 'Try Manual Fix', onPress: () => {
                // Show the syntax modal with manual instructions
                setSyntaxResult({ success: false, error: 'Please manually fix the JSON syntax errors.' });
                setShowSyntaxModal(true);
              }}
            ]
          );
        } else {
          Alert.alert('Syntax Check Failed', result.error || 'Failed to check syntax. Please try again.');
        }
        return;
      }
      
      setSyntaxResult(result);
      setShowSyntaxModal(true);
    } catch (error) {
      console.error('Syntax check error:', error);
      Alert.alert('Error', 'Failed to check syntax. Please try again.');
    } finally {
      setIsCheckingSyntax(false);
    }
  };

  // Apply corrected JSON
  const applyCorrectedJson = () => {
    if (syntaxResult?.correctedJson) {
      setForm(f => ({
        ...f,
        schemaConfig: {
          ...f.schemaConfig,
          columnConfigs: syntaxResult.correctedJson!
        }
      }));
      setShowSyntaxModal(false);
      setSyntaxResult(null);
      Alert.alert('Applied', 'Corrected JSON has been applied');
    }
  };

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
    setShowDeleteModal(true);
  };
  const confirmDelete = async () => {
    if (!selectedOrg) return;
    setIsSaving(true);
    await deleteOrganization(selectedOrg.id);
    setIsSaving(false);
    setShowDeleteModal(false);
    setShowModal(false);
    setSuccessMessage('Organization deleted successfully!');
    setShowSuccessModal(true);
    refetchOrganizations();
  };
  const handleSave = async () => {
    // Validate required fields
    if (!form.name || !form.scadaDbConfig.host || !form.scadaDbConfig.port || !form.scadaDbConfig.user || !form.scadaDbConfig.password || !form.scadaDbConfig.database) {
      Alert.alert('Validation Error', 'Please fill all required fields.');
      return;
    }
    
    // Validate JSON configuration if provided
    if (form.schemaConfig.columnConfigs.trim()) {
      try {
        const config = JSON.parse(form.schemaConfig.columnConfigs);
        
        // Validate column configurations
        for (const [columnName, columnConfig] of Object.entries(config)) {
          if (typeof columnConfig !== 'object' || !columnConfig) {
            throw new Error(`Invalid configuration for column: ${columnName}`);
          }
          
          const configObj = columnConfig as any;
          
          // Check if it's analog or binary
          if (configObj.isAnalog && configObj.isBinary) {
            throw new Error(`Column ${columnName} cannot be both analog and binary`);
          }
          
          if (!configObj.isAnalog && !configObj.isBinary) {
            throw new Error(`Column ${columnName} must be either analog or binary`);
          }
          
          // Check required fields
          if (!configObj.name || !configObj.type) {
            throw new Error(`Column ${columnName} missing required fields: name and type`);
          }
        }
      } catch (error) {
        Alert.alert('Configuration Error', `Invalid JSON configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return;
      }
    }
    // Utility to trim all string fields in an object
    const trimObjectStrings = (obj: any) => {
      const trimmed: any = {};
      for (const key in obj) {
        const val = obj[key];
        trimmed[key] = typeof val === 'string' ? val.trim() : val;
      }
      return trimmed;
    };
    // Trim all scadaDbConfig and schemaConfig fields
    const trimmedScadaDbConfig = trimObjectStrings(form.scadaDbConfig);
    const trimmedSchemaConfig = trimObjectStrings(form.schemaConfig);
    const scadaDbConfig = {
      ...trimmedScadaDbConfig,
      port: Number(trimmedScadaDbConfig.port),
    };
    const schemaConfig = {
      columns: trimmedSchemaConfig.columns.split(',').map((s: string) => s.trim()).filter(Boolean),
      columnConfigs: trimmedSchemaConfig.columnConfigs ? JSON.parse(trimmedSchemaConfig.columnConfigs) : undefined,
    };
    setIsSaving(true);
    try {
      if (modalType === 'add') {
        await createOrganization({
          name: form.name,
          scadaDbConfig,
          schemaConfig,
        });
        setSuccessMessage('Organization created successfully!');
      } else if (selectedOrg) {
        await updateOrganization(selectedOrg.id, {
          name: form.name,
          scadaDbConfig,
          schemaConfig,
        });
        setSuccessMessage('Organization updated successfully!');
      }
      setShowModal(false);
      setShowSuccessModal(true);
      refetchOrganizations();
    } finally {
      setIsSaving(false);
    }
  };

  // Handler for pull-to-refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchOrganizations();
    setIsRefreshing(false);
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
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[isDarkMode ? '#22d3ee' : '#2563eb']}
            tintColor={isDarkMode ? '#22d3ee' : '#2563eb'}
            progressBackgroundColor={isDarkMode ? '#1e293b' : '#f3f4f6'}
          />
        }
      >
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
              {['host', 'port', 'user', 'password', 'database', 'sslmode', 'table'].map((field) => (
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
                  placeholder="hz1sv, hz1pv, oilpv, ..."
                  placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
                />
              </View>
              
              {/* Column Configurations */}
              <View style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b', fontSize: 13 }}>Column Configurations (JSON)</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b', marginRight: 4 }}>Auto-gen</Text>
                    <TouchableOpacity 
                      onPress={handleAutoGenerate}
                      style={{ padding: 4, marginRight: 8 }}
                    >
                      <Ionicons name="flash" size={16} color={isDarkMode ? '#22c55e' : '#16a34a'} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={handleFileUpload}
                      style={{ padding: 4, marginRight: 8 }}
                    >
                      <Ionicons name="cloud-upload" size={16} color={isDarkMode ? '#f59e42' : '#ea580c'} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={handleSyntaxCheck}
                      disabled={isCheckingSyntax}
                      style={{ padding: 4, marginRight: 8 }}
                    >
                      {isCheckingSyntax ? (
                        <ActivityIndicator size={16} color={isDarkMode ? '#60A5FA' : '#2563EB'} />
                      ) : (
                        <Ionicons name="checkmark-circle" size={16} color={isDarkMode ? '#60A5FA' : '#2563EB'} />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowConfigModal(true)} style={{ padding: 4 }}>
                      <Ionicons name="help-circle-outline" size={16} color={isDarkMode ? '#60A5FA' : '#2563EB'} />
                    </TouchableOpacity>
                  </View>
                </View>
                <TextInput
                  value={form.schemaConfig.columnConfigs}
                  editable={isEditing}
                  onChangeText={val => setForm(f => ({ ...f, schemaConfig: { ...f.schemaConfig, columnConfigs: val } }))}
                  style={{ 
                    borderWidth: 1, 
                    borderColor: '#e5e7eb', 
                    borderRadius: 8, 
                    padding: 8, 
                    backgroundColor: isDarkMode ? '#334155' : '#f9fafb', 
                    color: isDarkMode ? '#fff' : '#111827',
                    minHeight: 100,
                    textAlignVertical: 'top'
                  }}
                  placeholder="Enter JSON configuration for column alarms..."
                  placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
                  multiline
                />
              </View>

              {/* Predictive Maintenance Config */}
              <Text style={{ fontWeight: '600', color: isDarkMode ? '#F8FAFC' : '#1E293B', marginTop: 16 }}>Predictive Maintenance</Text>
              
              {/* Enable Predictions Toggle */}
              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: 12,
                paddingVertical: 8
              }}>
                <Text style={{ color: isDarkMode ? '#F8FAFC' : '#1E293B', fontSize: 16 }}>
                  Enable ML Predictions
                </Text>
                <View style={{
                  width: 50,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: (selectedOrg?.predictionEnabled || false) ? '#22c55e' : '#94a3b8',
                  justifyContent: 'center',
                  paddingHorizontal: 2
                }}>
                  <View style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: '#ffffff',
                    alignSelf: (selectedOrg?.predictionEnabled || false) ? 'flex-end' : 'flex-start'
                  }} />
                </View>
              </View>

              {selectedOrg?.predictionEnabled && (
                <>
                  {/* Model Version */}
                  <View style={{ marginBottom: 8 }}>
                    <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b', fontSize: 13 }}>Model Version</Text>
                    <Text style={{ 
                      color: isDarkMode ? '#F8FAFC' : '#1E293B',
                      fontSize: 14,
                      fontWeight: '600',
                      paddingVertical: 8
                    }}>
                      {selectedOrg.modelVersion || 'Not Available'}
                    </Text>
                  </View>

                  {/* Model Accuracy */}
                  <View style={{ marginBottom: 8 }}>
                    <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b', fontSize: 13 }}>Model Accuracy</Text>
                    <Text style={{ 
                      color: selectedOrg.modelAccuracy && selectedOrg.modelAccuracy > 0.8 ? '#22c55e' : '#f59e0b',
                      fontSize: 14,
                      fontWeight: '600',
                      paddingVertical: 8
                    }}>
                      {selectedOrg.modelAccuracy ? `${(selectedOrg.modelAccuracy * 100).toFixed(1)}%` : 'Not Available'}
                    </Text>
                  </View>

                  {/* Last Training Date */}
                  <View style={{ marginBottom: 8 }}>
                    <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b', fontSize: 13 }}>Last Training</Text>
                    <Text style={{ 
                      color: isDarkMode ? '#F8FAFC' : '#1E293B',
                      fontSize: 14,
                      fontWeight: '600',
                      paddingVertical: 8
                    }}>
                      {selectedOrg.lastTrainingDate ? new Date(selectedOrg.lastTrainingDate).toLocaleDateString() : 'Never'}
                    </Text>
                  </View>

                  {/* Quick Actions */}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        backgroundColor: isDarkMode ? '#059669' : '#10b981',
                        borderRadius: 6,
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        alignItems: 'center'
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                        Configure ML
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        backgroundColor: isDarkMode ? '#7c3aed' : '#8b5cf6',
                        borderRadius: 6,
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        alignItems: 'center'
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                        View Performance
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
              {isEditing ? (
                <>
                  <TouchableOpacity onPress={handleCancel} style={{ padding: 8, borderRadius: 8, backgroundColor: '#e5e7eb', marginRight: 8 }} disabled={isSaving}>
                    <Text style={{ color: '#111827' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSave} style={{ padding: 8, borderRadius: 8, backgroundColor: isDarkMode ? '#2563eb' : '#3b82f6', flexDirection: 'row', alignItems: 'center', minWidth: 80, justifyContent: 'center' }} disabled={isSaving}>
                    {isSaving ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save</Text>
                    )}
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
      
      {/* Success Modal */}
      <Modal visible={showSuccessModal} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: 16, padding: 32, alignItems: 'center', width: '85%' }}>
            <Ionicons name="checkmark-circle" size={64} color={isDarkMode ? '#22d3ee' : '#22c55e'} style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: isDarkMode ? '#F8FAFC' : '#1E293B', marginBottom: 8 }}>{successMessage}</Text>
            <TouchableOpacity onPress={() => setShowSuccessModal(false)} style={{ marginTop: 20, backgroundColor: isDarkMode ? '#2563eb' : '#3b82f6', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* Delete Confirmation Modal */}
      <Modal visible={showDeleteModal} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: 16, padding: 28, alignItems: 'center', width: '85%' }}>
            <Ionicons name="warning" size={56} color="#f59e42" style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: isDarkMode ? '#F8FAFC' : '#1E293B', marginBottom: 8 }}>Delete Organization</Text>
            <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b', textAlign: 'center', marginBottom: 18 }}>
              Are you sure you want to delete <Text style={{ fontWeight: 'bold', color: isDarkMode ? '#f87171' : '#dc2626' }}>{selectedOrg?.name}</Text>? This action cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity onPress={() => setShowDeleteModal(false)} style={{ padding: 10, borderRadius: 8, backgroundColor: '#e5e7eb', marginRight: 8, minWidth: 80, alignItems: 'center' }} disabled={isSaving}>
                <Text style={{ color: '#111827', fontWeight: 'bold' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmDelete} style={{ padding: 10, borderRadius: 8, backgroundColor: '#ef4444', minWidth: 80, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }} disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="trash" size={20} color="#fff" style={{ marginRight: 6 }} />
                )}
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Syntax Check Result Modal */}
      <Modal visible={showSyntaxModal} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: 16, padding: 24, width: '95%', maxHeight: '90%' }}>
            <ScrollView style={{ maxHeight: 400 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: isDarkMode ? '#F8FAFC' : '#1E293B' }}>
                {syntaxResult?.success ? 'Syntax Check Complete' : 'Syntax Check Failed'}
              </Text>
              
              {syntaxResult?.success ? (
                <View>
                  <Text style={{ fontSize: 14, color: isDarkMode ? '#22c55e' : '#16a34a', marginBottom: 12 }}>
                    ✅ JSON syntax is valid and has been corrected!
                  </Text>
                  <Text style={{ fontSize: 14, color: isDarkMode ? '#cbd5e1' : '#64748b', marginBottom: 12 }}>
                    Corrected JSON:
                  </Text>
                  <View style={{ backgroundColor: isDarkMode ? '#334155' : '#f1f5f9', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                    <Text style={{ fontFamily: 'monospace', fontSize: 11, color: isDarkMode ? '#e2e8f0' : '#475569' }}>
                      {syntaxResult.correctedJson}
                    </Text>
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={{ fontSize: 14, color: isDarkMode ? '#f87171' : '#dc2626', marginBottom: 12 }}>
                    ❌ Failed to fix JSON syntax
                  </Text>
                  <Text style={{ fontSize: 14, color: isDarkMode ? '#cbd5e1' : '#64748b', marginBottom: 12 }}>
                    Error: {syntaxResult?.error}
                  </Text>
                </View>
              )}
            </ScrollView>
            
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity 
                onPress={() => setShowSyntaxModal(false)} 
                style={{ 
                  flex: 1,
                  padding: 12, 
                  borderRadius: 8, 
                  backgroundColor: '#e5e7eb',
                  alignItems: 'center'
                }}
              >
                <Text style={{ color: '#111827', fontWeight: 'bold' }}>Close</Text>
              </TouchableOpacity>
              
              {syntaxResult?.success && (
                <TouchableOpacity 
                  onPress={applyCorrectedJson}
                  style={{ 
                    flex: 1,
                    padding: 12, 
                    borderRadius: 8, 
                    backgroundColor: isDarkMode ? '#22c55e' : '#16a34a',
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Apply Fix</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Configuration Help Modal */}
      <Modal visible={showConfigModal} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: 16, padding: 24, width: '95%', maxHeight: '90%' }}>
            <ScrollView style={{ maxHeight: 500 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: isDarkMode ? '#F8FAFC' : '#1E293B' }}>Column Configuration Help</Text>
              
              <Text style={{ fontSize: 14, color: isDarkMode ? '#cbd5e1' : '#64748b', marginBottom: 12 }}>
                Configure how each column should be treated for alarm monitoring. Use this JSON format:
              </Text>
              
              <Text style={{ fontSize: 14, fontWeight: '600', color: isDarkMode ? '#60A5FA' : '#2563EB', marginBottom: 8 }}>
                🚀 Auto-Generation Support:
              </Text>
              <Text style={{ fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#64748b', marginBottom: 12 }}>
                The auto-generate button (⚡) can automatically detect and configure columns based on naming patterns:
              </Text>
              <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderRadius: 6, padding: 8, marginBottom: 12 }}>
                <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b', marginBottom: 4 }}>• Temperature zones: hz1sv, hz1pv, tz2sv, tz2pv</Text>
                <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b', marginBottom: 4 }}>• Carbon potential: cpsv, cppv</Text>
                <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b', marginBottom: 4 }}>• Oil sensors: oilpv, oiltemphigh, oillevelhigh</Text>
                <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b', marginBottom: 4 }}>• Equipment failures: hz1hfail, hardconfail, hz1fanfail</Text>
                <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b' }}>• Controller alarms: tempconfail, tempcontraip</Text>
              </View>
              
              <View style={{ backgroundColor: isDarkMode ? '#334155' : '#f1f5f9', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <Text style={{ fontFamily: 'monospace', fontSize: 12, color: isDarkMode ? '#e2e8f0' : '#475569' }}>
{`{
  "hz1sv": {
    "name": "HARDENING ZONE 1 SETPOINT",
    "type": "temperature",
    "zone": "zone1",
    "unit": "°C",
    "isAnalog": true,
    "isBinary": false,
    "lowDeviation": -30.0,
    "highDeviation": 10.0
  },
  "hz1pv": {
    "name": "HARDENING ZONE 1 TEMPERATURE",
    "type": "temperature", 
    "zone": "zone1",
    "unit": "°C",
    "isAnalog": true,
    "isBinary": false,
    "lowDeviation": -30.0,
    "highDeviation": 10.0
  },
  "cpsv": {
    "name": "CARBON POTENTIAL SETPOINT",
    "type": "carbon",
    "unit": "%",
    "isAnalog": true,
    "isBinary": false,
    "lowDeviation": -0.05,
    "highDeviation": 0.05
  },
  "cppv": {
    "name": "CARBON POTENTIAL",
    "type": "carbon",
    "unit": "%",
    "isAnalog": true,
    "isBinary": false,
    "lowDeviation": -0.05,
    "highDeviation": 0.05
  },
  "oilpv": {
    "name": "OIL TEMPERATURE",
    "type": "temperature",
    "unit": "°C", 
    "isAnalog": true,
    "isBinary": false,
    "lowDeviation": -10.0,
    "highDeviation": 20.0
  },
  "oiltemphigh": {
    "name": "OIL TEMPERATURE HIGH",
    "type": "temperature",
    "isAnalog": false,
    "isBinary": true
  },
  "oillevelhigh": {
    "name": "OIL LEVEL HIGH",
    "type": "level",
    "isAnalog": false,
    "isBinary": true
  },
  "hz1hfail": {
    "name": "HARDENING ZONE 1 HEATER FAILURE",
    "type": "heater",
    "zone": "zone1",
    "isAnalog": false,
    "isBinary": true
  },
  "cpsv": {
    "name": "CARBON POTENTIAL",
    "type": "carbon",
    "unit": "%",
    "isAnalog": true,
    "isBinary": false,
    "lowDeviation": -0.05,
    "highDeviation": 0.05
  }
}`}
                </Text>
              </View>
              
              <Text style={{ fontSize: 14, fontWeight: '600', color: isDarkMode ? '#F8FAFC' : '#1E293B', marginBottom: 8 }}>Configuration Options:</Text>
              
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? '#60A5FA' : '#2563EB', marginBottom: 4 }}>Analog Alarms (isAnalog: true, isBinary: false):</Text>
                <Text style={{ fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#64748b', marginBottom: 2 }}>• name: Display name for the alarm</Text>
                <Text style={{ fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#64748b', marginBottom: 2 }}>• type: Alarm type (temperature, carbon, etc.)</Text>
                <Text style={{ fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#64748b', marginBottom: 2 }}>• zone: Zone identifier (optional)</Text>
                <Text style={{ fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#64748b', marginBottom: 8 }}>• unit: Unit of measurement (optional)</Text>
                <Text style={{ fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#64748b', marginBottom: 8 }}>• lowDeviation: Lower deviation for analog alarms (optional)</Text>
                <Text style={{ fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#64748b', marginBottom: 8 }}>• highDeviation: Upper deviation for analog alarms (optional)</Text>
              </View>
              
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? '#60A5FA' : '#2563EB', marginBottom: 4 }}>Binary Alarms (isAnalog: false, isBinary: true):</Text>
                <Text style={{ fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#64748b', marginBottom: 2 }}>• name: Display name for the alarm</Text>
                <Text style={{ fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#64748b', marginBottom: 2 }}>• type: Alarm type (heater, fan, etc.)</Text>
                <Text style={{ fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#64748b', marginBottom: 8 }}>• zone: Zone identifier (optional)</Text>
              </View>
              
              <Text style={{ fontSize: 12, color: isDarkMode ? '#fbbf24' : '#f59e42', fontStyle: 'italic' }}>
                Note: For analog alarms, the system automatically pairs PV (process value) and SV (setpoint value) fields based on naming patterns.
              </Text>
            </ScrollView>
            
            <TouchableOpacity 
              onPress={() => setShowConfigModal(false)} 
              style={{ 
                marginTop: 16, 
                backgroundColor: isDarkMode ? '#2563eb' : '#3b82f6', 
                borderRadius: 8, 
                paddingVertical: 12, 
                paddingHorizontal: 24,
                alignItems: 'center'
              }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default OrganizationManagement;