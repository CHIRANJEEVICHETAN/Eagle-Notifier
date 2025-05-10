import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { format as formatDate, subDays } from 'date-fns';
import { ReportFormat, ReportGenerator, ReportTimeRange } from '../../components/ReportGenerator';
import { useTheme } from '../../context/ThemeContext';
import { useReportGenerator } from '../../hooks/useReportGenerator';

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
    { id: string; format: ReportFormat; date: Date; filePath: string | null }[]
  >([]);
  
  // Handle report generation
  const handleGenerateReport = useCallback(
    async (reportFormat: ReportFormat, timeRange: ReportTimeRange): Promise<string> => {
      const filePath = await generateReport(reportFormat, timeRange);
      
      if (filePath) {
        // Add to recent reports
        const newReport = {
          id: `report-${Date.now()}`,
          format: reportFormat,
          date: new Date(),
          filePath,
        };
        
        setRecentReports(prev => [newReport, ...prev]);
        return filePath;
      }
      
      // If filePath is null, throw an error to maintain Promise<string> return type
      throw new Error('Failed to generate report');
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
  
  // Render report items
  const renderReportItem = useCallback(
    (report: typeof recentReports[0]) => {
      const getIcon = () => {
        return report.format === 'pdf' ? 'document-text-outline' : 'grid-outline';
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
                color={report.format === 'pdf' ? '#EF4444' : '#3B82F6'}
              />
            </View>
            <View style={styles.reportInfo}>
              <Text
                style={[
                  styles.reportTitle,
                  { color: isDarkMode ? '#FFFFFF' : '#1F2937' },
                ]}
              >
                {report.format.toUpperCase()} Report
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
      
      <View style={styles.header}>
        <Text
          style={[
            styles.title,
            { color: isDarkMode ? '#FFFFFF' : '#1F2937' },
          ]}
        >
          Reports
        </Text>
        
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
              Generate your first report by tapping the "New Report" button.
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