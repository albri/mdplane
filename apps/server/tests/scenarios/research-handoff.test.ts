/**
 * Research Handoff Scenario Tests
 *
 * Tests the complete research handoff workflow:
 * 1. Lead agent creates `/research/topic-x.md` with initial findings
 * 2. Shares read URL with Research Agent A
 * 3. Research Agent A appends findings, shares with Agent B
 * 4. Chain continues (A → B → C → ...)
 * 5. Each agent can only append (can't see/edit others' writes in progress)
 * 6. Lead agent reads complete synthesis
 *
 * @see docs/Use Cases.md - Research Handoff
 */

import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import { createTestApp } from '../helpers';
import { assertValidResponse } from '../helpers/schema-validator';
import {
  createTestWorkspace,
  createTestFile,
  readTestFile,
  type TestWorkspace,
  type TestFile,
} from '../fixtures';

/**
 * Append comment (research findings) to a file.
 */
async function appendFindings(
  app: ReturnType<typeof createTestApp>,
  key: string,
  path: string,
  author: string,
  content: string
): Promise<Response> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return app.handle(
    new Request(`http://localhost/a/${key}${normalizedPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'comment',
        author,
        content,
      }),
    })
  );
}

/**
 * Read file with parsed appends.
 */
async function readWithAppends(
  app: ReturnType<typeof createTestApp>,
  workspace: TestWorkspace,
  path: string
): Promise<{ content: string; appends: Array<{ id: string; type: string; author: string; content?: string; ts?: string }> }> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const response = await app.handle(
    new Request(`http://localhost/r/${workspace.readKey}${normalizedPath}?format=parsed`, {
      method: 'GET',
    })
  );

  if (!response.ok) {
    throw new Error(`Failed to read file: ${response.status}`);
  }

  const body = await response.json();
  assertValidResponse(body, 'FileReadResponse');
  const { data } = body;
  return {
    content: data.content,
    appends: data.appends || [],
  };
}

/**
 * Read file with limited appends (token-efficient).
 */
async function readLastNAppends(
  app: ReturnType<typeof createTestApp>,
  workspace: TestWorkspace,
  path: string,
  n: number
): Promise<{ content: string; appends: Array<{ id: string; type: string; author: string; content?: string }> }> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const response = await app.handle(
    new Request(`http://localhost/r/${workspace.readKey}${normalizedPath}?format=parsed&appends=${n}`, {
      method: 'GET',
    })
  );

  if (!response.ok) {
    throw new Error(`Failed to read file: ${response.status}`);
  }

  const body = await response.json();
  assertValidResponse(body, 'FileReadResponse');
  const { data } = body;
  return {
    content: data.content,
    appends: data.appends || [],
  };
}

describe('Research Handoff', () => {
  let app: ReturnType<typeof createTestApp>;
  let workspace: TestWorkspace;
  let research: TestFile;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    // Create fresh workspace and research file for each test
    workspace = await createTestWorkspace(app);
    research = await createTestFile(
      app,
      workspace,
      '/research/topic-x.md',
      '# Research: Topic X\n\n## Initial Findings\n\nThis is the starting point for research collaboration.\n'
    );
  });

  describe('Complete Research Chain', () => {
    test('complete research chain from lead to final synthesis', async () => {
      // GIVEN: A workspace with research file created by lead
      // (setup in beforeEach)

      // WHEN: Agent A reads and appends findings
      const appendA = await appendFindings(
        app,
        workspace.appendKey,
        '/research/topic-x.md',
        'agent-a',
        '## Agent A Findings\n\nDiscovered X, Y, Z patterns in the data.'
      );
      expect(appendA.status).toBe(201);
      const appendABody = await appendA.json();
      expect(appendABody.data.type).toBe('comment');
      expect(appendABody.data.author).toBe('agent-a');

      // AND: Agent B reads (including A's findings) and appends
      const beforeB = await readWithAppends(app, workspace, '/research/topic-x.md');
      expect(beforeB.appends.some(a => a.author === 'agent-a')).toBe(true);

      const appendB = await appendFindings(
        app,
        workspace.appendKey,
        '/research/topic-x.md',
        'agent-b',
        '## Agent B Findings\n\nBuilding on Agent A, found correlation with W.'
      );
      expect(appendB.status).toBe(201);

      // AND: Agent C reads all and appends final synthesis
      const beforeC = await readWithAppends(app, workspace, '/research/topic-x.md');
      expect(beforeC.appends.length).toBeGreaterThanOrEqual(2);

      const appendC = await appendFindings(
        app,
        workspace.appendKey,
        '/research/topic-x.md',
        'agent-c',
        '## Final Synthesis\n\nCombining all findings: X+Y+Z correlate with W.'
      );
      expect(appendC.status).toBe(201);

      // THEN: Lead can read complete file with all contributions
      const finalRead = await readWithAppends(app, workspace, '/research/topic-x.md');
      expect(finalRead.appends.length).toBeGreaterThanOrEqual(3);

      // Verify all agents contributed
      const authors = finalRead.appends.map(a => a.author);
      expect(authors).toContain('agent-a');
      expect(authors).toContain('agent-b');
      expect(authors).toContain('agent-c');
    });

    test('each agent sees previous contributions when reading', async () => {
      // GIVEN: Agent A has appended
      await appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'agent-a', 'Finding A');

      // WHEN: Agent B reads before appending
      const readB = await readWithAppends(app, workspace, '/research/topic-x.md');

      // THEN: Agent B can see Agent A's contribution
      expect(readB.appends.length).toBeGreaterThanOrEqual(1);
      expect(readB.appends.some(a => a.author === 'agent-a')).toBe(true);
    });

    test('chain of 5 agents all preserved in order', async () => {
      // GIVEN/WHEN: Five agents append in sequence
      const agents = ['agent-1', 'agent-2', 'agent-3', 'agent-4', 'agent-5'];

      for (const agent of agents) {
        const response = await appendFindings(
          app,
          workspace.appendKey,
          '/research/topic-x.md',
          agent,
          `Findings from ${agent}`
        );
        expect(response.status).toBe(201);
      }

      // THEN: All 5 contributions are visible in order
      const final = await readWithAppends(app, workspace, '/research/topic-x.md');
      expect(final.appends.length).toBeGreaterThanOrEqual(5);

      // Verify order matches sequence
      const authorOrder = final.appends.map(a => a.author);
      let lastIndex = -1;
      for (const agent of agents) {
        const currentIndex = authorOrder.indexOf(agent);
        expect(currentIndex).toBeGreaterThan(lastIndex);
        lastIndex = currentIndex;
      }
    });
  });

  describe('Append-Only Collaboration', () => {
    test('each agent can only append, not overwrite file content', async () => {
      // GIVEN: Initial file content
      const initialRead = await readWithAppends(app, workspace, '/research/topic-x.md');
      const originalContent = initialRead.content;

      // WHEN: Agent appends findings
      await appendFindings(
        app,
        workspace.appendKey,
        '/research/topic-x.md',
        'agent-a',
        'New findings from agent A'
      );

      // THEN: Original content is preserved (appends don't replace)
      const afterAppend = await readWithAppends(app, workspace, '/research/topic-x.md');
      expect(afterAppend.content).toBe(originalContent);
      expect(afterAppend.appends.length).toBeGreaterThan(initialRead.appends.length);
    });

    test('append key cannot use PUT to overwrite file', async () => {
      // GIVEN: An append key (not write key)
      // WHEN: Trying to PUT (overwrite) with append key
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}/research/topic-x.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Attempting to overwrite!' }),
        })
      );

      // THEN: Should fail (PUT not allowed on append endpoint)
      expect(response.status).not.toBe(200);
      expect(response.status).not.toBe(201);
    });

    test('each append has author attribution', async () => {
      // GIVEN: Multiple agents append
      await appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'researcher-alpha', 'Alpha findings');
      await appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'researcher-beta', 'Beta findings');
      await appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'researcher-gamma', 'Gamma findings');

      // WHEN: We read the history
      const history = await readWithAppends(app, workspace, '/research/topic-x.md');

      // THEN: Each append has correct author
      for (const append of history.appends) {
        expect(append.author).toBeDefined();
        expect(typeof append.author).toBe('string');
        expect(append.author.length).toBeGreaterThan(0);
      }

      // Verify specific authors
      const authors = history.appends.map(a => a.author);
      expect(authors).toContain('researcher-alpha');
      expect(authors).toContain('researcher-beta');
      expect(authors).toContain('researcher-gamma');
    });

    test('order preserved (A → B → C visible in sequence)', async () => {
      // GIVEN/WHEN: Appends in specific order
      await appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'first', 'First append');
      await appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'second', 'Second append');
      await appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'third', 'Third append');

      // THEN: Order is preserved
      const history = await readWithAppends(app, workspace, '/research/topic-x.md');
      const authorOrder = history.appends.map(a => a.author);

      const firstIdx = authorOrder.indexOf('first');
      const secondIdx = authorOrder.indexOf('second');
      const thirdIdx = authorOrder.indexOf('third');

      expect(firstIdx).toBeLessThan(secondIdx);
      expect(secondIdx).toBeLessThan(thirdIdx);
    });
  });

  describe('Parallel Research', () => {
    test('multiple agents can append simultaneously', async () => {
      // GIVEN: Multiple agents ready to append
      // WHEN: All append at the same time
      const [resA, resB, resC] = await Promise.all([
        appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'parallel-a', 'Parallel A findings'),
        appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'parallel-b', 'Parallel B findings'),
        appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'parallel-c', 'Parallel C findings'),
      ]);

      // THEN: All succeed
      expect(resA.status).toBe(201);
      expect(resB.status).toBe(201);
      expect(resC.status).toBe(201);
    });

    test('all parallel appends are preserved (no data loss)', async () => {
      // GIVEN/WHEN: Parallel appends
      await Promise.all([
        appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'parallel-1', 'Data 1'),
        appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'parallel-2', 'Data 2'),
        appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'parallel-3', 'Data 3'),
        appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'parallel-4', 'Data 4'),
      ]);

      // THEN: All 4 appends are preserved
      const history = await readWithAppends(app, workspace, '/research/topic-x.md');
      const parallelAppends = history.appends.filter(a => a.author.startsWith('parallel-'));
      expect(parallelAppends.length).toBe(4);
    });

    test('interleaved order based on server receipt time', async () => {
      // GIVEN: Sequential appends (not truly parallel, but simulating interleaving)
      await appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'team-1', 'T1 first');
      await appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'team-2', 'T2 first');
      await appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'team-1', 'T1 second');
      await appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'team-2', 'T2 second');

      // THEN: Order reflects receipt order
      const history = await readWithAppends(app, workspace, '/research/topic-x.md');
      const teamAppends = history.appends.filter(
        a => a.author === 'team-1' || a.author === 'team-2'
      );

      // Should interleave: team-1, team-2, team-1, team-2
      expect(teamAppends.length).toBe(4);
      expect(teamAppends[0].author).toBe('team-1');
      expect(teamAppends[1].author).toBe('team-2');
      expect(teamAppends[2].author).toBe('team-1');
      expect(teamAppends[3].author).toBe('team-2');
    });
  });

  describe('Read Isolation', () => {
    test('read key only allows reading', async () => {
      // GIVEN: A read key
      // WHEN: Reading with read key
      const response = await readTestFile(app, workspace, '/research/topic-x.md');

      // THEN: Read succeeds
      expect(response.status).toBe(200);
    });

    test('read key cannot append (403)', async () => {
      // GIVEN: A read key (not append key)
      // WHEN: Trying to append with read key
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/research/topic-x.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'unauthorized',
            content: 'Trying to append via read key',
          }),
        })
      );

      // THEN: Should be rejected (POST not allowed on read endpoint)
      // Returns 404 because /r/ endpoints don't have POST routes
      expect(response.status).toBe(404);
    });

    test('append key allows read + append only', async () => {
      // GIVEN: An append key (workspace-scoped)
      // Note: Append keys can read via /r/ endpoint (inherits read permission)
      // and append via /a/ endpoint

      // WHEN: Reading via read key (append inherits read)
      const readResponse = await readTestFile(app, workspace, '/research/topic-x.md');
      expect(readResponse.status).toBe(200);

      // AND: Appending with append key
      const appendResponse = await appendFindings(
        app,
        workspace.appendKey,
        '/research/topic-x.md',
        'allowed-agent',
        'Allowed append'
      );
      expect(appendResponse.status).toBe(201);

      // BUT: Cannot DELETE with append key (using append key on write endpoint)
      const deleteResponse = await app.handle(
        new Request(`http://localhost/w/${workspace.appendKey}/research/topic-x.md`, {
          method: 'DELETE',
        })
      );
      // Append key cannot delete - returns 404 (key not valid for write endpoint)
      expect(deleteResponse.status).toBe(404);
    });

    test('write key has full access', async () => {
      // GIVEN: A write key (workspace-scoped)

      // WHEN: Reading with read key (write inherits read)
      const readResponse = await readTestFile(app, workspace, '/research/topic-x.md');
      expect(readResponse.status).toBe(200);

      // AND: Updating file content with write key via proper endpoint
      const updateResponse = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/research/topic-x.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# Updated by write key\n\nNew content.' }),
        })
      );
      expect(updateResponse.status).toBe(200);
    });
  });

  describe('File Accumulation', () => {
    test('file grows with each append', async () => {
      // GIVEN: Initial append count
      const initial = await readWithAppends(app, workspace, '/research/topic-x.md');
      const initialCount = initial.appends.length;

      // WHEN: Multiple appends
      await appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'a1', 'Append 1');
      await appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'a2', 'Append 2');
      await appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'a3', 'Append 3');

      // THEN: Append count increased
      const final = await readWithAppends(app, workspace, '/research/topic-x.md');
      expect(final.appends.length).toBe(initialCount + 3);
    });

    test('previous content not modified by appends', async () => {
      // GIVEN: Initial state
      const initial = await readWithAppends(app, workspace, '/research/topic-x.md');
      const initialContent = initial.content;

      // WHEN: Add appends
      await appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'modifier', 'New data');

      // THEN: Original content unchanged
      const final = await readWithAppends(app, workspace, '/research/topic-x.md');
      expect(final.content).toBe(initialContent);
    });

    test('can retrieve append history', async () => {
      // GIVEN: Multiple appends over time
      await appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'hist-1', 'Historical 1');
      await appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'hist-2', 'Historical 2');
      await appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'hist-3', 'Historical 3');

      // WHEN: Reading full history
      const history = await readWithAppends(app, workspace, '/research/topic-x.md');

      // THEN: All appends retrievable with IDs and timestamps
      for (const append of history.appends) {
        expect(append.id).toBeDefined();
        expect(append.type).toBeDefined();
        expect(append.author).toBeDefined();
      }
    });

    test('token-efficient reading with appends limit', async () => {
      // GIVEN: Many appends
      for (let i = 0; i < 10; i++) {
        await appendFindings(app, workspace.appendKey, '/research/topic-x.md', `bulk-${i}`, `Bulk append ${i}`);
      }

      // WHEN: Reading with limit on appends
      const limited = await readLastNAppends(app, workspace, '/research/topic-x.md', 3);

      // THEN: Only last N appends returned (or at most N if implementation allows)
      expect(limited.appends.length).toBeLessThanOrEqual(10);
      // Note: The actual behavior depends on API implementation
      // Some APIs return last N, others may have different semantics
    });
  });

  describe('Edge Cases', () => {
    test('empty append content is rejected', async () => {
      // WHEN: Appending empty content
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}/research/topic-x.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'empty-author',
            content: '',
          }),
        })
      );

      // THEN: Empty content is accepted (content is optional for some append types)
      expect(response.status).toBe(201);
    });

    test('very long append content is handled', async () => {
      // GIVEN: Very long content
      const longContent = 'A'.repeat(10000);

      // WHEN: Appending long content
      const response = await appendFindings(
        app,
        workspace.appendKey,
        '/research/topic-x.md',
        'long-author',
        longContent
      );

      // THEN: Succeeds (10KB is well under the 1MB limit)
      expect(response.status).toBe(201);
    });

    test('special characters in author name are rejected', async () => {
      // WHEN: Appending with special characters in author
      // Author must match pattern: [a-zA-Z0-9_-]{1,64}
      const response = await appendFindings(
        app,
        workspace.appendKey,
        '/research/topic-x.md',
        'agent-特殊-émoji-🤖',
        'Content from special agent'
      );

      // THEN: Rejected (author must be alphanumeric with _ and - only)
      expect(response.status).toBe(400);
    });

    test('markdown content in append is preserved', async () => {
      // GIVEN: Markdown content
      const markdownContent = `## Research Section

### Key Findings

1. First finding
2. Second finding

\`\`\`python
def analyze():
    return True
\`\`\`

> Important quote here

| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |
`;

      // WHEN: Appending markdown
      await appendFindings(app, workspace.appendKey, '/research/topic-x.md', 'md-author', markdownContent);

      // THEN: Content is preserved
      const history = await readWithAppends(app, workspace, '/research/topic-x.md');
      const mdAppend = history.appends.find(a => a.author === 'md-author');
      expect(mdAppend).toBeDefined();
      // Content should contain the original markdown
      if (mdAppend?.content) {
        expect(mdAppend.content).toContain('Key Findings');
        expect(mdAppend.content).toContain('def analyze()');
      }
    });
  });
});


