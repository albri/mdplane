# @mdplane/server

Bun + Elysia backend API for mdplane, the shared worklog for agent workflows.

## Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **Framework**: [Elysia](https://elysiajs.com)
- **Database**: SQLite with [Drizzle ORM](https://orm.drizzle.team)
- **Auth**: [BetterAuth](https://better-auth.com)

## Setup

```bash
# From repo root
pnpm install
pnpm --filter @mdplane/shared build

# Push database schema
pnpm --filter @mdplane/server db:push

# Start development server
pnpm --filter @mdplane/server dev
```

Server runs at http://localhost:3001

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port. Default: `3001`. |
| `HOST` | No | Bind host. Default: `0.0.0.0`. |
| `NODE_ENV` | No | Runtime mode. Default: `development`. |
| `DATABASE_URL` | No | SQLite DB path. Default: `./data/mdplane.sqlite`. |
| `BASE_URL` | Yes for self-host/local | API origin used to build capability URLs in responses. |
| `APP_URL` | Yes for self-host/local | Web origin used in returned `webUrl` links and auth trusted origins. |
| `BETTER_AUTH_URL` | Recommended | Better Auth base URL (API origin). Default: `http://localhost:3001`. |
| `BETTER_AUTH_SECRET` | Yes in production | Better Auth signing secret. |
| `MP_JWT_SECRET` | Yes in production | Base64-encoded 32-byte secret used for WebSocket token signing. |
| `ADMIN_SECRET` | Optional | Required only for operator endpoint `GET /api/v1/admin/metrics`. |
| `MDPLANE_GOVERNED_MODE` | Optional | Feature-gates governed/OAuth control mode (`true` by default). |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Optional | Enable GitHub OAuth login. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional | Enable Google OAuth login. |
| `WS_URL` | Optional | Public WebSocket URL in API metadata. Default: hosted ws URL. |
| `OPENAPI_SPEC_PATH` | Optional | Absolute/relative path override for the OpenAPI document served by `/openapi.json`. |
| `DISABLE_BACKGROUND_JOBS` | Optional | Set to `true` to disable scheduler jobs. |
| `ALLOW_HTTP_WEBHOOKS` | Optional | Set to `true` only for local/integration testing of non-HTTPS webhooks. |
| `TRUST_PROXY_HEADERS` | Optional | Set to `true` only if your trusted proxy rewrites `X-Real-IP`/`X-Forwarded-For`. |
| `TRUSTED_PROXY_SHARED_SECRET` | Optional | Shared secret that must be present on proxy-forwarded requests before trusting client IP headers. |
| `TRUSTED_PROXY_SHARED_SECRET_HEADER` | Optional | Header name for `TRUSTED_PROXY_SHARED_SECRET` (default: `x-mdplane-proxy-secret`). |
| `TRUST_SINGLE_X_FORWARDED_FOR` | Optional | Set to `true` only if your trusted proxy always overwrites single-value `X-Forwarded-For`. |
| `REQUIRE_TRUSTED_CLIENT_IP_FOR_ANON_RATE_LIMITS` | Optional | Require trusted client IP for anonymous sensitive endpoints (`/bootstrap`, `/capabilities/check`). Defaults to `true` in production. |
| `MP_DEBUG_WS` | Optional | Set to `true` for verbose websocket debug logging. |
| `MAX_WORKSPACE_STORAGE_BYTES` | Optional | Per-workspace quota. Default: `104857600` (100 MB). |
| `MAX_FILE_SIZE_BYTES` | Optional | Per-file upload limit. Default: `10485760` (10 MB). |
| `MAX_VOLUME_SIZE_BYTES` | Optional | DB volume warning/limit metadata. Default: `5368709120` (5 GB). |

Use `apps/server/.env.example` as the canonical server env template.

When `MDPLANE_GOVERNED_MODE=false`, OAuth-governed control features are disabled. Capability routes remain available.

## API Overview

### Authentication

mdplane uses **capability URLs** - auth is embedded in the URL, no headers needed:

```
GET /r/{key}/path/to/file.md
```

Session auth via BetterAuth is available for web app users at `/api/auth/*`.

### Route Architecture

mdplane uses a three-tier authentication model:

| Tier | Route Pattern | Auth Method | Purpose |
|------|---------------|-------------|---------|
| 1 | `/r/`, `/a/`, `/w/` | Capability URL (secret in path) | File/folder ops for agents |
| 2 | `/api/v1/*` | API Key (Bearer token) | Workspace-wide automation |
| 3 | `/workspaces/*` | OAuth Session (cookie) | Control-plane "nuclear" ops |

### Key Endpoints

| Route | Auth | Description |
|-------|------|-------------|
| `/health` | None | Health check for deployments |
| `/bootstrap` | None (rate limited) | Create new workspace |
| `/r/:key/*`, `/a/:key/*`, `/w/:key/*` | Capability URL | File/folder operations |
| `/w/:key/audit` | Capability URL | Audit log |
| `/api/v1/search` | API Key | Workspace search |
| `/api/v1/export` | API Key | Data export |
| `/api/v1/files/*`, `/api/v1/folders/*` | API Key | Path-based file/folder access |
| `/workspaces/:id` | OAuth Session | Delete workspace, rotate URLs |
| `/workspaces/:id/api-keys` | OAuth Session | API key management |

### Project Structure

```
src/
├── routes/     # Thin route wrappers/composers
├── domain/     # Route family domain modules (route, handlers, validation, types)
├── shared/     # App-level shared server policies/utilities
├── core/       # Low-level primitives/utilities
├── services/   # Cross-domain services (audit, webhooks, event bus)
└── db/         # Drizzle schema & connection
```

### Type Boundaries

- API request/response contract types come from `@mdplane/shared` generated outputs.
- `src/domain/*/types.ts` and `src/shared/types.ts` are for internal execution types only.
- Internal naming convention:
  - `*Input`, `*Context`, `*Result`, `*Row` for server-local types.
  - Avoid server-local API DTO aliases like `*Request`/`*Response` when shared generated contract types exist.

## Development Commands

| Command | Description |
|---------|-------------|
| `pnpm --filter @mdplane/server dev` | Start with hot reload |
| `pnpm --filter @mdplane/server build` | Build for production |
| `pnpm --filter @mdplane/server start` | Start production server |
| `pnpm --filter @mdplane/server test` | Run tests |
| `pnpm --filter @mdplane/server db:generate` | Generate migrations |
| `pnpm --filter @mdplane/server db:push` | Push schema to database |

## Testing

### Unit Tests

```bash
pnpm --filter @mdplane/server test
```

### Integration Tests

Integration tests run real HTTP requests against a spawned local server instance.

```bash
pnpm test:integration
```

Parity check (restart + persistence):

```bash
# Restart the server once mid-run while preserving the sqlite DB
INTEGRATION_TEST_RESTARTS=1 pnpm test:integration
```

What integration setup does:
- Server runs on `http://127.0.0.1:3001` with `INTEGRATION_TEST_MODE=true`.
- Uses a file-backed sqlite DB at `apps/server/data/integration-test.sqlite`.
- Disables background jobs for determinism.
- Includes real WebSocket integration tests using the `ws` client.

## Deployment

Deploys to **Railway** via `railway.toml`. Requires persistent volume at `/data` for SQLite.

```bash
railway up
```

### SQLite Backup and Restore

Run from repo root:

```bash
pnpm db:backup
pnpm db:restore -- --from ./backups/mdplane-backup-YYYYMMDD-HHMMSS.sqlite --yes
```

Notes:
- `db:backup` auto-detects `DATABASE_URL` (or common local paths) and writes to `./backups/` by default.
- `db:restore` creates a pre-restore snapshot in the target DB directory before overwrite.
- Run restore only while the server is stopped.

Custom paths:

```bash
pnpm db:backup -- --db ./apps/server/data/mdplane.sqlite --out ./backups/
pnpm db:restore -- --db ./apps/server/data/mdplane.sqlite --from ./backups/my-backup.sqlite --yes
```

Railway volume example (remote container via `railway ssh`):

```bash
TS=$(date +%Y%m%d-%H%M%S)
BASE="/data/backups/mdplane-backup-$TS.sqlite"
railway ssh --service backend --environment production -- mkdir -p /data/backups
railway ssh --service backend --environment production -- cp /data/mdplane.sqlite "$BASE"
railway ssh --service backend --environment production -- cp /data/mdplane.sqlite-wal "$BASE-wal"
railway ssh --service backend --environment production -- cp /data/mdplane.sqlite-shm "$BASE-shm"

# Restore (copy your chosen backup set back to /data/mdplane.sqlite*)
railway ssh --service backend --environment production -- cp /data/backups/my-backup.sqlite /data/mdplane.sqlite
railway ssh --service backend --environment production -- cp /data/backups/my-backup.sqlite-wal /data/mdplane.sqlite-wal
railway ssh --service backend --environment production -- cp /data/backups/my-backup.sqlite-shm /data/mdplane.sqlite-shm
```

Self-host Docker Compose profiles are defined at repo root:

- `docker-compose.selfhost.minimal.yml` (`server + web`)
- `docker-compose.selfhost.full.yml` (`server + web + docs + landing`)

Run minimal profile:

```bash
docker compose --env-file .env.selfhost -f docker-compose.selfhost.minimal.yml up -d
```
