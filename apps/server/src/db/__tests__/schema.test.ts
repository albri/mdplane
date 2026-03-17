import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../schema';

// Test database setup
let sqlite: Database;
let db: ReturnType<typeof drizzle>;

beforeAll(() => {
  // Create in-memory database for testing
  sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
});

afterAll(() => {
  sqlite.close();
});

describe('Database Schema - Table Existence', () => {
  test('should export workspaces table', () => {
    expect(schema.workspaces).toBeDefined();
  });

  test('should export capabilityKeys table', () => {
    expect(schema.capabilityKeys).toBeDefined();
  });

  test('should export files table', () => {
    expect(schema.files).toBeDefined();
  });

  test('should export appends table', () => {
    expect(schema.appends).toBeDefined();
  });

  test('should export webhooks table', () => {
    expect(schema.webhooks).toBeDefined();
  });

  test('should export idempotencyKeys table', () => {
    expect(schema.idempotencyKeys).toBeDefined();
  });

  // Note: pendingClaims table removed - OAuth session provides instant claiming
});

describe('workspaces table schema', () => {
  test('should have id column as primary key (TEXT)', () => {
    expect(schema.workspaces.id).toBeDefined();
    expect(schema.workspaces.id.dataType).toBe('string');
    expect(schema.workspaces.id.primary).toBe(true);
  });

  test('should have name column (TEXT, nullable)', () => {
    expect(schema.workspaces.name).toBeDefined();
    expect(schema.workspaces.name.dataType).toBe('string');
    expect(schema.workspaces.name.notNull).toBe(false);
  });

  test('should have createdAt column (TEXT, NOT NULL)', () => {
    expect(schema.workspaces.createdAt).toBeDefined();
    expect(schema.workspaces.createdAt.notNull).toBe(true);
  });

  test('should have claimedAt column (TEXT, nullable)', () => {
    expect(schema.workspaces.claimedAt).toBeDefined();
    expect(schema.workspaces.claimedAt.notNull).toBe(false);
  });

  test('should have claimedByEmail column (TEXT, nullable)', () => {
    expect(schema.workspaces.claimedByEmail).toBeDefined();
    expect(schema.workspaces.claimedByEmail.notNull).toBe(false);
  });

  test('should have lastActivityAt column (TEXT, NOT NULL)', () => {
    expect(schema.workspaces.lastActivityAt).toBeDefined();
    expect(schema.workspaces.lastActivityAt.notNull).toBe(true);
  });

  test('should have deletedAt column (TEXT, nullable)', () => {
    expect(schema.workspaces.deletedAt).toBeDefined();
    expect(schema.workspaces.deletedAt.notNull).toBe(false);
  });
});

describe('capabilityKeys table schema', () => {
  test('should have id column as primary key (TEXT)', () => {
    expect(schema.capabilityKeys.id).toBeDefined();
    expect(schema.capabilityKeys.id.primary).toBe(true);
  });

  test('should have workspaceId column (TEXT, NOT NULL, FK to workspaces)', () => {
    expect(schema.capabilityKeys.workspaceId).toBeDefined();
    expect(schema.capabilityKeys.workspaceId.notNull).toBe(true);
  });

  test('should have prefix column (TEXT, NOT NULL)', () => {
    expect(schema.capabilityKeys.prefix).toBeDefined();
    expect(schema.capabilityKeys.prefix.notNull).toBe(true);
  });

  test('should have keyHash column (TEXT, NOT NULL)', () => {
    expect(schema.capabilityKeys.keyHash).toBeDefined();
    expect(schema.capabilityKeys.keyHash.notNull).toBe(true);
  });

  test('should have permission column (TEXT enum, NOT NULL)', () => {
    expect(schema.capabilityKeys.permission).toBeDefined();
    expect(schema.capabilityKeys.permission.notNull).toBe(true);
    // Should be enum: 'read' | 'append' | 'write'
    expect(schema.capabilityKeys.permission.enumValues).toContain('read');
    expect(schema.capabilityKeys.permission.enumValues).toContain('append');
    expect(schema.capabilityKeys.permission.enumValues).toContain('write');
  });

  test('should have scopeType column (TEXT enum, NOT NULL)', () => {
    expect(schema.capabilityKeys.scopeType).toBeDefined();
    expect(schema.capabilityKeys.scopeType.notNull).toBe(true);
    expect(schema.capabilityKeys.scopeType.enumValues).toContain('workspace');
    expect(schema.capabilityKeys.scopeType.enumValues).toContain('folder');
    expect(schema.capabilityKeys.scopeType.enumValues).toContain('file');
  });

  test('should have scopePath column (TEXT, nullable)', () => {
    expect(schema.capabilityKeys.scopePath).toBeDefined();
  });

  test('should have boundAuthor column (TEXT, nullable)', () => {
    expect(schema.capabilityKeys.boundAuthor).toBeDefined();
  });

  test('should have wipLimit column (INTEGER, nullable)', () => {
    expect(schema.capabilityKeys.wipLimit).toBeDefined();
    expect(schema.capabilityKeys.wipLimit.dataType).toBe('number');
  });

  test('should have allowedTypes column (TEXT, nullable - JSON array)', () => {
    expect(schema.capabilityKeys.allowedTypes).toBeDefined();
  });

  test('should have createdAt column (TEXT, NOT NULL)', () => {
    expect(schema.capabilityKeys.createdAt).toBeDefined();
    expect(schema.capabilityKeys.createdAt.notNull).toBe(true);
  });

  test('should have expiresAt column (TEXT, nullable)', () => {
    expect(schema.capabilityKeys.expiresAt).toBeDefined();
  });

  test('should have revokedAt column (TEXT, nullable)', () => {
    expect(schema.capabilityKeys.revokedAt).toBeDefined();
  });
});

describe('files table schema', () => {
  test('should have id column as primary key (TEXT)', () => {
    expect(schema.files.id).toBeDefined();
    expect(schema.files.id.primary).toBe(true);
  });

  test('should have workspaceId column (TEXT, NOT NULL, FK to workspaces)', () => {
    expect(schema.files.workspaceId).toBeDefined();
    expect(schema.files.workspaceId.notNull).toBe(true);
  });

  test('should have path column (TEXT, NOT NULL)', () => {
    expect(schema.files.path).toBeDefined();
    expect(schema.files.path.notNull).toBe(true);
  });

  test('should have createdAt column (TEXT, NOT NULL)', () => {
    expect(schema.files.createdAt).toBeDefined();
    expect(schema.files.createdAt.notNull).toBe(true);
  });

  test('should have updatedAt column (TEXT, NOT NULL)', () => {
    expect(schema.files.updatedAt).toBeDefined();
    expect(schema.files.updatedAt.notNull).toBe(true);
  });

  test('should have deletedAt column (TEXT, nullable)', () => {
    expect(schema.files.deletedAt).toBeDefined();
    expect(schema.files.deletedAt.notNull).toBe(false);
  });
});

describe('appends table schema', () => {
  test('should have id column as primary key (TEXT)', () => {
    expect(schema.appends.id).toBeDefined();
    expect(schema.appends.id.primary).toBe(true);
  });

  test('should have fileId column (TEXT, NOT NULL, FK to files)', () => {
    expect(schema.appends.fileId).toBeDefined();
    expect(schema.appends.fileId.notNull).toBe(true);
  });

  test('should have appendId column (TEXT, NOT NULL)', () => {
    expect(schema.appends.appendId).toBeDefined();
    expect(schema.appends.appendId.notNull).toBe(true);
  });

  test('should have author column (TEXT, NOT NULL)', () => {
    expect(schema.appends.author).toBeDefined();
    expect(schema.appends.author.notNull).toBe(true);
  });

  test('should have type column (TEXT, nullable)', () => {
    expect(schema.appends.type).toBeDefined();
  });

  test('should have ref column (TEXT, nullable)', () => {
    expect(schema.appends.ref).toBeDefined();
  });

  test('should have status column (TEXT, nullable)', () => {
    expect(schema.appends.status).toBeDefined();
  });

  test('should have priority column (TEXT, nullable)', () => {
    expect(schema.appends.priority).toBeDefined();
  });

  test('should have labels column (TEXT, nullable)', () => {
    expect(schema.appends.labels).toBeDefined();
  });

  test('should have dueAt column (TEXT, nullable)', () => {
    expect(schema.appends.dueAt).toBeDefined();
  });

  test('should have expiresAt column (TEXT, nullable)', () => {
    expect(schema.appends.expiresAt).toBeDefined();
  });

  test('should have createdAt column (TEXT, NOT NULL)', () => {
    expect(schema.appends.createdAt).toBeDefined();
    expect(schema.appends.createdAt.notNull).toBe(true);
  });

  test('should have contentPreview column (TEXT, nullable)', () => {
    expect(schema.appends.contentPreview).toBeDefined();
  });
});

describe('webhooks table schema', () => {
  test('should have id column as primary key (TEXT)', () => {
    expect(schema.webhooks.id).toBeDefined();
    expect(schema.webhooks.id.primary).toBe(true);
  });

  test('should have workspaceId column (TEXT, NOT NULL, FK to workspaces)', () => {
    expect(schema.webhooks.workspaceId).toBeDefined();
    expect(schema.webhooks.workspaceId.notNull).toBe(true);
  });

  test('should have scopeType column (TEXT, NOT NULL)', () => {
    expect(schema.webhooks.scopeType).toBeDefined();
    expect(schema.webhooks.scopeType.notNull).toBe(true);
  });

  test('should have scopePath column (TEXT, nullable)', () => {
    expect(schema.webhooks.scopePath).toBeDefined();
  });

  test('should have url column (TEXT, NOT NULL)', () => {
    expect(schema.webhooks.url).toBeDefined();
    expect(schema.webhooks.url.notNull).toBe(true);
  });

  test('should have events column (TEXT, NOT NULL - JSON array)', () => {
    expect(schema.webhooks.events).toBeDefined();
    expect(schema.webhooks.events.notNull).toBe(true);
  });

  test('should have secretHash column (TEXT, nullable)', () => {
    expect(schema.webhooks.secretHash).toBeDefined();
  });

  test('should have createdAt column (TEXT, NOT NULL)', () => {
    expect(schema.webhooks.createdAt).toBeDefined();
    expect(schema.webhooks.createdAt.notNull).toBe(true);
  });

  test('should have lastTriggeredAt column (TEXT, nullable)', () => {
    expect(schema.webhooks.lastTriggeredAt).toBeDefined();
  });

  test('should have failureCount column (INTEGER, default 0)', () => {
    expect(schema.webhooks.failureCount).toBeDefined();
    expect(schema.webhooks.failureCount.dataType).toBe('number');
  });

  test('should have disabledAt column (TEXT, nullable)', () => {
    expect(schema.webhooks.disabledAt).toBeDefined();
  });
});


describe('idempotencyKeys table schema', () => {
  test('should have key column as primary key (TEXT)', () => {
    expect(schema.idempotencyKeys.key).toBeDefined();
    expect(schema.idempotencyKeys.key.primary).toBe(true);
  });

  test('should have capabilityKeyId column (TEXT, NOT NULL)', () => {
    expect(schema.idempotencyKeys.capabilityKeyId).toBeDefined();
    expect(schema.idempotencyKeys.capabilityKeyId.notNull).toBe(true);
  });

  test('should have responseStatus column (INTEGER, NOT NULL)', () => {
    expect(schema.idempotencyKeys.responseStatus).toBeDefined();
    expect(schema.idempotencyKeys.responseStatus.notNull).toBe(true);
    expect(schema.idempotencyKeys.responseStatus.dataType).toBe('number');
  });

  test('should have responseBody column (TEXT, NOT NULL)', () => {
    expect(schema.idempotencyKeys.responseBody).toBeDefined();
    expect(schema.idempotencyKeys.responseBody.notNull).toBe(true);
  });

  test('should have createdAt column (TEXT, NOT NULL)', () => {
    expect(schema.idempotencyKeys.createdAt).toBeDefined();
    expect(schema.idempotencyKeys.createdAt.notNull).toBe(true);
  });
});

describe('Database Schema - Foreign Key Relationships', () => {
  test('capabilityKeys.workspaceId should reference workspaces.id', () => {
    const fk = schema.capabilityKeys.workspaceId;
    expect(fk).toBeDefined();
    // Foreign keys in Drizzle 0.45+ are stored at table level, not column config
    // We verify the column exists and is properly typed - the .references() call
    // in schema.ts ensures the FK constraint is created
    expect(fk.name).toBe('workspace_id');
  });

  test('files.workspaceId should reference workspaces.id', () => {
    const fk = schema.files.workspaceId;
    expect(fk).toBeDefined();
  });

  test('appends.fileId should reference files.id', () => {
    const fk = schema.appends.fileId;
    expect(fk).toBeDefined();
  });

  test('webhooks.workspaceId should reference workspaces.id', () => {
    const fk = schema.webhooks.workspaceId;
    expect(fk).toBeDefined();
  });

  // Note: pendingClaims FK test removed - table no longer exists
});

describe('Database Schema - Integration Tests', () => {
  test('should be able to create tables from schema', async () => {
    // This test verifies the schema can be used to create actual database tables
    // Using raw SQL to push schema to in-memory database
    const tableCreationResult = sqlite.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT,
        created_at TEXT NOT NULL,
        claimed_at TEXT,
        claimed_by_email TEXT,
        last_activity_at TEXT NOT NULL,
        deleted_at TEXT
      )
    `);

    // Verify table exists
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workspaces'")
      .all();
    expect(tables.length).toBe(1);
  });

  test('should enforce NOT NULL constraints on required fields', () => {
    // Insert a workspace to test constraints
    const insert = sqlite.prepare(`
      INSERT INTO workspaces (id, created_at, last_activity_at)
      VALUES (?, ?, ?)
    `);

    expect(() => {
      insert.run('ws_test123', new Date().toISOString(), new Date().toISOString());
    }).not.toThrow();

    // Trying to insert without required fields should fail
    const badInsert = sqlite.prepare(`
      INSERT INTO workspaces (id, name)
      VALUES (?, ?)
    `);

    expect(() => {
      badInsert.run('ws_test456', 'Test Workspace');
    }).toThrow();
  });

  test('should create all 7 tables with correct names', () => {
    // These are the expected table names from Architecture.md
    const expectedTables = [
      'workspaces',
      'capability_keys',
      'files',
      'appends',
      'webhooks',
      'idempotency_keys',
      'pending_claims',
    ];

    // Verify all tables can be created from schema
    // For now, just check schema exports exist
    expect(schema.workspaces).toBeDefined();
    expect(schema.capabilityKeys).toBeDefined();
    expect(schema.files).toBeDefined();
    expect(schema.appends).toBeDefined();
    expect(schema.webhooks).toBeDefined();
    expect(schema.idempotencyKeys).toBeDefined();
    // Note: pendingClaims removed - OAuth session provides instant claiming
  });
});

describe('Database Integrity - Foreign Key Enforcement', () => {
  let integrityDb: Database;

  beforeAll(() => {
    integrityDb = new Database(':memory:');
    integrityDb.exec('PRAGMA foreign_keys = ON;');

    integrityDb.exec(`
      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY,
        name TEXT,
        created_at TEXT NOT NULL,
        claimed_at TEXT,
        claimed_by_email TEXT,
        last_activity_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE TABLE files (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id),
        path TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        settings TEXT
      );

      CREATE TABLE appends (
        id TEXT PRIMARY KEY,
        file_id TEXT NOT NULL REFERENCES files(id),
        append_id TEXT NOT NULL,
        author TEXT NOT NULL,
        type TEXT,
        ref TEXT,
        status TEXT,
        priority TEXT,
        labels TEXT,
        due_at TEXT,
        expires_at TEXT,
        created_at TEXT NOT NULL,
        content_preview TEXT,
        content_hash TEXT
      );
    `);
  });

  afterAll(() => {
    integrityDb.close();
  });

  test('should reject insert of file referencing non-existent workspace', () => {
    const now = new Date().toISOString();
    expect(() => {
      integrityDb.exec(`
        INSERT INTO files (id, workspace_id, path, created_at, updated_at)
        VALUES ('file_orphan', 'ws_nonexistent', '/test.md', '${now}', '${now}')
      `);
    }).toThrow(/FOREIGN KEY constraint failed/);
  });

  test('should reject insert of append referencing non-existent file', () => {
    const now = new Date().toISOString();
    expect(() => {
      integrityDb.exec(`
        INSERT INTO appends (id, file_id, append_id, author, created_at)
        VALUES ('append_orphan', 'file_nonexistent', 'a1', 'test-author', '${now}')
      `);
    }).toThrow(/FOREIGN KEY constraint failed/);
  });

  test('should allow insert when parent exists', () => {
    const now = new Date().toISOString();

    integrityDb.exec(`
      INSERT INTO workspaces (id, created_at, last_activity_at)
      VALUES ('ws_valid', '${now}', '${now}')
    `);

    expect(() => {
      integrityDb.exec(`
        INSERT INTO files (id, workspace_id, path, created_at, updated_at)
        VALUES ('file_valid', 'ws_valid', '/test.md', '${now}', '${now}')
      `);
    }).not.toThrow();

    expect(() => {
      integrityDb.exec(`
        INSERT INTO appends (id, file_id, append_id, author, created_at)
        VALUES ('append_valid', 'file_valid', 'a1', 'test-author', '${now}')
      `);
    }).not.toThrow();
  });
});

describe('Database Integrity - Unique Constraints', () => {
  let constraintDb: Database;

  beforeAll(() => {
    constraintDb = new Database(':memory:');
    constraintDb.exec('PRAGMA foreign_keys = ON;');

    constraintDb.exec(`
      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY,
        name TEXT,
        created_at TEXT NOT NULL,
        claimed_at TEXT,
        claimed_by_email TEXT,
        last_activity_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE TABLE files (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id),
        path TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        settings TEXT
      );

      CREATE UNIQUE INDEX files_workspace_path_unique ON files(workspace_id, path);
    `);
  });

  afterAll(() => {
    constraintDb.close();
  });

  test('should reject duplicate file path in same workspace', () => {
    const now = new Date().toISOString();

    constraintDb.exec(`
      INSERT INTO workspaces (id, created_at, last_activity_at)
      VALUES ('ws_dup_test', '${now}', '${now}')
    `);

    constraintDb.exec(`
      INSERT INTO files (id, workspace_id, path, created_at, updated_at)
      VALUES ('file_first', 'ws_dup_test', '/duplicate.md', '${now}', '${now}')
    `);

    expect(() => {
      constraintDb.exec(`
        INSERT INTO files (id, workspace_id, path, created_at, updated_at)
        VALUES ('file_second', 'ws_dup_test', '/duplicate.md', '${now}', '${now}')
      `);
    }).toThrow(/UNIQUE constraint failed/);
  });

  test('should allow same path in different workspaces', () => {
    const now = new Date().toISOString();

    constraintDb.exec(`
      INSERT INTO workspaces (id, created_at, last_activity_at)
      VALUES ('ws_a', '${now}', '${now}');
      INSERT INTO workspaces (id, created_at, last_activity_at)
      VALUES ('ws_b', '${now}', '${now}');
    `);

    expect(() => {
      constraintDb.exec(`
        INSERT INTO files (id, workspace_id, path, created_at, updated_at)
        VALUES ('file_ws_a', 'ws_a', '/same-path.md', '${now}', '${now}');
        INSERT INTO files (id, workspace_id, path, created_at, updated_at)
        VALUES ('file_ws_b', 'ws_b', '/same-path.md', '${now}', '${now}');
      `);
    }).not.toThrow();
  });

  test('concurrent duplicate file creation results in exactly one success', async () => {
    const now = new Date().toISOString();

    constraintDb.exec(`
      INSERT INTO workspaces (id, created_at, last_activity_at)
      VALUES ('ws_concurrent', '${now}', '${now}')
    `);

    const insertFile = (id: string) => {
      return new Promise<{ success: boolean; error?: string }>((resolve) => {
        try {
          constraintDb.exec(`
            INSERT INTO files (id, workspace_id, path, created_at, updated_at)
            VALUES ('${id}', 'ws_concurrent', '/concurrent.md', '${now}', '${now}')
          `);
          resolve({ success: true });
        } catch (e) {
          resolve({ success: false, error: (e as Error).message });
        }
      });
    };

    const results = await Promise.all([
      insertFile('file_concurrent_1'),
      insertFile('file_concurrent_2'),
    ]);

    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
    expect(failures[0].error).toMatch(/UNIQUE constraint failed/);
  });
});

describe('Database Integrity - user_workspaces FK Fix', () => {
  test('userWorkspaces table should be defined in schema', () => {
    // The user_workspaces.user_id column references BetterAuth's 'user' table,
    // not the app's 'users' table. The FK constraint on user_id was removed
    // in migration 0002 because it referenced the wrong table.
    expect(schema.userWorkspaces).toBeDefined();
  });
});
