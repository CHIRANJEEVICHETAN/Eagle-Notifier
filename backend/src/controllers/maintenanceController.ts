import { Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma-client';

const prisma = new PrismaClient();

export const getMaintenanceStatus = async (req: Request, res: Response) => {
  try {
    const settings = await prisma.systemSettings.findFirst();
    res.json({ maintenanceMode: settings?.maintenanceMode || false });
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

    // Toggle maintenance mode
    const updatedSettings = await prisma.systemSettings.update({
      where: { id: settings.id },
      data: {
        maintenanceMode: !settings.maintenanceMode,
        enabledBy: !settings.maintenanceMode ? userId : null,
        enabledAt: !settings.maintenanceMode ? new Date() : null,
      },
    });

    res.json({ maintenanceMode: updatedSettings.maintenanceMode });
  } catch (error) {
    console.error('Error toggling maintenance mode:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}; 