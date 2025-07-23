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
import { testAllOrgScadaConnections } from './src/config/scadaDb';
import prisma from './src/config/db';
import authRoutes from './src/routes/authRoutes';
import operatorRoutes from './src/routes/operatorRoutes';
import meterRoutes from './src/routes/meterRoutes';
import predictiveAlertRoutes from './src/routes/predictiveAlertRoutes';
import trainingRoutes from './src/routes/trainingRoutes';
import errorHandlingRoutes from './src/routes/errorHandlingRoutes';
import securityRoutes from './src/routes/securityRoutes';
import performanceRoutes from './src/routes/performanceRoutes';
import modelDeploymentRoutes from './src/routes/modelDeploymentRoutes';
import { securityMonitoringService } from './src/services/securityMonitoringService';
import BackgroundMonitoringService from './src/services/backgroundMonitoringService';
import { trainingMonitor } from './src/services/trainingMonitor';
import { trainingScheduler } from './src/services/trainingScheduler';
import { enhancedPredictionService } from './src/services/errorHandling/enhancedPredictionService';
import { performanceMonitoringService } from './src/services/performanceMonitoringService';
import { batchPredictionService } from './src/services/batchPredictionService';
import { modelDeploymentService } from './src/services/modelDeploymentService';
import { modelDeploymentMonitoringService } from './src/services/modelDeploymentMonitoringService';
import { modelDeploymentPipeline } from './src/services/modelDeploymentPipeline';

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
app.use('/api/predictive-alerts', predictiveAlertRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/error-handling', errorHandlingRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/model-deployment', modelDeploymentRoutes);

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

// Get monitoring interval from environment
const MONITORING_INTERVAL = parseInt(
  process.env.SCADA_MONITORING_INTERVAL || process.env.SCADA_POLL_INTERVAL || 
  process.env.EXPO_PUBLIC_SCADA_INTERVAL || '30000'
); // Default 30 seconds

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
      console.log('✅ Successfully connected to main database');
    } catch (dbError) {
      console.error('❌ Database connection error:', dbError);
      console.log('🔄 Retrying database connection in 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      await prisma.$connect();
      console.log('✅ Database connection retry successful');
    }

    // Test all org SCADA DB connections and log results
    console.log('🔍 Testing SCADA database connections for all organizations...');
    await testAllOrgScadaConnections();

    // Initialize enhanced prediction service
    console.log('🤖 Initializing enhanced prediction service with error handling...');
    await enhancedPredictionService.initializeModels();

    // Initialize security monitoring service
    console.log('🔒 Security monitoring service initialized and running...');

    // Initialize performance monitoring service
    console.log('📊 Performance monitoring service initialized and running...');
    
    // Initialize model deployment services
    console.log('🚀 Model deployment and monitoring services initialized...');

    // Start the background monitoring service
    console.log('🚀 Starting background monitoring service...');
    await BackgroundMonitoringService.start();

    // Initialize training scheduler and monitor
    console.log('🤖 ML training services ready (scheduler and monitor will be initialized later)');
    // TODO: Initialize training scheduler and monitor when node-cron issues are resolved

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      
      // Log all available routes
      console.log('📋 Available routes:');
      console.log('/api/auth routes (authentication)');
      console.log('/api/alarms routes (alarm management)');
      console.log('/api/admin routes (administrative functions)');
      console.log('/api/operator routes (operator functions)');
      console.log('/api/notifications routes (notification management)');
      console.log('/api/scada routes (SCADA data access)');
      console.log('/api/maintenance routes (maintenance operations)');
      console.log('/api/reports routes (reporting functions)');
      console.log('/api/meter routes (meter readings)');
      console.log('/api/predictive-alerts routes (predictive maintenance alerts)');
      console.log('/api/training routes (ML model training and management)');
      console.log('/api/error-handling routes (error monitoring and circuit breaker management)');
      console.log('/api/security routes (security monitoring and audit)');
      console.log('/api/performance routes (performance monitoring and optimization)');
      console.log('/api/model-deployment routes (model deployment and version management)');

      console.log(`⏱️ Background monitoring interval: ${MONITORING_INTERVAL}ms`);
      console.log('✅ Server initialization complete');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  
  // Stop background monitoring service
  BackgroundMonitoringService.stop();
  
  // Stop enhanced prediction service
  enhancedPredictionService.shutdown();
  
  // Stop performance monitoring service
  performanceMonitoringService.shutdown();
  
  // Stop batch prediction service
  batchPredictionService.shutdown();
  
  // Stop model deployment monitoring service
  modelDeploymentMonitoringService.stopMonitoring();
  
  // Stop training services
  await trainingScheduler.shutdown();
  trainingMonitor.stop();
  
  // Disconnect Prisma client
  await prisma.$disconnect();
  
  console.log('✅ Graceful shutdown complete');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received. Shutting down gracefully...');
  
  // Stop background monitoring service
  BackgroundMonitoringService.stop();
  
  // Stop enhanced prediction service
  enhancedPredictionService.shutdown();
  
  // Stop performance monitoring service
  performanceMonitoringService.shutdown();
  
  // Stop batch prediction service
  batchPredictionService.shutdown();
  
  // Stop model deployment monitoring service
  modelDeploymentMonitoringService.stopMonitoring();
  
  // Stop training services
  await trainingScheduler.shutdown();
  trainingMonitor.stop();
  
  // Disconnect Prisma client
  await prisma.$disconnect();
  
  console.log('✅ Graceful shutdown complete');
  process.exit(0);
});

// Start the server
startServer();