import { Pool } from 'pg';
import { backOff } from 'exponential-backoff';

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
      // Add connection pool settings
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Add event listeners for connection issues
    pool.on('connect', () => {
      if (DEBUG) console.log('🟢 New client connected to SCADA DB');
    });

    pool.on('error', (err, client) => {
      console.error('🔴 Unexpected error on idle SCADA DB client:', err);
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

const scadaPool = createScadaPool();

// Enhanced connection test with retries and better logging
export const testScadaConnection = async () => {
  const retryOptions = {
    numOfAttempts: 5,
    startingDelay: 1000,
    timeMultiple: 2,
    maxDelay: 10000,
  };

  try {
    await backOff(async () => {
      const client = await scadaPool.connect();
      try {
        const result = await client.query('SELECT NOW()');
        if (DEBUG) {
          console.log('🟢 Successfully connected to SCADA database');
          console.log('📊 Connection test result:', result.rows[0]);
        }
        return true;
      } finally {
        client.release();
      }
    }, retryOptions);
    return true;
  } catch (error) {
    console.error('🔴 Failed to connect to SCADA database after retries:', error);
    return false;
  }
};

// Add a health check function with detailed diagnostics
export const checkScadaHealth = async () => {
  try {
    const client = await scadaPool.connect();
    try {
      const result = await client.query('SELECT NOW()');
      const health = {
        status: 'healthy',
        timestamp: result.rows[0].now,
        poolSize: scadaPool.totalCount,
        idleConnections: scadaPool.idleCount,
        waitingCount: scadaPool.waitingCount
      };
      if (DEBUG) console.log('🏥 SCADA DB Health Check:', health);
      return health;
    } finally {
      client.release();
    }
  } catch (error) {
    const errorStatus = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date()
    };
    console.error('🔴 SCADA DB Health Check Failed:', errorStatus);
    return errorStatus;
  }
};

export default scadaPool;