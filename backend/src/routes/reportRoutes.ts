import express, { Request, Response, Router, RequestHandler } from 'express';
import { getClientWithRetry } from '../config/scadaDb';
import { authenticate } from '../middleware/authMiddleware';
import prisma from '../config/db';

const router: Router = express.Router();

// Apply authentication to all report routes
router.use(authenticate);

/**
 * @route   GET /api/reports/alarm-data
 * @desc    Get alarm data from jk2 table with filters
 * @access  Private
 */
router.get('/alarm-data', function(req: Request, res: Response) {
  (async () => {
    try {
      const { 
        startDate, 
        endDate, 
        alarmTypes = [], 
        severityLevels = [], 
        zones = [] 
      } = req.query;

      // Validate date inputs
      const parsedStartDate = startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default to 7 days ago
      const parsedEndDate = endDate ? new Date(endDate as string) : new Date();
      
      if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }

      // Get a SCADA DB client
      const client = await getClientWithRetry();

      try {
        // Get setpoints to calculate thresholds
        const setpoints = await prisma.setpoint.findMany();
        const setpointMap = new Map<string, { lowDeviation: number; highDeviation: number }>();
        
        setpoints.forEach(sp => {
          setpointMap.set(sp.scadaField, {
            lowDeviation: sp.lowDeviation,
            highDeviation: sp.highDeviation
          });
        });

        // Build the query to fetch all required fields
        let query = `
          SELECT 
            id, 
            created_timestamp,
            -- Analog values (first 11 fields)
            hz1sv, hz1pv,
            hz2sv, hz2pv,
            cpsv, cppv,
            tz1sv, tz1pv,
            tz2sv, tz2pv,
            oilpv,
            -- Binary status fields (fields 12-18+)
            oiltemphigh, oillevelhigh, oillevellow,
            hz1hfail, hz2hfail,
            hardconfail, hardcontraip,
            oilconfail, oilcontraip,
            hz1fanfail, hz2fanfail,
            hz1fantrip, hz2fantrip,
            tempconfail, tempcontraip,
            tz1fanfail, tz2fanfail,
            tz1fantrip, tz2fantrip
          FROM jk2
          WHERE created_timestamp BETWEEN $1 AND $2
        `;

        const queryParams: (Date | number | string)[] = [parsedStartDate, parsedEndDate];
        let paramIndex = 3;

        // Add alarm type filters if provided
        if (alarmTypes && Array.isArray(alarmTypes) && alarmTypes.length > 0) {
          const alarmTypeConditions = [];
          
          for (const type of alarmTypes) {
            switch(type) {
              case 'temperature':
                alarmTypeConditions.push(`
                  (hz1pv IS NOT NULL OR hz2pv IS NOT NULL OR 
                   tz1pv IS NOT NULL OR tz2pv IS NOT NULL)
                `);
                break;
              case 'carbon':
                alarmTypeConditions.push(`cppv IS NOT NULL`);
                break;
              case 'oil':
                alarmTypeConditions.push(`
                  (oilpv IS NOT NULL OR oiltemphigh = true OR 
                   oillevelhigh = true OR oillevellow = true)
                `);
                break;
              case 'fan':
                alarmTypeConditions.push(`
                  (hz1fanfail = true OR hz2fanfail = true OR 
                   tz1fanfail = true OR tz2fanfail = true OR
                   hz1fantrip = true OR hz2fantrip = true OR
                   tz1fantrip = true OR tz2fantrip = true)
                `);
                break;
              case 'conveyor':
                alarmTypeConditions.push(`
                  (hardconfail = true OR hardcontraip = true OR 
                   oilconfail = true OR oilcontraip = true OR
                   tempconfail = true OR tempcontraip = true)
                `);
                break;
            }
          }
          
          if (alarmTypeConditions.length > 0) {
            query += ` AND (${alarmTypeConditions.join(' OR ')})`;
          }
        }
        
        // Add zone filters if provided
        if (zones && Array.isArray(zones) && zones.length > 0) {
          const zoneConditions = [];
          
          for (const zone of zones) {
            switch(zone) {
              case 'zone1':
                zoneConditions.push(`
                  (hz1pv IS NOT NULL OR hz1sv IS NOT NULL OR 
                   tz1pv IS NOT NULL OR tz1sv IS NOT NULL OR
                   hz1fanfail = true OR hz1fantrip = true OR
                   tz1fanfail = true OR tz1fantrip = true)
                `);
                break;
              case 'zone2':
                zoneConditions.push(`
                  (hz2pv IS NOT NULL OR hz2sv IS NOT NULL OR 
                   tz2pv IS NOT NULL OR tz2sv IS NOT NULL OR
                   hz2fanfail = true OR hz2fantrip = true OR
                   tz2fanfail = true OR tz2fantrip = true)
                `);
                break;
            }
          }
          
          if (zoneConditions.length > 0) {
            query += ` AND (${zoneConditions.join(' OR ')})`;
          }
        }

        // Add severity filters (we'll determine severity based on thresholds for analog values)
        if (severityLevels && Array.isArray(severityLevels) && severityLevels.length > 0) {
          const severityConditions = [];
          
          for (const severity of severityLevels) {
            switch(severity) {
              case 'critical':
                severityConditions.push(`
                  (hz1pv > hz1ht OR hz1pv < hz1lt OR
                   hz2pv > hz2ht OR hz2pv < hz2lt OR
                   tz1pv > tz1ht OR tz1pv < tz1lt OR
                   tz2pv > tz2ht OR tz2pv < tz2lt OR
                   cppv > cph OR cppv < cpl OR
                   oiltemphigh = true OR
                   hardconfail = true OR oilconfail = true OR tempconfail = true OR
                   hz1fanfail = true OR hz2fanfail = true OR
                   tz1fanfail = true OR tz2fanfail = true)
                `);
                break;
              case 'warning':
                // For warning, use thresholds closer to setpoints
                severityConditions.push(`
                  ((hz1pv > (hz1sv + (hz1ht - hz1sv) * 0.5) AND hz1pv <= hz1ht) OR
                   (hz1pv < (hz1sv - (hz1sv - hz1lt) * 0.5) AND hz1pv >= hz1lt) OR
                   (hz2pv > (hz2sv + (hz2ht - hz2sv) * 0.5) AND hz2pv <= hz2ht) OR
                   (hz2pv < (hz2sv - (hz2sv - hz2lt) * 0.5) AND hz2pv >= hz2lt) OR
                   (tz1pv > (tz1sv + (tz1ht - tz1sv) * 0.5) AND tz1pv <= tz1ht) OR
                   (tz1pv < (tz1sv - (tz1sv - tz1lt) * 0.5) AND tz1pv >= tz1lt) OR
                   (tz2pv > (tz2sv + (tz2ht - tz2sv) * 0.5) AND tz2pv <= tz2ht) OR
                   (tz2pv < (tz2sv - (tz2sv - tz2lt) * 0.5) AND tz2pv >= tz2lt) OR
                   (cppv > (cpsv + (cph - cpsv) * 0.5) AND cppv <= cph) OR
                   (cppv < (cpsv - (cpsv - cpl) * 0.5) AND cppv >= cpl) OR
                   oillevelhigh = true OR oillevellow = true OR
                   hardcontraip = true OR oilcontraip = true OR tempcontraip = true OR
                   hz1fantrip = true OR hz2fantrip = true OR
                   tz1fantrip = true OR tz2fantrip = true)
                `);
                break;
            }
          }
          
          if (severityConditions.length > 0) {
            query += ` AND (${severityConditions.join(' OR ')})`;
          }
        }
        
        // Order by timestamp
        query += ' ORDER BY created_timestamp DESC';
        
        // Add limit if needed
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 1000;
        if (!isNaN(limit) && limit > 0) {
          query += ` LIMIT $${paramIndex}`;
          queryParams.push(limit);
        }
        
        // Execute the query
        const result = await client.query(query, queryParams);
        
        // Add calculated threshold values to each row
        const enrichedData = result.rows.map(row => {
          const enrichedRow = { ...row };
          
          // Calculate thresholds for analog values based on setpoints
          const addThresholds = (setValueField: string, presentValueField: string) => {
            const setpoint = setpointMap.get(setValueField);
            if (setpoint && row[setValueField] !== null && row[setValueField] !== undefined) {
              const setValue = row[setValueField];
              enrichedRow[`${presentValueField.replace('pv', 'ht')}`] = setValue + setpoint.highDeviation;
              enrichedRow[`${presentValueField.replace('pv', 'lt')}`] = setValue + setpoint.lowDeviation;
            }
          };
          
          // Add thresholds for each analog field
          addThresholds('hz1sv', 'hz1pv');
          addThresholds('hz2sv', 'hz2pv');
          const cpSetpoint = setpointMap.get('cpsv');
          if (cpSetpoint && row.cpsv !== null && row.cpsv !== undefined) {
            const cpSetValue = row.cpsv;
            enrichedRow['cph'] = cpSetValue + cpSetpoint.highDeviation;
            enrichedRow['cpl'] = cpSetValue + cpSetpoint.lowDeviation;
          }
          addThresholds('tz1sv', 'tz1pv');
          addThresholds('tz2sv', 'tz2pv');
          addThresholds('oilpv', 'oilpv'); // Special case for oil temperature
          
          return enrichedRow;
        });
        
        return res.json({
          count: enrichedData.length,
          data: enrichedData
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error fetching alarm report data:', error);
      return res.status(500).json({ error: 'Failed to retrieve alarm data' });
    }
  })();
});

/**
 * @route   GET /api/reports/furnace
 * @desc    Get saved furnace reports for a user with pagination
 * @access  Private
 */
router.get('/furnace', function(req: Request, res: Response) {
  (async () => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Parse pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      // Get reports with pagination and exclude large fileContent for list view
      const reports = await prisma.furnaceReport.findMany({
        where: { userId },
        select: {
          id: true,
          title: true,
          format: true,
          fileName: true,
          fileSize: true,
          startDate: true,
          endDate: true,
          grouping: true,
          includeThresholds: true,
          includeStatusFields: true,
          alarmTypes: true,
          severityLevels: true,
          zones: true,
          createdAt: true,
          metadata: true,
          user: {
            select: { id: true, name: true, email: true }
          }
          // Exclude fileContent to reduce memory usage
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      });

      // Get total count for pagination info
      const totalCount = await prisma.furnaceReport.count({
        where: { userId }
      });

      const totalPages = Math.ceil(totalCount / limit);

      return res.json({
        reports,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });
    } catch (error) {
      console.error('Error fetching furnace reports:', error);
      return res.status(500).json({ error: 'Failed to retrieve furnace reports' });
    }
  })();
});

/**
 * @route   POST /api/reports/furnace
 * @desc    Save a new furnace report
 * @access  Private
 */
router.post('/furnace', function(req: Request, res: Response) {
  (async () => {
    try {
      console.log('POST /api/reports/furnace - Request received');
      const userId = (req as any).user?.id;
      console.log('User ID:', userId);
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const {
        title,
        format,
        fileContent,
        fileName,
        fileSize,
        startDate,
        endDate,
        grouping,
        includeThresholds,
        includeStatusFields,
        alarmTypes,
        severityLevels,
        zones,
        metadata
      } = req.body;
      
      console.log('Request body keys:', Object.keys(req.body));
      console.log('Title:', title);
      console.log('File size:', fileSize);
      console.log('File content length:', fileContent?.length);

      // Convert base64 to buffer
      const buffer = Buffer.from(fileContent, 'base64');
      console.log('Buffer size:', buffer.length);

      console.log('Creating furnace report in database...');
      const report = await prisma.furnaceReport.create({
        data: {
          userId,
          title,
          format,
          fileContent: buffer,
          fileName,
          fileSize,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          grouping,
          includeThresholds: includeThresholds ?? true,
          includeStatusFields: includeStatusFields ?? true,
          alarmTypes: alarmTypes || [],
          severityLevels: severityLevels || [],
          zones: zones || [],
          metadata
        }
      });

      console.log('Report saved successfully with ID:', report.id);
      return res.json({ id: report.id, message: 'Furnace report saved successfully' });
    } catch (error: any) {
      console.error('Error saving furnace report:', error);
      console.error('Error stack:', error.stack);
      console.error('Error message:', error.message);
      return res.status(500).json({ 
        error: 'Failed to save furnace report',
        details: error.message 
      });
    }
  })();
});

/**
 * @route   GET /api/reports/furnace/:id
 * @desc    Get a specific furnace report file
 * @access  Private
 */
router.get('/furnace/:id', function(req: Request, res: Response) {
  (async () => {
    try {
      const userId = (req as any).user?.id;
      const reportId = req.params.id;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const report = await prisma.furnaceReport.findFirst({
        where: { 
          id: reportId,
          userId 
        }
      });

      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // Set appropriate headers for file download
      res.setHeader('Content-Type', 
        report.format === 'pdf' 
          ? 'application/pdf' 
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${report.fileName}"`);
      res.setHeader('Content-Length', report.fileContent.length);

      return res.send(report.fileContent);
    } catch (error) {
      console.error('Error retrieving furnace report:', error);
      return res.status(500).json({ error: 'Failed to retrieve report' });
    }
  })();
});

/**
 * @route   GET /api/reports/setpoints
 * @desc    Get setpoint configurations for alarm processing
 * @access  Private
 */
router.get('/setpoints', function(req: Request, res: Response) {
  (async () => {
    try {
      const setpoints = await prisma.setpoint.findMany({
        orderBy: [
          { type: 'asc' },
          { zone: 'asc' },
          { name: 'asc' }
        ]
      });

      return res.json(setpoints);
    } catch (error) {
      console.error('Error fetching setpoints:', error);
      return res.status(500).json({ error: 'Failed to retrieve setpoints' });
    }
  })();
});

export default router; 