import { afterEach, describe, expect, test } from 'bun:test';
import type { Database } from 'bun:sqlite';
import { runMigrations } from '../migrate';

let sqlite: Database | null = null;

function setupDb(): Database {
  sqlite = runMigrations(':memory:');
  const now = new Date().toISOString();
  sqlite.exec(`
    INSERT INTO workspaces (id, name, created_at, last_activity_at, storage_used_bytes)
    VALUES ('ws_scope_guard', 'Scope Guard', '${now}', '${now}', 0)
  `);
  return sqlite;
}

afterEach(() => {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
  }
});

describe('Capability Key Scope Integrity Migration', () => {
  test('rejects insert for file scope without scope_path', () => {
    const db = setupDb();
    const now = new Date().toISOString();

    expect(() => {
      db.exec(`
        INSERT INTO capability_keys (
          id, workspace_id, prefix, key_hash, permission, scope_type, scope_path, created_at
        ) VALUES (
          'ck_bad_file', 'ws_scope_guard', 'a_', 'hash_bad_file', 'append', 'file', NULL, '${now}'
        )
      `);
    }).toThrow(/INVALID_SCOPE_PATH/);
  });

  test('rejects insert for folder scope with empty scope_path', () => {
    const db = setupDb();
    const now = new Date().toISOString();

    expect(() => {
      db.exec(`
        INSERT INTO capability_keys (
          id, workspace_id, prefix, key_hash, permission, scope_type, scope_path, created_at
        ) VALUES (
          'ck_bad_folder', 'ws_scope_guard', 'r_', 'hash_bad_folder', 'read', 'folder', '   ', '${now}'
        )
      `);
    }).toThrow(/INVALID_SCOPE_PATH/);
  });

  test('allows workspace scope without scope_path', () => {
    const db = setupDb();
    const now = new Date().toISOString();

    expect(() => {
      db.exec(`
        INSERT INTO capability_keys (
          id, workspace_id, prefix, key_hash, permission, scope_type, scope_path, created_at
        ) VALUES (
          'ck_workspace_ok', 'ws_scope_guard', 'w_', 'hash_workspace_ok', 'write', 'workspace', NULL, '${now}'
        )
      `);
    }).not.toThrow();
  });

  test('allows file scope with non-empty scope_path', () => {
    const db = setupDb();
    const now = new Date().toISOString();

    expect(() => {
      db.exec(`
        INSERT INTO capability_keys (
          id, workspace_id, prefix, key_hash, permission, scope_type, scope_path, created_at
        ) VALUES (
          'ck_file_ok', 'ws_scope_guard', 'a_', 'hash_file_ok', 'append', 'file', '/tasks/today.md', '${now}'
        )
      `);
    }).not.toThrow();
  });
});

