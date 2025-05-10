import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Notifications from 'expo-notifications';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import { format as formatDate } from 'date-fns';
import { generateReportHtml } from './pdfGenerator';
import { ReportData, ReportFilters, reportsApi } from '../api/reportsApi';
import { ReportFormat, ReportTimeRange } from '../components/ReportGenerator';

const DOWNLOADS_DIRECTORY = `${FileSystem.documentDirectory}downloads/`;

/**
 * Custom error classes for better error handling
 */
export class ReportGenerationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ReportGenerationError';
  }
}

export class ReportFileError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ReportFileError';
  }
}

export class ReportSharingError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ReportSharingError';
  }
}

/**
 * Get MIME type based on file extension
 */
const getMimeType = (filePath: string): string => {
  const extension = filePath.split('.').pop()?.toLowerCase() || '';
  
  switch (extension) {
    case 'pdf':
      return 'application/pdf';
    case 'xlsx':
    case 'xls':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'csv':
      return 'text/csv';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    default:
      return 'application/octet-stream';
  }
};

/**
 * Service for handling report generation and management
 */
export const reportService = {
  /**
   * Generate a report in the specified format
   */
  generateReport: async (
    reportFormat: ReportFormat,
    timeRange: ReportTimeRange,
    filters: Partial<ReportFilters> = {}
  ): Promise<string> => {
    try {
      // Ensure downloads directory exists
      await reportService.ensureDownloadsDirectory();
      
      // Fetch report data
      const reportData = await reportsApi.fetchReportData({
        timeRange,
        ...filters,
      });
      
      // Generate filename
      const timestamp = formatDate(new Date(), 'yyyyMMdd-HHmmss');
      const fileName = `eagle-report-${timestamp}.${reportFormat === 'pdf' ? 'pdf' : 'xlsx'}`;
      const filePath = `${DOWNLOADS_DIRECTORY}${fileName}`;
      
      // Generate the appropriate report format
      if (reportFormat === 'pdf') {
        return await reportService.generatePdfReport(reportData, timeRange, filePath);
      } else {
        // For this implementation, we'll just use PDF for all formats
        // In a real app, you would implement Excel generation here
        return await reportService.generatePdfReport(reportData, timeRange, filePath);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      throw new ReportGenerationError(
        `Failed to generate ${reportFormat.toUpperCase()} report`,
        error
      );
    }
  },
  
  /**
   * Generate a PDF report
   */
  generatePdfReport: async (
    reportData: ReportData,
    timeRange: ReportTimeRange,
    filePath: string
  ): Promise<string> => {
    try {
      // Generate HTML content
      const html = generateReportHtml(reportData, timeRange, 'Eagle Alarm Report');
      
      // Generate PDF from HTML
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });
      
      // Copy file to our downloads directory
      await FileSystem.moveAsync({
        from: uri,
        to: filePath,
      });
      
      // Send notification
      await reportService.sendDownloadNotification('PDF', filePath);
      
      return filePath;
    } catch (error) {
      console.error('Error generating PDF report:', error);
      throw new ReportGenerationError('Failed to generate PDF report', error);
    }
  },
  
  /**
   * Open a report file
   */
  openReport: async (filePath: string): Promise<void> => {
    try {
      if (Platform.OS === 'ios') {
        // On iOS, we can use the Sharing API to view the file
        await Sharing.shareAsync(filePath);
      } else if (Platform.OS === 'android') {
        // On Android, we can use IntentLauncher to open the file
        const contentUri = await FileSystem.getContentUriAsync(filePath);
        
        // Get proper MIME type for the file
        const mimeType = getMimeType(filePath);
        
        // Launch intent to view the file
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          type: mimeType,
        });
      }
    } catch (error) {
      console.error('Error opening report:', error);
      throw new ReportFileError('Failed to open report', error);
    }
  },
  
  /**
   * Share a report file
   */
  shareReport: async (filePath: string): Promise<void> => {
    try {
      await Sharing.shareAsync(filePath);
    } catch (error) {
      console.error('Error sharing report:', error);
      throw new ReportSharingError('Failed to share report', error);
    }
  },
  
  /**
   * Ensure downloads directory exists
   */
  ensureDownloadsDirectory: async (): Promise<void> => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(DOWNLOADS_DIRECTORY);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DOWNLOADS_DIRECTORY, { intermediates: true });
      }
    } catch (error) {
      console.error('Error ensuring downloads directory:', error);
      throw new ReportFileError('Failed to create downloads directory', error);
    }
  },
  
  /**
   * Set up notification handlers for report interactions
   */
  setupNotificationHandlers: () => {
    // Set up notification handler for when user taps on notification
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    
    // Set up response handler for notification actions
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const { filePath, action } = response.notification.request.content.data as { 
        filePath: string;
        action?: 'open' | 'share';
      };
      
      if (filePath) {
        if (action === 'share') {
          reportService.shareReport(filePath).catch(console.error);
        } else {
          // Default action is to open the file
          reportService.openReport(filePath).catch(console.error);
        }
      }
    });
    
    // Note: In a real app, you'd want to store this subscription and unsubscribe
    // when appropriate (e.g., in a useEffect cleanup in your main component)
    return subscription;
  },
  
  /**
   * Send a notification for a downloaded report
   */
  sendDownloadNotification: async (format: string, filePath: string): Promise<void> => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${format} Report Ready`,
          body: 'Tap to view your report or use actions to share it',
          data: { filePath, action: 'open' },
          // Add actions that user can take directly from notification
          categoryIdentifier: 'report',
        },
        trigger: null, // Send immediately
      });
      
      // Register the category with actions if on iOS
      if (Platform.OS === 'ios') {
        await Notifications.setNotificationCategoryAsync('report', [
          {
            identifier: 'open',
            buttonTitle: 'View',
            options: {
              isDestructive: false,
              isAuthenticationRequired: false,
            },
          },
          {
            identifier: 'share',
            buttonTitle: 'Share',
            options: {
              isDestructive: false,
              isAuthenticationRequired: false,
            },
          },
        ]);
      }
    } catch (error) {
      console.error('Error sending download notification:', error);
      // Don't throw here, just log - we don't want to fail the report generation
      // if notification fails
    }
  },
}; 