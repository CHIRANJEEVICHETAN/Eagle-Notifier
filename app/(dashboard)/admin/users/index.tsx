import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { UserRole, User } from '../../../types/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Mock API service for users
// In a real app, this would be replaced with actual API calls
const userService = {
  getUsers: async (): Promise<User[]> => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // Mock user data
    return [
      {
        id: '1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        email: 'operator@example.com',
        name: 'Operator User',
        role: 'operator',
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '3',
        email: 'jane@example.com',
        name: 'Jane Smith',
        role: 'operator',
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  },
  
  createUser: async (userData: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
  }): Promise<User> => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // In a real app, this would send the data to the server
    return {
      id: Math.random().toString(36).substring(7),
      email: userData.email,
      name: userData.name,
      role: userData.role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },
  
  updateUser: async (id: string, userData: {
    name?: string;
    email?: string;
    role?: UserRole;
  }): Promise<User> => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // In a real app, this would send the data to the server
    return {
      id,
      email: userData.email || 'updated@example.com',
      name: userData.name || 'Updated User',
      role: userData.role || 'operator',
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },
  
  deleteUser: async (id: string): Promise<void> => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // In a real app, this would send a delete request to the server
    console.log(`User ${id} deleted`);
  },
};

// Form types
type FormMode = 'create' | 'edit';

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export default function UserManagementScreen() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // Form state
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [formVisible, setFormVisible] = useState(false);
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    password: '',
    role: 'operator',
  });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  
  // Fetch users
  const {
    data: users,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['users'],
    queryFn: userService.getUsers,
  });
  
  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: userService.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setFormVisible(false);
      resetForm();
    },
  });
  
  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: ({ id, userData }: { id: string; userData: Partial<UserFormData> }) =>
      userService.updateUser(id, userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setFormVisible(false);
      resetForm();
    },
  });
  
  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: userService.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
  
  // Reset form state
  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'operator',
    });
    setSelectedUserId(null);
  }, []);
  
  // Handle form submission
  const handleSubmit = useCallback(() => {
    // Validate form data
    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Name is required');
      return;
    }
    
    if (!formData.email.trim()) {
      Alert.alert('Validation Error', 'Email is required');
      return;
    }
    
    if (formMode === 'create' && !formData.password.trim()) {
      Alert.alert('Validation Error', 'Password is required');
      return;
    }
    
    if (formMode === 'create') {
      createUserMutation.mutate(formData);
    } else if (formMode === 'edit' && selectedUserId) {
      const updateData: Partial<UserFormData> = {
        name: formData.name,
        email: formData.email,
        role: formData.role
      };
      
      // Only include password if it's not empty
      if (formData.password.trim()) {
        updateData.password = formData.password;
      }
      
      updateUserMutation.mutate({
        id: selectedUserId,
        userData: updateData,
      });
    }
  }, [formMode, formData, selectedUserId, createUserMutation, updateUserMutation]);
  
  // Handle opening the create form
  const handleCreateUser = useCallback(() => {
    resetForm();
    setFormMode('create');
    setFormVisible(true);
  }, [resetForm]);
  
  // Handle opening the edit form
  const handleEditUser = useCallback((user: User) => {
    setFormMode('edit');
    setSelectedUserId(user.id);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // Don't set the password, it will only be updated if a new one is provided
      role: user.role,
    });
    setFormVisible(true);
  }, []);
  
  // Handle delete user
  const handleDeleteUser = useCallback((id: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this user? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteUserMutation.mutate(id),
        },
      ]
    );
  }, [deleteUserMutation]);
  
  // Render user item
  const renderUserItem = useCallback(({ item }: { item: User }) => (
    <View style={[
      styles.userCard,
      { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }
    ]}>
      <View style={styles.userInfo}>
        <Text style={[styles.userName, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
          {item.name}
        </Text>
        <Text style={[styles.userEmail, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
          {item.email}
        </Text>
        <View style={styles.userDetails}>
          <View style={[
            styles.roleBadge,
            { backgroundColor: item.role === 'admin' 
                ? (isDarkMode ? '#4F46E5' : '#6366F1') 
                : (isDarkMode ? '#2563EB' : '#3B82F6') 
            }
          ]}>
            <Text style={styles.roleText}>
              {item.role === 'admin' ? 'Admin' : 'Operator'}
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.userActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }]}
          onPress={() => handleEditUser(item)}
        >
          <Ionicons
            name="pencil-outline"
            size={18}
            color={isDarkMode ? '#60A5FA' : '#2563EB'}
          />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }]}
          onPress={() => handleDeleteUser(item.id)}
        >
          <Ionicons
            name="trash-outline"
            size={18}
            color={isDarkMode ? '#F87171' : '#EF4444'}
          />
        </TouchableOpacity>
      </View>
    </View>
  ), [isDarkMode, handleEditUser, handleDeleteUser]);
  
  // Render loading state
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' }]}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDarkMode ? '#60A5FA' : '#2563EB'} />
          <Text style={[styles.loadingText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Loading users...
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // Render error state
  if (isError) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' }]}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={64}
            color={isDarkMode ? '#F87171' : '#EF4444'}
          />
          <Text style={[styles.errorTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            Error Loading Users
          </Text>
          <Text style={[styles.errorMessage, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            {error instanceof Error ? error.message : 'Failed to load users'}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB' }]}
            onPress={() => refetch()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}
            onPress={() => router.back()}
          >
            <Ionicons
              name="arrow-back"
              size={20}
              color={isDarkMode ? '#E5E7EB' : '#4B5563'}
            />
          </TouchableOpacity>
          
          <View>
            <Text style={[styles.headerTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
              User Management
            </Text>
            <Text style={[styles.headerSubtitle, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
              Create, edit, and manage users
            </Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB' }]}
          onPress={handleCreateUser}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add User</Text>
        </TouchableOpacity>
      </View>
      
      {/* User List */}
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={renderUserItem}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={[styles.emptyState, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}>
            <Ionicons
              name="people-outline"
              size={48}
              color={isDarkMode ? '#4B5563' : '#9CA3AF'}
            />
            <Text style={[styles.emptyStateText, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
              No Users Found
            </Text>
            <Text style={[styles.emptyStateSubtext, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
              Add new users to get started.
            </Text>
          </View>
        }
      />
      
      {/* User Form Modal */}
      <Modal
        visible={formVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFormVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.formContainer, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}>
            <View style={styles.formHeader}>
              <Text style={[styles.formTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                {formMode === 'create' ? 'Create New User' : 'Edit User'}
              </Text>
              <TouchableOpacity onPress={() => setFormVisible(false)}>
                <Ionicons
                  name="close"
                  size={24}
                  color={isDarkMode ? '#E5E7EB' : '#4B5563'}
                />
              </TouchableOpacity>
            </View>
            
            <View style={styles.formFields}>
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                  Name
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { 
                      backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                      color: isDarkMode ? '#E5E7EB' : '#1F2937',
                      borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                    }
                  ]}
                  placeholder="Enter name"
                  placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  autoCapitalize="words"
                />
              </View>
              
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                  Email
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { 
                      backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                      color: isDarkMode ? '#E5E7EB' : '#1F2937',
                      borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                    }
                  ]}
                  placeholder="Enter email"
                  placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                  Password {formMode === 'edit' && '(leave blank to keep current password)'}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { 
                      backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                      color: isDarkMode ? '#E5E7EB' : '#1F2937',
                      borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                    }
                  ]}
                  placeholder="Enter password"
                  placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
                  value={formData.password}
                  onChangeText={(text) => setFormData({ ...formData, password: text })}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
              
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                  Role
                </Text>
                <View style={styles.roleSelector}>
                  <Text style={[styles.roleSelectorText, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                    Admin
                  </Text>
                  <Switch
                    value={formData.role === 'admin'}
                    onValueChange={(value) => {
                      setFormData({ ...formData, role: value ? 'admin' : 'operator' });
                    }}
                    trackColor={{ 
                      false: isDarkMode ? '#4B5563' : '#D1D5DB', 
                      true: isDarkMode ? '#4F46E5' : '#6366F1' 
                    }}
                    thumbColor={isDarkMode ? '#E5E7EB' : '#FFFFFF'}
                  />
                </View>
              </View>
            </View>
            
            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }]}
                onPress={() => setFormVisible(false)}
              >
                <Text style={[styles.cancelButtonText, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.saveButton, { 
                  backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB',
                  opacity: (createUserMutation.isPending || updateUserMutation.isPending) ? 0.7 : 1,
                }]}
                onPress={handleSubmit}
                disabled={createUserMutation.isPending || updateUserMutation.isPending}
              >
                {(createUserMutation.isPending || updateUserMutation.isPending) ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {formMode === 'create' ? 'Create' : 'Update'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
    marginLeft: 4,
  },
  listContainer: {
    padding: 16,
  },
  userCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 14,
    marginTop: 2,
  },
  userDetails: {
    flexDirection: 'row',
    marginTop: 8,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  roleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  userActions: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 16,
  },
  formContainer: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
    maxWidth: 500,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  formFields: {
    marginBottom: 16,
  },
  formField: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  roleSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    paddingHorizontal: 12,
  },
  roleSelectorText: {
    fontSize: 16,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginRight: 12,
  },
  cancelButtonText: {
    fontWeight: '500',
  },
  saveButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
}); 