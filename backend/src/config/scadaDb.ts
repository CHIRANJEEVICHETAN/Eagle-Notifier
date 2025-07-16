import { Pool, PoolClient } from 'pg';
import { backOff } from 'exponential-backoff';
import { logError } from './../utils/logger';
import prisma from './db';

const DEBUG = process.env.NODE_ENV === 'development';

// Custom error interface with code property
interface PostgresError extends Error {
  code?: string;
}

const poolCache = new Map<string, Pool>();

async function getOrgScadaConfig(orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new Error('Organization not found');
  return org.scadaDbConfig;
}

function createPoolFromConfig(config: any): Pool {
  // Validate required fields
  const requiredFields = ['host', 'port', 'user', 'password', 'database'];
  for (const field of requiredFields) {
    if (!config[field] || typeof config[field] !== 'string' && field !== 'port') {
      console.error(`❌ SCADA DB config error: Missing or invalid '${field}' in org config:`, config);
      throw new Error(`SCADA DB config error: Missing or invalid '${field}'`);
    }
  }
  // Determine SSL config based on sslmode
  let ssl: any = false;
  if (config.sslmode === 'require' || config.ssl === true) {
    ssl = { rejectUnauthorized: false };
  }
  if (typeof config.ssl === 'object') {
    ssl = config.ssl;
  }
  // Ensure password is always a string
  let password = config.password;
  if (typeof password !== 'string') {
    console.warn('⚠️ SCADA DB password is not a string, coercing to string.');
    password = password !== undefined && password !== null ? String(password) : '';
  }
  return new Pool({
    user: config.user,
    password,
    host: config.host,
    port: parseInt(config.port || '5432'),
    database: config.database,
    ssl,
    max: 20,
    min: 4,
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 5000,
    maxUses: 5000,
    allowExitOnIdle: false,
    keepAlive: true
  });
}

export async function getScadaPoolForOrg(orgId: string): Promise<Pool> {
  if (poolCache.has(orgId)) return poolCache.get(orgId)!;
  const config = await getOrgScadaConfig(orgId);
  const pool = createPoolFromConfig(config);
  poolCache.set(orgId, pool);
  return pool;
}

export async function getClientWithRetry(orgId: string, retries = 3, delay = 500): Promise<PoolClient> {
  try {
    const pool = await getScadaPoolForOrg(orgId);
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
    } catch (testError) {
      client.release(true);
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return getClientWithRetry(orgId, retries - 1, delay * 2);
      }
      throw new Error('Connection test failed');
    }
    return client;
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return getClientWithRetry(orgId, retries - 1, delay * 2);
    } else {
      throw error;
    }
  }
}

// Check database health
export async function checkScadaHealth(orgId: string) {
  try {
    const client = await getClientWithRetry(orgId);
    try {
      const result = await client.query('SELECT NOW()');
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        details: {
          connected: true,
          databaseTime: result.rows[0].now,
          poolStats: {
            totalCount: getScadaPoolForOrg(orgId).then(p => p.totalCount),
            idleCount: getScadaPoolForOrg(orgId).then(p => p.idleCount),
            waitingCount: getScadaPoolForOrg(orgId).then(p => p.waitingCount),
          }
        }
      };
    } finally {
      client.release(true); // Force release the client
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      details: {
        error: error instanceof Error ? error.message : String(error),
        connected: false
      }
    };
  }
}

// Test the connection and output status
export async function testScadaConnection(orgId: string) {
  try {
    const client = await getClientWithRetry(orgId);
    try {
      const result = await client.query('SELECT NOW()');
      if (DEBUG) console.log('🟢 Successfully connected to SCADA database');
      if (DEBUG) console.log('📊 Connection test result:', result.rows[0]);
      return true;
    } finally {
      client.release(true); // Force release
    }
  } catch (error) {
    console.error('🔴 Error connecting to SCADA database:', error);
    return false;
  }
}

// Close all database connections
export async function closeScadaConnections() {
  try {
    for (const pool of poolCache.values()) {
      await pool.end();
    }
    poolCache.clear();
    if (DEBUG) console.log('✅ All SCADA database connections closed');
  } catch (error) {
    console.error('❌ Error closing SCADA database connections:', error);
    return false;
  }
}

// Helper to test and log all org SCADA DB connections at startup
export async function testAllOrgScadaConnections() {
  const orgs = await prisma.organization.findMany();
  for (const org of orgs) {
    const orgName = org.name || org.id;
    if (!org.scadaDbConfig || Object.keys(org.scadaDbConfig).length === 0) {
      console.error(`❌ [${orgName}] Missing scadaDbConfig. Skipping organization.`);
      continue;
    }
    try {
      // Validate config before attempting connection
      createPoolFromConfig(org.scadaDbConfig);
      // Test connection
      const pool = getScadaPoolForOrg(org.id);
      await testScadaConnection(org.id);
      console.log(`✅ [${orgName}] SCADA DB connected successfully (orgId: ${org.id})`);
    } catch (err: any) {
      console.error(`🔴 [${orgName}] Failed to connect to SCADA DB (orgId: ${org.id}):`, err.message || err);
    }
  }
}