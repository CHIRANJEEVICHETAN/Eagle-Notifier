import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface ResolutionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (message: string) => void;
  alarmDescription: string;
}

export const ResolutionModal: React.FC<ResolutionModalProps> = ({
  visible,
  onClose,
  onSubmit,
  alarmDescription,
}) => {
  const { isDarkMode } = useTheme();
  const [message, setMessage] = useState('');

  const handleSubmit = () => {
    if (message.trim()) {
      onSubmit(message.trim());
      setMessage('');
    }
  };

  const THEME = {
    dark: {
      background: '#1E293B',
      card: '#334155',
      text: {
        primary: '#F8FAFC',
        secondary: '#94A3B8',
      },
      border: '#475569',
      button: {
        primary: '#3B82F6',
        secondary: '#475569',
      },
    },
    light: {
      background: '#F8FAFC',
      card: '#FFFFFF',
      text: {
        primary: '#1E293B',
        secondary: '#64748B',
      },
      border: '#E2E8F0',
      button: {
        primary: '#2563EB',
        secondary: '#E2E8F0',
      },
    },
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={[
          styles.modalOverlay,
          { backgroundColor: 'rgba(0, 0, 0, 0.5)' }
        ]}>
          <View style={[
            styles.modalContent,
            {
              backgroundColor: isDarkMode ? THEME.dark.card : THEME.light.card,
              borderColor: isDarkMode ? THEME.dark.border : THEME.light.border,
            }
          ]}>
            <View style={styles.modalHeader}>
              <Text style={[
                styles.modalTitle,
                { color: isDarkMode ? THEME.dark.text.primary : THEME.light.text.primary }
              ]}>
                Resolve Alarm
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons
                  name="close"
                  size={24}
                  color={isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={[
                styles.alarmDescription,
                { color: isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary }
              ]}>
                {alarmDescription}
              </Text>

              <Text style={[
                styles.inputLabel,
                { color: isDarkMode ? THEME.dark.text.primary : THEME.light.text.primary }
              ]}>
                Resolution Message
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: isDarkMode ? THEME.dark.text.primary : THEME.light.text.primary,
                    backgroundColor: isDarkMode ? THEME.dark.background : THEME.light.background,
                    borderColor: isDarkMode ? THEME.dark.border : THEME.light.border,
                  }
                ]}
                placeholder="Enter resolution details..."
                placeholderTextColor={isDarkMode ? THEME.dark.text.secondary : THEME.light.text.secondary}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.cancelButton,
                  {
                    backgroundColor: isDarkMode ? THEME.dark.button.secondary : THEME.light.button.secondary,
                  }
                ]}
                onPress={onClose}
              >
                <Text style={[
                  styles.buttonText,
                  { color: isDarkMode ? THEME.dark.text.primary : THEME.light.text.primary }
                ]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.submitButton,
                  {
                    backgroundColor: message.trim()
                      ? (isDarkMode ? THEME.dark.button.primary : THEME.light.button.primary)
                      : (isDarkMode ? '#1E40AF' : '#93C5FD'),
                    opacity: message.trim() ? 1 : 0.5,
                  }
                ]}
                onPress={handleSubmit}
                disabled={!message.trim()}
              >
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                  Submit
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
    maxHeight: 400,
  },
  alarmDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  submitButton: {},
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
}); 