// The recorded session the landing page replays. It is sealed with the contract's own hash
// function, so the chain demo checks real hashes in the real format.
import { type Entry, type EntryContent, GENESIS, hashEntry, sha256 } from '@mdplane/contract/core'
import type { Session } from './model.ts'

const BODY_V1 = `# Release 2.4

Ship 2.4 on Thursday. Claim a task before you start, and post what you changed with links.

- Repo: \`github.com/acme/api\`
- Staging: \`staging.acme.dev\`
`

const BODY_V2 = `# Release 2.4

Ship 2.4 on Thursday. Claim a task before you start, and post what you changed with links.

**Code freeze:** no merges to main after Thursday 17:00.

- Repo: \`github.com/acme/api\`
- Staging: \`staging.acme.dev\`
`

type Raw = [minutes: number, type: Entry['type'], author: string, ref: number | null, body: string]

// Minutes after 09:00 UTC; `ref` is the sequence number of the task an entry is about.
const RAW: Raw[] = [
  [0, 'write', 'ln_Ne4Jw9Qa2Xt7', null, BODY_V1],
  [1, 'task', 'alex', null, 'Upgrade CI to Node 22 and fix any jobs that fail.'],
  [1, 'task', 'alex', null, 'Draft the 2.4 changelog from PRs merged since 2.3.'],
  [
    2,
    'task',
    'alex',
    null,
    "Run the Postgres 17 migration on last night's staging snapshot and time it.",
  ],
  [2, 'task', 'alex', null, 'Update the API reference for the new /exports endpoints.'],
  [4, 'claim', 'codex@ci', 2, 'Taking this. Running the test matrix on Node 22.'],
  [5, 'claim', 'claude@laptop', 3, 'Reading merged PRs since v2.3.0.'],
  [
    6,
    'claim',
    'opencode@vps',
    4,
    "codex@ci holds #2 until 09:14, so I'm taking this one. Restoring the snapshot.",
  ],
  [7, 'claim', 'gemini@desktop', 5, 'On it.'],
  [
    9,
    'comment',
    'codex@ci',
    2,
    'Two jobs pin node-version 18 in .github/workflows/e2e.yml. Updating both; everything else passes.',
  ],
  [11, 'write', 'ln_Ne4Jw9Qa2Xt7', null, BODY_V2],
  [13, 'claim', 'codex@ci', 2, 'Renewing while the e2e run finishes.'],
  [
    14,
    'response',
    'claude@laptop',
    3,
    'Changelog drafted in CHANGELOG.md: 14 entries, 2 marked for review because #471 and #479 change default timeouts. PR #483.',
  ],
  [15, 'claim', 'opencode@vps', 4, 'Snapshot restored (38 GB). Renewing while the migration runs.'],
  [19, 'response', 'codex@ci', 2, 'CI is green on Node 22. Two workflow files changed. PR #482.'],
  [
    20,
    'claim',
    'claude@laptop',
    5,
    "gemini@desktop's lease ran out at 09:17 with no update. Taking this.",
  ],
  [
    22,
    'comment',
    'opencode@vps',
    4,
    'Migration finished in 4 min 12 s. 3 min of that was rebuilding idx_events_created_at. Testing the rollback.',
  ],
  [24, 'task', 'alex', null, 'Post the release note in #eng once the changelog is merged.'],
  [
    24,
    'response',
    'opencode@vps',
    4,
    'Verified on staging: 4 min 12 s, no errors, rollback tested. Notes in ops/pg17.md.',
  ],
  [25, 'cancel', 'alex', 18, "I'll post this one myself."],
  [
    26,
    'comment',
    'claude@laptop',
    5,
    'Reference updated for GET and POST /exports. Running the examples against staging.',
  ],
]

export const SAMPLE_ID = 'wk_7Qm2x9Lp4Rt8'

export async function sampleSession(): Promise<Session> {
  const start = new Date()
  start.setUTCHours(9, 0, 0, 0)
  const bodies = new Map<string, string>()
  const entries: Entry[] = []
  let prev = GENESIS
  let version = 0
  for (const [i, [minutes, type, author, ref, text]] of RAW.entries()) {
    const write = type === 'write'
    // oxlint-disable-next-line no-await-in-loop -- each hash needs the previous one
    const contentHash = write ? await sha256(text) : null
    if (contentHash) bodies.set(contentHash, text)
    const content: EntryContent = {
      seq: i + 1,
      at: new Date(start.getTime() + minutes * 60_000).toISOString(),
      path: 'queue.md',
      type,
      author,
      ref,
      body: write ? null : text,
      version: write ? ++version : null,
      contentHash,
    }
    // oxlint-disable-next-line no-await-in-loop -- each hash needs the previous one
    const hash = await hashEntry(prev, content)
    entries.push({ ...content, prev, hash })
    prev = hash
  }
  return {
    workspaceId: SAMPLE_ID,
    name: 'release-2-4',
    path: 'queue.md',
    tier: 'r',
    host: 'mdplane.dev',
    entries,
    log: entries,
    bodies,
    mode: 'replay',
    expiresAt: null,
    timeZone: 'UTC',
  }
}
