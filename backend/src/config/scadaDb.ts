import { Pool, PoolClient } from 'pg';
import { backOff } from 'exponential-backoff';
import { logError } from './../utils/logger';

const DEBUG = process.env.NODE_ENV === 'development';

const createScadaPool = () => {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    if (DEBUG) {
      console.log('🔌 Initializing SCADA DB connection...');
    }

    const [credentials, hostInfo] = dbUrl.split('@');
    const [protocol, userPass] = credentials.split('://');
    const [user, password] = userPass.split(':');
    const [hostPort, dbName] = hostInfo.split('/');
    const [host, port] = hostPort.split(':');

    const pool = new Pool({
      user,
      password,
      host,
      port: parseInt(port || '19905'),
      database: 'Notifier-Main-DB',
      ssl: {
        rejectUnauthorized: false
      },
      // Enhanced connection pool settings to prevent timeouts
      max: 20,               // Maximum number of clients in the pool
      min: 2,  // Keep at least 2 connections ready
      idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
      connectionTimeoutMillis: 2000, // How long to wait for a connection
      maxUses: 7500,        // Close and replace after this many uses
      allowExitOnIdle: false // Don't exit on idle
    });

    // Add event listeners for connection issues
    pool.on('connect', () => {
      if (DEBUG) console.log('🟢 New client connected to SCADA DB');
    });

    pool.on('error', (err, client) => {
      logError('Unexpected error on idle client', err);
      if (client) {
        client.release(true);
      }
    });

    pool.on('acquire', () => {
      if (DEBUG) console.log('🔵 Client acquired from pool');
    });

    pool.on('remove', () => {
      if (DEBUG) console.log('🟡 Client removed from pool');
    });

    return pool;
  } catch (error) {
    console.error('🔴 Error creating SCADA database pool:', error);
    throw error;
  }
};

// Use a singleton pattern for connection pool with auto-reconnect capabilities
let scadaPool: Pool;

const getScadaPool = () => {
  if (!scadaPool) {
    scadaPool = createScadaPool();
  }
  return scadaPool;
};

// Helper function to get a client with retry logic
export async function getClientWithRetry(retries = 3, delay = 500): Promise<PoolClient> {
  try {
    if (DEBUG) console.log('🔵 Client acquired from pool');
    const client = await getScadaPool().connect();
    
    // Ensure client is properly released when it's no longer needed
    const originalRelease = client.release;
    client.release = (err?: Error) => {
      if (DEBUG) console.log('🟡 Client released back to pool');
      client.release = originalRelease;
      return originalRelease.call(client, err);
    };
    
    return client;
  } catch (error) {
    if (retries > 0) {
      if (DEBUG) console.warn(`⚠️ Failed to get client, retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return getClientWithRetry(retries - 1, delay * 2);
    } else {
      console.error('🔴 Failed to get SCADA DB client after retries:', error);
      throw error;
    }
  }
}

// Check database health
export async function checkScadaHealth() {
  try {
    const client = await getClientWithRetry();
    try {
      const result = await client.query('SELECT NOW()');
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        details: {
          connected: true,
          databaseTime: result.rows[0].now,
          poolStats: {
            totalCount: getScadaPool().totalCount,
            idleCount: getScadaPool().idleCount,
            waitingCount: getScadaPool().waitingCount,
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
export async function testScadaConnection() {
  try {
    const client = await getClientWithRetry();
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
    await getScadaPool().end();
    if (DEBUG) console.log('✅ All SCADA database connections closed');
    return true;
  } catch (error) {
    console.error('❌ Error closing SCADA database connections:', error);
    return false;
  }
}

export default getScadaPool();