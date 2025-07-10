import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface UpdateModalProps {
  visible: boolean;
  isDownloading: boolean;
  onUpdate: () => void;
  onCancel: () => void;
}

export function UpdateModal({ visible, isDownloading, onUpdate, onCancel }: UpdateModalProps) {
  const { isDarkMode } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[
          styles.modalContainer,
          { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }
        ]}>
          {/* Icon */}
          <View style={[
            styles.iconContainer,
            { backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(37, 99, 235, 0.1)' }
          ]}>
            <Ionicons
              name="cloud-download-outline"
              size={40}
              color={isDarkMode ? '#60A5FA' : '#2563EB'}
            />
          </View>

          {/* Content */}
          <Text style={[
            styles.title,
            { color: isDarkMode ? '#F3F4F6' : '#1F2937' }
          ]}>
            Update Available
          </Text>
          <Text style={[
            styles.description,
            { color: isDarkMode ? '#9CA3AF' : '#6B7280' }
          ]}>
            A new version of Eagle Notifier is available. Update now to get the latest features and improvements.
          </Text>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.secondaryButton,
                { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }
              ]}
              onPress={onCancel}
              disabled={isDownloading}
            >
              <Text style={[
                styles.buttonText,
                { color: isDarkMode ? '#E5E7EB' : '#4B5563' }
              ]}>
                Not Now
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.primaryButton,
                { backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB' }
              ]}
              onPress={onUpdate}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Update Now</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={styles.buttonIcon} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get('window');
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: width - 48,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  primaryButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonIcon: {
    marginLeft: 6,
  },
}); 