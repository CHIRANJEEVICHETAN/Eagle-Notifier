import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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

// Middleware
// Apply security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:19000',
  credentials: true
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes by default
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'), // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to auth routes
app.use('/api/auth', apiLimiter);

app.use(express.json());

// API Routes
app.get('/', (req, res) => {
  res.json({ message: 'Eagle Notifier API' });
});

// Mount route modules
app.use('/api/auth', authRoutes);
app.use('/api/alarms', alarmRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/operator', operatorRoutes);
app.use('/api/notifications', notificationRoutes);

// Error handling middleware (must be after all other middleware and routes)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 