import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { format as formatDate, subDays } from 'date-fns';
import { ReportFormat, ReportGenerator, ReportTimeRange } from '../../components/ReportGenerator';
import { useTheme } from '../../context/ThemeContext';
import { useReportGenerator } from '../../hooks/useReportGenerator';
import { router } from 'expo-router';
import { ColumnGrouping } from '../../services/ExcelReportService';
import { Alert } from 'react-native';

export default function ReportsScreen() {
  const { isDarkMode } = useTheme();
  const [showReportModal, setShowReportModal] = useState(false);
  const [
    { isGenerating, generatedFilePath },
    { generateReport, openReport, shareReport }
  ] = useReportGenerator();

  // Default time range: last 7 days
  const defaultTimeRange: ReportTimeRange = useMemo(
    () => ({
      startDate: subDays(new Date(), 7),
      endDate: new Date(),
    }),
    []
  );

  // Recent reports (would be loaded from storage or API in a real app)
  const [recentReports, setRecentReports] = useState<
    { id: string; format: ReportFormat; date: Date; filePath: string | null; title: string }[]
  >([]);

  // Handle report generation
  const handleGenerateReport = useCallback(
    async (reportFormat: ReportFormat, timeRange: ReportTimeRange): Promise<string> => {
      try {
        // Generate a title based on date range
        const startFormatted = formatDate(timeRange.startDate, 'MMM_d_yyyy');
        const endFormatted = formatDate(timeRange.endDate, 'MMM_d_yyyy');
        const title = `Alarm_Report_${startFormatted}_to_${endFormatted}`;

        // Generate the report
        const filePath = await generateReport(reportFormat, timeRange, {
          title,
          grouping: ColumnGrouping.CHRONOLOGICAL,
        });

        if (filePath) {
          // Add to recent reports
          const newReport = {
            id: `report-${Date.now()}`,
            format: reportFormat,
            date: new Date(),
            filePath,
            title,
          };

          setRecentReports(prev => [newReport, ...prev]);
          return filePath;
        }

        throw new Error('Failed to generate report');
      } catch (error) {
        console.error('Error in handleGenerateReport:', error);
        Alert.alert(
          'Report Generation Failed', 
          error instanceof Error ? error.message : 'An unexpected error occurred'
        );
        throw error;
      }
    },
    [generateReport]
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
  const formatReportDate = (date: Date) => {
    return formatDate(date, 'PPP p');
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

  // Render report items
  const renderReportItem = useCallback(
    (report: typeof recentReports[0]) => {
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
              >
                {report.title.replace(/_/g, ' ')}
              </Text>
              <Text
                style={[
                  styles.reportDate,
                  { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
                ]}
              >
                {formatReportDate(report.date)}
              </Text>
            </View>
          </View>

          <View style={styles.reportActions}>
            <TouchableOpacity
              style={styles.reportAction}
              onPress={() => report.filePath && openReport(report.filePath)}
            >
              <Ionicons
                name="open-outline"
                size={20}
                color={isDarkMode ? '#9CA3AF' : '#6B7280'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.reportAction}
              onPress={() => report.filePath && shareReport(report.filePath)}
            >
              <Ionicons
                name="share-outline"
                size={20}
                color={isDarkMode ? '#9CA3AF' : '#6B7280'}
              />
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [isDarkMode, formatReportDate, openReport, shareReport]
  );

  return (
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

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {recentReports.length > 0 ? (
          <>
            <Text
              style={[
                styles.sectionTitle,
                { color: isDarkMode ? '#E5E7EB' : '#4B5563' },
              ]}
            >
              Recent Reports
            </Text>
            {recentReports.map(renderReportItem)}
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
              Generate your first alarm report by tapping the "New Report" button above.
            </Text>
          </View>
        )}
      </ScrollView>

      <ReportGenerator
        visible={showReportModal}
        onClose={closeReportModal}
        onGenerate={handleGenerateReport}
        defaultTimeRange={defaultTimeRange}
      />
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
  },
  reportItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  reportAction: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
}); 