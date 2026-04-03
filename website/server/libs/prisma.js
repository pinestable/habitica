import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import nconf from 'nconf';
import path from 'path';

const dbPath = nconf.get('DATABASE_PATH') || path.resolve(process.cwd(), 'habitica.db');
// adapter expects { url } where url may be a "file:..." path or an absolute path
const url = dbPath.startsWith('file:') ? dbPath : `file:${dbPath}`;
const adapter = new PrismaBetterSqlite3({ url });

export const prisma = new PrismaClient({ adapter });
export default prisma;
