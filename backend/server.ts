import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './src/middleware/errorHandler';
import alarmRoutes from './src/routes/alarmRoutes';
import notificationRoutes from './src/routes/notifications';
import adminRoutes from './src/routes/adminRoutes';
import scadaRoutes from './src/routes/scadaRoutes';
import maintenanceRoutes from './src/routes/maintenanceRoutes';
import reportRoutes from './src/routes/reportRoutes';
import { processAndFormatAlarms } from './src/services/scadaService';
import { testAllOrgScadaConnections } from './src/config/scadaDb';
import prisma from './src/config/db';
import authRoutes from './src/routes/authRoutes';
import operatorRoutes from './src/routes/operatorRoutes';
import meterRoutes from './src/routes/meterRoutes';

// Load environment variables
dotenv.config();

// Type definitions for Express middleware stacks
interface RouteHandler {
  route?: {
    path: string;
    methods: Record<string, boolean>;
  };
  name?: string;
  handle?: {
    stack: RouteHandler[];
  };
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 8000;

// CORS configuration
app.use(
  cors({
    origin: '*',
  })
);

// app.set('trust proxy', 1);

// // Rate limiting
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
    return (ip || req.ip || 'unknown-ip') as string;
  },
});

// // Apply rate limiting to auth routes
app.use('/api/auth', apiLimiter);

// Configure body parser with increased limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()}  ${req.method}  ${req.url}`);
  console.log('Headers:', req.headers);
  next();
});

// API Routes
app.get('/', (req, res) => {
  res.send('Eagle Notifier API');
});

// Mount route modules
app.use('/api/auth', authRoutes);
app.use('/api/alarms', alarmRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/operator', operatorRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/scada', scadaRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/meter', meterRoutes);

// Route not found handler
app.use((req, res) => {
  console.log('Route not found:', req.method, req.path);
  res.status(404).json({
    message: 'Route not found',
    path: req.path,
  });
});

// Error handling middleware (must be after all other middleware and routes)
app.use(errorHandler);

// Get polling interval - first check for EXPO_PUBLIC_SCADA_INTERVAL, then fallback to other env vars
const SCADA_POLL_INTERVAL = parseInt(
  process.env.SCADA_POLL_INTERVAL || process.env.EXPO_PUBLIC_SCADA_INTERVAL ||  
  '30000'
); // Default 30 seconds

// Track if polling is currently active
let isPolling = false;

// Multi-tenant SCADA polling function
async function pollScadaData() {
  if (isPolling) {
    console.log('⚠️ Previous poll still in progress, skipping this interval');
    return;
  }
  try {
    isPolling = true;
    console.log(`📊 Polling SCADA data at ${new Date().toISOString()}`);
    // Fetch all organizations
    const orgs = await prisma.organization.findMany();
    for (const org of orgs) {
      try {
        // Poll alarms for this org
        await processAndFormatAlarms(org.id, true);
        // Health check for this org
        // await checkScadaHealth(org.id); // This line was removed as per the edit hint
      } catch (err) {
        console.error(`Error polling SCADA for org ${org.id}:`, err);
      }
    }
  } catch (err) {
    console.error('Error in multi-tenant SCADA polling:', err);
  } finally {
    isPolling = false;
  }
}

// Initialize databases and start server
async function startServer() {
  try {
    // Test database connections with timeout and retry logic
    try {
      await Promise.race([
        prisma.$connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Prisma connection timeout')), 5000)
        )
      ]);
      console.log('Successfully connected to main database');
    } catch (dbError) {
      console.error('Database connection error:', dbError);
      console.log('Retrying database connection in 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      await prisma.$connect();
    }

    // Test all org SCADA DB connections and log results
    await testAllOrgScadaConnections();

    // Always start SCADA polling for all orgs, regardless of connection test results
    // Use reliable interval with jitter to prevent thundering herd problems
    const pollingInterval = setInterval(() => {
      // Add small random jitter (±500ms) to prevent synchronized requests
      const jitter = Math.floor(Math.random() * 1000) - 500;
      setTimeout(() => {
        pollScadaData().catch(error => {
          console.error('Error in SCADA polling:', error);
        });
      }, jitter);
    }, SCADA_POLL_INTERVAL);
    // Add to tracked intervals for clean shutdown
    trackedIntervals.push(pollingInterval);
    // Initial poll with error handling (with a slight delay to ensure server is fully ready)
    setTimeout(() => {
      pollScadaData().catch(error => {
        console.error('Error in initial SCADA poll:', error);
      });
    }, 2000);

    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      
      // Log all available routes
      console.log('Available routes:');
      // Simplified route logging to avoid type issues
      console.log('/api/auth routes (authentication)');
      console.log('/api/alarms routes (alarm management)');
      console.log('/api/admin routes (administrative functions)');
      console.log('/api/operator routes (operator functions)');
      console.log('/api/notifications routes (notification management)');
      console.log('/api/scada routes (SCADA data access)');
      console.log('/api/maintenance routes (maintenance operations)');
      console.log('/api/reports routes (reporting functions)');
      console.log('/api/meter routes (meter readings)');

      console.log(`SCADA polling interval: ${SCADA_POLL_INTERVAL}ms`);

      // Start SCADA polling if connection was successful
      // The polling logic was removed as per the edit hint
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Track intervals for clean shutdown
const trackedIntervals: NodeJS.Timeout[] = [];

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing connections...');
  // Clear all intervals
  trackedIntervals.forEach(interval => clearInterval(interval));
  // Disconnect Prisma client
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Closing connections...');
  // Clear all intervals
  trackedIntervals.forEach(interval => clearInterval(interval));
  // Disconnect Prisma client
  await prisma.$disconnect();
  process.exit(0);
});

// Start the server
startServer();