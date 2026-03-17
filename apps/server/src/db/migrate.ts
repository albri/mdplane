import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from './schema';
import { join, dirname } from 'path';
import { mkdirSync, existsSync, readdirSync } from 'fs';

export function runMigrations(databasePath: string): Database {
  const isMemory = databasePath === ':memory:';

  if (!isMemory) {
    const dir = dirname(databasePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  const sqlite = new Database(databasePath);

  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec('PRAGMA busy_timeout = 5000;');

  if (!isMemory) {
    sqlite.exec('PRAGMA journal_mode = WAL;');
  }

  const db = drizzle(sqlite, { schema });

  const dockerPath = '/app/drizzle';
  const devPath = join(dirname(import.meta.path), '../../drizzle');
  const altPath = join(process.cwd(), 'drizzle');
  const migrationsFolder = existsSync(dockerPath) ? dockerPath : (existsSync(devPath) ? devPath : altPath);

  if (!existsSync(migrationsFolder)) {
    throw new Error(`Migrations folder not found: tried ${dockerPath} and ${devPath}`);
  }

  migrate(db, { migrationsFolder });
  console.log('[migrate] migrations applied successfully');

  return sqlite;
}

export function resetDatabase(sqlite: Database): void {
  const tables = sqlite
    .query<{ name: string }, []>(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
    .all();

  sqlite.exec('PRAGMA foreign_keys = OFF;');

  for (const { name } of tables) {
    sqlite.exec(`DROP TABLE IF EXISTS "${name}";`);
  }

  sqlite.exec('PRAGMA foreign_keys = ON;');
}
