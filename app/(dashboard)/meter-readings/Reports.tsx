import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { format as formatDate } from 'date-fns';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { MeterReport, getMeterReports } from '../../api/meterApi';
import { useMeterReports, ReportTimeRange, ReportFormat, SortOrder } from '../../hooks/useMeterReports';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { MeterReportGenerator } from '../../components/MeterReportGenerator';

export default function MeterReportsScreen() {
  const { isDarkMode } = useTheme();
  const [showReportModal, setShowReportModal] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [generatedReportId, setGeneratedReportId] = useState<string | null>(null);
  
  const {
    reports: meterReports,
    isLoadingReports,
    isReportsError,
    isGenerating,
    generateReport,
    openReport,
    shareReport,
    refetchReports,
    getDefaultTimeRange
  } = useMeterReports();

  // Default time range: last 7 days
  const defaultTimeRange = useMemo(() => getDefaultTimeRange(), []);

  // Handle report generation
  const handleGenerateReport = useCallback(
    async (reportFormat: ReportFormat, timeRange: ReportTimeRange, parameters: string[], sortOrder?: SortOrder, title?: string): Promise<string> => {
      try {
        // Generate a title based on date range if not provided
        const reportTitle = title || (() => {
          const startFormatted = formatDate(timeRange.startDate, 'MMM_d_yyyy');
          const endFormatted = formatDate(timeRange.endDate, 'MMM_d_yyyy');
          return `Meter_Readings_${startFormatted}_to_${endFormatted}`;
        })();

        // Generate the report
        const reportId = await generateReport(reportFormat, timeRange, parameters, sortOrder, reportTitle);

        if (!reportId) {
          throw new Error('Failed to generate report');
        }

        // Save the generated report ID for the success modal
        setGeneratedReportId(reportId);
        
        // Show success modal
        setSuccessModalVisible(true);

        // Refresh reports list
        refetchReports();

        return reportId;
      } catch (error: any) {
        console.error('Error in handleGenerateReport:', error);
        
        // If the error wasn't already handled in the hook
        if (!error.handled) {
          Alert.alert(
            'Report Generation Failed', 
            error instanceof Error ? error.message : 'An unexpected error occurred'
          );
        }
        
        throw error;
      }
    },
    [generateReport, refetchReports]
  );

  // Open the report modal
  const openReportModal = useCallback(() => {
    setShowReportModal(true);
  }, []);

  // Close the report modal
  const closeReportModal = useCallback(() => {
    setShowReportModal(false);
  }, []);

  // Format date for display
  const formatReportDate = (date: string) => {
    return formatDate(new Date(date), 'PPP p');
  };

  // Format file size for display
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    else return (bytes / 1073741824).toFixed(1) + ' GB';
  };

  // Theme colors
  const theme = useMemo(() => ({
    background: isDarkMode ? '#111827' : '#F9FAFB',
    surface: isDarkMode ? '#1F2937' : '#FFFFFF',
    text: isDarkMode ? '#F3F4F6' : '#1F2937',
    subtext: isDarkMode ? '#9CA3AF' : '#6B7280',
    border: isDarkMode ? 'rgba(75, 85, 99, 0.4)' : 'rgba(229, 231, 235, 0.4)',
    primary: isDarkMode ? '#10B981' : '#059669',
    accent: isDarkMode ? '#6EE7B7' : '#34D399',
  }), [isDarkMode]);

  // Handle open report action
  const handleOpenReport = useCallback((reportId: string) => {
    openReport(reportId);
  }, [openReport]);

  // Handle share report action
  const handleShareReport = useCallback((reportId: string) => {
    shareReport(reportId);
  }, [shareReport]);

  // Render report items
  const renderReportItem = useCallback(
    (report: MeterReport) => {
      const getIcon = () => {
        return report.format === 'pdf' ? 'document-text-outline' : 'grid-outline';
      };

      const getIconColor = () => {
        return report.format === 'pdf' ? '#EF4444' : '#10B981';
      };

      return (
        <View
          key={report.id}
          style={[
            styles.reportItem,
            { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' },
          ]}
        >
          <View style={styles.reportItemLeft}>
            <View
              style={[
                styles.reportIcon,
                {
                  backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                },
              ]}
            >
              <Ionicons
                name={getIcon()}
                size={24}
                color={getIconColor()}
              />
            </View>
            <View style={styles.reportInfo}>
              <Text
                style={[
                  styles.reportTitle,
                  { color: isDarkMode ? '#FFFFFF' : '#1F2937' },
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {report.title.replace(/_/g, ' ')}
              </Text>
              <Text
                style={[
                  styles.reportDate,
                  { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
                ]}
              >
                {formatReportDate(report.createdAt)} • {formatFileSize(report.fileSize)}
              </Text>
            </View>
          </View>

          <View style={styles.reportActions}>
            <TouchableOpacity
              style={styles.reportActionButton}
              onPress={() => handleOpenReport(report.id)}
            >
              <Ionicons
                name="open-outline"
                size={20}
                color={isDarkMode ? '#9CA3AF' : '#6B7280'}
              />
              <Text style={[styles.reportActionText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                Open
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.reportActionButton, { marginRight: 0 }]}
              onPress={() => handleShareReport(report.id)}
            >
              <Ionicons
                name="share-outline"
                size={20}
                color={isDarkMode ? '#9CA3AF' : '#6B7280'}
              />
              <Text style={[styles.reportActionText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                Share
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [isDarkMode, formatReportDate, handleOpenReport, handleShareReport]
  );

  // Success modal component
  const renderSuccessModal = () => {
    return (
      <Modal
        visible={successModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Ionicons
                name="checkmark-circle"
                size={50}
                color={theme.primary}
              />
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Report Generated Successfully
              </Text>
              <Text style={[styles.modalSubtitle, { color: theme.subtext }]}>
                Your report is ready. What would you like to do?
              </Text>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                onPress={() => {
                  setSuccessModalVisible(false);
                  if (generatedReportId) {
                    openReport(generatedReportId);
                  }
                }}
              >
                <Ionicons name="open-outline" size={20} color="#FFFFFF" style={styles.modalButtonIcon} />
                <Text style={styles.modalButtonText}>Open Report</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: isDarkMode ? '#4B5563' : '#E5E7EB', marginTop: 12 }]}
                onPress={() => {
                  setSuccessModalVisible(false);
                  if (generatedReportId) {
                    shareReport(generatedReportId);
                  }
                }}
              >
                <Ionicons 
                  name="share-outline" 
                  size={20} 
                  color={isDarkMode ? '#FFFFFF' : '#4B5563'} 
                  style={styles.modalButtonIcon} 
                />
                <Text style={[
                  styles.modalButtonText, 
                  { color: isDarkMode ? '#FFFFFF' : '#4B5563' }
                ]}>
                  Share Report
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalCloseButton]}
                onPress={() => setSuccessModalVisible(false)}
              >
                <Text style={[styles.modalCloseText, { color: theme.subtext }]}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.background },
      ]}
    >
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      <View style={[
        styles.header,
        {
          backgroundColor: theme.surface,
          borderBottomColor: theme.border,
          borderBottomWidth: 1,
        }
      ]}>

        <TouchableOpacity
          style={[
            styles.backButton,
            { backgroundColor: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : 'rgba(243, 244, 246, 0.7)' }
          ]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Meter Reports</Text>
          <Text style={[styles.headerSubtitle, { color: theme.subtext }]}>
            Generate and share meter reading reports
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.newReportButton,
            { backgroundColor: theme.primary },
          ]}
          onPress={openReportModal}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.newReportButtonText}>New Report</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {isLoadingReports ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={isDarkMode ? '#6EE7B7' : '#10B981'} />
            <Text style={[styles.loadingText, { color: theme.subtext }]}>
              Loading reports...
            </Text>
          </View>
        ) : isReportsError ? (
          <View style={styles.errorContainer}>
            <Ionicons
              name="alert-circle-outline"
              size={64}
              color={isDarkMode ? '#F87171' : '#EF4444'}
            />
            <Text style={[styles.errorTitle, { color: theme.text }]}>
              Error Loading Reports
            </Text>
            <Text style={[styles.errorMessage, { color: theme.subtext }]}>
              Failed to load reports. Please try again.
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.primary }]}
              onPress={() => refetchReports()}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : meterReports && meterReports.length > 0 ? (
          <>
            <Text
              style={[
                styles.sectionTitle,
                { color: isDarkMode ? '#E5E7EB' : '#4B5563' },
              ]}
            >
              Recent Reports
            </Text>
            {meterReports.map(renderReportItem)}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons
              name="document-text-outline"
              size={64}
              color={isDarkMode ? '#374151' : '#D1D5DB'}
            />
            <Text
              style={[
                styles.emptyStateTitle,
                { color: isDarkMode ? '#E5E7EB' : '#4B5563' },
              ]}
            >
              No Reports Yet
            </Text>
            <Text
              style={[
                styles.emptyStateText,
                { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
              ]}
            >
              Generate your first meter readings report by tapping the "New Report" button above.
            </Text>
    </View>
        )}
      </ScrollView>

      {showReportModal && (
        <MeterReportGenerator
          visible={showReportModal}
          onClose={closeReportModal}
          onGenerate={handleGenerateReport}
          defaultTimeRange={defaultTimeRange}
        />
      )}
      
      {renderSuccessModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    marginRight: 10,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  newReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newReportButtonText: {
    marginLeft: 8,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  reportItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    flexWrap: 'wrap',
  },
  reportItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 200,
  },
  reportIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reportInfo: {
    flex: 1,
    marginRight: 8,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  reportDate: {
    fontSize: 14,
  },
  reportActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
  },
  reportActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    paddingVertical: 4,
  },
  reportActionText: {
    fontSize: 12,
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalActions: {
    width: '100%',
    alignItems: 'center',
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    width: '100%',
  },
  modalButtonIcon: {
    marginRight: 8,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  modalCloseButton: {
    paddingVertical: 12,
    marginTop: 16,
  },
  modalCloseText: {
    fontSize: 14,
    textAlign: 'center',
  },
});