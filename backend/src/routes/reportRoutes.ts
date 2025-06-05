import express, { Request, Response } from 'express';
import { getClientWithRetry } from '../config/scadaDb';
import { authenticate } from '../middleware/authMiddleware';

const router = express.Router();

// Apply authentication to all report routes
router.use(authenticate);

/**
 * @route   GET /api/reports/alarm-data
 * @desc    Get alarm data from jk2 table with filters
 * @access  Private
 */
router.get('/alarm-data', async (req: Request, res: Response) => {
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
      // Build the query based on filters
      let query = `
        SELECT 
          id, 
          created_timestamp,
          hz1sv, hz1pv, hz1ht, hz1lt,
          hz2sv, hz2pv, hz2ht, hz2lt,
          cpsv, cppv, cph, cpl,
          tz1sv, tz1pv, tz1ht, tz1lt,
          tz2sv, tz2pv, tz2ht, tz2lt,
          oilpv, deppv, postpv,
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

      const queryParams = [parsedStartDate, parsedEndDate];
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
      
      return res.json({
        count: result.rows.length,
        data: result.rows
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching alarm report data:', error);
    return res.status(500).json({ error: 'Failed to retrieve alarm data' });
  }
});

export default router; 