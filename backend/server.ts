import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// import rateLimit from 'express-rate-limit';
import { errorHandler } from './src/middleware/errorHandler';
import alarmRoutes from './src/routes/alarmRoutes';
import notificationRoutes from './src/routes/notifications';
import adminRoutes from './src/routes/adminRoutes';
import scadaRoutes from './src/routes/scadaRoutes';
import maintenanceRoutes from './src/routes/maintenanceRoutes';
import { processAndFormatAlarms } from './src/services/scadaService';
import { testScadaConnection } from './src/config/scadaDb';
import { PrismaClient } from '@prisma/client';
import authRoutes from './src/routes/authRoutes';
import operatorRoutes from './src/routes/operatorRoutes';

// Load environment variables
dotenv.config();

// Initialize Prisma Client
const prisma = new PrismaClient();

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
// const apiLimiter = rateLimit({
//   windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 min
//   max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
//   standardHeaders: true,
//   legacyHeaders: false,
//   keyGenerator: (req) => {
//     const forwarded = req.headers['x-forwarded-for'];
//     const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
//     return (ip || req.ip || 'unknown-ip') as string;
//   },
// });

// // Apply rate limiting to auth routes
// app.use('/api/auth', apiLimiter);

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

// SCADA Data Polling
const SCADA_POLL_INTERVAL = parseInt(process.env.SCADA_POLL_INTERVAL || '120000'); // Default 2 minutes

async function pollScadaData() {
  try {
    await processAndFormatAlarms();
    console.log('SCADA data processed successfully');
  } catch (error) {
    console.error('Error polling SCADA data:', error);
  }
}

// Initialize databases and start server
async function startServer() {
  try {
    // Test database connections
    await prisma.$connect();
    console.log('Successfully connected to main database');

    const scadaConnected = await testScadaConnection();
    if (!scadaConnected) {
      console.error('Failed to connect to SCADA database. Server will start but SCADA features may be limited.');
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log('Available routes:');
      console.log('GET /api/notifications');
      console.log('GET /api/notifications/:id');
      console.log('PATCH /api/notifications/:id/read');
      console.log('PATCH /api/notifications/mark-all-read');
      console.log('DELETE /api/notifications/:id');
      console.log('PUT /api/notifications/push-token');
      console.log(`SCADA polling interval: ${SCADA_POLL_INTERVAL}ms`);

      // Start SCADA polling if connection was successful
      if (scadaConnected) {
        setInterval(pollScadaData, SCADA_POLL_INTERVAL);
        // Initial poll
        pollScadaData();
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing connections...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Closing connections...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start the server
startServer();