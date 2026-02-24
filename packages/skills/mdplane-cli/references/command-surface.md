# mdplane CLI Command Surface

## Canonical Source

- Command registration: `packages/cli/src/commands/index.ts`
- Per-command flags/help:
  - `packages/cli/src/commands/*.ts`

## Command Inventory

- `init`
- `login`
- `claim`
- `status`
- `files`
- `ls`
- `read`
- `cat`
- `append`
- `write`
- `rm`
- `mkdir`
- `mv`
- `recover`
- `rotate`
- `settings`
- `check-keys`
- `search`
- `export`
- `export-status`
- `export-download`
- `agents`
- `deleted`

## Auth Expectations (High Level)

- Capability mode:
  - read key: read/list/search (scoped)
  - append key: append
  - write key: mutate file/folder/settings/rotation/recover
- API key mode:
  - workspace-wide search
  - export + export jobs
  - deleted files
  - agents liveness
- OAuth/session mode:
  - login and claim workflows

## Behavior Notes

- `search` supports both:
  - API key (workspace-wide)
  - read key (scoped via capability route)
- `append` supports user append types; heartbeats are a separate endpoint.
- `write` supports concurrency-safe updates (ETag path in command implementation).

## Verification

```bash
mdplane --help
mdplane <command> --help
```
