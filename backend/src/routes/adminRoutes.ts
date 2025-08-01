import express, { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import bcrypt from 'bcryptjs'; // Added for password hashing
import { createError } from '../middleware/errorHandler';
import { authenticate, authorize, getRequestOrgId } from '../middleware/authMiddleware';
import { Router } from 'express';
import BackgroundMonitoringService from '../services/backgroundMonitoringService';
import { forceRefreshSchemaConfig } from '../services/scadaService';

const router = Router();

// Apply authentication and admin/SUPER_ADMIN-only authorization to all admin routes
router.use(authenticate);
router.use(authorize(['ADMIN', 'SUPER_ADMIN']));

/**
 * @route   GET /api/admin/users
 * @desc    Get all users (admin only)
 * @access  Private (Admin)
 */
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // If SUPER_ADMIN, allow filtering by organizationId (query param), else use own org
    let organizationId: string | undefined = undefined;
    if (req.user?.role === 'SUPER_ADMIN') {
      organizationId = typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
    } else {
      organizationId = getRequestOrgId(req);
    }
    const where: any = {};
    if (organizationId) where.organizationId = organizationId;
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/admin/users
 * @desc    Create a new user (admin only)
 * @access  Private (Admin)
 */
router.post('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, role, organizationId: orgIdFromBody } = req.body;
    if (!name || !email || !password || !role) {
      throw createError('Please provide name, email, password, and role', 400);
    }
    if (!['ADMIN', 'OPERATOR'].includes(role)) {
      throw createError('Invalid role specified', 400);
    }
    // Determine organizationId
    let organizationId: string;
    if (req.user?.role === 'SUPER_ADMIN') {
      organizationId = orgIdFromBody || req.body.organizationId || req.query.organizationId;
      if (!organizationId) throw createError('organizationId is required for SUPER_ADMIN', 400);
    } else {
      organizationId = getRequestOrgId(req);
    }
    // Check for existing user in org
    const existingUser = await prisma.user.findFirst({
      where: { email, organizationId },
    });
    if (existingUser) {
      throw createError('User with this email already exists in this organization', 400);
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role as any,
        organizationId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.status(201).json(newUser);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Update user details (admin only)
 * @access  Private (Admin)
 */
router.put('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, email, role, password, organizationId: orgIdFromBody } = req.body;
    if (!name && !email && !role && !password && !orgIdFromBody) {
      throw createError('No update data provided', 400);
    }
    if (role && !['ADMIN', 'OPERATOR'].includes(role)) {
      throw createError('Invalid role specified', 400);
    }
    // Determine organizationId
    let organizationId: string | undefined = undefined;
    if (req.user?.role === 'SUPER_ADMIN') {
      organizationId = orgIdFromBody || req.body.organizationId || req.query.organizationId;
    } else {
      organizationId = getRequestOrgId(req);
    }
    // Find user to update
    const userToUpdate = await prisma.user.findUnique({
      where: { id },
      select: { organizationId: true, email: true },
    });
    if (!userToUpdate) {
      throw createError('User not found', 404);
    }
    // SUPER_ADMIN can update any user, ADMIN only in their org
    if (req.user?.role !== 'SUPER_ADMIN' && userToUpdate.organizationId !== organizationId) {
      throw createError('Unauthorized to update user in another organization', 403);
    }
    // Check if email is being changed and if it's already taken in the org
    if (email && email !== userToUpdate.email) {
      const existingUserWithNewEmail = await prisma.user.findFirst({
        where: { email, organizationId: userToUpdate.organizationId },
      });
      if (existingUserWithNewEmail) {
        throw createError('Email already in use by another account in this organization', 400);
      }
    }
    const dataToUpdate: any = {};
    if (name) dataToUpdate.name = name;
    if (email) dataToUpdate.email = email;
    if (role) dataToUpdate.role = role;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      dataToUpdate.password = await bcrypt.hash(password, salt);
    }
    // Only SUPER_ADMIN can change organizationId
    if (req.user?.role === 'SUPER_ADMIN' && orgIdFromBody && orgIdFromBody !== userToUpdate.organizationId) {
      dataToUpdate.organizationId = orgIdFromBody;
    }
    const updatedUser = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete a user (admin only)
 * @access  Private (Admin)
 */
router.delete('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    // Find user to delete
    const userToDelete = await prisma.user.findUnique({
      where: { id },
      select: { organizationId: true, email: true, role: true },
    });
    if (!userToDelete) {
      throw createError('User not found', 404);
    }
    // Only SUPER_ADMIN can delete users in any org, ADMIN only in their org
    if (req.user?.role !== 'SUPER_ADMIN' && userToDelete.organizationId !== req.user?.organizationId) {
      throw createError('Unauthorized to delete user in another organization', 403);
    }
    // Prevent deleting own admin account
    if (userToDelete.role === 'ADMIN' && userToDelete.email === req.user?.email) {
      throw createError('Cannot delete your own admin account', 400);
    }
    // Delete related notifications (and add more if needed)
    // await prisma.notification.deleteMany({ where: { userId: id } });
    // Now delete the user
    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/admin/dashboard
 * @desc    Get admin dashboard stats
 * @access  Private (Admin)
 */
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get counts of alarms by status
    const alarmCounts = await prisma.$transaction([
      prisma.alarm.count({ where: { status: 'ACTIVE' } }),
      prisma.alarm.count({ where: { status: 'ACKNOWLEDGED' } }),
      prisma.alarm.count({ where: { status: 'RESOLVED' } }),
    ]);
    
    // Get count of users by role
    const userCounts = await prisma.$transaction([
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.user.count({ where: { role: 'OPERATOR' } }),
    ]);
    
    // Get recent alarms
    const recentAlarms = await prisma.alarm.findMany({
      orderBy: { timestamp: 'desc' },
      take: 5,
    });
    
    res.json({
      alarmStats: {
        active: alarmCounts[0],
        acknowledged: alarmCounts[1],
        resolved: alarmCounts[2],
        total: alarmCounts.reduce((a: number, b: number) => a + b, 0),
      },
      userStats: {
        admins: userCounts[0],
        operators: userCounts[1],
        total: userCounts.reduce((a: number, b: number) => a + b, 0),
      },
      recentAlarms,
    });
  } catch (error) {
    next(error);
  }
});

// Get all setpoint configurations
router.get('/setpoints', async (req, res) => {
  try {
    const organizationId = getRequestOrgId(req);
    const setpoints = await prisma.setpoint.findMany({
      where: { organizationId },
    });
    res.json(setpoints);
  } catch (error) {
    console.error('Error fetching setpoints:', error);
    res.status(500).json({ error: 'Failed to fetch setpoints' });
  }
});

// Create a new setpoint configuration
router.post('/setpoints', async (req, res) => {
  try {
    const { name, type, zone, scadaField, lowDeviation, highDeviation } = req.body;
    const organizationId = getRequestOrgId(req);
    const setpoint = await prisma.setpoint.create({
      data: {
        name,
        type,
        zone,
        scadaField,
        lowDeviation: parseFloat(lowDeviation),
        highDeviation: parseFloat(highDeviation),
        organization: { connect: { id: organizationId } }
      }
    });
    res.json(setpoint);
  } catch (error) {
    console.error('Error creating setpoint:', error);
    res.status(500).json({ error: 'Failed to create setpoint' });
  }
});

// Update a setpoint configuration
router.put('/setpoints/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { lowDeviation, highDeviation } = req.body;
    const organizationId = getRequestOrgId(req);
    const setpoint = await prisma.setpoint.update({
      where: { id, organizationId },
      data: {
        lowDeviation: parseFloat(lowDeviation),
        highDeviation: parseFloat(highDeviation)
      }
    });
    res.json(setpoint);
  } catch (error) {
    console.error('Error updating setpoint:', error);
    res.status(500).json({ error: 'Failed to update setpoint' });
  }
});

// Add endpoints for org onboarding/config (create/update/delete Organization, set SCADA config/schemaConfig)
router.post('/organizations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, scadaDbConfig, schemaConfig } = req.body;
    if (!name || !scadaDbConfig) {
      throw createError('Organization name and SCADA DB config are required', 400);
    }
    // Create the organization first
    const org = await prisma.organization.create({
      data: { name, scadaDbConfig, schemaConfig: schemaConfig || {} },
    });

    // Create setpoints dynamically from column configuration
    if (schemaConfig && schemaConfig.columnConfigs) {
      try {
        const columnConfigs = typeof schemaConfig.columnConfigs === 'string' 
          ? JSON.parse(schemaConfig.columnConfigs) 
          : schemaConfig.columnConfigs;
        
        for (const [columnName, columnConfig] of Object.entries(columnConfigs)) {
          const config = columnConfig as any;
          
          // Only create setpoints for analog columns that have deviation values
          if (config.isAnalog && config.lowDeviation !== undefined && config.highDeviation !== undefined) {
            await prisma.setpoint.create({
              data: {
                name: config.name,
                type: config.type,
                zone: config.zone || null,
                scadaField: columnName,
                lowDeviation: config.lowDeviation,
                highDeviation: config.highDeviation,
                organization: { connect: { id: org.id } },
              },
            });
          }
        }
      } catch (error) {
        console.error('Error creating setpoints from column configuration:', error);
        // Continue with organization creation even if setpoint creation fails
      }
    }

    // Insert default meter limits
    const meterLimits = [
      {
        parameter: 'voltage',
        description: 'Line Voltage',
        unit: 'V',
        highLimit: 440.0,
        lowLimit: 380.0
      },
      {
        parameter: 'current',
        description: 'Line Current',
        unit: 'A',
        highLimit: 100.0,
        lowLimit: 0.0
      },
      {
        parameter: 'frequency',
        description: 'Power Frequency',
        unit: 'Hz',
        highLimit: 51.0,
        lowLimit: 49.0
      },
      {
        parameter: 'pf',
        description: 'Power Factor',
        unit: '',
        highLimit: 1.0,
        lowLimit: 0.85
      },
      {
        parameter: 'power',
        description: 'Active Power',
        unit: 'kW',
        highLimit: 75.0,
        lowLimit: 0.0
      },
      {
        parameter: 'energy',
        description: 'Energy Consumption',
        unit: 'kWh',
        highLimit: 1800.0,
        lowLimit: 0.0
      }
    ];
    for (const limit of meterLimits) {
      await prisma.meterLimit.create({
        data: {
          parameter: limit.parameter,
          description: limit.description,
          unit: limit.unit,
          highLimit: limit.highLimit,
          lowLimit: limit.lowLimit,
          organization: { connect: { id: org.id } },
        },
      });
    }

    res.status(201).json(org);
  } catch (error) { next(error); }
});
router.put('/organizations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, scadaDbConfig, schemaConfig } = req.body;
    
    // Get the current organization to check if schema config is being updated
    const currentOrg = await prisma.organization.findUnique({
      where: { id },
      select: { schemaConfig: true }
    });
    
    const org = await prisma.organization.update({
      where: { id },
      data: { name, scadaDbConfig, schemaConfig },
    });
    
    // If schema config was updated, refresh the SCADA service cache
    if (schemaConfig && currentOrg?.schemaConfig !== schemaConfig) {
      try {
        console.log(`🔄 Organization ${id} schema config updated, refreshing SCADA cache...`);
        await forceRefreshSchemaConfig(id);
        console.log(`✅ SCADA cache refreshed for organization ${id}`);
      } catch (cacheError) {
        console.error(`⚠️ Failed to refresh SCADA cache for organization ${id}:`, cacheError);
        // Don't fail the request if cache refresh fails
      }
    }
    
    res.json(org);
  } catch (error) { next(error); }
});

/**
 * @route   PATCH /api/admin/organizations/:id/toggle-status
 * @desc    Toggle organization enabled/disabled status (superAdmin only)
 * @access  Private (Super Admin)
 */
router.patch('/organizations/:id/toggle-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { isEnabled } = req.body;
    
    // Only SUPER_ADMIN can toggle organization status
    if (req.user?.role !== 'SUPER_ADMIN') {
      throw createError('Forbidden', 403);
    }
    
    if (typeof isEnabled !== 'boolean') {
      throw createError('isEnabled must be a boolean value', 400);
    }
    
    const org = await prisma.organization.update({
      where: { id },
      data: { isEnabled },
    });
    
    // Log the status change
    console.log(`🔄 Organization ${org.name} (${id}) ${isEnabled ? 'ENABLED' : 'DISABLED'} by SUPER_ADMIN ${req.user.email}`);
    
    if (!isEnabled) {
      console.log(`🛑 Users under ${org.name} will not be able to login`);
      console.log(`🛑 SCADA data fetching and notifications will be stopped for ${org.name}`);
    } else {
      console.log(`▶️ Users under ${org.name} can now login`);
      console.log(`▶️ SCADA data fetching and notifications will resume for ${org.name}`);
    }
    
    res.json(org);
  } catch (error) { next(error); }
});
router.delete('/organizations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    // Perform cascading delete in a transaction
    await prisma.$transaction([
      // Delete NotificationSettings
      prisma.notificationSettings.deleteMany({ where: { organizationId: id } }),
      // Delete Notifications
      prisma.notification.deleteMany({ where: { organizationId: id } }),
      // Delete AlarmHistory
      prisma.alarmHistory.deleteMany({ where: { organizationId: id } }),
      // Delete Alarms
      prisma.alarm.deleteMany({ where: { organizationId: id } }),
      // Delete MeterReports
      prisma.meterReport.deleteMany({ where: { organizationId: id } }),
      // Delete FurnaceReports
      prisma.furnaceReport.deleteMany({ where: { organizationId: id } }),
      // Delete Setpoints
      prisma.setpoint.deleteMany({ where: { organizationId: id } }),
      // Delete MeterLimits
      prisma.meterLimit.deleteMany({ where: { organizationId: id } }),
      // Delete SystemSettings
      prisma.systemSettings.deleteMany({ where: { organizationId: id } }),
      // Delete Users (if any left)
      prisma.user.deleteMany({ where: { organizationId: id } }),
      // Finally, delete the Organization
      prisma.organization.delete({ where: { id } })
    ]);
    res.status(204).send();
  } catch (error) { next(error); }
});

/**
 * @route   GET /api/admin/organizations
 * @desc    Get all organizations (superAdmin only)
 * @access  Private (Super Admin)
 */
// Define the async handler separately to avoid type inference issues
const getOrganizationsHandler = async (req: any, res: any, next: any) => {
  try {
    // Only SUPER_ADMIN can access this route
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const orgs = await prisma.organization.findMany();
    res.json(orgs);
  } catch (error) {
    next(error);
  }
};

router.get('/organizations', getOrganizationsHandler);

/**
 * @route   GET /api/admin/metrics
 * @desc    Get super admin metrics (superAdmin only)
 * @access  Private (Super Admin)
 */
const getMetricsHandler = async (req: any, res: any, next: any) => {
  try {
    // Only SUPER_ADMIN can access this route
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Get current date and start of week
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);

    // Fetch all organizations
    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        isEnabled: true,
        createdAt: true,
        users: {
          select: {
            id: true,
            createdAt: true,
          }
        }
      }
    });

    // Calculate metrics
    const totalOrganizations = organizations.length;
    const activeOrganizations = organizations.filter(org => org.isEnabled).length;
    const disabledOrganizations = organizations.filter(org => !org.isEnabled).length;
    
    // Count new organizations this week
    const newOrganizationsThisWeek = organizations.filter(org => 
      new Date(org.createdAt) >= startOfWeek
    ).length;

    // Count total users and new users this week
    let totalUsers = 0;
    let newUsersThisWeek = 0;

    organizations.forEach(org => {
      totalUsers += org.users.length;
      org.users.forEach(user => {
        if (new Date(user.createdAt) >= startOfWeek) {
          newUsersThisWeek++;
        }
      });
    });

    const metrics = {
      totalOrganizations,
      totalUsers,
      activeOrganizations,
      newOrganizationsThisWeek,
      newUsersThisWeek,
      disabledOrganizations,
    };

    res.json(metrics);
  } catch (error) {
    next(error);
  }
};

router.get('/metrics', getMetricsHandler);

/**
 * @route   GET /api/admin/monitoring/status
 * @desc    Get background monitoring service status (superAdmin only)
 * @access  Private (Super Admin)
 */
router.get('/monitoring/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Only SUPER_ADMIN can access this route
    if (req.user?.role !== 'SUPER_ADMIN') {
      throw createError('Forbidden', 403);
    }

    const healthStatus = BackgroundMonitoringService.getHealthStatus();
    const monitoringStatus = BackgroundMonitoringService.getMonitoringStatus();

    res.json({
      health: healthStatus,
      organizations: monitoringStatus
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/admin/monitoring/force-cycle
 * @desc    Force a monitoring cycle for all organizations (superAdmin only)
 * @access  Private (Super Admin)
 */
router.post('/monitoring/force-cycle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Only SUPER_ADMIN can access this route
    if (req.user?.role !== 'SUPER_ADMIN') {
      throw createError('Forbidden', 403);
    }

    await BackgroundMonitoringService.forceMonitoringCycle();
    res.json({ message: 'Monitoring cycle forced successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/admin/monitoring/force-org/:orgId
 * @desc    Force monitoring for a specific organization (superAdmin only)
 * @access  Private (Super Admin)
 */
router.post('/monitoring/force-org/:orgId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Only SUPER_ADMIN can access this route
    if (req.user?.role !== 'SUPER_ADMIN') {
      throw createError('Forbidden', 403);
    }

    const { orgId } = req.params;
    await BackgroundMonitoringService.forceMonitorOrganization(orgId);
    res.json({ message: `Monitoring forced for organization ${orgId}` });
  } catch (error) {
    next(error);
  }
});

export default router; 