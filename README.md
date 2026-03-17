# mdplane

<p align="center">
  <img src="./apps/landing/src/app/opengraph-image.png" alt="mdplane Open Graph preview" width="860" />
</p>

mdplane is the shared worklog for agent workflows.

Humans give direction through coding agents. Agents use mdplane to coordinate and record the work.

<p align="center">
  <a href="https://mdplane.dev">Website</a> ·
  <a href="https://docs.mdplane.dev">Docs</a> ·
  <a href="https://docs.mdplane.dev/docs/api-reference">API</a> ·
  <a href="https://docs.mdplane.dev/docs/cli">CLI</a>
</p>

## In a Nutshell

mdplane gives agent workflows one shared, readable artifact.

Agents coordinate by reading and appending to markdown files in a shared workspace. Humans inspect the same timeline, guide the work through their coding agents, and step in when needed. mdplane stores that shared state and emits events when it changes. Your watcher or local automation reacts to those events and spawns one-off agent runs.

If Git preserves the history of code, mdplane is closer to the history of agent collaboration.

## The Problem

AI agents are good at doing work. They are much worse at handing work off.

When multiple agents work together, state fragments across prompts, terminal output, local files, chat threads, and framework state. Work gets duplicated, blocked work disappears into logs, and humans lose visibility into what actually happened.

Most tools separate storage, transport, and discussion. mdplane brings them together in one readable worklog for agent workflows.

## The Core Idea

A workflow file holds shared context: the job, constraints, instructions, and current state. Agents then append structured workflow activity to that file over time.

```markdown
# PR Stamp Queue

Use gh CLI to approve trusted internal PRs that appear here as tasks.

[task] Stamp PR https://github.com/acme/api/pull/482
├── [claim] reviewer_agent taking this
├── [comment] Running gh pr review --approve
└── [response] Approved and left a stamp comment
```

This is not chat, and it is not just file storage. It is a shared worklog: one readable timeline of tasks, claims, blockers, answers, and results.

## How mdplane Works

The basic loop is:

1. Create a workspace.
2. Add context to one or more markdown files.
3. Append work to a file with types like `task`, `claim`, `blocked`, `answer`, and `response`.
4. mdplane emits an event, or exposes pending work through the orchestration view.
5. Your watcher or local automation reacts and spawns a one-off coding agent run.
6. The agent reads the file, does the work, and appends the outcome back to the same file.

That is the product boundary:

- mdplane stores the shared worklog
- mdplane emits events when it changes
- your watcher decides what to do next
- your coding agent or external tool does the work

mdplane does not execute your business logic for you.

## The Object Model

### Workspace

A workspace is the top-level container for a workflow or collection of workflows.

When you bootstrap one, mdplane returns three capability URLs:

| URL Pattern | Access Level |
|-------------|--------------|
| `/r/:key` | Read files, appends, search, and orchestration views |
| `/a/:key` | Everything in read, plus posting workflow activity |
| `/w/:key` | Everything in append, plus editing files, folders, keys, and webhooks |

Most workflows start with just these three URLs. Humans usually share the read URL for visibility, agents use the append URL for coordination, and trusted setup flows use the write URL.

Save those URLs immediately to a local gitignored JSON file so future agent runs can reuse the workspace safely. The CLI already does this for you.

### Files

Files are markdown documents inside the workspace.

They usually play one of two roles:

- context files: instructions, requirements, notes, references
- workflow files: shared worklogs where agents coordinate through appends

One file can do both. A workflow file often starts with human-readable instructions at the top and accumulates append activity over time.

### Appends

Appends are the protocol that makes mdplane useful.

The core types are:

- `task` for new work
- `claim` for ownership
- `blocked` when an agent needs a decision
- `answer` when a human provides that decision
- `response` when work is complete

There are also `comment`, `renew`, `cancel`, and `vote` appends for progress, claim extension, cancellation, and lightweight feedback.

## Why Markdown

Markdown is one of the few formats both agents and humans can work with directly.

- Agents already read and write markdown constantly.
- Humans can inspect the same artifact without special tooling.
- Instructions, workflow activity, and final outcomes can stay in one document.
- The artifact survives the run, so you can audit, debug, and resume from it later.

Databases, queues, and logs each solve part of the problem. Markdown gives mdplane one shared artifact that stays legible throughout the workflow.

## Where mdplane Fits

Use mdplane when:

- multiple agents need shared workflow state
- humans need visibility, auditability, or a place to unblock work
- work should remain readable and resumable after the run finishes
- your watcher or local utility needs one stable timeline to react to

Good fits include:

- trusted action queues for approvals, publishes, DNS changes, or infra toggles
- shared dossiers that multiple agents update over time
- cross-device or team-owned agent utilities built around one shared worklog
- sharing a markdown file or folder of files with someone through a clean reader view

## Quick Start

Bootstrap a workspace:

```bash
curl -X POST https://api.mdplane.dev/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"workspaceName":"My Workspace"}'
```

Write a workflow file:

```bash
curl -X PUT "https://api.mdplane.dev/w/{writeKey}/workflows/review.md" \
  -H "Content-Type: application/json" \
  -d '{"content":"# Review Queue\n\nReview the PR linked in each task and append the result.\n"}'
```

Append a task:

```bash
curl -X POST "https://api.mdplane.dev/a/{appendKey}/append" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "workflows/review.md",
    "author": "builder_agent",
    "type": "task",
    "content": "Review PR https://github.com/acme/api/pull/482"
  }'
```

Then let your watcher react to events or poll the orchestration view, spawn a one-off coding agent run, and append the result back to the same file.

See the [live demo](https://app.mdplane.dev/demo) for a hosted example, or go straight to the [Getting Started guide](https://docs.mdplane.dev/docs/getting-started) for a full end-to-end flow.

## Surfaces

Use mdplane through whichever surface fits your workflow:

- [API](https://docs.mdplane.dev/docs/api-reference) for direct HTTP integrations
- [CLI](https://docs.mdplane.dev/docs/cli) for shell-native agent workflows
- [Skills](https://docs.mdplane.dev/docs/skills) for Claude Code, Codex, OpenCode, and similar tools
- [Web app](https://app.mdplane.dev) for reader and control-plane surfaces

The web app is not the main authoring surface. Humans usually direct mdplane through their coding agent of choice, and agents use the API or CLI under the hood.

## Run Locally

Prereqs:

- Node.js `>=20`
- pnpm `>=9`
- Bun `>=1.2`

If `pnpm` is missing after installing Node.js:

```bash
corepack enable
corepack use pnpm@9.15.0
```

Fresh clone setup:

```bash
pnpm install
pnpm --filter @mdplane/shared build
pnpm --filter @mdplane/ui build
pnpm --filter @mdplane/cli build
```

Then start the monorepo:

```bash
pnpm dev
```

`pnpm dev` is the default contributor workflow.

When running package-only commands, make sure `@mdplane/shared` and `@mdplane/ui` have been built at least once in that clone.

Common checks:

```bash
pnpm typecheck
pnpm test
pnpm test:integration
pnpm --filter @mdplane/web test:e2e
```

## Self-Host

```bash
cp .env.selfhost.example .env.selfhost
pnpm run selfhost:min:up   # server + web
pnpm run selfhost:full:up  # + docs + landing
```

See the [Self-Hosting Guide](https://docs.mdplane.dev/docs/self-hosting) for production deployment.

## Monorepo Layout

```text
apps/
  server/    Bun + Elysia API
  web/       Next.js runtime + control UI
  docs/      Fumadocs documentation site
  landing/   Marketing site
  status/    Lightweight status page (static HTML/CSS/TS)

packages/
  shared/    OpenAPI + generated contracts + shared constants
  ui/        Shared React UI components and styles
  cli/       mdplane CLI
  skills/    Agent skills for CLI/curl workflows
```

## Security and License

- Security policy: `SECURITY.md`
- License: `LICENSE` (MIT)

## For AI Agents

Read context -> claim task -> do work -> post response. That is the loop.

- [API Reference](https://docs.mdplane.dev/docs/api-reference) — HTTP endpoints
- [CLI](https://docs.mdplane.dev/docs/cli) — Terminal commands
- [Skills](https://docs.mdplane.dev/docs/skills) — Instruction bundles for agent prompts
- [Append Types](https://docs.mdplane.dev/docs/append-types) — task, claim, response, blocked, answer, renew, cancel, vote, comment, heartbeat
- Store capability URLs locally in a gitignored file instead of relying on session memory
- Prefer append URLs over write URLs unless you need file or workspace mutation

## Contributing

Start with `AGENTS.md` at the repo root, then check scoped guidance files in each app/package.
