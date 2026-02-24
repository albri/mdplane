import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from './schema';
import { runMigrations, resetDatabase } from './migrate';
import { seedDemoWorkspace } from './seed-demo';
import { serverEnv } from '../config/env';

const databasePath = serverEnv.databaseUrl;
const isTest = serverEnv.isTest;
const isInMemory = databasePath === ':memory:';

const shouldReset = serverEnv.databaseReset;

let sqlite: Database;

if (shouldReset && !isInMemory) {
  console.log('DATABASE_RESET=true: Resetting database...');
  sqlite = new Database(databasePath);
  resetDatabase(sqlite);
  sqlite.close();
}

sqlite = runMigrations(databasePath);

export const db = drizzle(sqlite, { schema });

const isIntegrationTest = serverEnv.integrationTestMode;
if (!isTest || isIntegrationTest) {
  try {
    await seedDemoWorkspace(db);
  } catch (err) {
    console.error('[seed-demo] Failed to seed demo workspace:', err);
  }
}

export { sqlite };

/**
 * Initialize database tables.
 * @deprecated Use Drizzle migrations instead. This is kept for test compatibility.
 */
export function initializeDatabase(): void {
}

