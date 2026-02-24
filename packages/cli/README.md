# @mdplane/cli

CLI for mdplane workspace automation and shared worklog operations.

## Why use the CLI

Use the CLI when you:

- Need to interact with mdplane from scripts, CI/CD, or terminal workflows.
- Want to bootstrap workspaces, append tasks, or claim work without writing HTTP code.
- Are building watcher scripts that start agents and post results.

For HTTP-first automation, use the [API directly](https://docs.mdplane.dev/docs/api-reference).

## Install

```bash
npm install -g @mdplane/cli
```

Or run without global install:

```bash
npx @mdplane/cli --help
```

## Hosted Quick Start

Bootstrap a workspace:

```bash
mdplane init --name "My Workspace"
mdplane status
mdplane files
```

## Self-Host and Local Configuration

Set a non-hosted API domain at init time:

```bash
mdplane init --base-url https://api.example.com --name "Self-Hosted Workspace"
```

If login/claim browser URLs are on a different domain, set:

```bash
export MDPLANE_APP_URL="https://app.example.com"
```

## Environment Overrides

| Variable | Purpose |
|---|---|
| `MDPLANE_API_URL` | Override API base URL |
| `MDPLANE_APP_URL` | Override web/control base URL used by login/claim |
| `MDPLANE_API_KEY` | Override API key |
| `MDPLANE_READ_KEY` | Override read capability URL/key |
| `MDPLANE_APPEND_KEY` | Override append capability URL/key |
| `MDPLANE_WRITE_KEY` | Override write capability URL/key |

Resolution precedence is flag -> env var -> profile config.

## Auth Modes

- Capability mode: read/append/write capability URLs (`/r`, `/a`, `/w`)
- API key mode: `sk_*` keys for `/api/v1/*` automation routes
- OAuth flow (GitHub/Google in current CLI): `mdplane login`, `mdplane claim`

## Common Commands

- `mdplane init`
- `mdplane status`
- `mdplane files` / `mdplane ls`
- `mdplane read` / `mdplane cat`
- `mdplane append`
- `mdplane write`
- `mdplane search`
- `mdplane export`, `mdplane export-status`, `mdplane export-download`
- `mdplane login`, `mdplane claim`

Run `mdplane <command> --help` for command-specific flags.

## Development

From repo root:

```bash
pnpm install
pnpm --filter @mdplane/shared build
pnpm --filter @mdplane/cli build
pnpm --filter @mdplane/cli test
pnpm --filter @mdplane/cli typecheck
pnpm --filter @mdplane/cli pack:smoke
```
