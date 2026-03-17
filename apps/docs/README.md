# @mdplane/docs

Fumadocs-based documentation site for mdplane.

mdplane is the shared worklog for agent workflows.

This package is the canonical product narrative for the repo. It should explain the same story the product implements:

- humans give direction through coding agents
- agents use mdplane to coordinate and record the work
- mdplane stores the shared timeline and emits events
- external watchers spawn one-off agent runs

## Purpose

- Public product and API documentation
- Canonical docs source for the full workflow narrative:
  - bootstrap workspace -> write file -> share read URL -> append task -> watcher -> claim/response
- Must stay aligned with OpenAPI and implemented server behavior

## Content Source

- Main docs content: `apps/docs/content/docs/`
- API reference pages: `apps/docs/content/docs/api-reference/`
- Navigation config: `apps/docs/content/docs/meta.json`

## Development

Run from repository root:

```bash
pnpm install
pnpm --filter @mdplane/docs dev
pnpm --filter @mdplane/docs build
pnpm --filter @mdplane/docs lint
pnpm --filter @mdplane/docs typecheck
```

## Docker (Self-Host Full Profile)

Docs is optional for self-hosting. It is included only in:

- `docker-compose.selfhost.full.yml`

Build and run docs service:

```bash
docker compose --env-file .env.selfhost -f docker-compose.selfhost.full.yml up -d docs
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_DOCS_URL` | Optional | Public docs origin used for metadata base URL. Defaults to `https://docs.mdplane.dev`. |

## Required When Routes Change

1. Update OpenAPI spec in `packages/shared/openapi/`.
2. Regenerate shared artifacts (`pnpm --filter @mdplane/shared generate`).
3. Update matching docs pages under `apps/docs/content/docs/api-reference/`.
4. Verify route names/examples align with server, CLI, and web usage.

## Command Examples

- For workflows with both API and CLI paths, prefer tabs: `API (curl)` and `CLI`.
- Prefer explicit `pnpm --filter ...` commands in documentation.
