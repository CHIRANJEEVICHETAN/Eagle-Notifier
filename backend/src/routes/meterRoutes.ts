import { Router, Request, Response, NextFunction } from 'express';
import { getClientWithRetry } from '../config/scadaDb';
import { logError } from '../utils/logger';
import prisma from '../config/db';
import { NotificationService } from '../services/notificationService';
import { authenticate, authorize } from '../middleware/authMiddleware';

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
  const { voltage, current, frequency, pf, energy, power } = req.body;
  
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

  // Get database client
  const client = await getClientWithRetry();
  
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
    await checkThresholdViolations({ voltage, current, frequency, pf, energy, power });
    
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
router.get('/latest', asyncHandler(async (req: Request, res: Response) => {
  const client = await getClientWithRetry();
  
  try {
    // Simply get the latest reading, regardless of when it was created
    const result = await client.query(
      `SELECT meter_id, voltage, current, frequency, pf, energy, power, created_at
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
router.get('/history', asyncHandler(async (req: Request, res: Response) => {
  const client = await getClientWithRetry();
  
  const limit = parseInt(req.query.limit as string) || 60; // Default to 60 readings
  const hours = parseInt(req.query.hours as string) || 1; // Default to 1 hour
  
  try {
    // Try to get data within the specified time range
    let result = await client.query(
      `SELECT meter_id, voltage, current, frequency, pf, energy, power, created_at
       FROM meter_readings
       WHERE created_at >= NOW() - INTERVAL '${hours} hours'
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    
    // If no data found in the requested time frame, get the most recent readings anyway
    if (result.rows.length === 0) {
      result = await client.query(
        `SELECT meter_id, voltage, current, frequency, pf, energy, power, created_at
         FROM meter_readings
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );
    }
    
    return res.status(200).json({
      success: true,
      data: result.rows
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
router.get('/limits', asyncHandler(async (req: Request, res: Response) => {
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
}): Promise<void> {
  try {
    // Get all limits
    const limits = await prisma.meterLimit.findMany();
    
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
        }
      });
    }
    
    return;
  } catch (error) {
    logError('Error checking threshold violations', error);
    return;
  }
}

export default router; 