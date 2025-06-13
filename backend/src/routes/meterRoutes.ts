import { Router, Request, Response, NextFunction } from 'express';
import { getClientWithRetry } from '../config/scadaDb';
import { logError } from '../utils/logger';

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
      [voltage, current, frequency, pf, energy, power] // Using power as kwh
    );
    
    const meterId = result.rows[0].meter_id;
    
    // Return success response
    return res.status(201).json({
      success: true,
      message: 'Meter readings saved successfully',
      data: {
        meter_id: meterId,
        timestamp: new Date().toISOString()
      }
    });
  } finally {
    // Always release the client back to the pool
    client.release();
  }
}));

export default router; 