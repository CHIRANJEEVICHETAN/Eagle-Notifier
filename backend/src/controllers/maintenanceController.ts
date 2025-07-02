import { Request, Response } from 'express';
import prisma from '../config/db';

export const getMaintenanceStatus = async (req: Request, res: Response) => {
  try {
    const settings = await prisma.systemSettings.findFirst();
    res.json({
      maintenanceMode: settings?.maintenanceMode || false,
      enabledAt: settings?.enabledAt,
      enabledBy: settings?.enabledBy
    });
  } catch (error) {
    console.error('Error getting maintenance status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const toggleMaintenanceMode = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'ADMIN') {
      res.status(403).json({ message: 'Only admins can toggle maintenance mode' });
      return;
    }

    // Get current settings or create new
    let settings = await prisma.systemSettings.findFirst();
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          maintenanceMode: false,
        },
      });
    }

    const newMaintenanceMode = !settings.maintenanceMode;

    // Toggle maintenance mode
    const updatedSettings = await prisma.systemSettings.update({
      where: { id: settings.id },
      data: {
        maintenanceMode: newMaintenanceMode,
        enabledBy: newMaintenanceMode ? userId : null,
        enabledAt: newMaintenanceMode ? new Date() : null,
      },
    });

    // Log maintenance mode change
    console.log(`🔧 Maintenance mode ${newMaintenanceMode ? 'ENABLED' : 'DISABLED'} by user ${user.name} (${user.email})`);
    if (newMaintenanceMode) {
      console.log('🛑 SCADA data fetching will be STOPPED');
    } else {
      console.log('▶️ SCADA data fetching will be RESUMED');
    }

    res.json({
      maintenanceMode: updatedSettings.maintenanceMode,
      enabledAt: updatedSettings.enabledAt,
      enabledBy: updatedSettings.enabledBy,
      message: `Maintenance mode ${newMaintenanceMode ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error) {
    console.error('Error toggling maintenance mode:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Check if maintenance mode is currently active
export const isMaintenanceModeActive = async (): Promise<boolean> => {
  try {
    const settings = await prisma.systemSettings.findFirst();
    return settings?.maintenanceMode || false;
  } catch (error) {
    console.error('Error checking maintenance mode:', error);
    return false;
  }
}; 