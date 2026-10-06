import { PrismaPg } from '@prisma/adapter-pg';
import { config } from './config';
import { PrismaClient } from './generated/prisma/client';

export const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.databaseUrl }) });
export type Db = typeof db;
export { Prisma } from './generated/prisma/client';
