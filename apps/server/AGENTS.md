# Server Agent Instructions

> Loaded automatically when working in `apps/server/`.

## Scope

- Follow root `AGENTS.md` first.
- This file adds server-specific constraints only.

## Non-Negotiables

- OpenAPI + generated shared types are source of truth.
- No manual API contract types when shared generated types exist.
- API contract request/response types must be imported from `@mdplane/shared`.
- Server-local types are internal-only (`*Input`, `*Context`, `*Result`, `*Row`).
- Do not add server-local API `*Request`/`*Response` aliases when shared generated types exist.
- Route query params must be validated via shared query schemas.
- Route behavior must not drift from `packages/shared/openapi/`.
- No development-history narration in server code/tests/comments.

## Uncertainty Protocol

If server behavior and spec disagree:

1. Stop and identify dominant current behavior across server/tests/docs.
2. Reconcile OpenAPI + implementation to one canonical behavior.
3. Update all impacted consumers before completion.
4. Do not commit partial drift.

## Required When Changing Routes

1. Update `packages/shared/openapi/`.
2. Regenerate shared artifacts.
3. Update route code in `apps/server/src/routes/`.
4. Update affected clients/docs (`apps/web/`, `packages/cli/`, `packages/skills/`, `apps/docs/`).
5. Add/update server unit and integration tests.

## Stale Reference Gate

- Any new route path in docs/examples must exist in OpenAPI and server routes.
- Any command added to docs must exist in package scripts.

## Definition Of Done

1. Contract and implementation are aligned.
2. Route tests and integration coverage updated.
3. Shared generation checks are clean.
4. Lint/typecheck/tests pass (or blockers documented explicitly).

## Verification Commands (From Repo Root)

```bash
pnpm --filter @mdplane/shared generate:check
pnpm --filter @mdplane/shared openapi:lint
pnpm test:server
pnpm test:integration
pnpm check:route-coverage
pnpm check:route-db-usage
pnpm check:domain-route-imports
pnpm check:query-params
pnpm lint
pnpm typecheck
```

