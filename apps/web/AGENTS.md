# Web Agent Instructions

> Loaded automatically when working in `apps/web/`.

## Scope

- Follow root `AGENTS.md` first.
- This file governs web-app-specific behavior and IA clarity.

## Non-Negotiables

- Preserve workspace vs control separation in routes and copy.
- Do not invent API fields or route contracts in hooks/components.
- Prefer shared route constants/types from `@mdplane/shared`.
- Keep auth-layer intent explicit in UI language.
- Avoid hardcoded route strings when shared route constants exist.
- No development-history narration in UI/test naming.

## Surface Model

- Workspace surface: `src/app/(workspace)/r/*` (read-first runtime + query-param orchestration view)
- Control surface: `src/app/(control)/control/*`, `src/app/(auth)/claim/*`, `src/app/(auth)/login/*`

Do not blur governance controls into capability-first workspace pages.

## Uncertainty Protocol

If a UI/API behavior is unclear:

1. Verify OpenAPI + server route implementation first.
2. Check existing patterns in nearby hooks/components.
3. Align copy and UX to confirmed behavior.
4. Do not ship guessed API handling.

## Stale Reference Gate

- Route links/constants in UI must match shared/server routes.
- API examples and labels must match docs and implemented behavior.

## Definition Of Done

1. API usage matches OpenAPI/server behavior.
2. Workspace/control IA remains clear after change.
3. E2E coverage updated for changed flows.
4. Lint/typecheck/unit tests/E2E list command pass.

## Verification Commands (From Repo Root)

```bash
pnpm lint
pnpm typecheck
pnpm --filter @mdplane/web test
pnpm check:docs-routes
pnpm --filter @mdplane/web test:e2e -- --list
```

Run full E2E when environment is available:

```bash
pnpm --filter @mdplane/web test:e2e
```

