/**
 * Test: No test fixtures in runtime routes
 *
 * This test verifies that runtime route files do not contain test fixture patterns.
 * If test fixtures are found, the test fails with detailed information.
 *
 * This prevents regression where test fixtures creep back into production code.
 */

import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';

// Patterns that indicate test fixtures in runtime code
const TEST_FIXTURE_PATTERNS = [
  {
    name: 'TEST_*_KEY constants',
    regex: /\bTEST_[A-Z_]+_KEY\s*=/,
  },
  {
    name: 'TEST_WORKSPACE_ID',
    regex: /\bTEST_WORKSPACE_ID\s*=/,
  },
  {
    name: 'setupTestFixtures()',
    regex: /setupTestFixtures\s*\(/,
  },
  {
    name: 'reset*TestData()',
    regex: /reset\w*TestData\s*\(/,
  },
];

interface FixtureMatch {
  file: string;
  line: number;
  pattern: string;
  match: string;
  context: string;
}

/**
 * Check a single file for test fixture patterns
 */
function checkFileForFixtures(filePath: string): FixtureMatch[] {
  const matches: FixtureMatch[] = [];
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  for (const pattern of TEST_FIXTURE_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(pattern.regex);

      if (match) {
        matches.push({
          file: filePath,
          line: i + 1,
          pattern: pattern.name,
          match: match[0],
          context: line.trim(),
        });
      }
    }
  }

  return matches;
}

/**
 * Check all route files for test fixture patterns
 */
const ROUTES_TO_ENFORCE = [
  'appends.ts',
  'folders.ts',
  'heartbeat.ts',
  'orchestration.ts',
  'websocket.ts',
] as const;

function checkEnforcedRouteFiles(routesDir: string): FixtureMatch[] {
  const allMatches: FixtureMatch[] = [];

  for (const file of ROUTES_TO_ENFORCE) {
    const filePath = join(routesDir, file);
    const matches = checkFileForFixtures(filePath);
    if (matches.length > 0) {
      allMatches.push(...matches);
    }
  }

  return allMatches;
}

describe('Runtime routes should not contain test fixtures', () => {
  test('no TEST_* patterns in runtime routes', () => {
    const routesDir = resolve(import.meta.dir, '../src/routes');
    const matches = checkEnforcedRouteFiles(routesDir);

    if (matches.length > 0) {
      // Build a helpful error message
      const errorDetails = matches
        .map(m => `  ${m.file}:${m.line} - ${m.pattern}\n    ${m.context}`)
        .join('\n');

      throw new Error(
        `Found ${matches.length} test fixture pattern(s) in runtime routes:\n${errorDetails}\n\n` +
        `These routes must remain clean: ${ROUTES_TO_ENFORCE.join(', ')}\n` +
        'Move test fixture code to apps/server/tests/ or apps/server/tests/helpers (never runtime routes).'
      );
    }

    expect(matches.length).toBe(0);
  });
});

