import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// import rateLimit from 'express-rate-limit';
import { errorHandler } from './src/middleware/errorHandler';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './src/routes/authRoutes';
import alarmRoutes from './src/routes/alarmRoutes';
import adminRoutes from './src/routes/adminRoutes';
import operatorRoutes from './src/routes/operatorRoutes';
import notificationRoutes from './src/routes/notifications';

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
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
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


// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Available routes:`);
  console.log(`GET /api/notifications`);
  console.log(`GET /api/notifications/:id`);
  console.log(`PATCH /api/notifications/:id/read`);
  console.log(`PATCH /api/notifications/mark-all-read`);
  console.log(`DELETE /api/notifications/:id`);
  console.log(`PUT /api/notifications/push-token`);
}); 