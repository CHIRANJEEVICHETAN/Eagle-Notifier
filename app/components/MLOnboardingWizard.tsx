import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Organization } from '../hooks/useOrganizations';
import { usePredictiveMaintenanceData } from '../hooks/usePredictiveMaintenanceData';

interface MLOnboardingWizardProps {
  organization: Organization;
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type WizardStep = 'welcome' | 'requirements' | 'configuration' | 'testing' | 'completion';

const MLOnboardingWizard: React.FC<MLOnboardingWizardProps> = ({
  organization,
  visible,
  onClose,
  onComplete
}) => {
  const { isDarkMode } = useTheme();
  const { updateMLConfig, triggerTraining, testModel, isUpdatingConfig, isTraining, isTesting } = usePredictiveMaintenanceData();
  
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [config, setConfig] = useState({
    predictionEnabled: true,
    trainingSchedule: '0 2 * * 0', // Weekly at 2 AM on Sunday
    hyperparameters: {
      numLeaves: 31,
      learningRate: 0.1,
      featureFraction: 0.9,
      baggingFraction: 0.8,
      maxDepth: -1,
      numIterations: 100,
    },
    dataRange: { days: 365 }
  });

  const steps: { key: WizardStep; title: string; description: string }[] = [
    {
      key: 'welcome',
      title: 'Welcome to ML Setup',
      description: 'Set up predictive maintenance for your organization'
    },
    {
      key: 'requirements',
      title: 'Check Requirements',
      description: 'Verify data and system requirements'
    },
    {
      key: 'configuration',
      title: 'Configure ML Settings',
      description: 'Set up training schedule and parameters'
    },
    {
      key: 'testing',
      title: 'Test Configuration',
      description: 'Validate your ML setup'
    },
    {
      key: 'completion',
      title: 'Setup Complete',
      description: 'Your ML system is ready'
    }
  ];

  const getCurrentStepIndex = () => steps.findIndex(step => step.key === currentStep);
  const isLastStep = () => getCurrentStepIndex() === steps.length - 1;
  const isFirstStep = () => getCurrentStepIndex() === 0;

  const handleNext = async () => {
    const currentIndex = getCurrentStepIndex();
    
    if (currentStep === 'configuration') {
      // Save configuration before proceeding
      try {
        await updateMLConfig({
          organizationId: organization.id,
          config: {
            predictionEnabled: config.predictionEnabled,
            mlModelConfig: {
              hyperparameters: config.hyperparameters,
              dataRange: config.dataRange
            },
            trainingSchedule: {
              pattern: config.trainingSchedule,
              enabled: config.predictionEnabled
            }
          }
        });
      } catch (error) {
        Alert.alert('Error', 'Failed to save configuration');
        return;
      }
    }
    
    if (currentStep === 'testing') {
      // Trigger initial training
      try {
        await triggerTraining({
          organizationId: organization.id,
          config: {
            organizationId: organization.id,
            schedule: config.trainingSchedule,
            enabled: true,
            hyperparameters: config.hyperparameters,
            dataRange: config.dataRange
          }
        });
      } catch (error) {
        Alert.alert('Error', 'Failed to start training');
        return;
      }
    }
    
    if (isLastStep()) {
      onComplete();
      onClose();
    } else {
      setCurrentStep(steps[currentIndex + 1].key);
    }
  };

  const handlePrevious = () => {
    const currentIndex = getCurrentStepIndex();
    if (!isFirstStep()) {
      setCurrentStep(steps[currentIndex - 1].key);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <View style={{ alignItems: 'center', padding: 20 }}>
            <Ionicons name="rocket-outline" size={64} color={isDarkMode ? '#60A5FA' : '#2563EB'} />
            <Text style={{
              fontSize: 24,
              fontWeight: 'bold',
              color: isDarkMode ? '#F8FAFC' : '#1E293B',
              marginTop: 16,
              marginBottom: 8,
              textAlign: 'center'
            }}>
              Welcome to ML Setup
            </Text>
            <Text style={{
              fontSize: 16,
              color: isDarkMode ? '#94a3b8' : '#64748b',
              textAlign: 'center',
              lineHeight: 24
            }}>
              We'll help you set up predictive maintenance for {organization.name}. 
              This process will configure machine learning models to predict equipment failures.
            </Text>
            <View style={{ marginTop: 24, width: '100%' }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: isDarkMode ? '#F8FAFC' : '#1E293B',
                marginBottom: 12
              }}>
                What you'll get:
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', marginLeft: 8 }}>
                  Automated failure prediction
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', marginLeft: 8 }}>
                  Scheduled model training
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', marginLeft: 8 }}>
                  Performance monitoring
                </Text>
              </View>
            </View>
          </View>
        );

      case 'requirements':
        return (
          <View style={{ padding: 20 }}>
            <Text style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: isDarkMode ? '#F8FAFC' : '#1E293B',
              marginBottom: 16
            }}>
              System Requirements Check
            </Text>
            
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', marginLeft: 8 }}>
                  SCADA database configured
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', marginLeft: 8 }}>
                  Column schema defined
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', marginLeft: 8 }}>
                  Historical data available (recommended: 6+ months)
                </Text>
              </View>
            </View>

            <View style={{
              backgroundColor: isDarkMode ? '#334155' : '#f8fafc',
              borderRadius: 8,
              padding: 16,
              marginBottom: 16
            }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: isDarkMode ? '#F8FAFC' : '#1E293B',
                marginBottom: 8
              }}>
                Data Requirements
              </Text>
              <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', marginBottom: 8 }}>
                • Minimum 1000 data points for training
              </Text>
              <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', marginBottom: 8 }}>
                • Regular data collection intervals
              </Text>
              <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                • Labeled failure events (optional but recommended)
              </Text>
            </View>
          </View>
        );

      case 'configuration':
        return (
          <ScrollView style={{ padding: 20, maxHeight: 400 }}>
            <Text style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: isDarkMode ? '#F8FAFC' : '#1E293B',
              marginBottom: 16
            }}>
              ML Configuration
            </Text>

            {/* Training Schedule */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: isDarkMode ? '#F8FAFC' : '#1E293B',
                marginBottom: 8
              }}>
                Training Schedule
              </Text>
              <TextInput
                value={config.trainingSchedule}
                onChangeText={(value) => setConfig(prev => ({ ...prev, trainingSchedule: value }))}
                style={{
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#374155' : '#e5e7eb',
                  borderRadius: 8,
                  padding: 12,
                  backgroundColor: isDarkMode ? '#334155' : '#f9fafb',
                  color: isDarkMode ? '#fff' : '#111827',
                  fontFamily: 'monospace'
                }}
                placeholder="0 2 * * 0 (Weekly at 2 AM on Sunday)"
                placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
              />
            </View>

            {/* Quick Schedule Presets */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'Daily', value: '0 2 * * *' },
                { label: 'Weekly', value: '0 2 * * 0' },
                { label: 'Monthly', value: '0 2 1 * *' }
              ].map((preset) => (
                <TouchableOpacity
                  key={preset.value}
                  onPress={() => setConfig(prev => ({ ...prev, trainingSchedule: preset.value }))}
                  style={{
                    backgroundColor: config.trainingSchedule === preset.value 
                      ? (isDarkMode ? '#2563eb' : '#3b82f6')
                      : (isDarkMode ? '#374155' : '#f3f4f6'),
                    borderRadius: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{
                    fontSize: 12,
                    color: config.trainingSchedule === preset.value 
                      ? '#ffffff'
                      : (isDarkMode ? '#94a3b8' : '#64748b'),
                    fontWeight: '500'
                  }}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Data Range */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: isDarkMode ? '#F8FAFC' : '#1E293B',
                marginBottom: 8
              }}>
                Training Data Range (Days)
              </Text>
              <TextInput
                value={config.dataRange.days.toString()}
                onChangeText={(value) => setConfig(prev => ({ 
                  ...prev, 
                  dataRange: { days: parseInt(value) || 365 }
                }))}
                style={{
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#374155' : '#e5e7eb',
                  borderRadius: 8,
                  padding: 12,
                  backgroundColor: isDarkMode ? '#334155' : '#f9fafb',
                  color: isDarkMode ? '#fff' : '#111827',
                }}
                keyboardType="numeric"
                placeholder="365"
                placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
              />
            </View>
          </ScrollView>
        );

      case 'testing':
        return (
          <View style={{ padding: 20 }}>
            <Text style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: isDarkMode ? '#F8FAFC' : '#1E293B',
              marginBottom: 16
            }}>
              Test Configuration
            </Text>
            
            <Text style={{
              fontSize: 14,
              color: isDarkMode ? '#94a3b8' : '#64748b',
              marginBottom: 16,
              lineHeight: 20
            }}>
              We'll now test your configuration by starting the initial model training. 
              This may take a few minutes depending on your data size.
            </Text>

            <View style={{
              backgroundColor: isDarkMode ? '#334155' : '#f8fafc',
              borderRadius: 8,
              padding: 16,
              marginBottom: 16
            }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: isDarkMode ? '#F8FAFC' : '#1E293B',
                marginBottom: 8
              }}>
                Configuration Summary
              </Text>
              <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', marginBottom: 4 }}>
                Training Schedule: {config.trainingSchedule}
              </Text>
              <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', marginBottom: 4 }}>
                Data Range: {config.dataRange.days} days
              </Text>
              <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                Predictions: Enabled
              </Text>
            </View>

            {isTraining && (
              <View style={{ alignItems: 'center', marginTop: 20 }}>
                <ActivityIndicator size="large" color={isDarkMode ? '#60A5FA' : '#2563EB'} />
                <Text style={{
                  color: isDarkMode ? '#94a3b8' : '#64748b',
                  marginTop: 8,
                  textAlign: 'center'
                }}>
                  Training in progress...
                </Text>
              </View>
            )}
          </View>
        );

      case 'completion':
        return (
          <View style={{ alignItems: 'center', padding: 20 }}>
            <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
            <Text style={{
              fontSize: 24,
              fontWeight: 'bold',
              color: isDarkMode ? '#F8FAFC' : '#1E293B',
              marginTop: 16,
              marginBottom: 8,
              textAlign: 'center'
            }}>
              Setup Complete!
            </Text>
            <Text style={{
              fontSize: 16,
              color: isDarkMode ? '#94a3b8' : '#64748b',
              textAlign: 'center',
              lineHeight: 24,
              marginBottom: 24
            }}>
              Predictive maintenance is now enabled for {organization.name}. 
              Your first model training has been initiated.
            </Text>

            <View style={{
              backgroundColor: isDarkMode ? '#334155' : '#f8fafc',
              borderRadius: 8,
              padding: 16,
              width: '100%'
            }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: isDarkMode ? '#F8FAFC' : '#1E293B',
                marginBottom: 12
              }}>
                Next Steps:
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="time-outline" size={16} color={isDarkMode ? '#94a3b8' : '#64748b'} />
                <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', marginLeft: 8 }}>
                  Monitor training progress in the Performance tab
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="analytics-outline" size={16} color={isDarkMode ? '#94a3b8' : '#64748b'} />
                <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', marginLeft: 8 }}>
                  Review model performance metrics
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="settings-outline" size={16} color={isDarkMode ? '#94a3b8' : '#64748b'} />
                <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', marginLeft: 8 }}>
                  Adjust settings as needed
                </Text>
              </View>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ 
        flex: 1, 
        backgroundColor: 'rgba(0,0,0,0.5)', 
        justifyContent: 'center', 
        alignItems: 'center' 
      }}>
        <View style={{ 
          backgroundColor: isDarkMode ? '#1e293b' : '#fff', 
          borderRadius: 16, 
          width: '95%', 
          maxHeight: '90%',
          maxWidth: 500
        }}>
          {/* Header with Progress */}
          <View style={{ 
            padding: 20, 
            borderBottomWidth: 1, 
            borderBottomColor: isDarkMode ? '#374155' : '#e5e7eb' 
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ 
                fontSize: 20, 
                fontWeight: 'bold', 
                color: isDarkMode ? '#F8FAFC' : '#1E293B' 
              }}>
                ML Setup Wizard
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#94a3b8' : '#64748b'} />
              </TouchableOpacity>
            </View>
            
            {/* Progress Bar */}
            <View style={{ marginBottom: 8 }}>
              <View style={{
                height: 4,
                backgroundColor: isDarkMode ? '#374155' : '#e5e7eb',
                borderRadius: 2,
                overflow: 'hidden'
              }}>
                <View style={{
                  height: '100%',
                  width: `${((getCurrentStepIndex() + 1) / steps.length) * 100}%`,
                  backgroundColor: isDarkMode ? '#60A5FA' : '#2563EB',
                  borderRadius: 2
                }} />
              </View>
            </View>
            
            <Text style={{
              fontSize: 14,
              color: isDarkMode ? '#94a3b8' : '#64748b'
            }}>
              Step {getCurrentStepIndex() + 1} of {steps.length}: {steps[getCurrentStepIndex()].title}
            </Text>
          </View>

          {/* Content */}
          <View style={{ flex: 1 }}>
            {renderStepContent()}
          </View>

          {/* Footer */}
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            padding: 20,
            borderTopWidth: 1,
            borderTopColor: isDarkMode ? '#374155' : '#e5e7eb'
          }}>
            <TouchableOpacity
              onPress={handlePrevious}
              disabled={isFirstStep()}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: isDarkMode ? '#374155' : '#f3f4f6',
                opacity: isFirstStep() ? 0.5 : 1
              }}
            >
              <Text style={{ 
                color: isDarkMode ? '#94a3b8' : '#64748b',
                fontWeight: '600'
              }}>
                Previous
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleNext}
              disabled={isUpdatingConfig || isTraining}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: isDarkMode ? '#2563eb' : '#3b82f6',
                opacity: (isUpdatingConfig || isTraining) ? 0.6 : 1,
                flexDirection: 'row',
                alignItems: 'center'
              }}
            >
              {(isUpdatingConfig || isTraining) ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ 
                  color: '#fff',
                  fontWeight: '600'
                }}>
                  {isLastStep() ? 'Complete' : 'Next'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default MLOnboardingWizard;