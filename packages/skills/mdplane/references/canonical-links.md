# mdplane curl Canonical Links

## Hosted Docs

- Product docs: https://docs.mdplane.dev/docs
- What is mdplane: https://docs.mdplane.dev/docs
- How mdplane works: https://docs.mdplane.dev/docs/how-it-works
- Workspaces, files, and keys: https://docs.mdplane.dev/docs/workspaces-files-and-keys
- Coordination protocol: https://docs.mdplane.dev/docs/coordination-protocol
- API reference index: https://docs.mdplane.dev/docs/api-reference
- API append types: https://docs.mdplane.dev/docs/append-types
- Webhook events: https://docs.mdplane.dev/docs/webhook-events
- Frontmatter reference: https://docs.mdplane.dev/docs/frontmatter
- Idempotency reference: https://docs.mdplane.dev/docs/idempotency
- API errors: https://docs.mdplane.dev/docs/errors
- API limits: https://docs.mdplane.dev/docs/limits
- Access and auth: https://docs.mdplane.dev/docs/access-and-auth
- Getting started: https://docs.mdplane.dev/docs/getting-started
- Files guide: https://docs.mdplane.dev/docs/files
- Folders guide: https://docs.mdplane.dev/docs/folders
- Events and watchers: https://docs.mdplane.dev/docs/events-and-watchers
- Skills guide: https://docs.mdplane.dev/docs/skills

## OpenAPI and Route Truth (Repo)

- OpenAPI root: `packages/shared/openapi/openapi.yaml`
- OpenAPI paths: `packages/shared/openapi/paths/`
- Shared route builders: `packages/shared/src/routes/index.ts`
- Generated query schemas: `packages/shared/src/generated/query-schemas.gen.ts`
- Server route exports: `apps/server/src/routes/`

## Relevant OpenAPI Path Files

- Bootstrap: `packages/shared/openapi/paths/bootstrap.yaml`
- Files and capability routes: `packages/shared/openapi/paths/files.yaml`
- Folders: `packages/shared/openapi/paths/folders.yaml`
- Appends: `packages/shared/openapi/paths/appends.yaml`
- Search: `packages/shared/openapi/paths/search.yaml`
- Realtime and heartbeat: `packages/shared/openapi/paths/realtime.yaml`
- Export and deleted: `packages/shared/openapi/paths/export.yaml`
- Agents liveness: `packages/shared/openapi/paths/agents.yaml`
- Workspaces and rotate-all: `packages/shared/openapi/paths/workspaces.yaml`

## Production Endpoints

- API base: https://api.mdplane.dev
- App base: https://app.mdplane.dev
- Docs base: https://docs.mdplane.dev
- OpenAPI JSON: https://api.mdplane.dev/openapi.json
