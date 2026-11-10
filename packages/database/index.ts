export * from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export function createDatabase(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 }) });
}
