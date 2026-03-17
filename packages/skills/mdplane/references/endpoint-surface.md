# mdplane Endpoint Surface (curl)

## Capability URL Surfaces

### Read capability (`/r/{key}`)

- Read file content, raw content, metadata, structure, sections, tail
- List folders
- Scoped search
- File stats
- Realtime subscribe
- Read-only orchestration and agent liveness views

### Append capability (`/a/{key}`)

- Create appends (`/append`)
- Record heartbeat (`/heartbeat`)
- Append-scope folder subscriptions/listing
- File stats for scope

### Write capability (`/w/{key}`)

- Create/update/delete/recover/rename/rotate for scoped resource
- Move operations
- Settings updates
- Folder mutations and webhooks
- Workspace-level capabilities check (`/w/{key}/capabilities/check`)

## API Key Surface (`/api/v1/*`)

- Path-based files/folders operations
- Workspace-wide search
- Export + async export jobs + download
- Deleted files listing
- Agents liveness
- Other control-plane API key flows documented in API reference

## Session-Control Surface

- Workspace controls (`/workspaces/{workspaceId}/*`) require authenticated user session.
- Use this only for explicit ownership/admin tasks (for example rotate-all root keys).

## Bootstrap and Key Validation

- `POST /bootstrap` creates anonymous workspace and returns root capability keys/URLs.
- `POST /capabilities/check` validates keys globally.
- `POST /w/{key}/capabilities/check` validates keys with workspace scope.

## Notes

- Heartbeats are not regular appends; they use `/a/{key}/heartbeat`.
- Use URL-encoded path segments where route expects encoded path.
- Prefer append routes for agent coordination and reserve write routes for explicit mutations.
