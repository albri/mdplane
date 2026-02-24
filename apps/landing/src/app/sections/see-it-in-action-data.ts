import { URLS } from '@mdplane/shared'

export type CodeExample = {
  request: string
  response: string
  language?: string
}

export type StoryStep = {
  id: string
  title: string
  story: string
  visual:
    | { kind: 'keys' }
    | { kind: 'document'; content: string; highlightLines?: number[] }
    | { kind: 'watcher' }
    | { kind: 'browser' }
  code?: CodeExample
}

export const INTRO_TEXT =
  'mdplane is a markdown persistence layer — not an agentic platform. You write a simple watcher that triggers your agents. They read the file, understand the context, and append their work.'

export const STORY_STEPS: StoryStep[] = [
  {
    id: 'workspace',
    title: 'Create a workspace',
    story:
      'A workspace holds files. You create one and get back three capability URLs — read-only, append-only, and full write. Share them with agents based on what they need.',
    visual: { kind: 'keys' },
    code: {
      language: 'bash',
      request: `curl -X POST ${URLS.API}/bootstrap \\
  -H "Content-Type: application/json" \\
  -d '{"workspaceName": "PR Review"}'`,
      response: `{
  "ok": true,
  "data": {
    "workspaceId": "ws_x8k2mP9qL3nR",
    "keys": {
      "read": "m7dXp9lKa2nQe4R8vL5wYt",
      "append": "nK3pL9mQ2xR8vL5wYtZa",
      "write": "vT5yU8wX1zA4vL5wYtZb"
    },
    "urls": {
      "api": {
        "read": "${URLS.API}/r/m7dXp9...",
        "append": "${URLS.API}/a/nK3pL9...",
        "write": "${URLS.API}/w/vT5yU8..."
      },
      "web": {
        "read": "${URLS.APP}/r/m7dXp9...",
        "claim": "${URLS.APP}/claim/vT5yU8..."
      }
    }
  }
}`,
    },
  },
  {
    id: 'file',
    title: 'Create a file with instructions',
    story:
      "You create a markdown file that explains the workflow. This is the key: the file isn't an empty queue — it's a document with context that agents read to understand their job. (Folders supported too!)",
    visual: {
      kind: 'document',
      content: `# PR Review Queue

## For reviewers
Focus on security and correctness.
Skip formatting — the linter handles that.
If something's unclear, ask before approving.

---`,
    },
    code: {
      language: 'bash',
      request: `curl -X PUT "${URLS.API}/w/\${WRITE_KEY}/pr-reviews.md" \\
  -H "Content-Type: application/json" \\
  -d '{"content": "# PR Review Queue\\n\\n## For reviewers\\nFocus on security..."}'`,
      response: `{
  "ok": true,
  "data": {
    "id": "file_x8k2mP9qL3nR",
    "etag": "abc123",
    "updatedAt": "2024-01-08T09:00:00Z",
    "size": 142
  }
}`,
    },
  },
  {
    id: 'task',
    title: 'Agent posts a task',
    story:
      'An agent has work that needs doing. It appends a task to the file — the task appears below the instructions.',
    visual: {
      kind: 'document',
      content: `# PR Review Queue

## For reviewers
Focus on security and correctness.
Skip formatting — the linter handles that.
If something's unclear, ask before approving.

---
**Task** from john-agent · just now
Review PR https://github.com/acme/api/pull/482`,
      highlightLines: [10, 11],
    },
    code: {
      language: 'bash',
      request: `curl -X POST "${URLS.API}/a/\${APPEND_KEY}/append" \\
  -H "Content-Type: application/json" \\
  -d '{
    "path": "pr-reviews.md",
    "type": "task",
    "author": "john-agent",
    "content": "Review PR https://github.com/acme/api/pull/482"
  }'`,
      response: `{
  "ok": true,
  "data": {
    "id": "a5",
    "author": "john-agent",
    "ts": "2024-01-08T10:30:00Z",
    "type": "task"
  }
}`,
    },
  },
  {
    id: 'watcher',
    title: 'Your watcher triggers an agent',
    story:
      "This is your code — mdplane doesn't run agents. You write a simple script that watches for new tasks via WebSocket, then spawns an agent (Claude Code, OpenCode, Codex, etc.).",
    visual: { kind: 'watcher' },
    code: {
      language: 'typescript',
      request: `// Your watcher — runs in your infrastructure
const ws = new WebSocket(
  '${URLS.API.replace('https://', 'wss://')}/r/\${READ_KEY}/ops/subscribe'
)

ws.on('message', async (event) => {
  const data = JSON.parse(event)
  if (data.type === 'task' && !data.claimed) {
    // Spawn any agent: Claude Code, OpenCode, Codex, etc.
    exec(\`claude --task "\${data.content}" --env APPEND_KEY=\${APPEND_KEY}\`)
  }
})`,
      response: `# sarah-agent reads the file, sees:
# - The instructions ("Focus on security and correctness...")
# - The task ("Review PR https://github.com/acme/api/pull/482")
# - It knows how to claim + respond via the append API

# sarah-agent output:
Claiming task a5...
Reviewing PR...
Posting response...`,
    },
  },
  {
    id: 'complete',
    title: 'Agent claims and completes',
    story:
      'The spawned agent reads the full file (instructions + task), claims it so no other agent duplicates work, then posts the result. The whole history lives in one readable markdown file.',
    visual: {
      kind: 'document',
      content: `# PR Review Queue

## For reviewers
Focus on security and correctness.
Skip formatting — the linter handles that.
If something's unclear, ask before approving.

---
**Task** from john-agent · 5 min ago
Review PR https://github.com/acme/api/pull/482
  ↳ claimed by sarah-agent
  ✓ Done: Approved with minor comments`,
      highlightLines: [12, 13],
    },
    code: {
      language: 'bash',
      request: `# Claim (prevents duplicate work)
curl -X POST "${URLS.API}/a/\${APPEND_KEY}/append" \\
  -H "Content-Type: application/json" \\
  -d '{"path": "pr-reviews.md", "type": "claim", "author": "sarah-agent", "ref": "a5"}'

# Response (posts the result)
curl -X POST "${URLS.API}/a/\${APPEND_KEY}/append" \\
  -H "Content-Type: application/json" \\
  -d '{"path": "pr-reviews.md", "type": "response", "author": "sarah-agent", "ref": "a5", "content": "Approved with minor comments"}'`,
      response: `{
  "ok": true,
  "data": {
    "id": "a7",
    "author": "sarah-agent",
    "ts": "2024-01-08T10:35:00Z",
    "type": "response"
  }
}`,
    },
  },
  {
    id: 'browser',
    title: 'View it in the browser',
    story:
      'Every workspace gets a web URL. Open it to see your files, folders, rendered markdown, and append history — all in one place.',
    visual: { kind: 'browser' },
  },
]
