import { useTheme } from "../context/ThemeContext";
import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput } from "react-native";
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

  // Modal state for delete confirmation and success
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<SuperAdminUser | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [deletedUserInfo, setDeletedUserInfo] = useState<{ name: string; email: string } | null>(null);

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
      await deleteUser(userToDelete.id);
      setShowDeleteModal(false);
      setDeletedUserInfo({ name: userToDelete.name, email: userToDelete.email });
      setShowSuccessModal(true);
      setUserToDelete(null);
      refetchUsers();
    }
  };

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.role || !form.organizationId) return;
    if (modalType === 'add') {
      await createUser(form);
    } else if (modalType === 'edit' && selectedUser) {
      await updateUser(selectedUser.id, form);
    }
    setShowModal(false);
    refetchUsers();
  };

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
      <ScrollView style={{ flex: 1 }}>
        {isLoading ? (
          <Text>Loading...</Text>
        ) : users.length === 0 ? (
          <Text>No users found.</Text>
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
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>{modalType === 'add' ? 'Add User' : 'Edit User'}</Text>
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
              <Text style={{ fontWeight: '600', marginBottom: 4 }}>Role:</Text>
              <View style={{ flexDirection: 'row' }}>
                {['ADMIN', 'OPERATOR'].map(role => (
                  <TouchableOpacity key={role} onPress={() => setForm(f => ({ ...f, role: role as 'ADMIN' | 'OPERATOR' }))} style={{ marginRight: 8, padding: 8, borderRadius: 8, backgroundColor: form.role === role ? (isDarkMode ? '#2563eb' : '#3b82f6') : '#e5e7eb' }}>
                    <Text style={{ color: form.role === role ? '#fff' : '#111827' }}>{role}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={{ marginBottom: 10 }}>
              <Text style={{ fontWeight: '600', marginBottom: 4 }}>Organization:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                {organizations.map(org => (
                  <TouchableOpacity key={org.id} onPress={() => setForm(f => ({ ...f, organizationId: org.id }))} style={{ marginRight: 8, padding: 8, borderRadius: 8, backgroundColor: form.organizationId === org.id ? (isDarkMode ? '#2563eb' : '#3b82f6') : '#e5e7eb' }}>
                    <Text style={{ color: form.organizationId === org.id ? '#fff' : '#111827' }}>{org.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
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
              <TouchableOpacity onPress={() => setShowDeleteModal(false)} style={{ padding: 8, borderRadius: 8, backgroundColor: '#e5e7eb', marginRight: 8 }}>
                <Text style={{ color: '#111827' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmDelete} style={{ padding: 8, borderRadius: 8, backgroundColor: '#ef4444' }}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Success Modal */}
      <Modal visible={showSuccessModal} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', borderRadius: 12, padding: 24, width: '85%', alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={48} color={isDarkMode ? '#22d3ee' : '#22c55e'} style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: isDarkMode ? '#fff' : '#111827' }}>User Deleted</Text>
            <Text style={{ color: isDarkMode ? '#cbd5e1' : '#334155', marginBottom: 16 }}>
              User <Text style={{ fontWeight: 'bold' }}>{deletedUserInfo?.email}</Text> has been deleted successfully.
            </Text>
            <TouchableOpacity onPress={() => setShowSuccessModal(false)} style={{ padding: 10, borderRadius: 8, backgroundColor: isDarkMode ? '#2563eb' : '#3b82f6', marginTop: 8, paddingHorizontal: 20, paddingVertical: 10 }}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default SuperAdminUserManagement; 