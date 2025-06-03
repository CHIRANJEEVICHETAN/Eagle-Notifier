import React, { useState, useEffect, useCallback } from 'react';
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
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { apiConfig } from '../../api/config';
import { getAuthHeader } from '../../api/auth';
import { UserRole } from '../../types/auth';
import { NotificationSettings } from '../../types/notification';
import { BlurView } from 'expo-blur';
import { useMaintenance } from '../../context/MaintenanceContext';

// Types for profile API responses
interface ProfileResponse {
  message: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar?: string;
    createdAt: string;
    updatedAt: string;
    pushToken?: string;
  };
}

// Helper function to convert API user to local User type
const convertApiUserToUserType = (apiUser: ProfileResponse['user']) => {
  return {
    ...apiUser,
    role: apiUser.role as UserRole, // Cast the role string to UserRole type
  };
};

export default function ProfileScreen() {
  const { isDarkMode, toggleTheme } = useTheme();
  const { authState, updateUser, logout, refreshAuthToken } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isMaintenanceMode, toggleMaintenanceMode } = useMaintenance();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'enable' | 'disable'>('enable');
  
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
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    pushEnabled: true,
    emailEnabled: false,
    criticalOnly: false,
  });
  
  // Logout modal state
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  
  // Validation states
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [currentPasswordError, setCurrentPasswordError] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  
  // Image picker state
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarOptionsVisible, setAvatarOptionsVisible] = useState(false);
  const [avatarKey, setAvatarKey] = useState(0);
  
  // Fetch notification settings
  const { data: settingsData } = useQuery({
    queryKey: ['notificationSettings'],
    queryFn: async () => {
      const headers = await getAuthHeader();
      const response = await axios.get<NotificationSettings>(
        `${apiConfig.apiUrl}/api/notifications/settings`,
        { headers }
      );
      return response.data;
    }
  });
  
  // Update notification settings from API data
  useEffect(() => {
    if (settingsData) {
      setNotificationSettings(settingsData);
    }
  }, [settingsData]);
  
  // Add profile fetch query
  const { data: profileData } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const headers = await getAuthHeader();
      const response = await axios.get<ProfileResponse>(
        `${apiConfig.apiUrl}/api/auth/profile`,
        { headers }
      );
      if (response.data.user) {
        updateUser(convertApiUserToUserType(response.data.user));
      }
      return response.data;
    },
    retry: 2,
    staleTime: 300000 // 5 minutes
  });
  
  // Profile update mutation
  const profileMutation = useMutation({
    mutationFn: async (data: { name: string; email: string }) => {
      const headers = await getAuthHeader();
      const response = await axios.put<ProfileResponse>(
        `${apiConfig.apiUrl}/api/auth/profile`, 
        data,
        { headers }
      );
      return response.data;
    },
    onSuccess: (data) => {
      // Update local auth state
      if (data.user) {
        updateUser(convertApiUserToUserType(data.user));
      }
      
      setEditingProfile(false);
      Alert.alert('Success', 'Profile updated successfully');
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'An error occurred. Please try again.';
      Alert.alert('Error', errorMessage);
    },
  });
  
  // Password change mutation
  const passwordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const headers = await getAuthHeader();
      const response = await axios.put(
        `${apiConfig.apiUrl}/api/auth/change-password`, 
        data,
        { headers }
      );
      return response.data;
    },
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordFormVisible(false);
      Alert.alert('Success', 'Password changed successfully');
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'An error occurred. Please try again.';
      
      // Check if it's a current password error
      if (errorMessage.includes('Current password')) {
        setCurrentPasswordError(errorMessage);
      } else {
        Alert.alert('Error', errorMessage);
      }
    },
  });
  
  // Notification settings mutation
  const notificationMutation = useMutation({
    mutationFn: async (settings: Partial<NotificationSettings>) => {
      const headers = await getAuthHeader();
      const response = await axios.put<NotificationSettings>(
        `${apiConfig.apiUrl}/api/notifications/settings`,
        settings,
        { headers }
      );
      return response.data;
    },
    onSuccess: (data) => {
      setNotificationSettings(data);
      queryClient.invalidateQueries({ queryKey: ['notificationSettings'] });
      Alert.alert('Success', 'Notification settings updated');
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to update notification settings';
      Alert.alert('Error', errorMessage);
    },
  });
  
  // Avatar update mutation
  const avatarMutation = useMutation({
    mutationFn: async (data: { avatar: string | null }) => {
      const headers = await getAuthHeader();
      const response = await axios.put<ProfileResponse>(
        `${apiConfig.apiUrl}/api/auth/profile`, 
        data,
        { headers }
      );
      return response.data;
    },
    onSuccess: (data) => {
      // Update local auth state
      if (data.user) {
        updateUser(convertApiUserToUserType(data.user));
      }
      Alert.alert('Success', 'Profile picture updated');
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to update profile picture';
      Alert.alert('Error', errorMessage);
    },
  });
  
  // Remove avatar mutation
  const removeAvatarMutation = useMutation({
    mutationFn: async () => {
      const headers = await getAuthHeader();
      const response = await axios.delete<ProfileResponse>(
        `${apiConfig.apiUrl}/api/auth/avatar`, 
        { headers }
      );
      return response.data;
    },
    onSuccess: (data) => {
      // Update local auth state
      if (data.user) {
        updateUser(convertApiUserToUserType(data.user));
      }
      Alert.alert('Success', 'Profile picture removed');
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to remove profile picture';
      Alert.alert('Error', errorMessage);
    },
  });
  
  // Update name whenever authState changes
  useEffect(() => {
    setName(authState.user?.name || '');
    setEmail(authState.user?.email || '');
  }, [authState.user]);
  
  // Handle profile save
  const handleProfileSave = useCallback(() => {
    const isNameValid = validateName(name);
    const isEmailValid = validateEmail(email);
    
    if (isNameValid && isEmailValid) {
      profileMutation.mutate({ name, email });
    }
  }, [name, email, profileMutation]);
  
  // Handle password change
  const handlePasswordChange = useCallback(() => {
    const isCurrentPasswordValid = validateCurrentPassword(currentPassword);
    const isNewPasswordValid = validateNewPassword(newPassword);
    const isConfirmPasswordValid = validateConfirmPassword(confirmPassword);
    
    if (isCurrentPasswordValid && isNewPasswordValid && isConfirmPasswordValid) {
      passwordMutation.mutate({ 
        currentPassword, 
        newPassword
      });
    }
  }, [currentPassword, newPassword, confirmPassword, passwordMutation]);
  
  // Reset password form
  const resetPasswordForm = useCallback(() => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }, []);
  
  // Handle notification setting toggle
  const handleToggleSetting = useCallback((setting: keyof NotificationSettings) => {
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
    setNameError('');
    setEmailError('');
    setEditingProfile(false);
  }, [authState.user]);
  
  // Update pickImage function
  const pickImage = async (useCamera = false) => {
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera permission is required to take photos');
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Media library permission is required to select photos');
          return;
        }
      }
      
      setAvatarLoading(true);
      
      // Launch camera or image picker with optimized settings
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.1,
            base64: true,
            exif: false,
            cameraType: ImagePicker.CameraType.front,
            presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.1,
            base64: true,
            exif: false
          });
      
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        let base64Image = '';
        
        try {
          if (asset.base64) {
            base64Image = `data:image/jpeg;base64,${asset.base64}`;
            
            // Get fresh auth headers before making the request
            const headers = await getAuthHeader();
            
            // Update avatar in API with increased timeout
            const response = await axios.put(
              `${apiConfig.apiUrl}/api/auth/profile`,
              { avatar: base64Image },
              { 
                headers,
                timeout: 60000,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
              }
            );
            
            if (response.data.user) {
              const updatedUser = convertApiUserToUserType(response.data.user);
              updateUser(updatedUser);
              queryClient.invalidateQueries({ queryKey: ['profile'] });
              Alert.alert('Success', 'Profile picture updated successfully');
            }
          } else {
            throw new Error('Failed to get base64 image data');
          }
        } catch (error: any) {
          console.error('Avatar update error:', error);
          
          if (error?.response?.status === 401) {
            try {
              const newToken = await refreshAuthToken();
              if (newToken) {
                const response = await axios.put(
                  `${apiConfig.apiUrl}/api/auth/profile`,
                  { avatar: base64Image },
                  { 
                    headers: {
                      'Authorization': `Bearer ${newToken}`,
                      'Content-Type': 'application/json'
                    },
                    timeout: 60000,
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                  }
                );
                
                if (response.data.user) {
                  const updatedUser = convertApiUserToUserType(response.data.user);
                  updateUser(updatedUser);
                  queryClient.invalidateQueries({ queryKey: ['profile'] });
                  Alert.alert('Success', 'Profile picture updated successfully');
                }
              }
            } catch (refreshError) {
              console.error('Token refresh failed:', refreshError);
              Alert.alert(
                'Session Expired',
                'Your session has expired. Please log in again.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      logout();
                      router.replace('/(auth)/login');
                    }
                  }
                ]
              );
            }
          } else {
            Alert.alert(
              'Error',
              'Failed to update profile picture. Please try again with a smaller image.'
            );
          }
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to process image. Please try again with a smaller image or lower quality.');
    } finally {
      setAvatarLoading(false);
      setAvatarOptionsVisible(false);
    }
  };
  
  // Handle avatar selection with options
  const handleAvatarSelection = () => {
    setAvatarOptionsVisible(true);
  };
  
  // Validation functions
  const validateName = (value: string) => {
    setName(value);
    if (!value.trim()) {
      setNameError('Name is required');
      return false;
    } else if (value.trim().length < 2) {
      setNameError('Name must be at least 2 characters');
      return false;
    } else {
      setNameError('');
      return true;
    }
  };
  
  const validateEmail = (value: string) => {
    setEmail(value);
    if (!value.trim()) {
      setEmailError('Email is required');
      return false;
    } else if (!/\S+@\S+\.\S+/.test(value)) {
      setEmailError('Please enter a valid email address');
      return false;
    } else {
      setEmailError('');
      return true;
    }
  };
  
  const validateCurrentPassword = (value: string) => {
    setCurrentPassword(value);
    if (!value) {
      setCurrentPasswordError('Current password is required');
      return false;
    } else {
      setCurrentPasswordError('');
      return true;
    }
  };
  
  const validateNewPassword = (value: string) => {
    setNewPassword(value);
    if (!value) {
      setNewPasswordError('New password is required');
      return false;
    } else if (value.length < 6) {
      setNewPasswordError('Password must be at least 6 characters');
      return false;
    } else {
      setNewPasswordError('');
      return true;
    }
  };
  
  const validateConfirmPassword = (value: string) => {
    setConfirmPassword(value);
    if (!value) {
      setConfirmPasswordError('Please confirm your password');
      return false;
    } else if (value !== newPassword) {
      setConfirmPasswordError('Passwords do not match');
      return false;
    } else {
      setConfirmPasswordError('');
      return true;
    }
  };
  
  // Add this component before your return statement
  const AvatarOptionsModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
    const { isDarkMode } = useTheme();
    
    if (!visible) return null;
    
    const options = [
      {
        icon: 'camera',
        text: 'Take Photo',
        onPress: () => {
          onClose();
          pickImage(true);
        }
      },
      {
        icon: 'images',
        text: 'Choose from Library',
        onPress: () => {
          onClose();
          pickImage(false);
        }
      },
      {
        icon: 'trash',
        text: 'Remove Photo',
        onPress: () => {
          onClose();
          if (authState.user?.avatar) {
            removeAvatarMutation.mutate();
          }
        },
        destructive: true
      }
    ];
    
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <BlurView
          intensity={20}
          style={StyleSheet.absoluteFill}
          tint={isDarkMode ? 'dark' : 'light'}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={onClose}
          >
            <View style={[
              styles.modalContent,
              { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }
            ]}>
              <Text style={[
                styles.modalTitle,
                { color: isDarkMode ? '#FFFFFF' : '#1F2937' }
              ]}>
                Update Profile Picture
              </Text>
              
              <View style={styles.optionsList}>
                {options.map((option, index) => (
                  <TouchableOpacity
                    key={option.text}
                    style={[
                      styles.optionButton,
                      index < options.length - 1 && styles.optionBorder,
                      { borderColor: isDarkMode ? '#374151' : '#E5E7EB' }
                    ]}
                    onPress={option.onPress}
                  >
                    <Ionicons
                      name={option.icon as any}
                      size={24}
                      color={option.destructive
                        ? '#EF4444'
                        : (isDarkMode ? '#60A5FA' : '#2563EB')
                      }
                      style={styles.optionIcon}
                    />
                    <Text style={[
                      styles.optionText,
                      option.destructive && styles.destructiveText,
                      { color: option.destructive
                        ? '#EF4444'
                        : (isDarkMode ? '#FFFFFF' : '#1F2937')
                      }
                    ]}>
                      {option.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <TouchableOpacity
                style={[
                  styles.cancelButton,
                  { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }
                ]}
                onPress={onClose}
              >
                <Text style={[
                  styles.cancelText,
                  { color: isDarkMode ? '#E5E7EB' : '#4B5563' }
                ]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </BlurView>
      </Modal>
    );
  };
  
  // Add this in the App Settings section, after the Dark Mode toggle
  const renderMaintenanceModeCard = () => {
    if (authState.user?.role !== 'ADMIN') return null;
    
    return (
      <View style={[
        styles.card,
        {
          backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
          borderColor: isDarkMode ? '#374151' : '#E5E7EB'
        }
      ]}>
        <View style={styles.cardHeader}>
          <Text style={[
            styles.cardTitle,
            { color: isDarkMode ? '#FFFFFF' : '#1F2937' }
          ]}>
            Maintenance Mode
          </Text>
          <View style={[
            styles.statusBadge,
            {
              backgroundColor: isMaintenanceMode
                ? isDarkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)'
                : isDarkMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)'
            }
          ]}>
            <Text style={[
              styles.statusText,
              {
                color: isMaintenanceMode
                  ? isDarkMode ? '#F87171' : '#EF4444'
                  : isDarkMode ? '#34D399' : '#10B981'
              }
            ]}>
              {isMaintenanceMode ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
        
        <Text style={[
          styles.cardDescription,
          { color: isDarkMode ? '#9CA3AF' : '#6B7280' }
        ]}>
          {isMaintenanceMode
            ? 'Maintenance mode is currently active. Non-admin users will see a maintenance screen.'
            : 'Maintenance mode is currently inactive. All users have normal access.'}
        </Text>
        
        <TouchableOpacity
          style={[
            styles.toggleButton,
            {
              backgroundColor: isMaintenanceMode
                ? isDarkMode ? '#10B981' : '#059669'
                : isDarkMode ? '#EF4444' : '#DC2626'
            }
          ]}
          onPress={() => handleToggleMaintenance(isMaintenanceMode ? 'disable' : 'enable')}
        >
          <Text style={styles.toggleButtonText}>
            {isMaintenanceMode ? 'Disable Maintenance Mode' : 'Enable Maintenance Mode'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const handleToggleMaintenance = (action: 'enable' | 'disable') => {
    setConfirmAction(action);
    setShowConfirmModal(true);
  };

  const handleConfirmMaintenance = async () => {
    try {
      await toggleMaintenanceMode();
      setShowConfirmModal(false);
    } catch (error) {
      console.error('Failed to toggle maintenance mode:', error);
    }
  };

  // Add confirmation modal component
  const ConfirmationModal = () => (
    <Modal
      visible={showConfirmModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowConfirmModal(false)}
    >
      <View style={[
        styles.modalOverlay,
        { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.5)' }
      ]}>
        <View style={[
          styles.modalContent,
          {
            backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
            borderColor: isDarkMode ? '#374151' : '#E5E7EB'
          }
        ]}>
          <Text style={[
            styles.modalTitle,
            { color: isDarkMode ? '#FFFFFF' : '#1F2937' }
          ]}>
            {confirmAction === 'enable' ? 'Enable Maintenance Mode' : 'Disable Maintenance Mode'}
          </Text>
          
          <Text style={[
            styles.modalDescription,
            { color: isDarkMode ? '#9CA3AF' : '#6B7280' }
          ]}>
            {confirmAction === 'enable'
              ? 'Are you sure you want to enable maintenance mode? This will restrict access for all non-admin users.'
              : 'Are you sure you want to disable maintenance mode? This will restore access for all users.'}
          </Text>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[
                styles.modalButton,
                styles.cancelButton,
                { borderColor: isDarkMode ? '#374151' : '#E5E7EB' }
              ]}
              onPress={() => setShowConfirmModal(false)}
            >
              <Text style={[
                styles.modalButtonText,
                { color: isDarkMode ? '#9CA3AF' : '#6B7280' }
              ]}>
                Cancel
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.modalButton,
                styles.confirmButton,
                {
                  backgroundColor: confirmAction === 'enable' ? '#EF4444' : '#10B981',
                  borderColor: confirmAction === 'enable' ? '#DC2626' : '#059669'
                }
              ]}
              onPress={handleConfirmMaintenance}
            >
              <Text style={[
                styles.modalButtonText,
                { color: '#FFFFFF' }
              ]}>
                {confirmAction === 'enable' ? 'Enable' : 'Disable'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

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
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={handleAvatarSelection}
              disabled={avatarLoading || avatarMutation.isPending || removeAvatarMutation.isPending}
            >
              {avatarLoading || avatarMutation.isPending || removeAvatarMutation.isPending ? (
                <View style={[styles.avatar, { backgroundColor: isDarkMode ? '#374151' : '#E5E7EB' }]}>
                  <ActivityIndicator color={isDarkMode ? '#60A5FA' : '#2563EB'} />
                </View>
              ) : authState.user?.avatar ? (
                <Image 
                  key={avatarKey}
                  source={{ uri: authState.user.avatar }}
                  style={styles.avatarImage}
                  onError={() => {
                    console.error('Failed to load avatar image');
                    // Fallback to initial if image fails to load
                    setAvatarKey(prev => prev + 1);
                  }}
                />
              ) : (
                <View style={[styles.avatar, { backgroundColor: isDarkMode ? '#374151' : '#E5E7EB' }]}>
                  <Text style={[styles.avatarText, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                    {authState.user?.name?.charAt(0) || 'U'}
                  </Text>
                  <Ionicons
                    name="camera"
                    size={16}
                    color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                    style={styles.cameraIcon}
                  />
                </View>
              )}
              <Text style={[styles.roleBadge, { 
                backgroundColor: authState.user?.role === 'ADMIN' 
                  ? (isDarkMode ? '#4F46E5' : '#6366F1')
                  : (isDarkMode ? '#2563EB' : '#3B82F6'),
              }]}>
                {authState.user?.role === 'ADMIN' ? 'Admin' : 'Operator'}
              </Text>
            </TouchableOpacity>
            
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
                        borderColor: nameError ? '#EF4444' : (isDarkMode ? '#4B5563' : '#D1D5DB'),
                      }]}
                      value={name}
                      onChangeText={validateName}
                      placeholder="Your name"
                      placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                    />
                    {nameError ? (
                      <Text style={styles.errorText}>{nameError}</Text>
                    ) : null}
                  </View>
                  
                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                      Email
                    </Text>
                    <TextInput
                      style={[styles.input, { 
                        backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                        color: isDarkMode ? '#FFFFFF' : '#1F2937',
                        borderColor: emailError ? '#EF4444' : (isDarkMode ? '#4B5563' : '#D1D5DB'),
                      }]}
                      value={email}
                      onChangeText={validateEmail}
                      placeholder="Your email"
                      placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    {emailError ? (
                      <Text style={styles.errorText}>{emailError}</Text>
                    ) : null}
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
                    borderColor: currentPasswordError ? '#EF4444' : (isDarkMode ? '#4B5563' : '#D1D5DB'),
                  }]}
                  value={currentPassword}
                  onChangeText={validateCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                  secureTextEntry
                />
                {currentPasswordError ? (
                  <Text style={styles.errorText}>{currentPasswordError}</Text>
                ) : null}
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                  New Password
                </Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                    color: isDarkMode ? '#FFFFFF' : '#1F2937',
                    borderColor: newPasswordError ? '#EF4444' : (isDarkMode ? '#4B5563' : '#D1D5DB'),
                  }]}
                  value={newPassword}
                  onChangeText={validateNewPassword}
                  placeholder="Enter new password"
                  placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                  secureTextEntry
                />
                {newPasswordError ? (
                  <Text style={styles.errorText}>{newPasswordError}</Text>
                ) : null}
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: isDarkMode ? '#E5E7EB' : '#4B5563' }]}>
                  Confirm New Password
                </Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                    color: isDarkMode ? '#FFFFFF' : '#1F2937',
                    borderColor: confirmPasswordError ? '#EF4444' : (isDarkMode ? '#4B5563' : '#D1D5DB'),
                  }]}
                  value={confirmPassword}
                  onChangeText={validateConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                  secureTextEntry
                />
                {confirmPasswordError ? (
                  <Text style={styles.errorText}>{confirmPasswordError}</Text>
                ) : null}
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
              value={notificationSettings.criticalOnly}
              onValueChange={() => handleToggleSetting('criticalOnly')}
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
        
        {/* Maintenance Mode Card */}
        {renderMaintenanceModeCard()}
        
        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: isDarkMode ? '#DC2626' : '#EF4444' }]}
          onPress={() => setLogoutModalVisible(true)}
        >
          <Ionicons name="log-out-outline" size={20} color="#FFFFFF" style={styles.logoutIcon} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2025 TecoSoft Digital Solutions. All rights reserved.</Text>
          <Text style={[styles.footerText, { marginTop: 5, paddingBottom: 10 }]}>Version {process.env.EXPO_PUBLIC_APP_VERSION}</Text>
        </View>
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
      {/* Avatar Options Modal */}
      <AvatarOptionsModal
        visible={avatarOptionsVisible}
        onClose={() => setAvatarOptionsVisible(false)}
      />
      <ConfirmationModal />
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
    fontWeight: '600',
    marginLeft: 12,
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
    marginBottom: 16,
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
    gap: 10,
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
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    padding: 4,
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
    borderRadius: 12,
    marginTop: 16,
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
  footer: {
    paddingBottom: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#6B7280',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
  },
  cancelButton: {
    backgroundColor: 'transparent',
  },
  confirmButton: {
    borderWidth: 0,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  card: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  toggleButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  // Avatar options modal styles
  optionsList: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  optionBorder: {
    borderBottomWidth: 1,
  },
  optionIcon: {
    marginRight: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  destructiveText: {
    color: '#EF4444',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
} as const); 