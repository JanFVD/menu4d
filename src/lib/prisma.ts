import { PrismaClient } from '@prisma/client';

// Singleton compartido entre el servidor Socket.io y los Server Components de Next.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

