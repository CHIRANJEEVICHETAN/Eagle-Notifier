import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useMutation } from '@tanstack/react-query';

// Mock user service
const userService = {
  updateUserProfile: async (data: {
    name?: string;
    email?: string;
  }) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Updating user profile with:', data);
    return { success: true };
  },
  
  changePassword: async (data: {
    currentPassword: string;
    newPassword: string;
  }) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // In a real app, we would validate the current password
    if (data.currentPassword === 'wrongpassword') {
      throw new Error('Current password is incorrect');
    }
    
    console.log('Changing password with:', data);
    return { success: true };
  },
  
  updateNotificationSettings: async (settings: {
    pushEnabled: boolean;
    emailEnabled: boolean;
    criticalAlarmsOnly: boolean;
  }) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Updating notification settings with:', settings);
    return { success: true };
  },
};

export default function ProfileScreen() {
  const { isDarkMode, toggleTheme } = useTheme();
  const { authState, updateUser, logout } = useAuth();
  const router = useRouter();
  
  // Profile form state
  const [name, setName] = useState(authState.user?.name || '');
  const [email, setEmail] = useState(authState.user?.email || '');
  const [editingProfile, setEditingProfile] = useState(false);
  
  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordFormVisible, setPasswordFormVisible] = useState(false);
  
  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState({
    pushEnabled: true,
    emailEnabled: false,
    criticalAlarmsOnly: false,
  });
  
  // Logout modal state
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  
  // Profile update mutation
  const profileMutation = useMutation({
    mutationFn: userService.updateUserProfile,
    onSuccess: () => {
      // Update local auth state with new profile info
      updateUser({ name, email });
      setEditingProfile(false);
      Alert.alert('Success', 'Profile updated successfully');
    },
    onError: (error) => {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update profile');
    },
  });
  
  // Password change mutation
  const passwordMutation = useMutation({
    mutationFn: userService.changePassword,
    onSuccess: () => {
      setPasswordFormVisible(false);
      resetPasswordForm();
      Alert.alert('Success', 'Password changed successfully');
    },
    onError: (error) => {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to change password');
    },
  });
  
  // Notification settings mutation
  const notificationMutation = useMutation({
    mutationFn: userService.updateNotificationSettings,
    onSuccess: () => {
      Alert.alert('Success', 'Notification settings updated');
    },
    onError: (error) => {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update notification settings');
    },
  });
  
  // Handle profile save
  const handleProfileSave = useCallback(() => {
    // Validate email (basic)
    if (!email.includes('@')) {
      Alert.alert('Validation Error', 'Please enter a valid email address');
      return;
    }
    
    profileMutation.mutate({ name, email });
  }, [name, email, profileMutation]);
  
  // Handle password change
  const handlePasswordChange = useCallback(() => {
    // Validate
    if (!currentPassword) {
      Alert.alert('Validation Error', 'Current password is required');
      return;
    }
    
    if (newPassword.length < 6) {
      Alert.alert('Validation Error', 'New password must be at least 6 characters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'Passwords do not match');
      return;
    }
    
    passwordMutation.mutate({ currentPassword, newPassword });
  }, [currentPassword, newPassword, confirmPassword, passwordMutation]);
  
  // Reset password form
  const resetPasswordForm = useCallback(() => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }, []);
  
  // Handle notification setting toggle
  const handleToggleSetting = useCallback((setting: keyof typeof notificationSettings) => {
    setNotificationSettings(prev => {
      const newSettings = {
        ...prev,
        [setting]: !prev[setting],
      };
      
      // Update on server
      notificationMutation.mutate(newSettings);
      
      return newSettings;
    });
  }, [notificationMutation]);
  
  // Cancel profile editing
  const cancelProfileEdit = useCallback(() => {
    setName(authState.user?.name || '');
    setEmail(authState.user?.email || '');
    setEditingProfile(false);
  }, [authState.user]);
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={styles.header}>
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
        
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            Profile & Settings
          </Text>
          <Text style={[styles.headerSubtitle, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            Manage your account and preferences
          </Text>
        </View>
      </View>
      
      <ScrollView style={styles.content}>
        {/* User Profile Section */}
        <View style={[styles.section, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
              User Profile
            </Text>
            
            {!editingProfile ? (
              <TouchableOpacity 
                style={styles.editButton} 
                onPress={() => setEditingProfile(true)}
              >
                <Ionicons
                  name="pencil-outline"
                  size={18}
                  color={isDarkMode ? '#60A5FA' : '#2563EB'}
                />
                <Text style={[styles.editButtonText, { color: isDarkMode ? '#60A5FA' : '#2563EB' }]}>
                  Edit
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={cancelProfileEdit}
                >
                  <Text style={[styles.cancelButtonText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.saveButton, { 
                    backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB',
                    opacity: profileMutation.isPending ? 0.7 : 1,
                  }]}
                  onPress={handleProfileSave}
                  disabled={profileMutation.isPending}
                >
                  {profileMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
          
          <View style={styles.profileInfo}>
            <View style={styles.avatarContainer}>
              <View style={[styles.avatar, { backgroundColor: isDarkMode ? '#374151' : '#E5E7EB' }]}>
                <Text style={[styles.avatarText, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                  {authState.user?.name?.charAt(0) || 'U'}
                </Text>
              </View>
              <Text style={[styles.roleBadge, { 
                backgroundColor: authState.user?.role === 'admin' 
                  ? (isDarkMode ? '#4F46E5' : '#6366F1')
                  : (isDarkMode ? '#2563EB' : '#3B82F6'),
              }]}>
                {authState.user?.role === 'admin' ? 'Admin' : 'Operator'}
              </Text>
            </View>
            
            <View style={styles.profileFields}>
              {editingProfile ? (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                      Name
                    </Text>
                    <TextInput
                      style={[styles.input, { 
                        backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                        color: isDarkMode ? '#FFFFFF' : '#1F2937',
                        borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                      }]}
                      value={name}
                      onChangeText={setName}
                      placeholder="Your name"
                      placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                    />
                  </View>
                  
                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                      Email
                    </Text>
                    <TextInput
                      style={[styles.input, { 
                        backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                        color: isDarkMode ? '#FFFFFF' : '#1F2937',
                        borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                      }]}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="Your email"
                      placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.profileField}>
                    <Text style={[styles.fieldLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                      Name
                    </Text>
                    <Text style={[styles.fieldValue, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                      {authState.user?.name || 'Not set'}
                    </Text>
                  </View>
                  
                  <View style={styles.profileField}>
                    <Text style={[styles.fieldLabel, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                      Email
                    </Text>
                    <Text style={[styles.fieldValue, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                      {authState.user?.email || 'Not set'}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>
          
          {/* Password Change Section */}
          <TouchableOpacity
            style={styles.passwordSection}
            onPress={() => setPasswordFormVisible(!passwordFormVisible)}
          >
            <View style={styles.passwordHeader}>
              <Text style={[styles.passwordTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                Change Password
              </Text>
              <Ionicons
                name={passwordFormVisible ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={isDarkMode ? '#9CA3AF' : '#6B7280'}
              />
            </View>
          </TouchableOpacity>
          
          {passwordFormVisible && (
            <View style={styles.passwordForm}>
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                  Current Password
                </Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                    color: isDarkMode ? '#FFFFFF' : '#1F2937',
                    borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                  }]}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                  secureTextEntry
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                  New Password
                </Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                    color: isDarkMode ? '#FFFFFF' : '#1F2937',
                    borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                  }]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                  secureTextEntry
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                  Confirm New Password
                </Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                    color: isDarkMode ? '#FFFFFF' : '#1F2937',
                    borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                  }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                  secureTextEntry
                />
              </View>
              
              <TouchableOpacity
                style={[styles.passwordButton, { 
                  backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB',
                  opacity: passwordMutation.isPending ? 0.7 : 1,
                }]}
                onPress={handlePasswordChange}
                disabled={passwordMutation.isPending}
              >
                {passwordMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.passwordButtonText}>
                    Change Password
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {/* Notification Settings */}
        <View style={[styles.section, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            Notification Settings
          </Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                Push Notifications
              </Text>
              <Text style={[styles.settingDescription, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                Receive notifications on your device
              </Text>
            </View>
            <Switch
              value={notificationSettings.pushEnabled}
              onValueChange={() => handleToggleSetting('pushEnabled')}
              trackColor={{ false: isDarkMode ? '#4B5563' : '#D1D5DB', true: '#3B82F6' }}
              thumbColor={isDarkMode ? '#FFFFFF' : '#FFFFFF'}
              disabled={notificationMutation.isPending}
            />
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                Email Notifications
              </Text>
              <Text style={[styles.settingDescription, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                Receive alarm notifications via email
              </Text>
            </View>
            <Switch
              value={notificationSettings.emailEnabled}
              onValueChange={() => handleToggleSetting('emailEnabled')}
              trackColor={{ false: isDarkMode ? '#4B5563' : '#D1D5DB', true: '#3B82F6' }}
              thumbColor={isDarkMode ? '#FFFFFF' : '#FFFFFF'}
              disabled={notificationMutation.isPending}
            />
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                Critical Alarms Only
              </Text>
              <Text style={[styles.settingDescription, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                Only receive notifications for critical alarms
              </Text>
            </View>
            <Switch
              value={notificationSettings.criticalAlarmsOnly}
              onValueChange={() => handleToggleSetting('criticalAlarmsOnly')}
              trackColor={{ false: isDarkMode ? '#4B5563' : '#D1D5DB', true: '#3B82F6' }}
              thumbColor={isDarkMode ? '#FFFFFF' : '#FFFFFF'}
              disabled={notificationMutation.isPending}
            />
          </View>
        </View>
        
        {/* Theme Settings */}
        <View style={[styles.section, { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }]}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
            App Settings
          </Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                Dark Mode
              </Text>
              <Text style={[styles.settingDescription, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                Use dark theme for the app
              </Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: '#D1D5DB', true: '#3B82F6' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
        
        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: isDarkMode ? '#EF4444' : '#F87171' }]}
          onPress={() => setLogoutModalVisible(true)}
        >
          <Ionicons name="log-out-outline" size={20} color="#FFFFFF" style={styles.logoutIcon} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
      {/* Logout Confirmation Modal */}
      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: isDarkMode ? '#1F2937' : '#FFF', borderRadius: 16, padding: 24, width: 320, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 }}>
            <Ionicons name="log-out-outline" size={40} color={isDarkMode ? '#F87171' : '#EF4444'} style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: isDarkMode ? '#FFF' : '#1F2937', marginBottom: 8 }}>Confirm Logout</Text>
            <Text style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: 15, textAlign: 'center', marginBottom: 24 }}>
              Are you sure you want to log out?
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
              <TouchableOpacity
                style={{ flex: 1, marginRight: 8, backgroundColor: isDarkMode ? '#374151' : '#E5E7EB', borderRadius: 8, paddingVertical: 12, alignItems: 'center' }}
                onPress={() => setLogoutModalVisible(false)}
              >
                <Text style={{ color: isDarkMode ? '#FFF' : '#1F2937', fontWeight: '500', fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, marginLeft: 8, backgroundColor: isDarkMode ? '#EF4444' : '#F87171', borderRadius: 8, paddingVertical: 12, alignItems: 'center' }}
                onPress={() => { setLogoutModalVisible(false); logout(); }}
              >
                <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Logout</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelButton: {
    marginRight: 12,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  profileInfo: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  avatarContainer: {
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  profileFields: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  profileField: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 14,
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  inputContainer: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 6,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
  },
  passwordSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  passwordTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  passwordForm: {
    marginTop: 16,
  },
  passwordButton: {
    height: 40,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  passwordButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 8,
    marginBottom: 32,
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
}); 