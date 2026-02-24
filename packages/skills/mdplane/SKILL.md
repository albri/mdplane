---
name: mdplane
description: Use mdplane through its HTTP API for automation, CI, and non-CLI agents. Trigger for capability URL requests, API endpoint calls, or integration tasks against mdplane. For shell command workflows, use mdplane-cli.
---

# mdplane API

Use this skill when the agent should call mdplane via HTTP directly (CI jobs, scripts, SDK-free integrations).

## Operating Rules

1. OpenAPI and server behavior are the source of truth.
2. Do not invent routes, request fields, query params, or response shapes.
3. Respect auth boundaries:
   - Capability routes: `/r/{key}`, `/a/{key}`, `/w/{key}`
   - API key routes: `/api/v1/*`
   - Control/session routes: `/workspaces/*`, `/api/auth/*` (only when explicitly needed)
4. Prefer least privilege and avoid write scope unless required.
5. Never print capability URLs, API keys, or cookies in logs/output.

## Standard Workflow

1. Set target base URL (`https://api.mdplane.dev`, self-host, or local).
2. Acquire or validate credentials (`/bootstrap`, `/capabilities/check`, existing env).
3. Execute minimal-scope request sequence.
4. Validate results and surface errors with status + API error code/message.
5. Recommend key rotation if exposure is suspected.

## Endpoint Surface

Use canonical endpoint maps here before writing requests:

- `./references/endpoint-surface.md`

## Canonical References

- `./references/canonical-links.md`

Read these references when handling advanced folder ops, orchestration, realtime, webhooks, exports, or API-key control routes.

## Safety Defaults

- Prefer `/a/{key}` over `/w/{key}` for agents that only need to add work.
- Use `/w/{key}` only for explicit mutate/recover/rotate workflows.
- Treat root keys and API keys as high-sensitivity credentials.

