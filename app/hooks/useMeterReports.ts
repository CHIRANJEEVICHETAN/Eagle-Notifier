import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { Alert, Platform } from 'react-native';
import { format as formatDate, subDays } from 'date-fns';
import { 
  generateMeterReport, 
  getMeterReports, 
  downloadMeterReport,
  MeterReport,
  MeterReportParams
} from '../api/meterApi';

export interface ReportTimeRange {
  startDate: Date;
  endDate: Date;
}

export interface MeterReportFilter {
  parameters?: string[];
  title?: string;
  sortOrder?: string;
}

export enum ReportFormat {
  EXCEL = 'excel',
  PDF = 'pdf'
}

export enum SortOrder {
  NEWEST_FIRST = 'newest_first',
  OLDEST_FIRST = 'oldest_first'
}

export function useMeterReports() {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReportId, setGeneratedReportId] = useState<string | null>(null);

  // Get all reports for the current user
  const {
    data: reports,
    isLoading: isLoadingReports,
    isError: isReportsError,
    refetch: refetchReports
  } = useQuery({
    queryKey: ['meterReports'],
    queryFn: getMeterReports,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: generateMeterReport,
    onSuccess: (data) => {
      // Save the generated report ID
      setGeneratedReportId(data.id);
      // Invalidate the reports query to refetch the list
      queryClient.invalidateQueries({ queryKey: ['meterReports'] });
    },
    onError: (error: any) => {
      console.error('Error in generate report mutation:', error);
      // Extract more detailed error information if available
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Unknown error';
      
      // Check if we have a more specific error about date range
      if (error.response?.data?.availableRange) {
        const { earliest, latest } = error.response.data.availableRange;
        const earliestDate = new Date(earliest);
        const latestDate = new Date(latest);
        
        // Check if there's a suggested range
        if (error.response?.data?.suggestedRange) {
          const { startDate, endDate } = error.response.data.suggestedRange;
          
          Alert.alert(
            'No Data in Selected Range',
            `No meter readings found in the selected date range. Available data is from ${formatDate(earliestDate, 'PPP')} to ${formatDate(latestDate, 'PPP')}.`,
            [
              { 
                text: 'Use Suggested Range', 
                onPress: () => {
                  // Mark the error as handled
                  error.handled = true;
                  
                  // Try again with the suggested range
                  const suggestedStartDate = new Date(startDate);
                  const suggestedEndDate = new Date(endDate);
                  
                  console.log('Using suggested date range:', {
                    startDate: suggestedStartDate,
                    endDate: suggestedEndDate
                  });
                  
                  // Retry with suggested range
                  generateReport(
                    ReportFormat.EXCEL, 
                    { startDate: suggestedStartDate, endDate: suggestedEndDate },
                    error.config?.data ? JSON.parse(error.config.data).parameters : undefined,
                    error.config?.data ? JSON.parse(error.config.data).sortOrder : undefined,
                    error.config?.data ? JSON.parse(error.config.data).title : undefined
                  ).catch(retryError => {
                    console.error('Error retrying with suggested range:', retryError);
                  });
                }
              },
              { text: 'Cancel' }
            ]
          );
        } else {
          Alert.alert(
            'No Data in Selected Range',
            `No meter readings found in the selected date range. Available data is from ${formatDate(earliestDate, 'PPP')} to ${formatDate(latestDate, 'PPP')}. Please adjust your selection.`,
            [
              { text: 'OK' }
            ]
          );
        }
      } else {
        Alert.alert('Report Generation Failed', errorMessage);
      }
      
      // Mark the error as handled
      error.handled = true;
    }
  });

  // Generate a report with filters
  const generateReport = async (
    format: ReportFormat,
    timeRange: ReportTimeRange,
    parameters: string[] = [],
    sortOrder: SortOrder = SortOrder.NEWEST_FIRST,
    title?: string
  ): Promise<string | null> => {
    try {
      setIsGenerating(true);
      
      // Validate parameters
      if (!timeRange || !timeRange.startDate || !timeRange.endDate) {
        throw new Error('Invalid time range provided');
      }
      
      if (timeRange.endDate < timeRange.startDate) {
        throw new Error('End date must be after start date');
      }

      // Prepare report parameters
      const params: MeterReportParams = {
        startDate: timeRange.startDate,
        endDate: timeRange.endDate,
        parameters: parameters.length > 0 ? parameters : undefined,
        title: title || `Meter_Readings_${formatDate(new Date(), 'yyyyMMdd_HHmmss')}`,
        sortOrder: sortOrder
      };

      console.log('Generating report with params:', JSON.stringify(params));

      // Generate the report
      const report = await generateReportMutation.mutateAsync(params);
      
      if (!report || !report.id) {
        throw new Error('Failed to generate report - no report ID returned');
      }
      
      return report.id;
    } catch (error: any) {
      console.error('Error generating report:', error);
      
      // If this is not an error already handled by the mutation
      if (!error.response) {
        Alert.alert(
          'Report Generation Failed', 
          error instanceof Error ? error.message : 'An unexpected error occurred'
        );
      }
      
      throw error;
    } finally {
      setIsGenerating(false);
    }
  };

  const openReport = async (reportId: string): Promise<void> => {
    try {
      // 1️⃣ Download the file blob
      const blob = await downloadMeterReport(reportId);
  
      // 2️⃣ Retrieve metadata
      const cached = queryClient.getQueryData<MeterReport[]>(['meterReports']);
      const meta = cached?.find(r => r.id === reportId);
      if (!meta) throw new Error('Report metadata not found');
  
      const fileUri = FileSystem.documentDirectory + meta.fileName;
  
      // 3️⃣ Convert blob to base64 and write to file
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result?.toString().split(',')[1];
        if (!base64) throw new Error('Failed to convert file to base64');
  
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
  
        const mime =
          meta.format === 'excel'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/pdf';
  
        if (Platform.OS === 'android') {
          // 4️⃣ Android: launch external app via IntentLauncher
          try {
            const contentUri = await FileSystem.getContentUriAsync(fileUri);
            await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
              data: contentUri,
              flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
              type: mime,
            });
          } catch (e) {
            // Fallback: use Sharing
            console.warn('IntentLauncher failed, using Sharing', e);
            await Sharing.shareAsync(fileUri, { mimeType: mime });
          }
        } else {
          // ✅ iOS: use expo-sharing to open the file
          const canShare = await Sharing.isAvailableAsync();
          if (!canShare) {
            throw new Error('Sharing is not available on this device');
          }
          await Sharing.shareAsync(fileUri, {
            mimeType: mime,
            UTI: meta.format === 'excel' ? 'com.microsoft.excel.xlsx' : 'com.adobe.pdf',
            dialogTitle: `Open Meter Readings Report`,
          });
        }
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('Error opening report:', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'Unable to open report');
    }
  };

  // Share a generated report
  const shareReport = async (reportId: string): Promise<void> => {
    try {
      // Download the report file
      const blob = await downloadMeterReport(reportId);
      
      // Get the report metadata from cache if available
      const cachedReports = queryClient.getQueryData<MeterReport[]>(['meterReports']);
      const reportMetadata = cachedReports?.find(report => report.id === reportId);
      
      if (!reportMetadata) {
        throw new Error('Report metadata not found');
      }
      
      // Create a temporary file
      const fileUri = FileSystem.documentDirectory + reportMetadata.fileName;
      
      // Convert blob to base64 and write to file
      const reader = new FileReader();
      reader.onload = async () => {
        const base64data = reader.result?.toString().split(',')[1];
        
        if (!base64data) {
          throw new Error('Failed to convert file');
        }
        
        await FileSystem.writeAsStringAsync(fileUri, base64data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Share the file with proper mime type
        const mimeType = reportMetadata.format === 'excel' 
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
          : 'application/pdf';
          
        await Sharing.shareAsync(fileUri, {
          mimeType: mimeType,
          UTI: reportMetadata.format === 'excel' ? 'com.microsoft.excel.xlsx' : 'com.adobe.pdf',
          dialogTitle: `Share Meter Readings Report`,
        });
      };
      
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error sharing report:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to share report');
    }
  };

  // Get default time range (last 7 days)
  const getDefaultTimeRange = (): ReportTimeRange => {
    return {
      startDate: subDays(new Date(), 7),
      endDate: new Date(),
    };
  };

  return {
    reports,
    isLoadingReports,
    isReportsError,
    isGenerating,
    generatedReportId,
    generateReport,
    openReport,
    shareReport,
    refetchReports,
    getDefaultTimeRange,
  };
}