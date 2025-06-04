import { PrismaClient } from '../generated/prisma-client';

// Create a singleton PrismaClient instance with better logging
const prisma = new PrismaClient({
  log: ['error', 'warn'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  }
});

// Handle connection errors gracefully
process.on('uncaughtException', (e) => {
  console.error('Uncaught Exception:', e);
});

// Export the singleton instance
export default prisma; 