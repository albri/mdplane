# Landing Agent Instructions

> Loaded automatically when working in `apps/landing/`.

## Scope

- Follow root `AGENTS.md` first.
- This file governs landing-site-specific behavior and messaging consistency.

## Non-Negotiables

- Keep messaging aligned with implemented behavior in `apps/web` and `apps/server`.
- Do not claim unsupported surfaces or routes.
- Preserve design-system consistency with shared primitives from `@mdplane/ui`.
- Avoid app-local primitive drift unless there is a clear product-specific need.
- No development-history narration in copy/tests.

## Product Messaging Guardrails

- Describe capability tiers (`/r`, `/a`, `/w`) as permission tiers.
- Present runtime web UX as read-first.
- Present control as governance/ownership surface.
- Keep bootstrap/key-custody messaging explicit and accurate.

## Uncertainty Protocol

If route/behavior is unclear:

1. Verify OpenAPI and server implementation.
2. Verify web implementation.
3. Update landing copy/examples only after confirming behavior.
4. Do not ship speculative product claims.

## Stale Reference Gate

- Every link and route in landing copy must resolve.
- Remove or update stale commands and references immediately.

## Definition Of Done

1. Copy and IA are consistent with actual product behavior.
2. Shared UI usage is preserved (no unnecessary primitive forks).
3. E2E assertions cover meaningful user-facing behavior.
4. Lint/typecheck/build pass.

## Verification Commands (From Repo Root)

```bash
pnpm --filter @mdplane/landing lint
pnpm --filter @mdplane/landing typecheck
pnpm --filter @mdplane/landing build
pnpm --filter @mdplane/landing test:e2e
```
