import { Router } from 'express';
import { processAndFormatAlarms } from '../services/scadaService';
import { authenticate } from '../middleware/authMiddleware';
import { checkScadaHealth } from '../config/scadaDb';

const DEBUG = process.env.NODE_ENV === 'development';
const router = Router();

// Get latest SCADA alarms with improved error handling
router.get('/alarms', authenticate, async (req, res) => {
  try {
    if (DEBUG) console.log('📡 Fetching SCADA alarms...');
    const alarms = await processAndFormatAlarms();
    
    if (DEBUG) {
      console.log('📊 SCADA Response Stats:');
      console.log(`Analog Alarms: ${alarms.analogAlarms.length}`);
      console.log(`Binary Alarms: ${alarms.binaryAlarms.length}`);
      console.log(`Last Update: ${alarms.lastUpdate}`);
    }

    res.json(alarms);
  } catch (error) {
    console.error('🔴 Error fetching SCADA alarms:', error);
    res.status(500).json({ 
      error: 'Failed to fetch SCADA alarms',
      details: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : undefined,
      timestamp: new Date().toISOString(),
      code: error instanceof Error ? error.name : 'UnknownError'
    });
  }
});

// Add health check endpoint with detailed diagnostics
router.get('/health', authenticate, async (req, res) => {
  if (DEBUG) console.log('🏥 Checking SCADA health...');
  const health = await checkScadaHealth();
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

export default router; 