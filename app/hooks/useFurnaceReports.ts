import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { Alert, Platform } from 'react-native';
import axios from 'axios';
import { getOrgHeaders } from '../api/auth';
import { apiConfig } from '../api/config';
import { subDays, addHours, format as formatDate } from 'date-fns';
import { ColumnGrouping, ExcelReportService } from '../services/ExcelReportService';
import { useAuth } from '../context/AuthContext';

export interface ReportTimeRange {
  startDate: Date;
  endDate: Date;
}

export type ReportFormat = 'excel' | 'pdf';
export type SortOrder = 'newest_first' | 'oldest_first';

export interface FurnaceReport {
  id: string;
  userId: string;
  title: string;
  format: string;
  fileName: string;
  fileSize: number;
  startDate: string;
  endDate: string;
  grouping: string;
  includeThresholds: boolean;
  includeStatusFields: boolean;
  alarmTypes: string[];
  severityLevels: string[];
  zones: string[];
  createdAt: string;
  metadata?: any;
}

interface ReportGeneratorOptions {
  title?: string;
  alarmTypes?: string[];
  severityLevels?: string[];
  zones?: string[];
  includeThresholds?: boolean;
  includeStatusFields?: boolean;
  grouping?: ColumnGrouping;
}

interface PaginatedReportsResponse {
  reports: FurnaceReport[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
}

export function useFurnaceReports() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [allReports, setAllReports] = useState<FurnaceReport[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const { organizationId } = useAuth();

  // Fetch reports from database with pagination
  const {
    data: reportsData,
    isLoading: isLoadingReports,
    isError: isReportsError,
    refetch: refetchReports,
  } = useQuery<PaginatedReportsResponse>({
    queryKey: ['furnaceReports', currentPage],
    queryFn: async () => {
      const headers = await getOrgHeaders(organizationId);
      
      // Fetch reports for the current page
      const { data } = await axios.get(
        `${apiConfig.apiUrl}/api/reports/furnace?page=${currentPage}&limit=10`,
        { headers }
      );
      
      // Update all reports list
      if (currentPage === 1) {
        setAllReports(data.reports);
      } else {
        setAllReports(prev => [...prev, ...data.reports]);
      }
      
      return data;
    },
    enabled: true,
  });

  const reports = allReports;
  const hasNextPage = reportsData?.pagination?.hasNextPage ?? false;

  // Load more reports for infinite scroll
  const loadMoreReports = useCallback(async () => {
    if (isLoadingMore || !hasNextPage) return;
    
    try {
      setIsLoadingMore(true);
      const nextPage = currentPage + 1;
      
      const headers = await getOrgHeaders(organizationId);
      const { data } = await axios.get(
        `${apiConfig.apiUrl}/api/reports/furnace?page=${nextPage}&limit=10`,
        { headers }
      );
      
      // Append new reports to existing list
      setAllReports(prev => [...prev, ...data.reports]);
      setCurrentPage(nextPage);
      
    } catch (error) {
      console.error('Error loading more reports:', error);
      Alert.alert('Error', 'Failed to load more reports');
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentPage, hasNextPage, isLoadingMore, organizationId]);

  // Reset pagination when refetching
  const handleRefetchReports = useCallback(async () => {
    setCurrentPage(1);
    setAllReports([]);
    await refetchReports();
  }, [refetchReports]);

  // Get default time range (last 1 hour)
  const getDefaultTimeRange = useCallback((): ReportTimeRange => {
    return {
      startDate: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      endDate: new Date(),
    };
  }, []);

  // Generate report
  const generateReport = useCallback(
    async (
      format: ReportFormat,
      timeRange: ReportTimeRange,
      alarmTypes: string[] = [],
      severityLevels: string[] = [],
      zones: string[] = [],
      grouping: ColumnGrouping = ColumnGrouping.NEWEST_FIRST,
      title?: string,
      includeThresholds: boolean = true,
      includeStatusFields: boolean = true,
      shouldSplit: boolean = false
    ): Promise<string> => {
      try {
        setIsGenerating(true);

        // Check if we need to split the report
        if (shouldSplit) {
          return await generateSplitReports(
            format, timeRange, alarmTypes, severityLevels, zones, 
            grouping, title, includeThresholds, includeStatusFields
          );
        }

        // Generate a title based on date range if not provided
        const reportTitle = title || (() => {
          const startFormatted = timeRange.startDate.toISOString().split('T')[0];
          const endFormatted = timeRange.endDate.toISOString().split('T')[0];
          return `Furnace_Report_${startFormatted}_to_${endFormatted}`;
        })();

        // Build a random filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.-]/g, '_');
        const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const sanitizedTitle = reportTitle.replace(/\s+/g, '_');
        
        // Use exact times from user selection (don't modify to full day)
        const startDate = new Date(timeRange.startDate);
        const endDate = new Date(timeRange.endDate);
        
        console.log('🕐 User selected time range:', {
          startDate: startDate.toLocaleString(),
          endDate: endDate.toLocaleString(),
          durationHours: ((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)).toFixed(2)
        });

        // Memory safety checks  
        const daysDifference = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        let filePath = '';
        let fileContent = '';
        let alarmData: any = null;
        let processedRecordCount = 0;
        
        if (format === 'excel') {
          // Fetch the data directly from API
          const headers = await getOrgHeaders(organizationId);
          
          // Smart limit calculation for SCADA data (1 record/second = 86,400/day)
          const timeDifferenceHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
          const actualRecordsPerHour = 3600; // SCADA records every second
          const maxSafeRecords = 5000; // Much more conservative limit for Excel property limits
          const maxRecommendedHours = 6; // Maximum 6 hours for SCADA data
          
          // Calculate safe limit based on actual time range in hours
          const estimatedTotal = Math.ceil(timeDifferenceHours * actualRecordsPerHour);
          const calculatedLimit = Math.min(estimatedTotal, maxSafeRecords);
          
          console.log('📊 Record calculation:', {
            timeDifferenceHours: timeDifferenceHours.toFixed(2),
            estimatedRecords: estimatedTotal,
            calculatedLimit,
            maxSafeRecords
          });
          
          // Warning for large time ranges
          if (timeDifferenceHours > maxRecommendedHours) {
            throw new Error(`Time range too large for SCADA data. Maximum recommended: ${maxRecommendedHours} hours (current: ${timeDifferenceHours.toFixed(1)} hours). SCADA generates 3,600 records per hour.`);
          }
          
          const params = new URLSearchParams({
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            limit: calculatedLimit.toString(),
            orderBy: grouping === ColumnGrouping.OLDEST_FIRST ? 'asc' : 'desc'
          });
          
          if (alarmTypes.length > 0) {
            alarmTypes.forEach(type => params.append('alarmTypes', type));
          }
          if (severityLevels.length > 0) {
            severityLevels.forEach(level => params.append('severityLevels', level));
          }
          if (zones.length > 0) {
            zones.forEach(zone => params.append('zones', zone));
          }
          
          // Debug: Log the API call parameters
          console.log('🔍 Fetching alarm data with parameters:');
          console.log('📅 Date Range:', {
            originalStart: timeRange.startDate,
            originalEnd: timeRange.endDate,
            formattedStart: startDate.toISOString(),
            formattedEnd: endDate.toISOString()
          });
          console.log('🔗 Full API URL:', `${apiConfig.apiUrl}/api/reports/alarm-data?${params.toString()}`);
          
          // Add memory and network error handling
          let result;
          try {
            console.log('🔄 Making API request with params:', {
              url: `${apiConfig.apiUrl}/api/reports/alarm-data`,
              limit: calculatedLimit,
              dateRange: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
              estimatedDays: daysDifference
            });

            const { data } = await axios.get(
              `${apiConfig.apiUrl}/api/reports/alarm-data?${params.toString()}`,
              { 
                headers,
                timeout: 60000, // 60 second timeout
                maxContentLength: 50 * 1024 * 1024, // 50MB max response size
                maxBodyLength: 50 * 1024 * 1024
              }
            );
            result = data;
          } catch (apiError: any) {
            console.error('❌ API Error:', apiError);
            
            // Handle specific error types
            if (apiError.code === 'ECONNABORTED') {
              throw new Error('Request timeout. The server took too long to respond. Please try a smaller date range.');
            }
            
            if (apiError.message?.includes('Network Error') || apiError.code === 'ERR_NETWORK') {
              throw new Error('Network error. Please check your connection and try again.');
            }
            
            // Handle memory-related errors from large responses
            if (apiError.message?.includes('OutOfMemoryError') || 
                apiError.message?.includes('allocation') ||
                apiError.response?.status === 413) {
              throw new Error(`Too much data for the selected time range. Please select a shorter time period (current: ${timeDifferenceHours.toFixed(1)} hours). For SCADA data, try 30 minutes to 2 hours maximum.`);
            }
            
            // Handle server errors
            if (apiError.response?.status >= 500) {
              throw new Error('Server error. Please try again later or contact support.');
            }
            
            // Handle client errors
            if (apiError.response?.status >= 400) {
              const errorMsg = apiError.response?.data?.message || 'Invalid request parameters.';
              throw new Error(errorMsg);
            }
            
            throw new Error(`Failed to fetch data: ${apiError.message || 'Unknown error'}`);
          }
          
          // Debug: Log the result and analyze date distribution
          const records = result?.data || [];
          let dateAnalysis = null;
          
          if (records.length > 0) {
            const timestamps = records.map((r: any) => new Date(r.created_timestamp)).sort();
            const earliestRecord = timestamps[0];
            const latestRecord = timestamps[timestamps.length - 1];
            
            // Check date distribution
            const dateGroups = records.reduce((acc: Record<string, number>, record: any) => {
              const date = new Date(record.created_timestamp).toDateString();
              acc[date] = (acc[date] || 0) + 1;
              return acc;
            }, {});
            
            dateAnalysis = {
              earliestRecord: earliestRecord.toISOString(),
              latestRecord: latestRecord.toISOString(),
              dateSpread: `${earliestRecord.toLocaleDateString()} to ${latestRecord.toLocaleDateString()}`,
              recordsPerDay: dateGroups,
              uniqueDays: Object.keys(dateGroups).length
            };
          }
          
          console.log('📊 API Response Analysis:', {
            totalRecords: records.length,
            hasData: records.length > 0,
            sampleRecord: records[0] || null,
            dateAnalysis
          });
          
          // Check if backend is properly filtering by time
          if (dateAnalysis) {
            const expectedStartTime = startDate.toISOString();
            const expectedEndTime = endDate.toISOString();
            const actualStartTime = dateAnalysis.earliestRecord;
            const actualEndTime = dateAnalysis.latestRecord;
            
            console.log('🔍 Time filtering analysis:', {
              expected: `${startDate.toLocaleString()} to ${endDate.toLocaleString()}`,
              actual: `${new Date(actualStartTime).toLocaleString()} to ${new Date(actualEndTime).toLocaleString()}`,
              recordsReturned: records.length
            });
            
            // Check if we're getting more data than expected for the time range
            const actualTimeSpanHours = (new Date(actualEndTime).getTime() - new Date(actualStartTime).getTime()) / (1000 * 60 * 60);
            if (actualTimeSpanHours > timeDifferenceHours * 2) {
              console.warn('⚠️ WARNING: Backend returned data for longer time span than requested!');
              console.warn('Expected hours:', timeDifferenceHours.toFixed(2));
              console.warn('Actual hours:', actualTimeSpanHours.toFixed(2));
            }
          }
          
          // Safeguard: Warn if we're getting excessive data
          if (records.length > 50000) {
            console.warn('⚠️ Large dataset detected:', records.length, 'records. This might impact performance.');
          }
          
          // Success: Log when we get a good date distribution
          if (dateAnalysis && dateAnalysis.uniqueDays > 1) {
            console.log('✅ Good data distribution across', dateAnalysis.uniqueDays, 'days');
          }
          
          if (!result || !result.data || result.data.length === 0) {
            const errorMsg = `No data found for the selected date range (${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}). Please check if data exists for this period.`;
            console.warn('⚠️ No data found:', {
              dateRange: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
              filters: { alarmTypes, severityLevels, zones },
              apiResponse: result
            });
            throw new Error(errorMsg);
          }
          
          alarmData = result;
          processedRecordCount = alarmData?.data?.length || 0;
          
          // Additional safety check for Excel generation
          if (processedRecordCount > 5000) {
            throw new Error(`Dataset too large for Excel generation (${processedRecordCount} records). For SCADA data, please select a smaller time range (30 minutes to 2 hours recommended).`);
          }
          
          console.log('✅ Record count safe for Excel generation:', processedRecordCount);
          
          // Use the passed grouping parameter directly
          
          // Use the ExcelReportService
          filePath = await ExcelReportService.generateExcelReport({
            alarmData: alarmData.data,
            title: sanitizedTitle,
            grouping,
            includeThresholds,
            includeStatusFields
          });
          
          // Read the file content to save to database
          fileContent = await FileSystem.readAsStringAsync(filePath, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } else {
          throw new Error(`Unsupported format: ${format}`);
        }
        
        // Get file info
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        const fileName = filePath.split('/').pop() || `${sanitizedTitle}.xlsx`;
        const fileSize = fileInfo.exists && !fileInfo.isDirectory ? fileInfo.size : 0;
        
        // Save to database
        const headers = await getOrgHeaders(organizationId);
        console.log('Attempting to save report to database...');
        console.log('Headers:', headers);
        console.log('Report title:', reportTitle);
        console.log('File size:', fileSize);
        
        try {
          const savePayload = {
            title: reportTitle,
            format,
            fileContent,
            fileName,
            fileSize,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            grouping: grouping.toString(),
            includeThresholds,
            includeStatusFields,
            alarmTypes,
            severityLevels,
            zones,
            metadata: {
              generatedAt: new Date().toISOString(),
              recordCount: alarmData?.data?.length || 0,
            }
          };
          
          console.log('Save payload size:', JSON.stringify(savePayload).length);
          
          const { data: result } = await axios.post(
            `${apiConfig.apiUrl}/api/reports/furnace`, 
            savePayload,
            { headers }
          );
          
          console.log('Report saved successfully:', result);
        } catch (saveError: any) {
          console.error('Save response error:', saveError);
          console.error('Error response:', saveError.response?.data);
          console.error('Error status:', saveError.response?.status);
          Alert.alert('Warning', 'Report generated but failed to save to database: ' + (saveError.response?.data?.error || saveError.message));
        }
        
        // Refresh the reports list after successful save
        handleRefetchReports();

        return filePath;
      } catch (error: any) {
        console.error('Error generating furnace report:', error);
        
        // Handle specific Excel property limit error
        if (error.message?.includes('Property storage exceeds') || 
            error.message?.includes('196607 properties')) {
          error.handled = true;
          Alert.alert(
            'Too Much Data for Excel',
            'Excel cannot handle this many records. For SCADA data (86,400 records/day), please select a much smaller time range:\n\n• Recommended: 2-6 hours maximum\n• SCADA generates 1 record per second\n• Large date ranges will exceed Excel limits'
          );
          throw error;
        }
        
        // Handle general memory/data size errors
        if (error.message?.includes('out of memory') || 
            error.message?.includes('allocation')) {
          error.handled = true;
          Alert.alert(
            'Data Size Too Large',
            'The selected date range contains too much SCADA data for processing.\n\n• Recommended: 2-6 hours maximum\n• SCADA generates 86,400 records per day\n• Please select a smaller time range'
          );
          throw error;
        }
        
        error.handled = true;
        
        Alert.alert(
          'Report Generation Failed',
          error.message || 'An unexpected error occurred while generating the report'
        );
        
        throw error;
      } finally {
        setIsGenerating(false);
      }
    },
    [organizationId, handleRefetchReports]
  );

  // Generate split reports for large time ranges
  const generateSplitReports = useCallback(
    async (
      format: ReportFormat,
      timeRange: ReportTimeRange,
      alarmTypes: string[] = [],
      severityLevels: string[] = [],
      zones: string[] = [],
      grouping: ColumnGrouping = ColumnGrouping.NEWEST_FIRST,
      title?: string,
      includeThresholds: boolean = true,
      includeStatusFields: boolean = true
    ): Promise<string> => {
      try {
        const startTime = timeRange.startDate;
        const endTime = timeRange.endDate;
        const timeDifferenceMs = endTime.getTime() - startTime.getTime();
        const timeDifferenceHours = timeDifferenceMs / (1000 * 60 * 60);
        
        // Calculate number of 1-hour chunks needed
        const chunkSizeHours = 1;
        const numberOfChunks = Math.ceil(timeDifferenceHours / chunkSizeHours);
        
        console.log(`📊 Splitting ${timeDifferenceHours.toFixed(1)} hours into ${numberOfChunks} chunks of ${chunkSizeHours} hour each`);
        
        const generatedReports: string[] = [];
        
        // Generate reports for each chunk
        for (let i = 0; i < numberOfChunks; i++) {
          const chunkStartTime = new Date(startTime.getTime() + (i * chunkSizeHours * 60 * 60 * 1000));
          const chunkEndTime = new Date(Math.min(
            chunkStartTime.getTime() + (chunkSizeHours * 60 * 60 * 1000),
            endTime.getTime()
          ));
          
          // Generate chunk title with time range
          const chunkTitle = title 
            ? `${title}_Part_${i + 1}_of_${numberOfChunks}_${formatDate(chunkStartTime, 'HH-mm')}_to_${formatDate(chunkEndTime, 'HH-mm')}`
            : `Furnace_Report_Part_${i + 1}_of_${numberOfChunks}_${formatDate(chunkStartTime, 'yyyy-MM-dd_HH-mm')}_to_${formatDate(chunkEndTime, 'HH-mm')}`;
          
          console.log(`📝 Generating chunk ${i + 1}/${numberOfChunks}: ${formatDate(chunkStartTime, 'PPp')} to ${formatDate(chunkEndTime, 'PPp')}`);
          
          try {
            // Generate report for this chunk (recursive call without shouldSplit)
            const chunkFilePath = await generateReport(
              format,
              { startDate: chunkStartTime, endDate: chunkEndTime },
              alarmTypes,
              severityLevels,
              zones,
              grouping,
              chunkTitle,
              includeThresholds,
              includeStatusFields,
              false // Don't split again
            );
            
            generatedReports.push(chunkFilePath);
            
            // Small delay between chunks to prevent overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 1000));
            
          } catch (chunkError) {
            console.error(`❌ Error generating chunk ${i + 1}:`, chunkError);
            Alert.alert(
              'Partial Success',
              `Generated ${generatedReports.length} of ${numberOfChunks} reports successfully. Chunk ${i + 1} failed: ${chunkError instanceof Error ? chunkError.message : 'Unknown error'}`
            );
            break;
          }
        }
        
        // Refresh reports list
        handleRefetchReports();
        
        // Show success message
        Alert.alert(
          'Split Reports Generated',
          `Successfully generated ${generatedReports.length} reports for your ${timeDifferenceHours.toFixed(1)}-hour time range.\n\nEach report covers ${chunkSizeHours} hour of data and can be found in your reports list.`,
          [{ text: 'OK' }]
        );
        
        // Return the first report path (for consistency with the interface)
        return generatedReports[0] || '';
        
      } catch (error) {
        console.error('Error in generateSplitReports:', error);
        throw error;
      }
    },
    [generateReport, handleRefetchReports]
  );

  // Open report from database
  const openReport = useCallback(async (reportId: string): Promise<void> => {
    try {
      // 1️⃣ Download the file
      const headers = await getOrgHeaders(organizationId);
      const response = await axios.get(`${apiConfig.apiUrl}/api/reports/furnace/${reportId}`, {
        headers,
        responseType: 'arraybuffer'
      });
      
      // 2️⃣ Retrieve metadata
      const cached = reports;
      const meta = cached?.find(r => r.id === reportId);
      if (!meta) throw new Error('Report metadata not found');
      
      const fileUri = FileSystem.documentDirectory + meta.fileName;
      
      // 3️⃣ Convert arraybuffer to base64 and write to file
      // Convert ArrayBuffer to base64
      const base64String = btoa(
        new Uint8Array(response.data)
          .reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      
      await FileSystem.writeAsStringAsync(fileUri, base64String, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const mime = meta.format === 'excel'
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
          dialogTitle: `Open Furnace Report`,
        });
      }
    } catch (error) {
      console.error('Error opening report:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to open report');
    }
  }, [reports, organizationId]);

  // Share report from database
  const shareReport = useCallback(async (reportId: string): Promise<void> => {
    try {
      const headers = await getOrgHeaders(organizationId);
      const response = await axios.get(`${apiConfig.apiUrl}/api/reports/furnace/${reportId}`, {
        headers,
        responseType: 'arraybuffer'
      });

      const fileName = `furnace_report_${reportId}.xlsx`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      // Convert ArrayBuffer to base64
      const base64String = btoa(
        new Uint8Array(response.data)
          .reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      
      await FileSystem.writeAsStringAsync(fileUri, base64String, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Share Furnace Report',
      });
    } catch (error) {
      console.error('Error sharing report:', error);
      Alert.alert('Error', 'Failed to share report');
    }
  }, [organizationId]);

  return {
    reports,
    isLoadingReports,
    isReportsError,
    isGenerating,
    generateReport,
    openReport,
    shareReport,
    refetchReports: handleRefetchReports,
    loadMoreReports,
    isLoadingMore,
    hasNextPage,
    getDefaultTimeRange,
  };
} 