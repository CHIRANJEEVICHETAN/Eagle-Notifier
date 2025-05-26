import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Setpoint } from '../hooks/useSetpoints';

interface SetpointConfigModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (lowDeviation: number, highDeviation: number) => void;
  setpoint: Setpoint | null;
  isSubmitting: boolean;
}

export function SetpointConfigModal({
  visible,
  onClose,
  onSubmit,
  setpoint,
  isSubmitting,
}: SetpointConfigModalProps) {
  const { isDarkMode } = useTheme();
  const [lowDeviation, setLowDeviation] = useState(setpoint?.lowDeviation.toString() || '');
  const [highDeviation, setHighDeviation] = useState(setpoint?.highDeviation.toString() || '');

  const handleSubmit = () => {
    const lowDev = parseFloat(lowDeviation);
    const highDev = parseFloat(highDeviation);

    if (isNaN(lowDev) || isNaN(highDev)) {
      Alert.alert('Validation Error', 'Please enter valid numbers for deviations');
      return;
    }

    onSubmit(lowDev, highDev);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[
          styles.modalContent,
          { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }
        ]}>
          <View style={styles.header}>
            <Text style={[
              styles.title,
              { color: isDarkMode ? '#F9FAFB' : '#111827' }
            ]}>
              Configure Setpoint
            </Text>
            <TouchableOpacity
              style={[
                styles.closeButton,
                { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }
              ]}
              onPress={onClose}
            >
              <Ionicons
                name="close"
                size={20}
                color={isDarkMode ? '#9CA3AF' : '#6B7280'}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={[
              styles.setpointName,
              { color: isDarkMode ? '#E5E7EB' : '#374151' }
            ]}>
              {setpoint?.name}
            </Text>

            <View style={styles.inputContainer}>
              <Text style={[
                styles.label,
                { color: isDarkMode ? '#D1D5DB' : '#4B5563' }
              ]}>
                Low Deviation
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                    color: isDarkMode ? '#F9FAFB' : '#111827',
                    borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                  }
                ]}
                value={lowDeviation}
                onChangeText={setLowDeviation}
                keyboardType="numeric"
                placeholder="Enter low deviation"
                placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[
                styles.label,
                { color: isDarkMode ? '#D1D5DB' : '#4B5563' }
              ]}>
                High Deviation
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                    color: isDarkMode ? '#F9FAFB' : '#111827',
                    borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                  }
                ]}
                value={highDeviation}
                onChangeText={setHighDeviation}
                keyboardType="numeric"
                placeholder="Enter high deviation"
                placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
              />
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.cancelButton,
                { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }
              ]}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={[
                styles.buttonText,
                { color: isDarkMode ? '#E5E7EB' : '#374151' }
              ]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.submitButton,
                { backgroundColor: isDarkMode ? '#2563EB' : '#3B82F6' }
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  Save Changes
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    marginBottom: 24,
  },
  setpointName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    marginRight: 8,
  },
  submitButton: {
    minWidth: 120,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
}); 