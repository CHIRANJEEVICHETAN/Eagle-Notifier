import { useTheme } from "../context/ThemeContext";
import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, RefreshControl, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSuperAdminUsers, SuperAdminUser, UserForm } from "../hooks/useSuperAdminUsers";
import { useOrganizations, Organization } from "../hooks/useOrganizations";
import { useAuth } from "../context/AuthContext";

const SuperAdminUserManagement: React.FC = () => {
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
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'add' | 'edit'>('add');
  const [selectedUser, setSelectedUser] = useState<SuperAdminUser | null>(null);
  const [form, setForm] = useState<UserForm>({ name: '', email: '', password: '', role: 'OPERATOR', organizationId: '' });
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Loading states
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal state for delete confirmation and success
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<SuperAdminUser | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ 
    type: 'create' | 'update' | 'delete'; 
    name: string; 
    email: string; 
    role?: string;
    organization?: string;
  } | null>(null);

  const openAddModal = () => {
    setModalType('add');
    setForm({ name: '', email: '', password: '', role: 'OPERATOR', organizationId: selectedOrgId || (organizations[0]?.id ?? '') });
    setShowModal(true);
    setSelectedUser(null);
  };

  const openEditModal = (user: SuperAdminUser) => {
    setModalType('edit');
    setForm({ name: user.name, email: user.email, role: user.role, organizationId: user.organizationId });
    setShowModal(true);
    setSelectedUser(user);
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
      } catch (error) {
        console.error('Error deleting user:', error);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.role || !form.organizationId) return;
    
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
        await updateUser(selectedUser.id, form);
        setSuccessInfo({ 
          type: 'update', 
          name: form.name, 
          email: form.email, 
          role: form.role,
          organization: organizations.find(o => o.id === form.organizationId)?.name
        });
      }
      setShowModal(false);
      setShowSuccessModal(true);
      refetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
    } finally {
      setIsCreating(false);
      setIsUpdating(false);
    }
  };

  // Handler for pull-to-refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchUsers();
    setIsRefreshing(false);
  };

  const getSuccessModalContent = () => {
    if (!successInfo) return null;
    
    const { type, name, email, role, organization } = successInfo;
    
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
            { label: 'Organization', value: organization }
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold' }}>Users</Text>
        <TouchableOpacity onPress={openAddModal} style={{ backgroundColor: isDarkMode ? '#2563eb' : '#3b82f6', borderRadius: 8, padding: 8 }}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontWeight: '600', marginBottom: 4 }}>Filter by Organization:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
          <TouchableOpacity onPress={() => setSelectedOrgId(undefined)} style={{ marginRight: 8, padding: 8, borderRadius: 8, backgroundColor: !selectedOrgId ? (isDarkMode ? '#2563eb' : '#3b82f6') : '#e5e7eb' }}>
            <Text style={{ color: !selectedOrgId ? '#fff' : '#111827' }}>All</Text>
          </TouchableOpacity>
          {organizations.map(org => (
            <TouchableOpacity key={org.id} onPress={() => setSelectedOrgId(org.id)} style={{ marginRight: 8, padding: 8, borderRadius: 8, backgroundColor: selectedOrgId === org.id ? (isDarkMode ? '#2563eb' : '#3b82f6') : '#e5e7eb' }}>
              <Text style={{ color: selectedOrgId === org.id ? '#fff' : '#111827' }}>{org.name}</Text>
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
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
            <ActivityIndicator size="large" color={isDarkMode ? '#22d3ee' : '#2563eb'} />
            <Text style={{ marginTop: 12, color: isDarkMode ? '#cbd5e1' : '#64748b' }}>Loading users...</Text>
          </View>
        ) : users.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
            <Ionicons name="people-outline" size={48} color={isDarkMode ? '#64748b' : '#94a3b8'} />
            <Text style={{ marginTop: 12, color: isDarkMode ? '#cbd5e1' : '#64748b' }}>No users found.</Text>
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
              <View key={user.id} style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f3f4f6', borderRadius: 10, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '600' }}>{user.name}</Text>
                  <Text style={{ fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#64748b' }}>{user.email}</Text>
                  <Text style={{ fontSize: 12, color: isDarkMode ? '#fbbf24' : '#2563eb' }}>Role: {user.role}</Text>
                  <Text style={{ fontSize: 12, color: isDarkMode ? '#a3e635' : '#0ea5e9' }}>Org: {organizations.find(o => o.id === user.organizationId)?.name || user.organizationId}</Text>
                </View>
                {!isCurrentSuperAdmin && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => openEditModal(user)} style={{ marginRight: 8 }}>
                      <Ionicons name="create-outline" size={22} color={isDarkMode ? '#fbbf24' : '#f59e42'} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openDeleteModal(user)}>
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
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: isDarkMode ? '#fff' : '#111827' }}>{modalType === 'add' ? 'Add User' : 'Edit User'}</Text>
            <TextInput
              placeholder="Name"
              value={form.name}
              onChangeText={name => setForm(f => ({ ...f, name }))}
              style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 8, marginBottom: 10, backgroundColor: isDarkMode ? '#334155' : '#f9fafb', color: isDarkMode ? '#fff' : '#111827' }}
              placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
            />
            <TextInput
              placeholder="Email"
              value={form.email}
              onChangeText={email => setForm(f => ({ ...f, email }))}
              style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 8, marginBottom: 10, backgroundColor: isDarkMode ? '#334155' : '#f9fafb', color: isDarkMode ? '#fff' : '#111827' }}
              placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {modalType === 'add' && (
              <TextInput
                placeholder="Password"
                value={form.password}
                onChangeText={password => setForm(f => ({ ...f, password }))}
                style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 8, marginBottom: 10, backgroundColor: isDarkMode ? '#334155' : '#f9fafb', color: isDarkMode ? '#fff' : '#111827' }}
                placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
                secureTextEntry
              />
            )}
            <View style={{ marginBottom: 10 }}>
              <Text style={{ fontWeight: '600', marginBottom: 4, color: isDarkMode ? '#fff' : '#111827' }}>Role:</Text>
              <View style={{ flexDirection: 'row' }}>
                {['ADMIN', 'OPERATOR'].map(role => (
                  <TouchableOpacity key={role} onPress={() => setForm(f => ({ ...f, role: role as 'ADMIN' | 'OPERATOR' }))} style={{ marginRight: 8, padding: 8, borderRadius: 8, backgroundColor: form.role === role ? (isDarkMode ? '#2563eb' : '#3b82f6') : '#e5e7eb' }}>
                    <Text style={{ color: form.role === role ? '#fff' : '#111827' }}>{role}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={{ marginBottom: 10 }}>
              <Text style={{ fontWeight: '600', marginBottom: 4, color: isDarkMode ? '#fff' : '#111827' }}>Organization:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                {organizations.map(org => (
                  <TouchableOpacity key={org.id} onPress={() => setForm(f => ({ ...f, organizationId: org.id }))} style={{ marginRight: 8, padding: 8, borderRadius: 8, backgroundColor: form.organizationId === org.id ? (isDarkMode ? '#2563eb' : '#3b82f6') : '#e5e7eb' }}>
                    <Text style={{ color: form.organizationId === org.id ? '#fff' : '#111827' }}>{org.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity 
                onPress={() => setShowModal(false)} 
                style={{ padding: 8, borderRadius: 8, backgroundColor: '#e5e7eb', marginRight: 8 }}
                disabled={isCreating || isUpdating}
              >
                <Text style={{ color: '#111827' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleSubmit} 
                style={{ 
                  padding: 8, 
                  borderRadius: 8, 
                  backgroundColor: (isCreating || isUpdating) ? '#9ca3af' : (isDarkMode ? '#2563eb' : '#3b82f6'),
                  flexDirection: 'row',
                  alignItems: 'center',
                  minWidth: 60,
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
                style={{ padding: 8, borderRadius: 8, backgroundColor: '#e5e7eb', marginRight: 8 }}
                disabled={isDeleting}
              >
                <Text style={{ color: '#111827' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={confirmDelete} 
                style={{ 
                  padding: 8, 
                  borderRadius: 8, 
                  backgroundColor: isDeleting ? '#fca5a5' : '#ef4444',
                  flexDirection: 'row',
                  alignItems: 'center',
                  minWidth: 70,
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