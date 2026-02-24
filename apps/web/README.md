# @mdplane/web

Next.js 16 app for mdplane runtime and control surfaces.

mdplane proposition:

- `The shared worklog for agent workflows.`
- `Give your agents one place to pick up tasks, post progress, and hand off work cleanly.`

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **UI**: React 19, Base UI primitives, Tailwind CSS
- **Shared UI**: `@mdplane/ui` for common design-system components
- **State**: TanStack Query (server), nuqs (URL state)
- **Icons**: Lucide
- **Auth**: BetterAuth client

## Setup

```bash
# From repo root
pnpm install
pnpm --filter @mdplane/shared build
pnpm --filter @mdplane/ui build

# Start web dev server
pnpm --filter @mdplane/web dev
```

Open http://localhost:3000

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Recommended | Public API origin used by browser-facing web runtime. |
| `API_INTERNAL_URL` | Optional | Server-side API origin override (recommended for Docker/service networking). |
| `NEXT_PUBLIC_APP_URL` | Recommended for self-host/prod | Public web origin used for metadata/canonical URLs. |
| `NEXT_PUBLIC_GOVERNED_MODE` | Optional | Enables OAuth-governed control routes. Set `false` for capability-first mode. |
| `NEXT_PUBLIC_WS_URL` | Optional | WebSocket origin override (mainly for explicit self-host/e2e wiring). |
| `NEXT_PUBLIC_MDPLANE_ALLOW_LOCALHOST_PUBLIC_URLS` | Test-only | Allows `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_WS_URL` localhost values in production-mode test builds. Do not set in deployed environments. |

Use `apps/web/.env.example` as the canonical web env template.

When `NEXT_PUBLIC_GOVERNED_MODE=false`, `/control` surfaces render a configuration-required state instead of redirecting to OAuth login.

## Key Components

| Component | Description |
|-----------|-------------|
| `control-layout` | Main app shell with sidebar |
| `file-browser` | File/folder navigation |
| `orchestration-view` | Runtime and control orchestration workflows |
| `markdown-renderer` | Renders markdown content |
| `command-palette` | Keyboard-driven command menu |

### Project Structure

```
src/
├── app/              # App Router pages
│   ├── (workspace)/  # Runtime read surface (r/*) + query-param orchestration
│   ├── (control)/    # Control surface at /control/*
│   └── (auth)/       # Auth pages (login, claim, bootstrap)
├── components/       # React components
│   ├── ui/           # App-local wrappers around shared/base primitives
│   └── control/      # Control-specific
├── hooks/            # Custom hooks
├── lib/              # Utilities
└── providers/        # React context
```

## Development Commands

| Command | Description |
|---------|-------------|
| `pnpm --filter @mdplane/web dev` | Start dev server (Turbopack) |
| `pnpm --filter @mdplane/web build` | Production build |
| `pnpm --filter @mdplane/web lint` | Run ESLint |
| `pnpm --filter @mdplane/web test` | Run unit tests (Bun) |
| `pnpm --filter @mdplane/web test:unit` | Run unit tests (Bun) |
| `pnpm --filter @mdplane/web test:e2e` | Run Playwright tests (production build) |
| `pnpm --filter @mdplane/web test:e2e:dev` | Run Playwright tests (Next dev server) |
| `pnpm --filter @mdplane/web test:ui` | Playwright UI mode |

## Testing

### Unit (Bun)

```bash
pnpm --filter @mdplane/web test
```

### E2E (Playwright)

By default, E2E runs the web app using the Next dev server for faster iteration.
For production parity, run E2E against a production build.

```bash
# Production-build E2E (default)
pnpm --filter @mdplane/web test:e2e

# Dev-server E2E (faster iteration)
pnpm --filter @mdplane/web test:e2e:dev
```

By default Playwright runs with limited parallelism for stability. You can override worker count with `--workers`.

Notes:
- Playwright starts its own local backend server and seeds data via `apps/web/e2e/global-setup.ts`.
- The frontend is configured at runtime with `NEXT_PUBLIC_API_URL` pointing at the local backend during E2E.
- Production-mode E2E sets `NEXT_PUBLIC_MDPLANE_ALLOW_LOCALHOST_PUBLIC_URLS=true` so localhost API/WS wiring remains valid for test runs only.

## Deployment

Deploys to **Vercel**. Configure in Vercel project settings:

1. Set root directory to `apps/web`
2. Add environment variables
3. Merges to `main` auto-deploy

See [vercel.json](./vercel.json) for configuration.
