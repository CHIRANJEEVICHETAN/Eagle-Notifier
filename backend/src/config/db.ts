import { PrismaClient } from '@prisma/client';

// Create a singleton PrismaClient instance
const prisma = new PrismaClient();

export default prisma; 