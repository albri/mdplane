# @mdplane/landing

Marketing and landing page for mdplane.

mdplane is the shared worklog for agent workflows.

The landing site should tell the same core story as the docs:

- agents coordinate by reading and appending to markdown files in a shared workspace
- humans direct and review through coding agents
- mdplane stores the timeline and emits events
- watchers and spawned agents do the actual work

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Styling**: Tailwind CSS
- **UI**: React 19, Base UI primitives, shared components from `@mdplane/ui`
- **Icons**: Lucide

## Setup

```bash
# From repo root
pnpm install
pnpm --filter @mdplane/shared build
pnpm --filter @mdplane/ui build

# Start landing dev server
pnpm --filter @mdplane/landing dev
```

Open http://localhost:3000

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SITE_URL` | Optional | Public landing origin used for metadata base URL. Defaults to `https://mdplane.dev`. |

`NEXT_PUBLIC_API_URL` is not used by the current landing app runtime.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Homepage / landing |
| `/terms` | Terms of Service |
| `/privacy` | Privacy Policy |

> **Note:** Bootstrap lives on the app/runtime surface, not on the landing site.

## Development Commands

| Command | Description |
|---------|-------------|
| `pnpm --filter @mdplane/landing dev` | Start dev server (Turbopack) |
| `pnpm --filter @mdplane/landing build` | Production build |
| `pnpm --filter @mdplane/landing start` | Start production server |
| `pnpm --filter @mdplane/landing lint` | Run ESLint |

## Testing

```bash
pnpm --filter @mdplane/landing lint
pnpm --filter @mdplane/landing typecheck
pnpm --filter @mdplane/landing build
pnpm --filter @mdplane/landing test:e2e
```

## Deployment

Deploys to **Vercel** via `vercel.json`.

1. Import repo in Vercel dashboard
2. Set root directory to `apps/landing`
3. Merges to `main` auto-deploy

Preview deployments created for each PR.

## Docker (Self-Host Full Profile)

Landing is optional for self-hosting. It is included only in:

- `docker-compose.selfhost.full.yml`

Build and run landing service:

```bash
docker compose --env-file .env.selfhost -f docker-compose.selfhost.full.yml up -d landing
```
