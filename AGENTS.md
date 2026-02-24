# mdplane Development

> Implementation MUST match documentation. Deviation = bug.

## Critical Rules (Non-Negotiable)

1. `Testing Must Add Signal`: prefer test-first for behavior changes, but do not add implementation-detail or low-signal tests that create maintenance noise.
2. `OpenAPI Is Truth`: `packages/shared/openapi/` defines API contracts.
3. `No Shortcuts`: do not mark work done as "MVP viable".
4. `PE Review Required`: no task is complete without principal-engineer review.

## CI Pipeline

`Lint -> Typecheck -> Unit Tests -> Build -> Integration Tests -> E2E Tests`

All steps must pass for PR merge.

## Source Of Truth Hierarchy

1. `packages/shared/openapi/` (contract)
2. `packages/shared/src/generated/` (generated types/schemas)
3. `apps/server/src/routes/` (implementation)
4. Consumers and docs:
   - `apps/web/`
   - `packages/cli/`
   - `packages/skills/`
   - `apps/docs/content/docs/`
   - `apps/landing/`

## Type Safety Rules (P0)

- No manual API DTOs if generated/shared types exist.
- No `any` in new or modified code.
- Avoid unchecked type assertions; validate at boundaries.
- Backend routes with query params must have Zod validation.
- Contract request/response types must come from `@mdplane/shared` only.
- Server-local types are internal execution types only (`*Input`, `*Context`, `*Result`, `*Row`).
- Do not introduce server-local `*Request`/`*Response` API DTO aliases when a shared generated type exists.
- Prefer query schemas from `@mdplane/shared`:
  - `packages/shared/src/generated/query-schemas.gen.ts`
  - `packages/shared/src/schemas/query-schemas.ts`

## Code Hygiene Rules (P0)

- Comments must document current behavior only.
- Remove development-history narration and stale plan references as part of each touch.

## Route Change Checklist (Mandatory)

When changing any route, update all affected surfaces:

| Component | Location | Required Check |
|---|---|---|
| OpenAPI spec | `packages/shared/openapi/paths/*.yaml` | Paths, params, request/response schema |
| Shared generation | `packages/shared/src/generated/` | Regenerated outputs committed |
| Server routes | `apps/server/src/routes/` | Behavior matches contract |
| Docs site | `apps/docs/content/docs/` | API reference/examples updated |
| CLI | `packages/cli/` | Command behavior and help text in sync |
| Skills | `packages/skills/` | No hallucinated route examples |
| Web app | `apps/web/` | API usage and UX language in sync |
| Landing | `apps/landing/` | Product/API claims still true |

Failure to update affected components means the task is incomplete.

## Uncertainty Protocol (Mandatory)

If any route/field behavior is unclear:

1. Stop implementation for that part.
2. Verify against OpenAPI and server route code.
3. Reconcile drift before proceeding.
4. Do not commit speculative fixes or guessed docs/examples.

## Stale Reference Gate

Before marking work done:

- Every command listed in edited docs must exist.
- Every file path listed in edited docs must exist.
- Remove or fix dead links/references immediately.

## Definition Of Done

A task is done only when all apply:

1. Tests are added/updated where they materially validate user-facing behavior or regressions, and all relevant tests pass.
2. Implementation matches OpenAPI and generated types.
3. Affected packages/docs are updated for drift.
4. Verification commands pass locally (or failures are explicitly documented).
5. PE review requested/completed.

## Commands (Run From Repo Root)

### Development

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm format
```

### Testing

```bash
pnpm test
pnpm test:server
pnpm test:cli
pnpm test:integration
pnpm test:e2e
```

### Quality Gates

```bash
pnpm check:route-coverage
pnpm check:route-db-usage
pnpm check:domain-route-imports
pnpm check:enum-sync
pnpm check:query-params
pnpm check:docs-routes
pnpm --filter @mdplane/shared generate:check
pnpm --filter @mdplane/shared openapi:lint
```

## Consistency Checks (Before Implementing)

```bash
rg "paramName" apps/server/src/routes/
rg "paramName" packages/shared/openapi/
rg "paramName" apps/docs/content/docs/
```

Match existing naming conventions exactly.

## Glossary

- `Capability URL`: URL containing an unguessable secret key used as authorization.
- `Workspace Plane`: capability-first surface for agent read/append/write workflows.
- `Control Plane`: authenticated governance surface (API keys, ownership, settings).
- `Claim`: ownership-binding flow moving anonymous workspace governance to an authenticated user.
- `Workspace`: logical container for files/folders, tasks, keys, and webhooks.

## Never Do

- Skip PE review.
- Mark tasks complete with failing checks.
- Introduce naming drift.
- Deviate from OpenAPI contract without updating it first.
- Add guessed routes/examples/docs that are not implemented.
