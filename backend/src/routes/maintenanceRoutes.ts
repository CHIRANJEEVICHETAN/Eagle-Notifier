import express from 'express';
import { getMaintenanceStatus, toggleMaintenanceMode } from '../controllers/maintenanceController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = express.Router();

// Get maintenance status
router.get('/status', authenticate, getMaintenanceStatus);

// Toggle maintenance mode (admin only)
router.post('/toggle', authenticate, authorize(['ADMIN']), toggleMaintenanceMode);

export default router; 