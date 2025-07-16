import { PrismaClient } from '../src/generated/prisma-client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 1. Create default organization if not present
  const defaultOrgName = 'Default Org';
  let defaultOrg = await prisma.organization.findFirst({ where: { name: defaultOrgName } });
  if (!defaultOrg) {
    defaultOrg = await prisma.organization.create({
      data: {
        name: defaultOrgName,
        scadaDbConfig: {}, // Fill with real config as needed
        schemaConfig: {},
      },
    });
    console.log('✅ Created default organization:', defaultOrgName);
  } else {
    console.log('⏭️ Default organization already exists - skipping');
  }
  const organizationId = defaultOrg.id;

  // 2. Seed SUPER_ADMIN user if not present
  const superAdminEmail = 'superadmin@eaglenotifier.com';
  const superAdminPassword = 'SuperSecure123!'; // Change after first login
  const superAdminName = 'Super Admin';
  const existingSuperAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!existingSuperAdmin) {
    const hashedPassword = await bcrypt.hash(superAdminPassword, 10);
    await prisma.user.create({
      data: {
        email: superAdminEmail,
        password: hashedPassword,
        name: superAdminName,
        role: 'SUPER_ADMIN',
        // organizationId: null // Not required, nullable for SUPER_ADMIN
      }
    });
    console.log('✅ Seeded SUPER_ADMIN user:', superAdminEmail);
    console.log('   Default password:', superAdminPassword);
  } else {
    console.log('⏭️ SUPER_ADMIN user already exists - skipping');
  }

  // 3. Seed setpoints for the default org
  const setpoints = [
    {
      name: 'HARDENING ZONE 1 TEMPERATURE',
      type: 'temperature',
      zone: 'zone1',
      scadaField: 'hz1sv',
      lowDeviation: -30.0,
      highDeviation: 10.0,
      setPoint: 870
    },
    {
      name: 'HARDENING ZONE 2 TEMPERATURE',
      type: 'temperature',
      zone: 'zone2',
      scadaField: 'hz2sv',
      lowDeviation: -10.0,
      highDeviation: 10.0,
      setPoint: 880
    },
    {
      name: 'CARBON POTENTIAL',
      type: 'carbon',
      scadaField: 'cpsv',
      lowDeviation: -0.05,
      highDeviation: 0.05,
      setPoint: 0.40
    },
    {
      name: 'TEMPERING ZONE1 TEMPERATURE',
      type: 'temperature',
      zone: 'zone1',
      scadaField: 'tz1sv',
      lowDeviation: -30.0,
      highDeviation: 10.0,
      setPoint: 450
    },
    {
      name: 'TEMPERING ZONE2 TEMPERATURE',
      type: 'temperature',
      zone: 'zone2',
      scadaField: 'tz2sv',
      lowDeviation: -10.0,
      highDeviation: 10.0,
      setPoint: 460
    },
    {
      name: 'OIL TEMPERATURE',
      type: 'temperature',
      scadaField: 'oilpv',
      lowDeviation: -10,
      highDeviation: 20.0,
      setPoint: 60
    }
  ];

  console.log('🌱 Starting setpoint configuration seeding...');

  for (const setpoint of setpoints) {
    try {
      // Check if setpoint already exists for this org
      const existing = await prisma.setpoint.findFirst({
        where: {
          name: setpoint.name,
          type: setpoint.type,
          zone: setpoint.zone || null,
          organizationId,
        },
      });

      if (!existing) {
        // Create new setpoint configuration
        await prisma.setpoint.create({
          data: {
            name: setpoint.name,
            type: setpoint.type,
            zone: setpoint.zone || null,
            scadaField: setpoint.scadaField,
            lowDeviation: setpoint.lowDeviation,
            highDeviation: setpoint.highDeviation,
            organization: { connect: { id: organizationId } },
          },
        });
        console.log(`✅ Added setpoint configuration for ${setpoint.name}`);
        console.log(`   Set Point: ${setpoint.setPoint}`);
        console.log(`   Deviation Band: ${setpoint.lowDeviation} to +${setpoint.highDeviation}`);
      } else {
        console.log(`⏭️ Setpoint configuration for ${setpoint.name} already exists - skipping`);
      }
    } catch (error) {
      console.error(`❌ Error adding setpoint for ${setpoint.name}:`, error);
    }
  }

  console.log('✨ Setpoint configuration seeding completed');

  // 4. Seed meter limits for the default org
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

  console.log('🌱 Starting meter limits seeding...');

  for (const limit of meterLimits) {
    try {
      // Check if limit already exists for this org
      const existing = await prisma.meterLimit.findFirst({
        where: {
          parameter: limit.parameter,
          organizationId,
        }
      });

      if (!existing) {
        // Create new meter limit
        await prisma.meterLimit.create({
          data: {
            parameter: limit.parameter,
            description: limit.description,
            unit: limit.unit,
            highLimit: limit.highLimit,
            lowLimit: limit.lowLimit,
            organization: { connect: { id: organizationId } },
          }
        });
        console.log(`✅ Added meter limit for ${limit.description}`);
        console.log(`   Range: ${limit.lowLimit} ${limit.unit} to ${limit.highLimit} ${limit.unit}`);
      } else {
        console.log(`⏭️ Meter limit for ${limit.description} already exists - skipping`);
      }
    } catch (error) {
      console.error(`❌ Error adding meter limit for ${limit.description}:`, error);
    }
  }

  console.log('✨ Meter limits seeding completed');
}

main()
  .catch((e) => {
    console.error('🔴 Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 