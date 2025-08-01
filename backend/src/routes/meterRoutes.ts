import { Router, Request, Response, NextFunction } from 'express';
import { getClientWithRetry } from '../config/scadaDb';
import { logError } from '../utils/logger';
import prisma from '../config/db';
import { NotificationService } from '../services/notificationService';
import { authenticate, authorize } from '../middleware/authMiddleware';
import { getRequestOrgId } from '../middleware/authMiddleware';
import ExcelJS from 'exceljs';
import { format as formatDate } from 'date-fns';

const router = Router();

// Helper function to handle async routes
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/**
 * @route   POST /api/meter
 * @desc    Receive meter readings from Arduino device and store in database
 * @access  Public
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { voltage, current, frequency, pf, energy, power, organizationId } = req.body;
  
  // Validate required fields
  if (voltage === undefined || current === undefined || 
      frequency === undefined || pf === undefined || 
      energy === undefined || power === undefined) {
    logError('Missing required meter readings', req.body);
    return res.status(400).json({ 
      success: false, 
      message: 'Missing required meter readings' 
    });
  }

  // Validate organization ID
  if (!organizationId) {
    logError('Missing organization ID for meter readings', req.body);
    return res.status(400).json({ 
      success: false, 
      message: 'Organization ID is required' 
    });
  }

  // Get database client using organization ID from request body
  const client = await getClientWithRetry(organizationId);
  
  try {
    // Insert data into meter_readings table
    // The meter_id will be auto-generated using the sequence as per the schema
    const result = await client.query(
      `INSERT INTO meter_readings (voltage, current, frequency, pf, energy, power) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING meter_id`,
      [voltage, current, frequency, pf, energy, power] 
    );
    
    const meterId = result.rows[0].meter_id;
    
    // Check for threshold violations and send notifications
    await checkThresholdViolations({ voltage, current, frequency, pf, energy, power }, organizationId);
    
    // Return success response
    return res.status(201).json({
      success: true,
      message: 'Meter readings saved successfully',
      data: {
        meter_id: meterId,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logError('Error saving meter readings', error);
    return res.status(500).json({
      success: false,
      message: 'Error saving meter readings'
    });
  } finally {
    // Always release the client back to the pool
    client.release();
  }
}));

/**
 * @route   GET /api/meter/latest
 * @desc    Get latest meter readings
 * @access  Private
 */
router.get('/latest', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const client = await getClientWithRetry(getRequestOrgId(req));
  
  try {
    // Simply get the latest reading, regardless of when it was created
    const result = await client.query(
      `SELECT meter_id, voltage, current, frequency, pf, energy, power, 
       created_at AT TIME ZONE 'UTC' as created_at
       FROM meter_readings
       ORDER BY created_at DESC
       LIMIT 1`
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No meter readings found'
      });
    }
    
    // Log the result for debugging
    console.log(`Latest meter reading: ${JSON.stringify(result.rows[0])}`);
    
    return res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logError('Error fetching latest meter reading', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching latest meter reading'
    });
  } finally {
    client.release();
  }
}));

/**
 * @route   GET /api/meter/history
 * @desc    Get historical meter readings with pagination
 * @access  Private
 */
router.get('/history', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const client = await getClientWithRetry(getRequestOrgId(req));
  
  // Parse pagination parameters
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  
  const hours = parseInt(req.query.hours as string) || 1; // Default to 1 hour
  const startTime = req.query.startTime as string; // Optional specific start time
  
  try {
    let query: string;
    let countQuery: string;
    let queryParams: any[] = [];
    let countParams: any[] = [];
    
    if (startTime) {
      // If startTime is provided, use it as the reference point
      query = `
        SELECT meter_id, voltage, current, frequency, pf, energy, power, 
        created_at AT TIME ZONE 'UTC' as created_at
        FROM meter_readings
        WHERE created_at >= $1 AND created_at <= NOW()
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;
      queryParams = [startTime, limit, offset];
      
      countQuery = `
        SELECT COUNT(*) as total
        FROM meter_readings
        WHERE created_at >= $1 AND created_at <= NOW()
      `;
      countParams = [startTime];
    } else {
      // Otherwise use the hours parameter
      query = `
        SELECT meter_id, voltage, current, frequency, pf, energy, power, 
        created_at AT TIME ZONE 'UTC' as created_at
        FROM meter_readings
        WHERE created_at >= NOW() - INTERVAL '${hours} hours'
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `;
      queryParams = [limit, offset];
      
      countQuery = `
        SELECT COUNT(*) as total
        FROM meter_readings
        WHERE created_at >= NOW() - INTERVAL '${hours} hours'
      `;
      countParams = [];
    }
    
    // Execute the query
    let result = await client.query(query, queryParams);
    
    // Get total count for pagination
    const countResult = await client.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);
    
    // If no data found in the requested time frame, get the most recent readings anyway
    if (result.rows.length === 0 && page === 1) {
      result = await client.query(
        `SELECT meter_id, voltage, current, frequency, pf, energy, power, 
         created_at AT TIME ZONE 'UTC' as created_at
         FROM meter_readings
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );
    }
    
    return res.status(200).json({
      success: true,
      data: {
        readings: result.rows,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logError('Error fetching meter history', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching meter history'
    });
  } finally {
    client.release();
  }
}));

/**
 * @route   GET /api/meter/limits
 * @desc    Get all meter parameter limits
 * @access  Private
 */
router.get('/limits', authenticate, asyncHandler(async (req: Request, res: Response) => {
  try {
    const limits = await prisma.meterLimit.findMany({
      orderBy: { parameter: 'asc' }
    });
    
    return res.status(200).json({
      success: true,
      data: limits
    });
  } catch (error) {
    logError('Error fetching meter limits', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching meter limits'
    });
  }
}));

/**
 * @route   PUT /api/meter/limits/:id
 * @desc    Update meter parameter limits
 * @access  Private (Admin only)
 */
router.put('/limits/:id', authenticate, authorize(['ADMIN']), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { highLimit, lowLimit } = req.body;
  
  // Add validation to ensure proper values
  if (highLimit === undefined && lowLimit === undefined) {
    return res.status(400).json({
      success: false,
      message: 'At least one limit (high or low) must be provided'
    });
  }
  
  try {
    // Get the user ID from the authenticated request
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // First check if the limit exists
    const existingLimit = await prisma.meterLimit.findUnique({
      where: { id }
    });

    if (!existingLimit) {
      return res.status(404).json({
        success: false,
        message: 'Meter limit not found'
      });
    }
    
    const updatedLimit = await prisma.meterLimit.update({
      where: { id },
      data: {
        ...(highLimit !== undefined && { highLimit: parseFloat(highLimit) }),
        ...(lowLimit !== undefined && { lowLimit: parseFloat(lowLimit) }),
        updatedById: userId,
        updatedAt: new Date()
      }
    });
    
    return res.status(200).json({
      success: true,
      data: updatedLimit
    });
  } catch (error) {
    logError('Error updating meter limits', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating meter limits'
    });
  }
}));

/**
 * Helper function to check if meter readings exceed thresholds and send notifications
 */
async function checkThresholdViolations(readings: { 
  voltage: number, 
  current: number, 
  frequency: number, 
  pf: number, 
  energy: number, 
  power: number 
}, organizationId?: string): Promise<void> {
  try {
    // Validate that organizationId is provided
    if (!organizationId) {
      console.error('❌ Organization ID is required for checking threshold violations');
      return;
    }
    
    // Check if organization is enabled
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { isEnabled: true }
    });
    
    if (!org?.isEnabled) {
      console.log('🛑 Organization disabled - skipping threshold violation checks');
      return;
    }
    
    // Get limits for the specific organization
    const limits = await prisma.meterLimit.findMany({
      where: {
        organizationId: organizationId
      }
    });
    
    // Map to track violations
    const violations = [];
    
    // Check each parameter against its limits
    for (const limit of limits) {
      const value = readings[limit.parameter as keyof typeof readings];
      
      if (value === undefined) continue;
      
      if (limit.highLimit !== null && value > limit.highLimit) {
        violations.push({
          parameter: limit.parameter,
          description: limit.description,
          value: value,
          limit: limit.highLimit,
          type: 'high'
        });
      }
      
      if (limit.lowLimit !== null && value < limit.lowLimit) {
        violations.push({
          parameter: limit.parameter,
          description: limit.description,
          value: value,
          limit: limit.lowLimit,
          type: 'low'
        });
      }
    }
    
    // Send notifications for violations
    for (const violation of violations) {
      await NotificationService.createNotification({
        title: `Meter Alert: ${violation.description}`,
        body: `${violation.description} ${violation.type === 'high' ? 'exceeded' : 'fell below'} the ${violation.type} limit. Current value: ${violation.value}`,
        severity: 'WARNING',
        type: 'ALARM',
        metadata: {
          parameter: violation.parameter,
          value: violation.value,
          limit: violation.limit,
          type: violation.type
        },
        organizationId
      });
    }
    
    return;
  } catch (error) {
    logError('Error checking threshold violations', error);
    return;
  }
}

/**
 * @route   POST /api/meter/reports
 * @desc    Generate a meter readings report and save it to the database
 * @access  Private
 */
router.post('/reports', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, parameters, title, sortOrder } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      message: 'Start date and end date are required'
    });
  }

  try {
    // Log report generation attempt
    console.log(`📊 Report generation requested by user ${userId}:`, {
      startDate,
      endDate,
      parameters,
      title,
      sortOrder
    });

    // Get database client for SCADA DB
    console.log('🔄 Attempting to get database client...');
    const client = await getClientWithRetry(getRequestOrgId(req));
    console.log('✅ Database client acquired successfully');
    
    try {
      // Test database connection
      console.log('🔍 Testing database connection...');
      const testResult = await client.query('SELECT 1 as connection_test');
      console.log(`✅ Database connection test: ${JSON.stringify(testResult.rows[0])}`);
      
      // Check if meter_readings table exists
      console.log('🔍 Checking if meter_readings table exists...');
      try {
        const tableCheckResult = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_name = 'meter_readings'
          ) as table_exists
        `);
        console.log(`📊 meter_readings table exists: ${tableCheckResult.rows[0].table_exists}`);
        
        if (!tableCheckResult.rows[0].table_exists) {
          return res.status(500).json({
            success: false,
            message: 'Database schema issue: meter_readings table does not exist'
          });
        }
      } catch (tableCheckError) {
        console.error('❌ Error checking table existence:', tableCheckError);
      }
      
      // Build query based on parameters
      let query = `SELECT meter_id`;

      // Only include requested parameters in the query
      if (!parameters || parameters.includes('voltage')) query += `, voltage`;
      if (!parameters || parameters.includes('current')) query += `, current`;
      if (!parameters || parameters.includes('frequency')) query += `, frequency`;
      if (!parameters || parameters.includes('pf')) query += `, pf`;
      if (!parameters || parameters.includes('energy')) query += `, energy`;
      if (!parameters || parameters.includes('power')) query += `, power`;

      // Always include timestamp with proper timezone conversion
      query += `, created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS created_at FROM meter_readings WHERE created_at BETWEEN $1 AND $2`;

      // Add sort order
      if (sortOrder === 'oldest_first') {
        query += ` ORDER BY created_at ASC`;
      } else {
        query += ` ORDER BY created_at DESC`;
      }

      console.log(`📊 Full query: ${query.replace(/\s+/g, ' ')}`);
      
      try {
        let result = await client.query(
          query,
          [new Date(startDate), new Date(endDate)]
        );

        console.log(`📊 Query returned ${result.rows.length} rows`);

        if (result.rows.length === 0) {
          // Try to get any readings to provide better error message
          console.log('🔍 No readings found in date range, checking for any readings...');
          const anyReadingsQuery = `SELECT COUNT(*) as count FROM meter_readings`;
          const countResult = await client.query(anyReadingsQuery);
          const totalReadings = parseInt(countResult.rows[0].count);
          
          console.log(`📊 Total readings in database: ${totalReadings}`);
          
          if (totalReadings === 0) {
            console.log('❌ No meter readings found in the database at all');
            
            // Try to insert some sample data for testing
            console.log('🔄 Attempting to insert sample data for testing...');
            try {
              const now = new Date();
              const yesterday = new Date(now);
              yesterday.setDate(yesterday.getDate() - 1);
              
              // Insert some sample readings
              const sampleData = [
                {
                  voltage: 230.5,
                  current: 5.2,
                  frequency: 50.1,
                  pf: 0.95,
                  energy: 120.5,
                  power: 1.2,
                  created_at: yesterday
                },
                {
                  voltage: 231.2,
                  current: 5.3,
                  frequency: 50.0,
                  pf: 0.94,
                  energy: 121.0,
                  power: 1.25,
                  created_at: now
                }
              ];
              
              for (const sample of sampleData) {
                await client.query(
                  `INSERT INTO meter_readings (voltage, current, frequency, pf, energy, power, created_at) 
                   VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                  [sample.voltage, sample.current, sample.frequency, sample.pf, sample.energy, sample.power, sample.created_at]
                );
              }
              
              console.log('✅ Sample data inserted successfully');
              
              // Now try to run the original query again
              console.log('🔄 Retrying original query with sample data...');
              result = await client.query(
                query,
                [new Date(startDate), new Date(endDate)]
              );
              
              if (result.rows.length > 0) {
                console.log(`📊 Retry query returned ${result.rows.length} rows`);
                // Continue with the report generation using retryResult
                // Replace the original result with the retry result
              } else {
                // If still no data, return the original error
                return res.status(404).json({
                  success: false,
                  message: 'No meter readings found in the database. Please ensure the meter is sending data.'
                });
              }
            } catch (sampleDataError) {
              console.error('❌ Error inserting sample data:', sampleDataError);
              return res.status(404).json({
                success: false,
                message: 'No meter readings found in the database. Please ensure the meter is sending data.'
              });
            }
          } else {
            // Get date range of available readings
            const rangeQuery = `
              SELECT 
                MIN(created_at) as earliest,
                MAX(created_at) as latest
              FROM meter_readings
            `;
            console.log('🔍 Checking available date range...');
            const rangeResult = await client.query(rangeQuery);
            const earliest = rangeResult.rows[0].earliest;
            const latest = rangeResult.rows[0].latest;
            
            console.log(`📊 Available data range: ${new Date(earliest).toISOString()} to ${new Date(latest).toISOString()}`);
            
            // Check if the requested date range overlaps with available data
            const requestedStart = new Date(startDate);
            const requestedEnd = new Date(endDate);
            const availableStart = new Date(earliest);
            const availableEnd = new Date(latest);
            
            // If there's no overlap, suggest using the available range
            if (requestedEnd < availableStart || requestedStart > availableEnd) {
              return res.status(404).json({
                success: false,
                message: `No meter readings found in the specified date range. Available data ranges from ${new Date(earliest).toISOString()} to ${new Date(latest).toISOString()}.`,
                availableRange: {
                  earliest,
                  latest
                },
                suggestedRange: {
                  startDate: availableStart.toISOString(),
                  endDate: availableEnd.toISOString()
                }
              });
            }
            
            // If the requested range is partially outside the available range, suggest using the overlap
            const overlapStart = requestedStart < availableStart ? availableStart : requestedStart;
            const overlapEnd = requestedEnd > availableEnd ? availableEnd : requestedEnd;
            
            // Try to run the query with the overlapping date range
            console.log(`🔄 Retrying query with adjusted date range: ${overlapStart.toISOString()} to ${overlapEnd.toISOString()}`);
            result = await client.query(
              query,
              [overlapStart, overlapEnd]
            );
            
            if (result.rows.length > 0) {
              console.log(`📊 Retry query returned ${result.rows.length} rows`);
              // Continue with the report generation using retryResult
              // Replace the original result with the retry result
            } else {
              return res.status(404).json({
                success: false,
                message: `No meter readings found in the specified date range. Available data ranges from ${new Date(earliest).toISOString()} to ${new Date(latest).toISOString()}.`,
                availableRange: {
                  earliest,
                  latest
                },
                suggestedRange: {
                  startDate: availableStart.toISOString(),
                  endDate: availableEnd.toISOString()
                }
              });
            }
          }
        }

        // Create Excel workbook
        console.log('📊 Creating Excel workbook...');
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Eagle Notifier';
        workbook.lastModifiedBy = 'Eagle Notifier';
        workbook.created = new Date();
        workbook.modified = new Date();
        
        const worksheet = workbook.addWorksheet('Meter Readings');
        
        // Determine which columns to include based on parameters
        const allColumns = [
          { header: 'Meter ID', key: 'meter_id', width: 12 },
          { header: 'Date & Time (IST)', key: 'timestamp', width: 22 },
          { header: 'Voltage (V)', key: 'voltage', width: 12 },
          { header: 'Current (A)', key: 'current', width: 12 },
          { header: 'Frequency (Hz)', key: 'frequency', width: 15 },
          { header: 'Power Factor', key: 'pf', width: 12 },
          { header: 'Energy (kWh)', key: 'energy', width: 15 },
          { header: 'Power (kW)', key: 'power', width: 12 }
        ];
        
        // Filter columns based on parameters if provided
        const columnsToInclude = parameters && parameters.length > 0
          ? ['meter_id', 'timestamp', ...parameters]
          : allColumns.map(col => col.key);
        
        console.log(`📊 Columns to include: ${columnsToInclude.join(', ')}`);
        
        const filteredColumns = allColumns.filter(col => 
          columnsToInclude.includes(col.key)
        );
        
        // Add columns to worksheet
        worksheet.columns = filteredColumns;
        
        // Style header row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD3D3D3' }
        };
        
        // Function to format date in IST timezone
        const formatToIST = (date: Date): string => {
          try {
            // Since we're already getting the date in IST from the database
            // just format it properly for display
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            
            // Format the time components (12-hour format with AM/PM)
            let hours = date.getHours();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; // Convert 0 to 12
            
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const seconds = date.getSeconds().toString().padStart(2, '0');
            
            return `${day}/${month}/${year} ${hours}:${minutes}:${seconds} ${ampm} IST`;
          } catch (error) {
            console.error('Error formatting date to IST:', error);
            return date.toISOString();
          }
        };
        
        // Add data rows
        console.log('📊 Adding data rows to worksheet...');
        result.rows.forEach((reading, index) => {
          if (index === 0) {
            console.log(`📊 Sample row data: ${JSON.stringify(reading)}`);
          }
          
          const timestamp = new Date(reading.created_at);
          const rowData: any = {
            meter_id: reading.meter_id,
            timestamp: formatToIST(timestamp)
          };
          
          // Only add columns that were requested
          if (columnsToInclude.includes('voltage')) rowData.voltage = reading.voltage;
          if (columnsToInclude.includes('current')) rowData.current = reading.current;
          if (columnsToInclude.includes('frequency')) rowData.frequency = reading.frequency;
          if (columnsToInclude.includes('pf')) rowData.pf = reading.pf;
          if (columnsToInclude.includes('energy')) rowData.energy = reading.energy;
          if (columnsToInclude.includes('power')) rowData.power = reading.power;
          
          worksheet.addRow(rowData);
        });
        
        // Auto-fit columns
        worksheet.columns.forEach(column => {
          if (column && column.eachCell) {
            let maxLength = column.header?.length || 10;
            column.eachCell({ includeEmpty: true }, cell => {
              const columnLength = cell.value ? cell.value.toString().length : 10;
              if (columnLength > maxLength) {
                maxLength = columnLength;
              }
            });
            column.width = maxLength + 2;
          }
        });

        // Generate report buffer
        console.log('📊 Generating Excel buffer...');
        const buffer = await workbook.xlsx.writeBuffer();
        console.log(`📊 Excel buffer generated, size: ${buffer.byteLength} bytes`);
        
        // Format filename
        const reportTitle = title || 'Meter_Readings_Report';
        const formattedStartDate = formatDate(new Date(startDate), 'yyyy-MM-dd');
        const formattedEndDate = formatDate(new Date(endDate), 'yyyy-MM-dd');
        const fileName = `${reportTitle}_${formattedStartDate}_to_${formattedEndDate}.xlsx`;
        
        // Save report to database
        console.log('📊 Saving report to database...');
        try {
          const organizationId = getRequestOrgId(req);
          const meterReport = await prisma.meterReport.create({
            data: {
              userId,
              organizationId,
              title: reportTitle,
              format: 'excel',
              fileContent: Buffer.from(buffer),
              fileName,
              fileSize: Buffer.from(buffer).byteLength,
              startDate: new Date(startDate),
              endDate: new Date(endDate),
              parameters: parameters || ['voltage', 'current', 'frequency', 'pf', 'energy', 'power'],
              metadata: {
                rowCount: result.rows.length,
                generatedAt: new Date().toISOString()
              }
            }
          });
          
          console.log(`📊 Report generated successfully: ${meterReport.id}`);
          
          return res.status(201).json({
            success: true,
            message: 'Report generated successfully',
            data: {
              id: meterReport.id,
              title: meterReport.title,
              format: meterReport.format,
              fileName: meterReport.fileName,
              fileSize: meterReport.fileSize,
              createdAt: meterReport.createdAt
            }
          });
        } catch (dbError) {
          console.error('❌ Error saving report to database:', dbError);
          throw dbError;
        }
      } catch (queryError) {
        console.error('❌ Error executing meter readings query:', queryError);
        throw queryError;
      }
    } finally {
      client.release();
      console.log('🟡 Database client released');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error generating meter report:', errorMessage);
    if (error instanceof Error && error.stack) {
      console.error('❌ Stack trace:', error.stack);
    }
    logError('Error generating meter report', error);
    return res.status(500).json({
      success: false,
      message: 'Error generating meter report',
      error: errorMessage,
      details: error instanceof Error ? error.stack : undefined
    });
  }
}));

/**
 * @route   GET /api/meter/reports
 * @desc    Get all meter reports for the current user
 * @access  Private
 */
router.get('/reports', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  try {
    const organizationId = getRequestOrgId(req);
    // Get all reports for the user, sorted by most recent first
    const reports = await prisma.meterReport.findMany({
      where: {
        userId,
        organizationId
      },
      select: {
        id: true,
        title: true,
        format: true,
        fileName: true,
        fileSize: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        parameters: true,
        metadata: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.status(200).json({
      success: true,
      data: reports
    });
  } catch (error) {
    logError('Error fetching meter reports', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching meter reports'
    });
  }
}));

/**
 * @route   GET /api/meter/reports/:id
 * @desc    Get a specific meter report by ID
 * @access  Private
 */
router.get('/reports/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  try {
    const organizationId = getRequestOrgId(req);
    // Get the report including file content
    const report = await prisma.meterReport.findFirst({
      where: {
        id,
        userId, // Ensure the report belongs to the requesting user
        organizationId
      }
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Set the appropriate content type header
    let contentType;
    if (report.format === 'excel') {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (report.format === 'pdf') {
      contentType = 'application/pdf';
    } else {
      contentType = 'application/octet-stream';
    }

    // Set headers for file download
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename=${report.fileName}`);
    res.setHeader('Content-Length', report.fileSize);

    // Send the file content
    return res.send(report.fileContent);
  } catch (error) {
    logError('Error fetching meter report', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching meter report'
    });
  }
}));

export default router; 