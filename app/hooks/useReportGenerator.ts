import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { ReportFormat, ReportTimeRange } from '../components/ReportGenerator';
import { ReportFilters } from '../api/reportsApi';
import { reportService } from '../utils/reportService';

interface ReportGeneratorState {
  isGenerating: boolean;
  generatedFilePath: string | null;
}

interface ReportGeneratorActions {
  generateReport: (reportFormat: ReportFormat, timeRange: ReportTimeRange, filters?: Partial<ReportFilters>) => Promise<string | null>;
  openReport: (filePath?: string) => Promise<void>;
  shareReport: (filePath?: string) => Promise<void>;
}

/**
 * Custom hook for report generation
 */
export function useReportGenerator(): [ReportGeneratorState, ReportGeneratorActions] {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedFilePath, setGeneratedFilePath] = useState<string | null>(null);
  
  /**
   * Generate a report
   */
  const generateReport = useCallback(
    async (
      reportFormat: ReportFormat,
      timeRange: ReportTimeRange,
      filters?: Partial<ReportFilters>
    ): Promise<string | null> => {
      try {
        setIsGenerating(true);
        
        const filePath = await reportService.generateReport(reportFormat, timeRange, filters);
        
        setGeneratedFilePath(filePath);
        return filePath;
      } catch (error) {
        Alert.alert(
          'Report Generation Failed',
          error instanceof Error ? error.message : 'An unexpected error occurred'
        );
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    []
  );
  
  /**
   * Open a report file
   */
  const openReport = useCallback(
    async (filePath?: string): Promise<void> => {
      try {
        // Use the provided filePath or the last generated file
        const fileToOpen = filePath || generatedFilePath;
        
        if (!fileToOpen) {
          Alert.alert('Error', 'No report file to open. Please generate a report first.');
          return;
        }
        
        await reportService.openReport(fileToOpen);
      } catch (error) {
        Alert.alert(
          'Error Opening Report',
          error instanceof Error ? error.message : 'An unexpected error occurred'
        );
      }
    },
    [generatedFilePath]
  );
  
  /**
   * Share a report file
   */
  const shareReport = useCallback(
    async (filePath?: string): Promise<void> => {
      try {
        // Use the provided filePath or the last generated file
        const fileToShare = filePath || generatedFilePath;
        
        if (!fileToShare) {
          Alert.alert('Error', 'No report file to share. Please generate a report first.');
          return;
        }
        
        await reportService.shareReport(fileToShare);
      } catch (error) {
        Alert.alert(
          'Error Sharing Report',
          error instanceof Error ? error.message : 'An unexpected error occurred'
        );
      }
    },
    [generatedFilePath]
  );
  
  return [
    { isGenerating, generatedFilePath },
    { generateReport, openReport, shareReport },
  ];
} 