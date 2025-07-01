import { useState } from 'react';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { ReportFormat, ReportTimeRange } from '../components/ReportGenerator';
import { AlarmReportFilters, useAlarmReportData } from './useAlarmReportData';
import { ColumnGrouping, ExcelReportService } from '../services/ExcelReportService';

type ReportGeneratorReturnType = [
  {
    isGenerating: boolean;
    generatedFilePath: string | null;
  },
  {
    generateReport: (format: ReportFormat, timeRange: ReportTimeRange, options?: ReportGeneratorOptions) => Promise<string>;
    openReport: (filePath: string) => Promise<void>;
    shareReport: (filePath: string) => Promise<void>;
  }
];

interface ReportGeneratorOptions {
  title?: string;
  alarmTypes?: string[];
  severityLevels?: string[];
  zones?: string[];
  includeThresholds?: boolean;
  includeStatusFields?: boolean;
  grouping?: ColumnGrouping;
}

export function useReportGenerator(): ReportGeneratorReturnType {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedFilePath, setGeneratedFilePath] = useState<string | null>(null);
  
  // Create a wrapper hook with the needed filters
  const { refetch } = useAlarmReportData({}, false);
  
  // Generate a report based on parameters
  const generateReport = async (
    format: ReportFormat, 
    timeRange: ReportTimeRange,
    options: ReportGeneratorOptions = {}
  ): Promise<string> => {
    try {
      setIsGenerating(true);
      
      // Build a random filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.-]/g, '_');
      const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const title = options.title || 'Eagle_Notifier_Report';
      const sanitizedTitle = title.replace(/\s+/g, '_');
      
      let filePath = '';
      
      if (format === 'excel') {
        // Create a new instance of the hook with the specific filters
        const alarmReportHook = useAlarmReportData({
          startDate: timeRange.startDate,
          endDate: timeRange.endDate,
          alarmTypes: options.alarmTypes,
          severityLevels: options.severityLevels,
          zones: options.zones
        }, true); // Enable this instance
        
        // Fetch the data
        const result = await alarmReportHook.refetch();
        
        if (!result.data || !result.data.data || result.data.data.length === 0) {
          throw new Error('No data found for the selected filters');
        }
        
        // Use the ExcelReportService
        filePath = await ExcelReportService.generateExcelReport({
          alarmData: result.data.data,
          title: sanitizedTitle,
          grouping: options.grouping || ColumnGrouping.NEWEST_FIRST,
          includeThresholds: options.includeThresholds ?? true,
          includeStatusFields: options.includeStatusFields ?? true
        });
      } else if (format === 'pdf') {
        // Placeholder for PDF generation (future feature)
        filePath = await FileSystem.documentDirectory + `${sanitizedTitle}_${timestamp}_${randomSuffix}.pdf`;
        
        // Create a dummy PDF file for now
        await FileSystem.writeAsStringAsync(
          filePath,
          'PDF generation not implemented yet',
          { encoding: FileSystem.EncodingType.UTF8 }
        );
      } else {
        throw new Error(`Unsupported format: ${format}`);
      }
      
      // Save the generated file path
      setGeneratedFilePath(filePath);
      return filePath;
    } catch (error) {
      console.error('Error generating report:', error);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Open a generated report
  const openReport = async (filePath: string): Promise<void> => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }
      
      await Sharing.shareAsync(filePath);
    } catch (error) {
      console.error('Error opening report:', error);
      Alert.alert('Error', 'Failed to open report');
      throw error;
    }
  };
  
  // Share a generated report
  const shareReport = async (filePath: string): Promise<void> => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }
      
      await Sharing.shareAsync(filePath, {
        mimeType: filePath.endsWith('.xlsx') 
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf',
        dialogTitle: 'Share Report',
      });
    } catch (error) {
      console.error('Error sharing report:', error);
      Alert.alert('Error', 'Failed to share report');
      throw error;
    }
  };
  
  return [
    { isGenerating, generatedFilePath },
    { generateReport, openReport, shareReport }
  ];
} 