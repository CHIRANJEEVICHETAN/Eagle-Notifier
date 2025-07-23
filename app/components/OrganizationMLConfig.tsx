import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Organization } from '../hooks/useOrganizations';
import { usePredictiveMaintenanceData, ModelInfo } from '../hooks/usePredictiveMaintenanceData';

interface OrganizationMLConfigProps {
  organization: Organization;
  onClose: () => void;
  onUpdate: () => void;
}

const OrganizationMLConfig: React.FC<OrganizationMLConfigProps> = ({
  organization,
  onClose,
  onUpdate
}) => {
  const { isDarkMode } = useTheme();
  const { 
    fetchModelInfo, 
    updateMLConfig, 
    triggerTraining, 
    testModel,
    isUpdatingConfig,
    isTraining,
    isTesting
  } = usePredictiveMaintenanceData();

  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [isLoadingModelInfo, setIsLoadingModelInfo] = useState(false);
  const [config, setConfig] = useState({
    predictionEnabled: organization.predictionEnabled || false,
    trainingSchedule: '0 2 * * 0', // Weekly at 2 AM on Sunday
    hyperparameters: {
      numLeaves: 31,
      learningRate: 0.1,
      featureFraction: 0.9,
      baggingFraction: 0.8,
      maxDepth: -1,
      numIterations: 100,
    },
    dataRange: {
      days: 365
    }
  });
  const [testData, setTestData] = useState('{\n  "temperature": 85.0,\n  "pressure": 120.0,\n  "vibration": 0.5\n}');

  // Load model info when component mounts
  useEffect(() => {
    if (organization.predictionEnabled) {
      loadModelInfo();
    }
  }, [organization.id]);

  const loadModelInfo = async () => {
    setIsLoadingModelInfo(true);
    try {
      const info = await fetchModelInfo(organization.id);
      setModelInfo(info);
    } catch (error) {
      console.error('Failed to load model info:', error);
    } finally {
      setIsLoadingModelInfo(false);
    }
  };

  const handleSaveConfig = async () => {
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
      Alert.alert('Success', 'ML configuration updated successfully');
      onUpdate();
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to update ML configuration');
    }
  };

  const handleTriggerTraining = async () => {
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
      Alert.alert('Success', 'Training triggered successfully');
      setTimeout(loadModelInfo, 2000); // Refresh model info after 2 seconds
    } catch (error) {
      Alert.alert('Error', 'Failed to trigger training');
    }
  };

  const handleTestModel = async () => {
    try {
      const parsedTestData = JSON.parse(testData);
      const result = await testModel({
        organizationId: organization.id,
        testData: parsedTestData
      });
      
      Alert.alert(
        'Model Test Results',
        `Average Prediction: ${result.data.statistics.averageTime}ms\n` +
        `Iterations: ${result.data.statistics.iterations}\n` +
        `Total Time: ${result.data.statistics.totalTime}ms`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to test model. Check test data format.');
    }
  };

  return (
    <ScrollView style={{ maxHeight: 600 }}>
      {/* Organization Info */}
      <View style={{ 
        backgroundColor: isDarkMode ? '#334155' : '#f8fafc',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16
      }}>
        <Text style={{ 
          fontSize: 18, 
          fontWeight: 'bold', 
          color: isDarkMode ? '#F8FAFC' : '#1E293B',
          marginBottom: 8
        }}>
          {organization.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Ionicons 
            name={organization.predictionEnabled ? 'checkmark-circle' : 'close-circle'} 
            size={16} 
            color={organization.predictionEnabled ? '#22c55e' : '#ef4444'} 
          />
          <Text style={{ 
            fontSize: 14, 
            color: isDarkMode ? '#cbd5e1' : '#64748b',
            marginLeft: 6
          }}>
            {organization.predictionEnabled ? 'ML Enabled' : 'ML Disabled'}
          </Text>
        </View>
        {organization.predictionEnabled && (
          <>
            <Text style={{ 
              fontSize: 13, 
              color: isDarkMode ? '#94a3b8' : '#6b7280'
            }}>
              Model Version: {organization.modelVersion || 'N/A'}
            </Text>
            <Text style={{ 
              fontSize: 13, 
              color: isDarkMode ? '#94a3b8' : '#6b7280'
            }}>
              Accuracy: {organization.modelAccuracy ? `${(organization.modelAccuracy * 100).toFixed(1)}%` : 'N/A'}
            </Text>
          </>
        )}
      </View>

      {/* Model Information */}
      {organization.predictionEnabled && (
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ 
              fontSize: 16, 
              fontWeight: '600', 
              color: isDarkMode ? '#F8FAFC' : '#1E293B' 
            }}>
              Model Information
            </Text>
            <TouchableOpacity onPress={loadModelInfo} disabled={isLoadingModelInfo}>
              {isLoadingModelInfo ? (
                <ActivityIndicator size="small" color={isDarkMode ? '#60A5FA' : '#2563EB'} />
              ) : (
                <Ionicons name="refresh" size={20} color={isDarkMode ? '#60A5FA' : '#2563EB'} />
              )}
            </TouchableOpacity>
          </View>
          
          {modelInfo && (
            <View style={{ 
              backgroundColor: isDarkMode ? '#334155' : '#f8fafc',
              borderRadius: 8,
              padding: 12
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b' }}>Accuracy:</Text>
                <Text style={{ color: isDarkMode ? '#F8FAFC' : '#1E293B', fontWeight: '600' }}>
                  {(modelInfo.modelMetrics.accuracy * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b' }}>Precision:</Text>
                <Text style={{ color: isDarkMode ? '#F8FAFC' : '#1E293B', fontWeight: '600' }}>
                  {(modelInfo.modelMetrics.precision * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b' }}>Recall:</Text>
                <Text style={{ color: isDarkMode ? '#F8FAFC' : '#1E293B', fontWeight: '600' }}>
                  {(modelInfo.modelMetrics.recall * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: isDarkMode ? '#cbd5e1' : '#64748b' }}>AUC:</Text>
                <Text style={{ color: isDarkMode ? '#F8FAFC' : '#1E293B', fontWeight: '600' }}>
                  {(modelInfo.modelMetrics.auc * 100).toFixed(1)}%
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Configuration */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ 
          fontSize: 16, 
          fontWeight: '600', 
          color: isDarkMode ? '#F8FAFC' : '#1E293B',
          marginBottom: 12
        }}>
          Configuration
        </Text>

        {/* Enable/Disable Predictions */}
        <View style={{ 
          flexDirection: 'row', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 16,
          paddingVertical: 8
        }}>
          <Text style={{ color: isDarkMode ? '#F8FAFC' : '#1E293B', fontSize: 16 }}>
            Enable Predictions
          </Text>
          <Switch
            value={config.predictionEnabled}
            onValueChange={(value) => setConfig(prev => ({ ...prev, predictionEnabled: value }))}
            trackColor={{ false: '#767577', true: '#22c55e' }}
            thumbColor={config.predictionEnabled ? '#ffffff' : '#f4f3f4'}
          />
        </View>

        {/* Training Schedule */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ 
            color: isDarkMode ? '#cbd5e1' : '#64748b', 
            fontSize: 14,
            marginBottom: 8
          }}>
            Training Schedule (Cron Pattern)
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
            }}
            placeholder="0 2 * * 0 (Weekly at 2 AM on Sunday)"
            placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
          />
        </View>

        {/* Hyperparameters */}
        <Text style={{ 
          color: isDarkMode ? '#cbd5e1' : '#64748b', 
          fontSize: 14,
          marginBottom: 8
        }}>
          Hyperparameters
        </Text>
        
        {Object.entries(config.hyperparameters).map(([key, value]) => (
          <View key={key} style={{ marginBottom: 12 }}>
            <Text style={{ 
              color: isDarkMode ? '#94a3b8' : '#6b7280', 
              fontSize: 13,
              marginBottom: 4
            }}>
              {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
            </Text>
            <TextInput
              value={value.toString()}
              onChangeText={(val) => {
                const numValue = key === 'maxDepth' && val === '-1' ? -1 : parseFloat(val) || 0;
                setConfig(prev => ({
                  ...prev,
                  hyperparameters: {
                    ...prev.hyperparameters,
                    [key]: numValue
                  }
                }));
              }}
              style={{
                borderWidth: 1,
                borderColor: isDarkMode ? '#374155' : '#e5e7eb',
                borderRadius: 6,
                padding: 8,
                backgroundColor: isDarkMode ? '#334155' : '#f9fafb',
                color: isDarkMode ? '#fff' : '#111827',
                fontSize: 14
              }}
              keyboardType="numeric"
            />
          </View>
        ))}
      </View>

      {/* Model Testing */}
      {organization.predictionEnabled && (
        <View style={{ marginBottom: 16 }}>
          <Text style={{ 
            fontSize: 16, 
            fontWeight: '600', 
            color: isDarkMode ? '#F8FAFC' : '#1E293B',
            marginBottom: 12
          }}>
            Model Testing
          </Text>
          
          <Text style={{ 
            color: isDarkMode ? '#cbd5e1' : '#64748b', 
            fontSize: 14,
            marginBottom: 8
          }}>
            Test Data (JSON)
          </Text>
          <TextInput
            value={testData}
            onChangeText={setTestData}
            multiline
            numberOfLines={4}
            style={{
              borderWidth: 1,
              borderColor: isDarkMode ? '#374155' : '#e5e7eb',
              borderRadius: 8,
              padding: 12,
              backgroundColor: isDarkMode ? '#334155' : '#f9fafb',
              color: isDarkMode ? '#fff' : '#111827',
              textAlignVertical: 'top',
              fontFamily: 'monospace'
            }}
          />
          
          <TouchableOpacity
            onPress={handleTestModel}
            disabled={isTesting}
            style={{
              backgroundColor: isDarkMode ? '#7c3aed' : '#8b5cf6',
              borderRadius: 8,
              padding: 12,
              alignItems: 'center',
              marginTop: 12,
              opacity: isTesting ? 0.6 : 1
            }}
          >
            {isTesting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '600' }}>Test Model</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Action Buttons */}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
        <TouchableOpacity
          onPress={handleSaveConfig}
          disabled={isUpdatingConfig}
          style={{
            flex: 1,
            backgroundColor: isDarkMode ? '#2563eb' : '#3b82f6',
            borderRadius: 8,
            padding: 12,
            alignItems: 'center',
            opacity: isUpdatingConfig ? 0.6 : 1
          }}
        >
          {isUpdatingConfig ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '600' }}>Save Configuration</Text>
          )}
        </TouchableOpacity>

        {config.predictionEnabled && (
          <TouchableOpacity
            onPress={handleTriggerTraining}
            disabled={isTraining}
            style={{
              flex: 1,
              backgroundColor: isDarkMode ? '#059669' : '#10b981',
              borderRadius: 8,
              padding: 12,
              alignItems: 'center',
              opacity: isTraining ? 0.6 : 1
            }}
          >
            {isTraining ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '600' }}>Trigger Training</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

export default OrganizationMLConfig;