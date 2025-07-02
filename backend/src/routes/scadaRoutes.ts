import { Router } from 'express';
import { processAndFormatAlarms, getScadaAlarmHistory, getScadaAnalyticsData, SCADA_POLLING_INTERVAL } from '../services/scadaService';
import { authenticate } from '../middleware/authMiddleware';
import { checkScadaHealth } from '../config/scadaDb';

const DEBUG = process.env.NODE_ENV === 'development';
const router = Router();

// Get latest SCADA alarms with improved error handling
router.get('/alarms', authenticate, async (req, res) => {
  try {
    if (DEBUG) console.log('📡 Fetching SCADA alarms...');
    
    // forceRefresh parameter can be used to bypass interval-based caching
    const forceRefresh = req.query.force === 'true';
    
    if (forceRefresh && DEBUG) {
      console.log('🔄 Force refresh requested, bypassing cache');
    }
    
    const alarms = await processAndFormatAlarms(forceRefresh);
    
    if (DEBUG) {
      console.log('📊 SCADA Response Stats:');
      console.log(`Analog Alarms: ${alarms.analogAlarms.length}`);
      console.log(`Binary Alarms: ${alarms.binaryAlarms.length}`);
      console.log(`Last Update: ${alarms.lastUpdate}`);
      console.log(`SCADA polling interval: ${SCADA_POLLING_INTERVAL}ms`);
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

// Get historical SCADA alarms with pagination, filtering, and sorting
router.get('/history', authenticate, async (req, res) => {
  try {
    if (DEBUG) console.log('📜 Fetching SCADA alarm history...');
    
    // Parse query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const statusFilter = (req.query.status as string) || 'all';
    const timeFilter = req.query.hours ? parseInt(req.query.hours as string) : undefined;
    const searchQuery = req.query.search as string;
    const sortBy = (req.query.sortBy as string) || 'timestamp';
    const sortOrder = (req.query.sortOrder as string) || 'desc';
    const alarmType = (req.query.type as string) || undefined;
    const alarmId = (req.query.alarmId as string) || undefined;
    const startTime = req.query.startTime as string;
    const endTime = req.query.endTime as string;
    
    if (DEBUG) {
      console.log('🔍 History Query Parameters:');
      console.log(`Page: ${page}, Limit: ${limit}`);
      console.log(`Status Filter: ${statusFilter}`);
      console.log(`Time Filter: ${timeFilter} hours`);
      console.log(`Start Time: ${startTime || 'Not specified'}`);
      console.log(`End Time: ${endTime || 'Not specified'}`);
      console.log(`Search Query: ${searchQuery || 'None'}`);
      console.log(`Sort By: ${sortBy}, Order: ${sortOrder}`);
      console.log(`Alarm Type: ${alarmType || 'All'}`);
      console.log(`Alarm ID: ${alarmId || 'All'}`);
    }
    
    // Get historical alarms
    const alarmHistory = await getScadaAlarmHistory(
      page,
      limit,
      statusFilter,
      timeFilter,
      searchQuery,
      sortBy,
      sortOrder,
      alarmType,
      alarmId,
      startTime,
      endTime
    );
    
    if (DEBUG) {
      console.log('📊 History Response Stats:');
      console.log(`Total Records: ${alarmHistory.pagination.total}`);
      console.log(`Filtered Total: ${alarmHistory.pagination.filteredTotal || 'N/A'}`);
      console.log(`Pages: ${alarmHistory.pagination.pages}`);
      console.log(`Alarms Returned: ${alarmHistory.alarms.length}`);
    }
    
    res.json(alarmHistory);
  } catch (error) {
    console.error('🔴 Error fetching SCADA alarm history:', error);
    res.status(500).json({
      error: 'Failed to fetch SCADA alarm history',
      details: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : undefined,
      timestamp: new Date().toISOString(),
      code: error instanceof Error ? error.name : 'UnknownError'
    });
  }
});

// Get SCADA analytics data for charts
router.get('/analytics', authenticate, async (req, res) => {
  try {
    if (DEBUG) console.log('📈 Fetching SCADA analytics data...');
    
    // Parse query parameters
    const timeFilter = (req.query.timeFilter as string) || '20s'; // Default to 20 seconds
    
    if (DEBUG) {
      console.log('🔍 Analytics Query Parameters:');
      console.log(`Time Filter: ${timeFilter}`);
    }
    
    // Get analytics data
    const analyticsData = await getScadaAnalyticsData(timeFilter);
    
    if (DEBUG) {
      console.log('📊 Analytics Response Stats:');
      console.log(`Analog Data Points: ${analyticsData.analogData.length > 0 ? analyticsData.analogData[0].data.length : 0}`);
      console.log(`Binary Data Points: ${analyticsData.binaryData.length > 0 ? analyticsData.binaryData[0].data.length : 0}`);
      console.log(`Time Labels: ${analyticsData.timeLabels.length}`);
    }
    
    res.json(analyticsData);
  } catch (error) {
    console.error('🔴 Error fetching SCADA analytics data:', error);
    res.status(500).json({
      error: 'Failed to fetch SCADA analytics data',
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
  res.status(health.status === 'healthy' ? 200 : 503).json({
    ...health,
    pollingInterval: SCADA_POLLING_INTERVAL
  });
});

export default router; 