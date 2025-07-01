import * as XLSX from 'xlsx';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { AlarmData } from '../hooks/useAlarmReportData';

export enum ColumnGrouping {
  BY_TYPE = 'by_type',
  BY_ZONE = 'by_zone',
  NEWEST_FIRST = 'newest_first',
  OLDEST_FIRST = 'oldest_first'
}

interface GenerateReportOptions {
  alarmData: AlarmData[];
  title: string;
  grouping?: ColumnGrouping;
  includeThresholds?: boolean;
  includeStatusFields?: boolean;
}

// Define an interface for the report object
interface ReportData {
  Timestamp: string;
  ID: number;
  [key: string]: any; // Allow additional dynamic properties
}

export class ExcelReportService {
  /**
   * Generates an Excel report from alarm data
   */
  static async generateExcelReport(options: GenerateReportOptions): Promise<string> {
    const { 
      alarmData, 
      title, 
      grouping = ColumnGrouping.NEWEST_FIRST,
      includeThresholds = true,
      includeStatusFields = true 
    } = options;

    // Create a new workbook
    const wb = XLSX.utils.book_new();
    
    // Process the data based on grouping option
    let processedData: any[];
    
    switch (grouping) {
      case ColumnGrouping.BY_TYPE:
        processedData = this.processDataByType(alarmData, includeThresholds, includeStatusFields);
        break;
      case ColumnGrouping.BY_ZONE:
        processedData = this.processDataByZone(alarmData, includeThresholds, includeStatusFields);
        break;
      case ColumnGrouping.OLDEST_FIRST:
        processedData = this.processDataChronologically(alarmData, includeThresholds, includeStatusFields, 'asc');
        break;
      case ColumnGrouping.NEWEST_FIRST:
      default:
        processedData = this.processDataChronologically(alarmData, includeThresholds, includeStatusFields, 'desc');
    }
    
    // Convert to worksheet
    const ws = XLSX.utils.json_to_sheet(processedData);
    
    // Make headers bold
    this.makeHeadersBold(ws, processedData);
    
    // Add column widths
    const colWidths = this.getColumnWidths(processedData);
    ws['!cols'] = colWidths.map(width => ({ wch: width }));
    
    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, "Alarm Data");
    
    // Generate a filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${title.replace(/\s+/g, '_')}_${timestamp}.xlsx`;
    
    // Save the file
    const filePath = await this.saveWorkbookToFile(wb, filename);
    
    return filePath;
  }
  
  /**
   * Process data chronologically (default)
   */
  private static processDataChronologically(
    alarmData: AlarmData[], 
    includeThresholds: boolean,
    includeStatusFields: boolean,
    sortOrder: 'asc' | 'desc' = 'desc'
  ): any[] {
    // Sort data based on sortOrder
    const sortedData = [...alarmData].sort((a, b) => {
      const dateA = new Date(a.created_timestamp).getTime();
      const dateB = new Date(b.created_timestamp).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
    return sortedData.map(record => {
      // Define an interface for the report object
      interface ReportData {
        Timestamp: string;
        ID: number;
        [key: string]: any; // Allow additional dynamic properties
      }

      // Update the baseObj type
      const baseObj: ReportData = {
        'Timestamp': new Date(record.created_timestamp).toLocaleString(),
        'ID': record.id,
      };
      
      // Add all analog fields with descriptive names (Fields 1-11)
      
      // 1. Hardening Zone 1 Set Value
      if (record.hz1sv !== undefined) {
        baseObj['Hardening Zone 1 Set Value'] = record.hz1sv;
      }
      
      // 2. Hardening Zone 1 Present Value
      if (record.hz1pv !== undefined) {
        baseObj['Hardening Zone 1 Present Value'] = record.hz1pv;
        
        if (includeThresholds) {
          baseObj['HZ1 High Threshold'] = record.hz1ht;
          baseObj['HZ1 Low Threshold'] = record.hz1lt;
        }
      }
      
      // 3. Hardening Zone 2 Set Value
      if (record.hz2sv !== undefined) {
        baseObj['Hardening Zone 2 Set Value'] = record.hz2sv;
      }
      
      // 4. Hardening Zone 2 Present Value
      if (record.hz2pv !== undefined) {
        baseObj['Hardening Zone 2 Present Value'] = record.hz2pv;
        
        if (includeThresholds) {
          baseObj['HZ2 High Threshold'] = record.hz2ht;
          baseObj['HZ2 Low Threshold'] = record.hz2lt;
        }
      }
      
      // 5. Carbon Potential Set Value
      if (record.cpsv !== undefined) {
        baseObj['Carbon Potential Set Value'] = record.cpsv;
      }
      
      // 6. Carbon Potential Present Value
      if (record.cppv !== undefined) {
        baseObj['Carbon Potential Present Value'] = record.cppv;
        
        if (includeThresholds) {
          baseObj['Carbon High Threshold'] = record.cph;
          baseObj['Carbon Low Threshold'] = record.cpl;
        }
      }
      
      // 7. Tempering Zone 1 Set Value
      if (record.tz1sv !== undefined) {
        baseObj['Tempering Zone 1 Set Value'] = record.tz1sv;
      }
      
      // 8. Tempering Zone 1 Present Value
      if (record.tz1pv !== undefined) {
        baseObj['Tempering Zone 1 Present Value'] = record.tz1pv;
        
        if (includeThresholds) {
          baseObj['TZ1 High Threshold'] = record.tz1ht;
          baseObj['TZ1 Low Threshold'] = record.tz1lt;
        }
      }
      
      // 9. Tempering Zone 2 Set Value
      if (record.tz2sv !== undefined) {
        baseObj['Tempering Zone 2 Set Value'] = record.tz2sv;
      }
      
      // 10. Tempering Zone 2 Present Value
      if (record.tz2pv !== undefined) {
        baseObj['Tempering Zone 2 Present Value'] = record.tz2pv;
        
        if (includeThresholds) {
          baseObj['TZ2 High Threshold'] = record.tz2ht;
          baseObj['TZ2 Low Threshold'] = record.tz2lt;
        }
      }
      
      // 11. Oil Temperature Present Value
      if (record.oilpv !== undefined) {
        baseObj['Oil Temperature Present Value'] = record.oilpv;
      }
      
      // Add binary status fields (Fields 12-18) - Always show as True/False
      if (includeStatusFields) {
        // 12. Oil Temperature High
        baseObj['Oil Temperature High'] = record.oiltemphigh ? 'True' : 'False';
        
        // 13. Oil Level High
        baseObj['Oil Level High'] = record.oillevelhigh ? 'True' : 'False';
        
        // 14. Oil Level Low
        baseObj['Oil Level Low'] = record.oillevellow ? 'True' : 'False';
        
        // 15. Hardening Zone 1 Heater Failure
        baseObj['Hardening Zone 1 Heater Failure'] = record.hz1hfail ? 'True' : 'False';
        
        // 16. Hardening Zone 2 Heater Failure
        baseObj['Hardening Zone 2 Heater Failure'] = record.hz2hfail ? 'True' : 'False';
        
        // 17. Hardening Zone 1 Fan Failure
        baseObj['Hardening Zone 1 Fan Failure'] = record.hz1fanfail ? 'True' : 'False';
        
        // 18. Hardening Zone 2 Fan Failure
        baseObj['Hardening Zone 2 Fan Failure'] = record.hz2fanfail ? 'True' : 'False';
        
        // 19. Tempering Zone 1 Fan Failure
        baseObj['Tempering Zone 1 Fan Failure'] = record.tz1fanfail ? 'True' : 'False';
        
        // 20. Tempering Zone 2 Fan Failure
        baseObj['Tempering Zone 2 Fan Failure'] = record.tz2fanfail ? 'True' : 'False';
      }
      
      return baseObj;
    });
  }
  
  /**
   * Process data grouped by type (temperature, carbon, oil, etc.)
   */
  private static processDataByType(
    alarmData: AlarmData[],
    includeThresholds: boolean,
    includeStatusFields: boolean
  ): any[] {
    return alarmData.map(record => {
      const timestamp = new Date(record.created_timestamp).toLocaleString();
      // Define an interface for the report object
      interface ReportData {
        Timestamp: string;
        ID: number;
        [key: string]: any; // Allow additional dynamic properties
      }

      // Update the baseObj type
      const baseObj: ReportData = {
        'Timestamp': timestamp,
        'ID': record.id,
      };
      
      // Temperature group
      if (record.hz1pv !== undefined || record.hz2pv !== undefined || 
          record.tz1pv !== undefined || record.tz2pv !== undefined) {
        
        baseObj['Temperature_HZ1_PV'] = record.hz1pv;
        baseObj['Temperature_HZ2_PV'] = record.hz2pv;
        baseObj['Temperature_TZ1_PV'] = record.tz1pv;
        baseObj['Temperature_TZ2_PV'] = record.tz2pv;
        
        baseObj['Temperature_HZ1_SP'] = record.hz1sv;
        baseObj['Temperature_HZ2_SP'] = record.hz2sv;
        baseObj['Temperature_TZ1_SP'] = record.tz1sv;
        baseObj['Temperature_TZ2_SP'] = record.tz2sv;
        
        if (includeThresholds) {
          baseObj['Temperature_HZ1_HT'] = record.hz1ht;
          baseObj['Temperature_HZ1_LT'] = record.hz1lt;
          baseObj['Temperature_HZ2_HT'] = record.hz2ht;
          baseObj['Temperature_HZ2_LT'] = record.hz2lt;
          baseObj['Temperature_TZ1_HT'] = record.tz1ht;
          baseObj['Temperature_TZ1_LT'] = record.tz1lt;
          baseObj['Temperature_TZ2_HT'] = record.tz2ht;
          baseObj['Temperature_TZ2_LT'] = record.tz2lt;
        }
      }
      
      // Carbon group
      if (record.cppv !== undefined) {
        baseObj['Carbon_PV'] = record.cppv;
        baseObj['Carbon_SP'] = record.cpsv;
        
        if (includeThresholds) {
          baseObj['Carbon_HT'] = record.cph;
          baseObj['Carbon_LT'] = record.cpl;
        }
      }
      
      // Other sensors group
      if (record.oilpv !== undefined || record.deppv !== undefined || record.postpv !== undefined) {
        baseObj['Other_Oil_Temp'] = record.oilpv;
        baseObj['Other_Depth'] = record.deppv;
        baseObj['Other_Post_Temp'] = record.postpv;
      }
      
      // Status group
      if (includeStatusFields) {
        // Oil status
        if (record.oiltemphigh || record.oillevelhigh || record.oillevellow) {
          baseObj['Status_Oil_Temp_High'] = record.oiltemphigh ? 'Yes' : '';
          baseObj['Status_Oil_Level_High'] = record.oillevelhigh ? 'Yes' : '';
          baseObj['Status_Oil_Level_Low'] = record.oillevellow ? 'Yes' : '';
        }
        
        // Heaters status
        if (record.hz1hfail || record.hz2hfail) {
          baseObj['Status_HZ1_Heater_Fail'] = record.hz1hfail ? 'Yes' : '';
          baseObj['Status_HZ2_Heater_Fail'] = record.hz2hfail ? 'Yes' : '';
        }
        
        // Conveyor status
        if (record.hardconfail || record.hardcontraip || record.oilconfail || 
            record.oilcontraip || record.tempconfail || record.tempcontraip) {
          baseObj['Status_Hard_Con_Fail'] = record.hardconfail ? 'Yes' : '';
          baseObj['Status_Hard_Con_Trip'] = record.hardcontraip ? 'Yes' : '';
          baseObj['Status_Oil_Con_Fail'] = record.oilconfail ? 'Yes' : '';
          baseObj['Status_Oil_Con_Trip'] = record.oilcontraip ? 'Yes' : '';
          baseObj['Status_Temp_Con_Fail'] = record.tempconfail ? 'Yes' : '';
          baseObj['Status_Temp_Con_Trip'] = record.tempcontraip ? 'Yes' : '';
        }
        
        // Fan status
        if (record.hz1fanfail || record.hz2fanfail || record.hz1fantrip || record.hz2fantrip ||
            record.tz1fanfail || record.tz2fanfail || record.tz1fantrip || record.tz2fantrip) {
          baseObj['Status_HZ1_Fan_Fail'] = record.hz1fanfail ? 'Yes' : '';
          baseObj['Status_HZ2_Fan_Fail'] = record.hz2fanfail ? 'Yes' : '';
          baseObj['Status_HZ1_Fan_Trip'] = record.hz1fantrip ? 'Yes' : '';
          baseObj['Status_HZ2_Fan_Trip'] = record.hz2fantrip ? 'Yes' : '';
          baseObj['Status_TZ1_Fan_Fail'] = record.tz1fanfail ? 'Yes' : '';
          baseObj['Status_TZ2_Fan_Fail'] = record.tz2fanfail ? 'Yes' : '';
          baseObj['Status_TZ1_Fan_Trip'] = record.tz1fantrip ? 'Yes' : '';
          baseObj['Status_TZ2_Fan_Trip'] = record.tz2fantrip ? 'Yes' : '';
        }
      }
      
      return baseObj;
    });
  }
  
  /**
   * Process data grouped by zone
   */
  private static processDataByZone(
    alarmData: AlarmData[],
    includeThresholds: boolean,
    includeStatusFields: boolean
  ): any[] {
    return alarmData.map(record => {
      const timestamp = new Date(record.created_timestamp).toLocaleString();
      // Define an interface for the report object
      interface ReportData {
        Timestamp: string;
        ID: number;
        [key: string]: any; // Allow additional dynamic properties
      }

      // Update the baseObj type
      const baseObj: ReportData = {
        'Timestamp': timestamp,
        'ID': record.id,
      };
      
      // Zone 1 
      if (record.hz1pv !== undefined || record.tz1pv !== undefined || 
          record.hz1hfail || record.hz1fanfail || record.hz1fantrip || 
          record.tz1fanfail || record.tz1fantrip) {
        
        baseObj['Zone1_HZ_Temp_PV'] = record.hz1pv;
        baseObj['Zone1_HZ_Temp_SP'] = record.hz1sv;
        baseObj['Zone1_TZ_Temp_PV'] = record.tz1pv;
        baseObj['Zone1_TZ_Temp_SP'] = record.tz1sv;
        
        if (includeThresholds) {
          baseObj['Zone1_HZ_Temp_HT'] = record.hz1ht;
          baseObj['Zone1_HZ_Temp_LT'] = record.hz1lt;
          baseObj['Zone1_TZ_Temp_HT'] = record.tz1ht;
          baseObj['Zone1_TZ_Temp_LT'] = record.tz1lt;
        }
        
        if (includeStatusFields) {
          baseObj['Zone1_HZ_Heater_Fail'] = record.hz1hfail ? 'Yes' : '';
          baseObj['Zone1_HZ_Fan_Fail'] = record.hz1fanfail ? 'Yes' : '';
          baseObj['Zone1_HZ_Fan_Trip'] = record.hz1fantrip ? 'Yes' : '';
          baseObj['Zone1_TZ_Fan_Fail'] = record.tz1fanfail ? 'Yes' : '';
          baseObj['Zone1_TZ_Fan_Trip'] = record.tz1fantrip ? 'Yes' : '';
        }
      }
      
      // Zone 2
      if (record.hz2pv !== undefined || record.tz2pv !== undefined || 
          record.hz2hfail || record.hz2fanfail || record.hz2fantrip || 
          record.tz2fanfail || record.tz2fantrip) {
        
        baseObj['Zone2_HZ_Temp_PV'] = record.hz2pv;
        baseObj['Zone2_HZ_Temp_SP'] = record.hz2sv;
        baseObj['Zone2_TZ_Temp_PV'] = record.tz2pv;
        baseObj['Zone2_TZ_Temp_SP'] = record.tz2sv;
        
        if (includeThresholds) {
          baseObj['Zone2_HZ_Temp_HT'] = record.hz2ht;
          baseObj['Zone2_HZ_Temp_LT'] = record.hz2lt;
          baseObj['Zone2_TZ_Temp_HT'] = record.tz2ht;
          baseObj['Zone2_TZ_Temp_LT'] = record.tz2lt;
        }
        
        if (includeStatusFields) {
          baseObj['Zone2_HZ_Heater_Fail'] = record.hz2hfail ? 'Yes' : '';
          baseObj['Zone2_HZ_Fan_Fail'] = record.hz2fanfail ? 'Yes' : '';
          baseObj['Zone2_HZ_Fan_Trip'] = record.hz2fantrip ? 'Yes' : '';
          baseObj['Zone2_TZ_Fan_Fail'] = record.tz2fanfail ? 'Yes' : '';
          baseObj['Zone2_TZ_Fan_Trip'] = record.tz2fantrip ? 'Yes' : '';
        }
      }
      
      // Carbon and other readings (not zone specific)
      if (record.cppv !== undefined) {
        baseObj['Carbon_PV'] = record.cppv;
        baseObj['Carbon_SP'] = record.cpsv;
        
        if (includeThresholds) {
          baseObj['Carbon_HT'] = record.cph;
          baseObj['Carbon_LT'] = record.cpl;
        }
      }
      
      if (record.oilpv !== undefined) {
        baseObj['Oil_Temp'] = record.oilpv;
      }
      
      if (record.deppv !== undefined) {
        baseObj['Depth'] = record.deppv;
      }
      
      if (record.postpv !== undefined) {
        baseObj['Post_Temp'] = record.postpv;
      }
      
      // Common status fields (not zone specific)
      if (includeStatusFields) {
        baseObj['Oil_Temp_High'] = record.oiltemphigh ? 'Yes' : '';
        baseObj['Oil_Level_High'] = record.oillevelhigh ? 'Yes' : '';
        baseObj['Oil_Level_Low'] = record.oillevellow ? 'Yes' : '';
        
        baseObj['Hard_Con_Fail'] = record.hardconfail ? 'Yes' : '';
        baseObj['Hard_Con_Trip'] = record.hardcontraip ? 'Yes' : '';
        baseObj['Oil_Con_Fail'] = record.oilconfail ? 'Yes' : '';
        baseObj['Oil_Con_Trip'] = record.oilcontraip ? 'Yes' : '';
        baseObj['Temp_Con_Fail'] = record.tempconfail ? 'Yes' : '';
        baseObj['Temp_Con_Trip'] = record.tempcontraip ? 'Yes' : '';
      }
      
      return baseObj;
    });
  }
  
  /**
   * Make headers bold in the worksheet
   */
  private static makeHeadersBold(ws: XLSX.WorkSheet, data: any[]): void {
    if (data.length === 0) return;
    
    // Get column names from the first row
    const columns = Object.keys(data[0]);
    
    // Apply bold formatting to header row (row 1)
    columns.forEach((_, colIndex) => {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: colIndex });
      const cell = ws[cellAddress];
      
      if (cell) {
        // Initialize cell style if it doesn't exist
        if (!cell.s) {
          cell.s = {};
        }
        
        // Set font to bold
        cell.s.font = {
          bold: true,
          name: 'Calibri',
          sz: 11
        };
        
        // Optional: Add background color for better visibility
        cell.s.fill = {
          fgColor: { rgb: 'E7E6E6' }
        };
        
        // Optional: Add border
        cell.s.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
    });
  }

  /**
   * Get appropriate column widths based on the data
   */
  private static getColumnWidths(data: any[]): number[] {
    if (data.length === 0) {
      return [];
    }
    
    // Get column names from the first row
    const columns = Object.keys(data[0]);
    
    // Calculate widths
    return columns.map(column => {
      // Default width for timestamp columns (wider)
      if (column.includes('Timestamp') || column.includes('timestamp')) {
        return 20;
      }
      
      // Default width for value columns
      return Math.max(column.length, 12);
    });
  }
  
  /**
   * Save workbook to a file and return the file path
   */
  private static async saveWorkbookToFile(wb: XLSX.WorkBook, filename: string): Promise<string> {
    // Write to binary string with cellStyles enabled to preserve formatting
    const wbout = XLSX.write(wb, { 
      bookType: 'xlsx', 
      type: 'base64',
      cellStyles: true // Enable cell styles for bold headers and formatting
    });
    
    // Create file path
    const filePath = `${FileSystem.documentDirectory}${filename}`;
    
    try {
      // Write file
      await FileSystem.writeAsStringAsync(filePath, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      return filePath;
    } catch (error) {
      console.error('Error saving Excel file:', error);
      throw error;
    }
  }
  
  /**
   * Share the Excel file
   */
  static async shareExcelFile(filePath: string): Promise<void> {
    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        // Check if sharing is available
        const isAvailable = await Sharing.isAvailableAsync();
        if (!isAvailable) {
          throw new Error('Sharing is not available on this device');
        }
        
        // Share file
        await Sharing.shareAsync(filePath, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Share Excel Report',
          UTI: 'com.microsoft.excel.xlsx',
        });
      } else {
        throw new Error('File sharing is only available on iOS and Android');
      }
    } catch (error) {
      console.error('Error sharing Excel file:', error);
      throw error;
    }
  }
} 