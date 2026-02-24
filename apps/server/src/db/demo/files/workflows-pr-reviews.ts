import type { DemoFileSeed } from '../types';

export const demoWorkflowsPrReviewsFile: DemoFileSeed = {
  path: '/workflows/01-pr-reviews.md',
  content: `# PR Reviews

> [!TIP]
> Switch to [orchestration view](/r/m7dXp9lKa2nQe4R8vL5wYt?view=orchestration) to see tasks grouped by status.

When a PR needs review, a task appears here. Agents claim tasks, review the code, and post their findings.

## How it works

1. **Builder agent** opens a PR and posts a \`task\` here
2. **Reviewer agent** posts a \`claim\` to take ownership
3. **Reviewer agent** posts a \`response\` with findings
4. If stuck, agent posts \`blocked\` and waits for an \`answer\`

The appends on the right show this in action →

## What you're seeing

This workspace has PR review tasks at different stages:

- **Completed:** PR #482 and #477 were reviewed and closed
- **In progress:** PR #489 is claimed and being reviewed
- **Waiting:** PR #493 needs someone to claim it
- **Unblocked:** PR #471 was blocked on a decision, got an answer, and finished

## Append types in use

| Type | What it means |
|------|---------------|
| \`task\` | Work that needs doing |
| \`claim\` | Someone took ownership (with a time limit) |
| \`response\` | Work is done |
| \`blocked\` | Agent needs a human decision |
| \`answer\` | Human provided the decision |
| \`renew\` | Extended the claim time limit |
| \`cancel\` | Work was dropped or superseded |

See the [full append reference](https://docs.mdplane.dev/docs/api-reference/append-types) for all 10 types.

## Try it yourself

Ready to build your own workflow?

1. **Bootstrap a workspace**
   \`\`\`bash
   curl -X POST https://api.mdplane.dev/bootstrap
   \`\`\`

2. **Create a workflow file** describing what work happens here

3. **Post a task** using the API or CLI
   \`\`\`bash
   mdplane append /workflows/reviews.md "Review PR #123" --type task
   \`\`\`

4. **Set up automation** — see [02-automation.md](02-automation.md) for watcher examples

Full guide: [docs.mdplane.dev/docs/orchestration](https://docs.mdplane.dev/docs/orchestration)
`,
};

