import express from 'express';
import { getMaintenanceStatus, toggleMaintenanceMode } from '../controllers/maintenanceController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = express.Router();

// Get maintenance status
router.get('/status', authenticate, async (req, res, next) => {
  try {
    if (req.user?.role === 'SUPER_ADMIN') {
      res.status(403).json({ message: 'SUPER_ADMIN cannot access maintenance status. Please select an organization.' });
      return;
    }
    await getMaintenanceStatus(req, res);
  } catch (error) {
    next(error);
  }
});

// Toggle maintenance mode (admin only)
router.post('/toggle', authenticate, authorize(['ADMIN']), toggleMaintenanceMode);

export default router; 