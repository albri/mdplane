#!/usr/bin/env bun
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../src/db/schema';
import { runMigrations } from '../src/db/migrate';
import { generateKey, hashKey, generateScopedKey } from '../src/core/capability-keys';

const dbPath = process.env.DATABASE_URL;
if (!dbPath || dbPath === ':memory:') {
  console.error('Error: DATABASE_URL must be set to a file path (not :memory:)');
  process.exit(1);
}

const TEST_WORKSPACE_ID = 'ws_e2eTestWorkspace';

const CONTRACT_FILES = [
  {
    path: '/README.md',
    content: `# E2E Test Workspace

This workspace is used for E2E testing. It contains both contract files
(required by tests) and showcase files (for testing rich content rendering).

## Structure

- **docs/** - Documentation files
- **examples/** - Example files with frontmatter
- **src/** - Source code files
- **tasks/** - Task tracking with appends
- **agents/** - Agent activity logs
`,
  },
  {
    path: '/docs/getting-started.md',
    content: `# Getting Started

Welcome to the documentation.

## Quick Start

1. Create a workspace
2. Add some files
3. Share with capability URLs

## Next Steps

- Read the [API Reference](/docs/api-reference.md)
- Check out [examples](/examples/backlog.md)
`,
  },
  {
    path: '/docs/api-reference.md',
    content: `# API Reference

API documentation goes here.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /r/:key/:path | Read file |
| PUT | /w/:key/:path | Write file |
| POST | /a/:key/:path | Append to file |

## Authentication

All endpoints use capability URLs - the URL itself is the credential.
`,
  },
  {
    path: '/examples/backlog.md',
    content: `---
title: Backlog
---

# Task Backlog

## Tasks

- [ ] Task 1
- [ ] Task 2
- [x] Task 3 (completed)

## Notes

This file has frontmatter for testing parsed format.
`,
  },
  {
    path: '/src/index.ts',
    content: `// Main entry point
export function main() {
  console.log("Hello world");
}

export const VERSION = '1.0.0';
`,
  },
];

const SHOWCASE_FILES = [
  // Mermaid diagram test
  {
    path: '/docs/mermaid-test.md',
    content: `# Mermaid Diagrams

## Flow Chart

\`\`\`mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Do Something]
    B -->|No| D[Do Something Else]
    C --> E[End]
    D --> E
\`\`\`

## Sequence Diagram

\`\`\`mermaid
sequenceDiagram
    participant User
    participant Agent
    participant API
    User->>Agent: Request
    Agent->>API: Process
    API-->>Agent: Response
    Agent-->>User: Result
\`\`\`
`,
  },
  // XSS test (security)
  {
    path: '/docs/xss-test.md',
    content: '# XSS Test\n\n<script>alert(1)</script>\n\nThis should NOT execute JavaScript.',
  },
  // Task backlog with appends (for testing append rendering)
  {
    path: '/tasks/backlog.md',
    content: `---
title: Sprint 24 Backlog
sprint: 24
---

# Sprint 24 Backlog

## Goals

- Improve support agent response time to < 3 min
- Launch data pipeline v2
- Reduce escalation rate by 15%

## Notes

Tasks are managed via appends. Agents claim work by posting with \`X-Claim: true\`.

---
`,
  },
  // Agent activity log (for testing append rendering)
  {
    path: '/agents/activity.md',
    content: `# Activity Log

Append-only log of agent actions. Each entry is an append with metadata.

---
`,
  },
  // Agent status with tables
  {
    path: '/agents/status.md',
    content: `# Agent Status

Last updated: 2024-02-04 14:32 UTC

## Active Agents

| Agent | Status | Current Task | Last Seen |
|-------|--------|--------------|-----------|
| @agent-support | 🟢 Active | Ticket #4521 | 2 min ago |
| @agent-data | 🟢 Active | ETL batch 847 | 1 min ago |
| @agent-monitor | 🟢 Active | Health checks | 30 sec ago |

## Metrics (Last Hour)

- **Tickets resolved**: 47
- **Avg response time**: 2.3 min
- **Escalation rate**: 8%
`,
  },
];

// Combine all files
const ALL_FILES = [...CONTRACT_FILES, ...SHOWCASE_FILES];

type AppendData = {
  filePath: string;
  appendId: string;
  author: string;
  type: string;
  status?: 'pending' | 'claimed' | 'completed' | 'rejected' | 'cancelled' | 'expired' | 'escalated';
  priority?: 'critical' | 'high' | 'medium' | 'low';
  contentPreview: string;
  createdAt: string;
};

const now = Date.now();
const APPENDS: AppendData[] = [
  // Sprint backlog tasks
  {
    filePath: '/tasks/backlog.md',
    appendId: 'a1',
    author: 'sarah',
    type: 'task',
    status: 'pending',
    priority: 'high',
    contentPreview: 'Reduce support agent response time to < 3 min average',
    createdAt: new Date(now - 86400000).toISOString(),
  },
  {
    filePath: '/tasks/backlog.md',
    appendId: 'a2',
    author: 'marcus',
    type: 'task',
    status: 'claimed',
    priority: 'high',
    contentPreview: 'Deploy data pipeline v2 to production',
    createdAt: new Date(now - 7200000).toISOString(),
  },
  {
    filePath: '/tasks/backlog.md',
    appendId: 'a3',
    author: 'agent-support',
    type: 'task',
    status: 'completed',
    priority: 'medium',
    contentPreview: 'Resolve ticket #4518 - Password reset not working',
    createdAt: new Date(now - 3600000).toISOString(),
  },
  // Agent activity log
  {
    filePath: '/agents/activity.md',
    appendId: 'a1',
    author: 'agent-support',
    type: 'comment',
    status: 'completed',
    contentPreview: 'Resolved ticket #4517 - Billing inquiry',
    createdAt: new Date(now - 900000).toISOString(),
  },
  {
    filePath: '/agents/activity.md',
    appendId: 'a2',
    author: 'agent-data',
    type: 'comment',
    status: 'completed',
    contentPreview: 'ETL batch 846 completed - 12,847 records processed',
    createdAt: new Date(now - 600000).toISOString(),
  },
];

async function seed() {
  const sqlite = runMigrations(dbPath);
  const db = drizzle(sqlite, { schema });
  const nowIso = new Date().toISOString();

  // Clear existing test data
  sqlite.exec(`DELETE FROM rate_limits`);
  sqlite.exec(`DELETE FROM audit_logs WHERE workspace_id = '${TEST_WORKSPACE_ID}'`);
  sqlite.exec(`DELETE FROM api_keys WHERE workspace_id = '${TEST_WORKSPACE_ID}'`);
  sqlite.exec(`DELETE FROM user_workspaces WHERE workspace_id = '${TEST_WORKSPACE_ID}'`);
  sqlite.exec(`DELETE FROM webhooks WHERE workspace_id = '${TEST_WORKSPACE_ID}'`);
  sqlite.exec(`DELETE FROM folders WHERE workspace_id = '${TEST_WORKSPACE_ID}'`);
  sqlite.exec(
    `DELETE FROM appends WHERE file_id IN (SELECT id FROM files WHERE workspace_id = '${TEST_WORKSPACE_ID}')`
  );
  sqlite.exec(`DELETE FROM files WHERE workspace_id = '${TEST_WORKSPACE_ID}'`);
  sqlite.exec(`DELETE FROM capability_keys WHERE workspace_id = '${TEST_WORKSPACE_ID}'`);
  sqlite.exec(`DELETE FROM workspaces WHERE id = '${TEST_WORKSPACE_ID}'`);

  // Create workspace
  await db.insert(schema.workspaces).values({
    id: TEST_WORKSPACE_ID,
    name: 'E2E Test Workspace',
    createdAt: nowIso,
    lastActivityAt: nowIso,
  });

  // Generate capability keys
  const readKey = generateScopedKey('read');
  const appendKey = generateScopedKey('append');
  const writeKey = generateScopedKey('write');

  for (const keyData of [
    { key: readKey, permission: 'read' as const },
    { key: appendKey, permission: 'append' as const },
    { key: writeKey, permission: 'write' as const },
  ]) {
    await db.insert(schema.capabilityKeys).values({
      id: generateKey(16),
      workspaceId: TEST_WORKSPACE_ID,
      prefix: keyData.key.substring(0, 4),
      keyHash: hashKey(keyData.key),
      permission: keyData.permission,
      scopeType: 'workspace',
      scopePath: '/',
      createdAt: nowIso,
    });
  }

  // Create files and track IDs for appends
  const fileIds: Record<string, string> = {};
  for (const file of ALL_FILES) {
    const fileId = generateKey(16);
    fileIds[file.path] = fileId;
    await db.insert(schema.files).values({
      id: fileId,
      workspaceId: TEST_WORKSPACE_ID,
      path: file.path,
      content: file.content,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  // Create appends
  for (const append of APPENDS) {
    const fileId = fileIds[append.filePath];
    if (!fileId) continue;

    await db.insert(schema.appends).values({
      id: generateKey(16),
      fileId,
      appendId: append.appendId,
      author: append.author,
      type: append.type,
      status: append.status ?? null,
      priority: append.priority ?? null,
      contentPreview: append.contentPreview,
      createdAt: append.createdAt,
    });
  }

  sqlite.close();

  // Output result as JSON
  console.log(
    JSON.stringify({
      workspaceId: TEST_WORKSPACE_ID,
      readKey,
      appendKey,
      writeKey,
      files: ALL_FILES.map((f) => ({ path: f.path })),
      appends: APPENDS.length,
    })
  );
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

