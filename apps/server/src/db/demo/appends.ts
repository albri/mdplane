import type { DemoAppendSeed } from './types';

export function buildDemoAppends(baseMs: number = Date.now()): DemoAppendSeed[] {
  // All appends are on the main workflow file for a focused demo experience.
  // The story: multiple PRs at different lifecycle stages.
  const file = '/workflows/01-pr-reviews.md';

  return [
    // --- PR #482: Completed (task → claim → response) ---
    {
      filePath: file,
      appendId: 'a1',
      author: 'builder_agent',
      type: 'task',
      status: 'pending',
      priority: 'high',
      contentPreview: 'Review PR #482 — adds rate limiting to /api/auth endpoints',
      createdAt: new Date(baseMs - 7_200_000).toISOString(), // 2 hours ago
    },
    {
      filePath: file,
      appendId: 'a2',
      author: 'reviewer_agent',
      type: 'claim',
      ref: 'a1',
      status: 'active',
      priority: 'high',
      expiresAt: new Date(baseMs - 6_800_000).toISOString(),
      contentPreview: 'Claiming for review',
      createdAt: new Date(baseMs - 7_000_000).toISOString(),
    },
    {
      filePath: file,
      appendId: 'a3',
      author: 'reviewer_agent',
      type: 'response',
      ref: 'a1',
      status: 'completed',
      priority: 'high',
      contentPreview: 'Approved with two suggestions: add retry-after header, increase test coverage for edge cases.',
      createdAt: new Date(baseMs - 6_600_000).toISOString(),
    },

    // --- PR #477: Completed quickly (task → claim → response) ---
    {
      filePath: file,
      appendId: 'a4',
      author: 'builder_agent',
      type: 'task',
      status: 'pending',
      priority: 'low',
      contentPreview: 'Review PR #477 — typo fixes in README',
      createdAt: new Date(baseMs - 5_400_000).toISOString(), // 1.5 hours ago
    },
    {
      filePath: file,
      appendId: 'a5',
      author: 'reviewer_agent',
      type: 'claim',
      ref: 'a4',
      status: 'active',
      priority: 'low',
      expiresAt: new Date(baseMs - 5_200_000).toISOString(),
      contentPreview: 'Quick review',
      createdAt: new Date(baseMs - 5_300_000).toISOString(),
    },
    {
      filePath: file,
      appendId: 'a6',
      author: 'reviewer_agent',
      type: 'response',
      ref: 'a4',
      status: 'completed',
      priority: 'low',
      contentPreview: 'Looks good. Approved.',
      createdAt: new Date(baseMs - 5_100_000).toISOString(),
    },

    // --- PR #489: In progress (task → claim, no response yet) ---
    {
      filePath: file,
      appendId: 'a7',
      author: 'builder_agent',
      type: 'task',
      status: 'pending',
      priority: 'critical',
      contentPreview: 'Review PR #489 — security patch for token validation',
      createdAt: new Date(baseMs - 3_600_000).toISOString(), // 1 hour ago
    },
    {
      filePath: file,
      appendId: 'a8',
      author: 'reviewer_agent',
      type: 'claim',
      ref: 'a7',
      status: 'active',
      priority: 'critical',
      expiresAt: new Date(baseMs + 1_800_000).toISOString(), // expires in 30 min
      contentPreview: 'Reviewing security changes carefully',
      createdAt: new Date(baseMs - 3_000_000).toISOString(),
    },

    // --- PR #493: Pending (task only, no claim) ---
    {
      filePath: file,
      appendId: 'a9',
      author: 'builder_agent',
      type: 'task',
      status: 'pending',
      priority: 'medium',
      contentPreview: 'Review PR #493 — refactor database connection pooling',
      createdAt: new Date(baseMs - 1_800_000).toISOString(), // 30 min ago
    },

    // --- PR #471: Blocked → answered → completed ---
    {
      filePath: file,
      appendId: 'a10',
      author: 'builder_agent',
      type: 'task',
      status: 'pending',
      priority: 'high',
      contentPreview: 'Review PR #471 — deprecate legacy auth flow',
      createdAt: new Date(baseMs - 4_500_000).toISOString(),
    },
    {
      filePath: file,
      appendId: 'a11',
      author: 'reviewer_agent',
      type: 'claim',
      ref: 'a10',
      status: 'active',
      priority: 'high',
      expiresAt: new Date(baseMs - 3_900_000).toISOString(),
      contentPreview: 'Claiming deprecation review',
      createdAt: new Date(baseMs - 4_200_000).toISOString(),
    },
    {
      filePath: file,
      appendId: 'a12',
      author: 'reviewer_agent',
      type: 'renew',
      ref: 'a11',
      status: 'active',
      priority: 'high',
      contentPreview: 'Need more time — checking downstream impact',
      createdAt: new Date(baseMs - 3_800_000).toISOString(),
    },
    {
      filePath: file,
      appendId: 'a13',
      author: 'reviewer_agent',
      type: 'blocked',
      ref: 'a10',
      status: 'open',
      priority: 'high',
      contentPreview: 'Need product decision: should we keep fallback for one release cycle or remove immediately?',
      createdAt: new Date(baseMs - 3_600_000).toISOString(),
    },
    {
      filePath: file,
      appendId: 'a14',
      author: 'product_owner',
      type: 'answer',
      ref: 'a13',
      status: 'completed',
      priority: 'high',
      contentPreview: 'Keep the fallback for one release. Add deprecation warning to docs.',
      createdAt: new Date(baseMs - 2_700_000).toISOString(),
    },
    {
      filePath: file,
      appendId: 'a15',
      author: 'reviewer_agent',
      type: 'response',
      ref: 'a10',
      status: 'completed',
      priority: 'high',
      contentPreview: 'Approved with requested changes: added deprecation notice, fallback retained for v2.x.',
      createdAt: new Date(baseMs - 2_400_000).toISOString(),
    },
  ];
}
