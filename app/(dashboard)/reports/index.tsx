import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView, ActivityIndicator, Modal, Platform, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { format as formatDate, subDays } from 'date-fns';
import { ReportFormat, ReportGenerator, ReportTimeRange } from '../../components/ReportGenerator';
import { useTheme } from '../../context/ThemeContext';
import { useFurnaceReports, FurnaceReport } from '../../hooks/useFurnaceReports';
import { router } from 'expo-router';
import { ColumnGrouping } from '../../services/ExcelReportService';
import { Alert } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import ErrorBoundary from '../../components/ErrorBoundary';

export default function ReportsScreen() {
  const { isDarkMode } = useTheme();
  const [showReportModal, setShowReportModal] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [generatedReportId, setGeneratedReportId] = useState<string | null>(null);
  const [generatedFilePath, setGeneratedFilePath] = useState<string | null>(null);
  
  const {
    reports: furnaceReports,
    isLoadingReports,
    isReportsError,
    isGenerating,
    generateReport,
    openReport,
    shareReport,
    refetchReports,
    loadMoreReports,
    isLoadingMore,
    hasNextPage,
    getDefaultTimeRange
  } = useFurnaceReports();

  // Default time range: last 7 days
  const defaultTimeRange = useMemo(() => getDefaultTimeRange(), [getDefaultTimeRange]);

  // Handle report generation
  const handleGenerateReport = useCallback(
    async (
      reportFormat: ReportFormat, 
      timeRange: ReportTimeRange,
      filters: {
        alarmTypes: string[];
        severityLevels: string[];
        zones: string[];
        grouping: ColumnGrouping;
        includeThresholds: boolean;
        includeStatusFields: boolean;
        shouldSplit?: boolean;
      }
    ): Promise<string> => {
      try {
        // Generate a title based on date range
        const startFormatted = formatDate(timeRange.startDate, 'MMM_d_yyyy');
        const endFormatted = formatDate(timeRange.endDate, 'MMM_d_yyyy');
        const title = `Furnace_Report_${startFormatted}_to_${endFormatted}`;

        // Generate the report using the passed filters (including grouping)
        const filePath = await generateReport(
          reportFormat,
          timeRange,
          filters.alarmTypes,
          filters.severityLevels,
          filters.zones,
          filters.grouping,
          title,
          filters.includeThresholds,
          filters.includeStatusFields,
          filters.shouldSplit || false
        );

        if (filePath) {
          console.log('Report generated successfully, file path:', filePath);
          
          // Set the generated report ID and file path for the success modal
          setGeneratedReportId(title);
          setGeneratedFilePath(filePath);
          
          console.log('Showing success modal...');
          // Show success modal
          setSuccessModalVisible(true);

          // Refresh reports list
          await refetchReports();

          return filePath;
        }

        throw new Error('Failed to generate report');
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
    primary: isDarkMode ? '#3B82F6' : '#2563EB',
  }), [isDarkMode]);

  // Handle open report action
  const handleOpenReport = useCallback((reportId: string) => {
    openReport(reportId);
  }, [openReport]);

  // Handle share report action
  const handleShareReport = useCallback((reportId: string) => {
    shareReport(reportId);
  }, [shareReport]);

  // Handle open file directly
  const handleOpenFile = useCallback(async (filePath: string) => {
    try {
      if (Platform.OS === 'android') {
        try {
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: filePath,
            flags: 1,
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });
        } catch (e) {
          // If intent launcher fails, fall back to sharing
          await Sharing.shareAsync(filePath);
        }
      } else {
        // For iOS and other platforms, use sharing
        await Sharing.shareAsync(filePath);
      }
    } catch (error) {
      console.error('Error opening file:', error);
      Alert.alert('Error', 'Failed to open file');
    }
  }, []);

  // Handle share file directly
  const handleShareFile = useCallback(async (filePath: string) => {
    try {
      await Sharing.shareAsync(filePath, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Share Furnace Report',
      });
    } catch (error) {
      console.error('Error sharing file:', error);
      Alert.alert('Error', 'Failed to share file');
    }
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    await refetchReports();
  }, [refetchReports]);

  // Render report items
  const renderReportItem = useCallback(
    (report: FurnaceReport) => {
      const getIcon = () => {
        return report.format === 'pdf' ? 'document-text-outline' : 'grid-outline';
      };

      const getIconColor = () => {
        return report.format === 'pdf' ? '#EF4444' : '#3B82F6';
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
    [isDarkMode, formatReportDate, openReport, shareReport]
  );

  return (
    <ErrorBoundary>
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' },
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
          <Text style={[styles.headerTitle, { color: theme.text }]}>Reports</Text>
          <Text style={[styles.headerSubtitle, { color: theme.subtext }]}>
            Generate and share alarm reports
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.newReportButton,
            { backgroundColor: isDarkMode ? '#3B82F6' : '#2563EB' },
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

      {isLoadingReports ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDarkMode ? '#3B82F6' : '#2563EB'} />
          <Text style={[styles.loadingText, { color: theme.subtext }]}>
            Loading reports...
          </Text>
          <Text style={[styles.loadingSubtext, { color: theme.subtext }]}>
            Fetching your recent reports
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
      ) : (
        <FlatList
          style={styles.content}
          contentContainerStyle={[
            styles.contentContainer,
            (!furnaceReports || furnaceReports.length === 0) && styles.flexContainer
          ]}
          data={furnaceReports}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={({ item }) => renderReportItem(item)}
          refreshControl={
            <RefreshControl
              refreshing={isLoadingReports}
              onRefresh={handleRefresh}
              tintColor={isDarkMode ? '#3B82F6' : '#2563EB'}
              colors={[isDarkMode ? '#3B82F6' : '#2563EB']}
            />
          }
          onEndReached={loadMoreReports}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            furnaceReports && furnaceReports.length > 0 ? (
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDarkMode ? '#E5E7EB' : '#4B5563' },
                ]}
              >
                Recent Reports
              </Text>
            ) : null
          }
          ListEmptyComponent={
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
                Generate your first alarm report by tapping the "New Report" button above.
              </Text>
            </View>
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator 
                  size="small" 
                  color={isDarkMode ? '#3B82F6' : '#2563EB'} 
                />
                <Text style={[styles.loadingMoreText, { color: theme.subtext }]}>
                  Loading more reports...
                </Text>
              </View>
            ) : null
          }
        />
      )}

      <ReportGenerator
        visible={showReportModal}
        onClose={closeReportModal}
        onGenerate={handleGenerateReport}
        defaultTimeRange={defaultTimeRange}
      />
      
      {/* Success Modal */}
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
                Your furnace report is ready. What would you like to do?
              </Text>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                onPress={async () => {
                  setSuccessModalVisible(false);
                  if (generatedReportId && furnaceReports) {
                    // Find the report in the list by title (since generatedReportId contains the title)
                    const report = furnaceReports.find(r => r.title === generatedReportId);
                    if (report) {
                      await openReport(report.id);
                    } else if (generatedFilePath) {
                      // Fallback to direct file opening
                      await handleOpenFile(generatedFilePath);
                    }
                  }
                }}
              >
                <Ionicons name="open-outline" size={20} color="#FFFFFF" style={styles.modalButtonIcon} />
                <Text style={styles.modalButtonText}>Open Report</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: isDarkMode ? '#4B5563' : '#E5E7EB', marginTop: 12 }]}
                onPress={async () => {
                  setSuccessModalVisible(false);
                  if (generatedReportId && furnaceReports) {
                    // Find the report in the list by title
                    const report = furnaceReports.find(r => r.title === generatedReportId);
                    if (report) {
                      await shareReport(report.id);
                    } else if (generatedFilePath) {
                      // Fallback to direct file sharing
                      await handleShareFile(generatedFilePath);
                    }
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
                onPress={() => {
                  setSuccessModalVisible(false);
                  setGeneratedFilePath(null);
                  setGeneratedReportId(null);
                }}
              >
                <Text style={[styles.modalCloseText, { color: theme.subtext }]}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flexContainer: {
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
  reportAction: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  loadingSubtext: {
    marginTop: 4,
    fontSize: 14,
    opacity: 0.7,
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
  loadingMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingMoreText: {
    marginTop: 8,
    fontSize: 14,
    opacity: 0.7,
  },
}); 