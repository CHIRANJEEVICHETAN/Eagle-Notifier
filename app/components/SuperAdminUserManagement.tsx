import { useTheme } from "../context/ThemeContext";
import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, RefreshControl, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSuperAdminUsers, SuperAdminUser, UserForm } from "../hooks/useSuperAdminUsers";
import { useOrganizations, Organization } from "../hooks/useOrganizations";
import { useAuth } from "../context/AuthContext";

interface SuperAdminUserManagementProps {
  showAddModal?: boolean;
  setShowAddModal?: (show: boolean) => void;
}

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  organizationId?: string;
}

const SuperAdminUserManagement: React.FC<SuperAdminUserManagementProps> = ({ 
  showAddModal: externalShowAddModal, 
  setShowAddModal: externalSetShowAddModal 
}) => {
  const { isDarkMode } = useTheme();
  const { organizations } = useOrganizations();
  const { authState } = useAuth();
  const currentUserId = authState.user?.id;
  const currentUserEmail = authState.user?.email;
  const currentUserRole = authState.user?.role;
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>(undefined);
  const {
    users,
    isLoading,
    createUser,
    updateUser,
    deleteUser,
    refetchUsers
  } = useSuperAdminUsers(selectedOrgId);
  
  // Use external modal state if provided, otherwise use internal state
  const [internalShowModal, setInternalShowModal] = useState(false);
  const [modalType, setModalType] = useState<'add' | 'edit'>('add');
  const [selectedUser, setSelectedUser] = useState<SuperAdminUser | null>(null);
  
  // For edit mode, always use internal state to avoid conflicts with external add modal
  const showModal = modalType === 'edit' ? internalShowModal : (externalShowAddModal !== undefined ? externalShowAddModal : internalShowModal);
  const setShowModal = modalType === 'edit' ? setInternalShowModal : (externalSetShowAddModal || setInternalShowModal);
  const [form, setForm] = useState<UserForm>({ name: '', email: '', password: '', role: 'OPERATOR', organizationId: '' });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Loading states
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Modal state for delete confirmation and success
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<SuperAdminUser | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successInfo, setSuccessInfo] = useState<{ 
    type: 'create' | 'update' | 'delete'; 
    name: string; 
    email: string; 
    role?: string;
    organization?: string;
    passwordUpdated?: boolean;
  } | null>(null);

  // Validation functions
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): boolean => {
    return password.length >= 6;
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    // Name validation
    if (!form.name.trim()) {
      errors.name = 'Name is required';
    } else if (form.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters long';
    } else if (form.name.trim().length > 50) {
      errors.name = 'Name must be less than 50 characters';
    }

    // Email validation
    if (!form.email.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(form.email.trim())) {
      errors.email = 'Please enter a valid email address';
    } else if (form.email.trim().length > 100) {
      errors.email = 'Email must be less than 100 characters';
    } else {
      // Check for existing email in the same organization (only for add mode)
      if (modalType === 'add') {
        const existingUser = users.find(user => 
          user.email.toLowerCase() === form.email.trim().toLowerCase() && 
          user.organizationId === form.organizationId
        );
        if (existingUser) {
          errors.email = 'A user with this email already exists in the selected organization';
        }
      } else if (modalType === 'edit' && selectedUser) {
        // For edit mode, check if email exists in other users (excluding current user)
        const existingUser = users.find(user => 
          user.email.toLowerCase() === form.email.trim().toLowerCase() && 
          user.organizationId === form.organizationId &&
          user.id !== selectedUser.id
        );
        if (existingUser) {
          errors.email = 'A user with this email already exists in the selected organization';
        }
      }
    }

    // Password validation
    if (modalType === 'add') {
      // Password is required for new users
      if (!form.password) {
        errors.password = 'Password is required';
      } else if (!validatePassword(form.password)) {
        errors.password = 'Password must be at least 6 characters long';
      } else if (form.password.length > 50) {
        errors.password = 'Password must be less than 50 characters';
      }
    } else if (modalType === 'edit' && form.password) {
      // Password is optional for edit mode, but if provided, validate it
      if (!validatePassword(form.password)) {
        errors.password = 'Password must be at least 6 characters long';
      } else if (form.password.length > 50) {
        errors.password = 'Password must be less than 50 characters';
      }
    }

    // Role validation
    if (!form.role) {
      errors.role = 'Role is required';
    } else if (!['ADMIN', 'OPERATOR'].includes(form.role)) {
      errors.role = 'Please select a valid role';
    }

    // Organization validation
    if (!form.organizationId) {
      errors.organizationId = 'Organization is required';
    } else if (!organizations.find(org => org.id === form.organizationId)) {
      errors.organizationId = 'Please select a valid organization';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Clear form errors when form changes
  const clearFormErrors = () => {
    setFormErrors({});
  };

  // Real-time email validation
  const validateEmailInRealTime = (email: string) => {
    if (!email.trim()) {
      setFormErrors(prev => ({ ...prev, email: undefined }));
      return;
    }

    if (!validateEmail(email.trim())) {
      setFormErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
      return;
    }

    if (email.trim().length > 100) {
      setFormErrors(prev => ({ ...prev, email: 'Email must be less than 100 characters' }));
      return;
    }

    // Check for existing email in the same organization
    if (modalType === 'add') {
      const existingUser = users.find(user => 
        user.email.toLowerCase() === email.trim().toLowerCase() && 
        user.organizationId === form.organizationId
      );
      if (existingUser) {
        setFormErrors(prev => ({ ...prev, email: 'This email already exists in the selected organization' }));
        return;
      }
    } else if (modalType === 'edit' && selectedUser) {
      const existingUser = users.find(user => 
        user.email.toLowerCase() === email.trim().toLowerCase() && 
        user.organizationId === form.organizationId &&
        user.id !== selectedUser.id
      );
      if (existingUser) {
        setFormErrors(prev => ({ ...prev, email: 'This email already exists in the selected organization' }));
        return;
      }
    }

    // Clear email error if all validations pass
    setFormErrors(prev => ({ ...prev, email: undefined }));
  };

  // Handle external modal state changes
  useEffect(() => {
    if (externalShowAddModal) {
      setModalType('add');
      setForm({ name: '', email: '', password: '', role: 'OPERATOR', organizationId: selectedOrgId || (organizations[0]?.id ?? '') });
      setSelectedUser(null);
      clearFormErrors();
      setShowPassword(false); // Reset password visibility
    }
  }, [externalShowAddModal, selectedOrgId, organizations]);



  const openAddModal = () => {
    setModalType('add');
    setForm({ name: '', email: '', password: '', role: 'OPERATOR', organizationId: selectedOrgId || (organizations[0]?.id ?? '') });
    setInternalShowModal(true);
    setSelectedUser(null);
    clearFormErrors();
  };

  const openEditModal = (user: SuperAdminUser) => {
    setModalType('edit');
    setForm({ name: user.name, email: user.email, password: '', role: user.role, organizationId: user.organizationId });
    setInternalShowModal(true);
    setSelectedUser(user);
    clearFormErrors();
    setShowPassword(false); // Reset password visibility for edit mode
  };

  // Open delete confirmation modal
  const openDeleteModal = (user: SuperAdminUser) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (userToDelete) {
      setIsDeleting(true);
      try {
        await deleteUser(userToDelete.id);
        setShowDeleteModal(false);
        setSuccessInfo({ 
          type: 'delete', 
          name: userToDelete.name, 
          email: userToDelete.email 
        });
        setShowSuccessModal(true);
        setUserToDelete(null);
        refetchUsers();
      } catch (error: any) {
        console.error('Error deleting user:', error);
        
        // Extract error message from Axios response or direct error
        const errorMessage = error?.response?.data?.message || error?.message || '';
        const errorMsg = errorMessage || 'Failed to delete user. Please try again.';
        
        setErrorMessage(errorMsg);
        setShowErrorModal(true);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleSubmit = async () => {
    // Clear previous errors
    clearFormErrors();
    
    // Validate form
    if (!validateForm()) {
      return;
    }

    try {
      if (modalType === 'add') {
        setIsCreating(true);
        await createUser(form);
        setSuccessInfo({ 
          type: 'create', 
          name: form.name, 
          email: form.email, 
          role: form.role,
          organization: organizations.find(o => o.id === form.organizationId)?.name
        });
      } else if (modalType === 'edit' && selectedUser) {
        setIsUpdating(true);
        
        // For edit mode, only include password if it's provided
        const updateData = {
          name: form.name,
          email: form.email,
          role: form.role,
          organizationId: form.organizationId,
          ...(form.password && { password: form.password }) // Only include password if provided
        };
        
        await updateUser(selectedUser.id, updateData);
        setSuccessInfo({ 
          type: 'update', 
          name: form.name, 
          email: form.email, 
          role: form.role,
          organization: organizations.find(o => o.id === form.organizationId)?.name,
          passwordUpdated: !!form.password
        });
      }
      setShowModal(false);
      setShowSuccessModal(true);
      refetchUsers();
    } catch (error: any) {
      console.error('Error saving user:', error);
      console.error('Error response data:', error?.response?.data);
      console.error('Error message:', error?.message);
      
      // Handle specific error cases
      let errorMsg = 'Failed to save user. Please try again.';
      
      // Extract error message from Axios response or direct error
      const errorMessage = error?.response?.data?.message || error?.message || '';
      
      if (errorMessage) {
        if (errorMessage.toLowerCase().includes('email already exists') || 
            errorMessage.toLowerCase().includes('user with this email already exists') ||
            errorMessage.toLowerCase().includes('unique constraint failed') ||
            errorMessage.toLowerCase().includes('duplicate entry') ||
            errorMessage.toLowerCase().includes('unique constraint failed on the fields: (`email`)')) {
          errorMsg = 'User already exists. Please use another email ID.';
        } else if (errorMessage.toLowerCase().includes('validation')) {
          errorMsg = 'Please check your input and try again.';
        } else if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('fetch')) {
          errorMsg = 'Network error. Please check your connection and try again.';
        } else if (errorMessage.toLowerCase().includes('unauthorized') || errorMessage.toLowerCase().includes('401')) {
          errorMsg = 'Session expired. Please log in again.';
        } else if (errorMessage.toLowerCase().includes('forbidden') || errorMessage.toLowerCase().includes('403')) {
          errorMsg = 'You do not have permission to perform this action.';
        } else if (errorMessage.toLowerCase().includes('not found') || errorMessage.toLowerCase().includes('404')) {
          errorMsg = 'The requested resource was not found.';
        } else if (errorMessage.toLowerCase().includes('server error') || errorMessage.toLowerCase().includes('500')) {
          errorMsg = 'Server error. Please try again later.';
        } else {
          // Use the actual error message from the server if it's user-friendly
          errorMsg = errorMessage;
        }
      }
      
      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    } finally {
      setIsCreating(false);
      setIsUpdating(false);
    }
  };

  // Handler for pull-to-refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetchUsers();
    } catch (error: any) {
      console.error('Error refreshing users:', error);
      
      // Extract error message from Axios response or direct error
      const errorMessage = error?.response?.data?.message || error?.message || '';
      const errorMsg = errorMessage || 'Failed to refresh users. Please try again.';
      
      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getSuccessModalContent = () => {
    if (!successInfo) return null;
    
    const { type, name, email, role, organization, passwordUpdated } = successInfo;
    
    switch (type) {
      case 'create':
        return {
          title: 'User Created Successfully',
          icon: 'person-add',
          iconColor: isDarkMode ? '#22d3ee' : '#22c55e',
          message: `User ${name} (${email}) has been created successfully.`,
          details: [
            { label: 'Name', value: name },
            { label: 'Email', value: email },
            { label: 'Role', value: role },
            { label: 'Organization', value: organization }
          ]
        };
      case 'update':
        return {
          title: 'User Updated Successfully',
          icon: 'checkmark-circle',
          iconColor: isDarkMode ? '#fbbf24' : '#f59e0b',
          message: `User ${name} (${email}) has been updated successfully.`,
          details: [
            { label: 'Name', value: name },
            { label: 'Email', value: email },
            { label: 'Role', value: role },
            { label: 'Organization', value: organization },
            { label: 'Password', value: passwordUpdated ? 'Updated' : 'Unchanged' }
          ]
        };
      case 'delete':
        return {
          title: 'User Deleted Successfully',
          icon: 'trash',
          iconColor: isDarkMode ? '#f87171' : '#ef4444',
          message: `User ${name} (${email}) has been deleted successfully.`,
          details: [
            { label: 'Deleted User', value: name },
            { label: 'Email', value: email }
          ]
        };
    }
  };

  const successContent = getSuccessModalContent();

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {/* Organization Filter Section - Moved to top */}
      <View style={{ 
        marginBottom: 20, 
        paddingBottom: 16, 
        borderBottomWidth: 1, 
        borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' 
      }}>
        <Text style={{ 
          fontSize: 16, 
          fontWeight: '600', 
          marginBottom: 12, 
          letterSpacing: 0.3,
          color: isDarkMode ? '#F8FAFC' : '#1E293B'
        }}>Filter by Organization</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', paddingBottom: 4 }}>
          <TouchableOpacity 
            onPress={() => setSelectedOrgId(undefined)} 
            style={{ 
              marginRight: 12, 
              paddingHorizontal: 16, 
              paddingVertical: 10, 
              borderRadius: 12, 
              minWidth: 120,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: !selectedOrgId ? (isDarkMode ? '#2563eb' : '#3b82f6') : (isDarkMode ? '#334155' : '#e5e7eb'),
              borderColor: !selectedOrgId ? (isDarkMode ? '#60A5FA' : '#2563EB') : 'transparent',
              borderWidth: !selectedOrgId ? 2 : 0,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2,
            }}>
            <Ionicons 
              name="people" 
              size={16} 
              color={!selectedOrgId ? '#fff' : (isDarkMode ? '#F8FAFC' : '#111827')} 
              style={{ marginRight: 6 }}
            />
            <Text style={{ 
              color: !selectedOrgId ? '#fff' : (isDarkMode ? '#F8FAFC' : '#111827'),
              fontWeight: !selectedOrgId ? '600' : '500'
            }}>All Organizations</Text>
          </TouchableOpacity>
          {organizations.map(org => (
            <TouchableOpacity 
              key={org.id} 
              onPress={() => setSelectedOrgId(org.id)} 
              style={{ 
                marginRight: 12, 
                paddingHorizontal: 16, 
                paddingVertical: 10, 
                borderRadius: 12, 
                minWidth: 120,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selectedOrgId === org.id ? (isDarkMode ? '#2563eb' : '#3b82f6') : (isDarkMode ? '#334155' : '#e5e7eb'),
                borderColor: selectedOrgId === org.id ? (isDarkMode ? '#60A5FA' : '#2563EB') : 'transparent',
                borderWidth: selectedOrgId === org.id ? 2 : 0,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 2,
              }}>
              <Ionicons 
                name="business" 
                size={16} 
                color={selectedOrgId === org.id ? '#fff' : (isDarkMode ? '#F8FAFC' : '#111827')} 
                style={{ marginRight: 6 }}
              />
              <Text style={{ 
                color: selectedOrgId === org.id ? '#fff' : (isDarkMode ? '#F8FAFC' : '#111827'),
                fontWeight: selectedOrgId === org.id ? '600' : '500'
              }}>{org.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40, minHeight: 300 }}>
            <Ionicons name="hourglass-outline" size={48} color={isDarkMode ? '#60A5FA' : '#2563EB'} />
            <Text style={{ 
              marginTop: 12, 
              color: isDarkMode ? '#F8FAFC' : '#1E293B',
              fontSize: 16,
              fontWeight: '500'
            }}>Loading users...</Text>
          </View>
        ) : users.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40, minHeight: 300 }}>
            <Ionicons name="people-outline" size={48} color={isDarkMode ? '#94A3B8' : '#64748B'} />
            <Text style={{ 
              marginTop: 12, 
              color: isDarkMode ? '#F8FAFC' : '#1E293B',
              fontSize: 16,
              fontWeight: '500',
              textAlign: 'center'
            }}>
              {selectedOrgId ? 'No users found in this organization.' : 'No users found.'}
            </Text>
            <Text style={{ 
              marginTop: 8, 
              color: isDarkMode ? '#94A3B8' : '#64748B',
              fontSize: 14,
              textAlign: 'center',
              opacity: 0.7
            }}>
              Tap the + button to add a new user
            </Text>
          </View>
        ) : [...users]
          // TypeScript fix: allow for possible 'SUPER_ADMIN' role in sorting
          .sort((a: any, b: any) => {
            if (a.role === 'SUPER_ADMIN' && b.role !== 'SUPER_ADMIN') return -1;
            if (a.role !== 'SUPER_ADMIN' && b.role === 'SUPER_ADMIN') return 1;
            return 0;
          })
          .map((user: SuperAdminUser) => {
            // Hide edit/delete for current super_admin
            const isCurrentSuperAdmin = user.id === currentUserId && currentUserRole === 'SUPER_ADMIN';
            return (
              <View key={user.id} style={{ 
                backgroundColor: isDarkMode ? '#1e293b' : '#f3f4f6', 
                borderRadius: 12, 
                padding: 16, 
                marginBottom: 12, 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ 
                    fontSize: 18, 
                    fontWeight: '600',
                    color: isDarkMode ? '#F8FAFC' : '#1E293B',
                    marginBottom: 4
                  }}>{user.name}</Text>
                  <Text style={{ 
                    fontSize: 12, 
                    color: isDarkMode ? '#cbd5e1' : '#64748b',
                    marginBottom: 2
                  }}>{user.email}</Text>
                  <Text style={{ 
                    fontSize: 12, 
                    color: isDarkMode ? '#fbbf24' : '#2563eb',
                    marginBottom: 2
                  }}>Role: {user.role}</Text>
                  <Text style={{ 
                    fontSize: 12, 
                    color: isDarkMode ? '#a3e635' : '#0ea5e9'
                  }}>Org: {organizations.find(o => o.id === user.organizationId)?.name || user.organizationId}</Text>
                </View>
                {!isCurrentSuperAdmin && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => openEditModal(user)} style={{ 
                      padding: 8, 
                      borderRadius: 8, 
                      backgroundColor: 'rgba(0,0,0,0.05)' 
                    }}>
                      <Ionicons name="create-outline" size={22} color={isDarkMode ? '#fbbf24' : '#f59e42'} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openDeleteModal(user)} style={{ 
                      padding: 8, 
                      borderRadius: 8, 
                      backgroundColor: 'rgba(0,0,0,0.05)' 
                    }}>
                      <Ionicons name="trash-outline" size={22} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
      </ScrollView>

      {/* Add/Edit User Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: 12, padding: 20, width: '90%' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: isDarkMode ? '#fff' : '#111827' }}>
              {modalType === 'add' ? 'Add User' : 'Edit User'}
            </Text>
            
            {/* Name Input */}
            <View style={{ marginBottom: 12 }}>
              <TextInput
                placeholder="Name"
                value={form.name}
                onChangeText={name => {
                  setForm(f => ({ ...f, name }));
                  if (formErrors.name) clearFormErrors();
                }}
                style={{ 
                  borderWidth: 1, 
                  borderColor: formErrors.name ? '#ef4444' : '#e5e7eb', 
                  borderRadius: 8, 
                  padding: 12, 
                  backgroundColor: isDarkMode ? '#334155' : '#f9fafb', 
                  color: isDarkMode ? '#fff' : '#111827',
                  fontSize: 16
                }}
                placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
              />
              {formErrors.name && (
                <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{formErrors.name}</Text>
              )}
            </View>

            {/* Email Input */}
            <View style={{ marginBottom: 12 }}>
              <TextInput
                placeholder="Email"
                value={form.email}
                onChangeText={email => {
                  setForm(f => ({ ...f, email }));
                  validateEmailInRealTime(email);
                }}
                style={{ 
                  borderWidth: 1, 
                  borderColor: formErrors.email ? '#ef4444' : '#e5e7eb', 
                  borderRadius: 8, 
                  padding: 12, 
                  backgroundColor: isDarkMode ? '#334155' : '#f9fafb', 
                  color: isDarkMode ? '#fff' : '#111827',
                  fontSize: 16
                }}
                placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              {formErrors.email && (
                <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{formErrors.email}</Text>
              )}
            </View>

            {/* Password Input */}
            <View style={{ marginBottom: 12 }}>
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center',
                borderWidth: 1, 
                borderColor: formErrors.password ? '#ef4444' : '#e5e7eb', 
                borderRadius: 8, 
                backgroundColor: isDarkMode ? '#334155' : '#f9fafb'
              }}>
                <TextInput
                  placeholder={modalType === 'add' ? "Password" : "Password (optional)"}
                  value={form.password}
                  onChangeText={password => {
                    setForm(f => ({ ...f, password }));
                    if (formErrors.password) clearFormErrors();
                  }}
                  style={{ 
                    flex: 1,
                    padding: 12, 
                    color: isDarkMode ? '#fff' : '#111827',
                    fontSize: 16
                  }}
                  placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity 
                  onPress={() => setShowPassword(!showPassword)}
                  style={{ 
                    padding: 12,
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}
                >
                  <Ionicons 
                    name={showPassword ? "eye-off" : "eye"} 
                    size={20} 
                    color={isDarkMode ? '#94a3b8' : '#64748b'} 
                  />
                </TouchableOpacity>
              </View>
              {formErrors.password && (
                <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{formErrors.password}</Text>
              )}
            </View>

            {/* Role Selection */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontWeight: '600', marginBottom: 8, color: isDarkMode ? '#fff' : '#111827' }}>Role:</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['ADMIN', 'OPERATOR'].map(role => (
                  <TouchableOpacity 
                    key={role} 
                    onPress={() => {
                      setForm(f => ({ ...f, role: role as 'ADMIN' | 'OPERATOR' }));
                      if (formErrors.role) clearFormErrors();
                    }} 
                    style={{ 
                      padding: 8, 
                      borderRadius: 8, 
                      backgroundColor: form.role === role ? (isDarkMode ? '#2563eb' : '#3b82f6') : (isDarkMode ? '#334155' : '#e5e7eb'),
                      borderWidth: formErrors.role ? 1 : 0,
                      borderColor: formErrors.role ? '#ef4444' : 'transparent'
                    }}>
                    <Text style={{ color: form.role === role ? '#fff' : (isDarkMode ? '#F8FAFC' : '#111827') }}>{role}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {formErrors.role && (
                <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{formErrors.role}</Text>
              )}
            </View>

            {/* Organization Selection */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontWeight: '600', marginBottom: 8, color: isDarkMode ? '#fff' : '#111827' }}>Organization:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                {organizations.map(org => (
                  <TouchableOpacity 
                    key={org.id} 
                    onPress={() => {
                      setForm(f => ({ ...f, organizationId: org.id }));
                      if (formErrors.organizationId) clearFormErrors();
                      // Re-validate email when organization changes
                      if (form.email) {
                        validateEmailInRealTime(form.email);
                      }
                    }} 
                    style={{ 
                      marginRight: 8, 
                      padding: 8, 
                      borderRadius: 8, 
                      backgroundColor: form.organizationId === org.id ? (isDarkMode ? '#2563eb' : '#3b82f6') : (isDarkMode ? '#334155' : '#e5e7eb'),
                      borderWidth: formErrors.organizationId ? 1 : 0,
                      borderColor: formErrors.organizationId ? '#ef4444' : 'transparent'
                    }}>
                    <Text style={{ color: form.organizationId === org.id ? '#fff' : (isDarkMode ? '#F8FAFC' : '#111827') }}>{org.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {formErrors.organizationId && (
                <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{formErrors.organizationId}</Text>
              )}
            </View>

            {/* Modal Actions */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity 
                onPress={() => setShowModal(false)} 
                style={{ padding: 12, borderRadius: 8, backgroundColor: '#e5e7eb', marginRight: 8 }}
                disabled={isCreating || isUpdating}
              >
                <Text style={{ color: '#111827' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleSubmit} 
                style={{ 
                  padding: 12, 
                  borderRadius: 8, 
                  backgroundColor: (isCreating || isUpdating) ? '#9ca3af' : (isDarkMode ? '#2563eb' : '#3b82f6'),
                  flexDirection: 'row',
                  alignItems: 'center',
                  minWidth: 80,
                  justifyContent: 'center'
                }}
                disabled={isCreating || isUpdating}
              >
                {(isCreating || isUpdating) && (
                  <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />
                )}
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                  {isCreating ? 'Creating...' : isUpdating ? 'Saving...' : (modalType === 'add' ? 'Add' : 'Save')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={showDeleteModal} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: 12, padding: 24, width: '85%' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: isDarkMode ? '#fff' : '#111827' }}>Confirm Delete</Text>
            <Text style={{ marginBottom: 20, color: isDarkMode ? '#cbd5e1' : '#334155' }}>
              Are you sure you want to delete user
              <Text style={{ fontWeight: 'bold', color: isDarkMode ? '#f87171' : '#dc2626' }}> {userToDelete?.email} </Text>?
              This action cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity 
                onPress={() => setShowDeleteModal(false)} 
                style={{ padding: 12, borderRadius: 8, backgroundColor: '#e5e7eb', marginRight: 8 }}
                disabled={isDeleting}
              >
                <Text style={{ color: '#111827' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={confirmDelete} 
                style={{ 
                  padding: 12, 
                  borderRadius: 8, 
                  backgroundColor: isDeleting ? '#fca5a5' : '#ef4444',
                  flexDirection: 'row',
                  alignItems: 'center',
                  minWidth: 80,
                  justifyContent: 'center'
                }}
                disabled={isDeleting}
              >
                {isDeleting && (
                  <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />
                )}
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal visible={showErrorModal} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ 
            backgroundColor: isDarkMode ? '#1e293b' : '#fff', 
            borderRadius: 16, 
            padding: 24, 
            width: '90%', 
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8
          }}>
            <View style={{ 
              width: 80, 
              height: 80, 
              borderRadius: 40, 
              backgroundColor: isDarkMode ? '#334155' : '#fef2f2',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16
            }}>
              <Ionicons name="alert-circle" size={40} color="#ef4444" />
            </View>
            <Text style={{ 
              fontSize: 20, 
              fontWeight: 'bold', 
              marginBottom: 12, 
              color: isDarkMode ? '#fff' : '#111827',
              textAlign: 'center'
            }}>
              Error
            </Text>
            <Text style={{ 
              color: isDarkMode ? '#cbd5e1' : '#334155', 
              marginBottom: 20,
              textAlign: 'center',
              lineHeight: 20
            }}>
              {errorMessage}
            </Text>
            <TouchableOpacity 
              onPress={() => setShowErrorModal(false)} 
              style={{ 
                paddingHorizontal: 24, 
                paddingVertical: 12, 
                borderRadius: 8, 
                backgroundColor: isDarkMode ? '#2563eb' : '#3b82f6',
                minWidth: 100,
                alignItems: 'center'
              }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Enhanced Success Modal */}
      <Modal visible={showSuccessModal} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ 
            backgroundColor: isDarkMode ? '#1e293b' : '#fff', 
            borderRadius: 16, 
            padding: 24, 
            width: '90%', 
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8
          }}>
            {successContent && (
              <>
                <View style={{ 
                  width: 80, 
                  height: 80, 
                  borderRadius: 40, 
                  backgroundColor: isDarkMode ? '#334155' : '#f8fafc',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 16
                }}>
                  <Ionicons name={successContent.icon as any} size={40} color={successContent.iconColor} />
                </View>
                <Text style={{ 
                  fontSize: 20, 
                  fontWeight: 'bold', 
                  marginBottom: 12, 
                  color: isDarkMode ? '#fff' : '#111827',
                  textAlign: 'center'
                }}>
                  {successContent.title}
                </Text>
                <Text style={{ 
                  color: isDarkMode ? '#cbd5e1' : '#334155', 
                  marginBottom: 20,
                  textAlign: 'center',
                  lineHeight: 20
                }}>
                  {successContent.message}
                </Text>
                <View style={{ 
                  width: '100%', 
                  backgroundColor: isDarkMode ? '#334155' : '#f8fafc',
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 20
                }}>
                  {successContent.details.map((detail, index) => (
                    <View key={index} style={{ 
                      flexDirection: 'row', 
                      justifyContent: 'space-between', 
                      marginBottom: index < successContent.details.length - 1 ? 8 : 0 
                    }}>
                      <Text style={{ 
                        color: isDarkMode ? '#94a3b8' : '#64748b', 
                        fontWeight: '500' 
                      }}>
                        {detail.label}:
                      </Text>
                      <Text style={{ 
                        color: isDarkMode ? '#fff' : '#111827', 
                        fontWeight: '600',
                        flex: 1,
                        textAlign: 'right',
                        marginLeft: 8
                      }}>
                        {detail.value}
                      </Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity 
                  onPress={() => setShowSuccessModal(false)} 
                  style={{ 
                    paddingHorizontal: 24, 
                    paddingVertical: 12, 
                    borderRadius: 8, 
                    backgroundColor: isDarkMode ? '#2563eb' : '#3b82f6',
                    minWidth: 100,
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>OK</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default SuperAdminUserManagement; 