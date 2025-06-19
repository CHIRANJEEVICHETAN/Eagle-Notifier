import { Pool, PoolClient } from 'pg';
import { backOff } from 'exponential-backoff';
import { logError } from './../utils/logger';

const DEBUG = process.env.NODE_ENV === 'development';

// Custom error interface with code property
interface PostgresError extends Error {
  code?: string;
}

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
      min: 4,                // Keep at least 4 connections ready
      idleTimeoutMillis: 15000, // Reduced idle timeout below our 30s polling interval
      connectionTimeoutMillis: 5000, // Increased time to wait for a connection
      maxUses: 5000,         // Close and replace after this many uses
      allowExitOnIdle: false, // Don't exit on idle
      keepAlive: true       // Enable TCP keepalive
    });

    // Add event listeners for connection issues
    pool.on('connect', () => {
      if (DEBUG) console.log('🟢 New client connected to SCADA DB');
    });

    pool.on('error', (err: PostgresError, client) => {
      logError('Unexpected error on idle client', err);
      // Force close this client and let the pool create a new one
      if (client) {
        client.release(true);
      }
      // Recreate the pool if we had critical errors
      if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
        console.log('🔄 Database connection error detected, recreating connection pool');
        scadaPool = createScadaPool();
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
    // Check if pool is healthy, recreate if needed
    if (!scadaPool || scadaPool.totalCount < 1) {
      console.log('🔄 Pool doesn\'t exist or is empty, recreating connection pool');
      scadaPool = createScadaPool();
    }
    
    const client = await getScadaPool().connect();
    
    // Test if connection is still valid with simple query
    try {
      await client.query('SELECT 1');
    } catch (testError) {
      console.error('❌ Connection test failed, releasing and retrying', testError);
      client.release(true);
      // If we still have retries left, attempt to get a new client
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return getClientWithRetry(retries - 1, delay * 2);
      }
      throw new Error('Connection test failed');
    }
    
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
    if (scadaPool) {
      await scadaPool.end();
      if (DEBUG) console.log('✅ All SCADA database connections closed');
    }
    return true;
  } catch (error) {
    console.error('❌ Error closing SCADA database connections:', error);
    return false;
  }
}

export default getScadaPool();