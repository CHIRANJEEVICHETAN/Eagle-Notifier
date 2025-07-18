import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, TextInput, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useOrganizations } from '../../../hooks/useOrganizations';
import { useSuperAdminUsers } from '../../../hooks/useSuperAdminUsers';

const UserManagementPage = () => {
  const { isDarkMode } = useTheme();
  const { authState } = useAuth();
  const router = useRouter();
  const { organizations } = useOrganizations();
  const currentUserId = authState.user?.id;
  const currentUserRole = authState.user?.role;
  
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'add' | 'edit'>('add');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'OPERATOR' as 'OPERATOR' | 'ADMIN', organizationId: '' });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);

  const {
    users,
    isLoading,
    createUser,
    updateUser,
    deleteUser,
    refetchUsers
  } = useSuperAdminUsers(selectedOrgId);

  const openAddModal = () => {
    setModalType('add');
    setForm({ name: '', email: '', password: '', role: 'OPERATOR', organizationId: selectedOrgId || (organizations[0]?.id ?? '') });
    setShowModal(true);
    setSelectedUser(null);
  };

  const openEditModal = (user: any) => {
    setModalType('edit');
    setForm({ name: user.name, email: user.email, password: '', role: user.role, organizationId: user.organizationId });
    setShowModal(true);
    setSelectedUser(user);
  };

  const openDeleteModal = (user: any) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (userToDelete) {
      await deleteUser(userToDelete.id);
      setShowDeleteModal(false);
      setUserToDelete(null);
      refetchUsers();
    }
  };

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.role || !form.organizationId) return;
    
    try {
      if (modalType === 'add') {
        await createUser(form);
      } else if (modalType === 'edit' && selectedUser) {
        await updateUser(selectedUser.id, { name: form.name, email: form.email, role: form.role, organizationId: form.organizationId });
      }
      setShowModal(false);
      refetchUsers();
    } catch (error) {
      Alert.alert('Error', 'Failed to save user. Please try again.');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchUsers();
    setIsRefreshing(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}
          onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={isDarkMode ? '#60A5FA' : '#2563EB'} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: isDarkMode ? '#60A5FA' : '#2563EB' }]}>User Management</Text>
          <Text style={[styles.headerSubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Manage users across all organizations</Text>
        </View>
        <TouchableOpacity onPress={openAddModal} style={[styles.addButton, { backgroundColor: isDarkMode ? '#2563eb' : '#3b82f6' }]}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        {/* Organization Filter Section - Moved to top */}
        <View style={styles.filterSection}>
          <Text style={[styles.filterTitle, { color: isDarkMode ? '#F8FAFC' : '#1E293B' }]}>Filter by Organization</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <TouchableOpacity 
              onPress={() => setSelectedOrgId(undefined)} 
              style={[
                styles.filterButton, 
                { 
                  backgroundColor: !selectedOrgId ? (isDarkMode ? '#2563eb' : '#3b82f6') : (isDarkMode ? '#334155' : '#e5e7eb'),
                  borderColor: !selectedOrgId ? (isDarkMode ? '#60A5FA' : '#2563EB') : 'transparent',
                  borderWidth: !selectedOrgId ? 2 : 0,
                }
              ]}>
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
                style={[
                  styles.filterButton, 
                  { 
                    backgroundColor: selectedOrgId === org.id ? (isDarkMode ? '#2563eb' : '#3b82f6') : (isDarkMode ? '#334155' : '#e5e7eb'),
                    borderColor: selectedOrgId === org.id ? (isDarkMode ? '#60A5FA' : '#2563EB') : 'transparent',
                    borderWidth: selectedOrgId === org.id ? 2 : 0,
                  }
                ]}>
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
          style={styles.userList}
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
            <View style={styles.emptyContainer}>
              <Ionicons name="hourglass-outline" size={48} color={isDarkMode ? '#60A5FA' : '#2563EB'} />
              <Text style={[styles.emptyText, { color: isDarkMode ? '#F8FAFC' : '#1E293B' }]}>Loading users...</Text>
            </View>
          ) : users.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={isDarkMode ? '#94A3B8' : '#64748B'} />
              <Text style={[styles.emptyText, { color: isDarkMode ? '#F8FAFC' : '#1E293B' }]}>
                {selectedOrgId ? 'No users found in this organization.' : 'No users found.'}
              </Text>
              <Text style={[styles.emptySubtext, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                Tap the + button to add a new user
              </Text>
            </View>
          ) : (
            users.map((user: any) => {
              const isCurrentSuperAdmin = user.id === currentUserId && currentUserRole === 'SUPER_ADMIN';
              return (
                <View key={user.id} style={[styles.userCard, { backgroundColor: isDarkMode ? '#1e293b' : '#f3f4f6' }]}>
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: isDarkMode ? '#F8FAFC' : '#1E293B' }]}>{user.name}</Text>
                    <Text style={[styles.userEmail, { color: isDarkMode ? '#cbd5e1' : '#64748b' }]}>{user.email}</Text>
                    <Text style={[styles.userRole, { color: isDarkMode ? '#fbbf24' : '#2563eb' }]}>Role: {user.role}</Text>
                    <Text style={[styles.userOrg, { color: isDarkMode ? '#a3e635' : '#0ea5e9' }]}>
                      Org: {organizations.find(o => o.id === user.organizationId)?.name || user.organizationId}
                    </Text>
                  </View>
                  {!isCurrentSuperAdmin && (
                    <View style={styles.userActions}>
                      <TouchableOpacity onPress={() => openEditModal(user)} style={styles.actionButton}>
                        <Ionicons name="create-outline" size={22} color={isDarkMode ? '#fbbf24' : '#f59e42'} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => openDeleteModal(user)} style={styles.actionButton}>
                        <Ionicons name="trash-outline" size={22} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Add/Edit User Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#1e293b' : '#fff' }]}>
            <Text style={[styles.modalTitle, { color: isDarkMode ? '#F8FAFC' : '#1E293B' }]}>
              {modalType === 'add' ? 'Add User' : 'Edit User'}
            </Text>
            
            <TextInput
              placeholder="Name"
              value={form.name}
              onChangeText={name => setForm(f => ({ ...f, name }))}
              style={[styles.input, { 
                backgroundColor: isDarkMode ? '#334155' : '#f9fafb', 
                color: isDarkMode ? '#fff' : '#111827',
                borderColor: isDarkMode ? '#475569' : '#e5e7eb'
              }]}
              placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
            />
            
            <TextInput
              placeholder="Email"
              value={form.email}
              onChangeText={email => setForm(f => ({ ...f, email }))}
              style={[styles.input, { 
                backgroundColor: isDarkMode ? '#334155' : '#f9fafb', 
                color: isDarkMode ? '#fff' : '#111827',
                borderColor: isDarkMode ? '#475569' : '#e5e7eb'
              }]}
              placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            
            {modalType === 'add' && (
              <TextInput
                placeholder="Password"
                value={form.password}
                onChangeText={password => setForm(f => ({ ...f, password }))}
                style={[styles.input, { 
                  backgroundColor: isDarkMode ? '#334155' : '#f9fafb', 
                  color: isDarkMode ? '#fff' : '#111827',
                  borderColor: isDarkMode ? '#475569' : '#e5e7eb'
                }]}
                placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
                secureTextEntry
              />
            )}
            
            <View style={styles.formSection}>
              <Text style={[styles.formLabel, { color: isDarkMode ? '#F8FAFC' : '#1E293B' }]}>Role:</Text>
              <View style={styles.roleButtons}>
                {['ADMIN', 'OPERATOR'].map(role => (
                  <TouchableOpacity 
                    key={role} 
                    onPress={() => setForm(f => ({ ...f, role: role as 'OPERATOR' | 'ADMIN' }))} 
                    style={[
                      styles.roleButton, 
                      { backgroundColor: form.role === role ? (isDarkMode ? '#2563eb' : '#3b82f6') : (isDarkMode ? '#334155' : '#e5e7eb') }
                    ]}>
                    <Text style={{ color: form.role === role ? '#fff' : (isDarkMode ? '#F8FAFC' : '#111827') }}>{role}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.formSection}>
              <Text style={[styles.formLabel, { color: isDarkMode ? '#F8FAFC' : '#1E293B' }]}>Organization:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.orgButtons}>
                {organizations.map(org => (
                  <TouchableOpacity 
                    key={org.id} 
                    onPress={() => setForm(f => ({ ...f, organizationId: org.id }))} 
                    style={[
                      styles.orgButton, 
                      { backgroundColor: form.organizationId === org.id ? (isDarkMode ? '#2563eb' : '#3b82f6') : (isDarkMode ? '#334155' : '#e5e7eb') }
                    ]}>
                    <Text style={{ color: form.organizationId === org.id ? '#fff' : (isDarkMode ? '#F8FAFC' : '#111827') }}>{org.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                onPress={() => setShowModal(false)} 
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: isDarkMode ? '#334155' : '#e5e7eb' }]}>
                <Text style={{ color: isDarkMode ? '#F8FAFC' : '#1E293B' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleSubmit} 
                style={[styles.modalButton, styles.saveButton, { backgroundColor: isDarkMode ? '#2563eb' : '#3b82f6' }]}>
                <Text style={{ color: '#fff' }}>{modalType === 'add' ? 'Add' : 'Update'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={showDeleteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#1e293b' : '#fff' }]}>
            <Text style={[styles.modalTitle, { color: isDarkMode ? '#F8FAFC' : '#1E293B' }]}>Confirm Delete</Text>
            <Text style={[styles.modalDescription, { color: isDarkMode ? '#cbd5e1' : '#334155' }]}>
              Are you sure you want to delete user <Text style={{ fontWeight: 'bold' }}>{userToDelete?.email}</Text>?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity 
                onPress={() => setShowDeleteModal(false)} 
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: isDarkMode ? '#334155' : '#e5e7eb' }]}>
                <Text style={{ color: isDarkMode ? '#F8FAFC' : '#1E293B' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={confirmDelete} 
                style={[styles.modalButton, styles.deleteButton, { backgroundColor: '#ef4444' }]}>
                <Text style={{ color: '#fff' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  addButton: {
    borderRadius: 12,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  filterSection: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  filterScroll: {
    flexDirection: 'row',
    paddingBottom: 4,
  },
  filterButton: {
    marginRight: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userList: {
    flex: 1,
  },
  userCard: {
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
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 12,
    marginBottom: 2,
  },
  userRole: {
    fontSize: 12,
    marginBottom: 2,
  },
  userOrg: {
    fontSize: 12,
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 300,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  emptySubtext: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 12,
    padding: 20,
    width: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalDescription: {
    marginBottom: 20,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  formSection: {
    marginBottom: 16,
  },
  formLabel: {
    fontWeight: '600',
    marginBottom: 8,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  roleButton: {
    padding: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  orgButtons: {
    flexDirection: 'row',
  },
  orgButton: {
    marginRight: 8,
    padding: 8,
    borderRadius: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    padding: 12,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#e5e7eb',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
});

export default UserManagementPage; 