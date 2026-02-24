# Docs Agent Instructions

> Loaded automatically when working in `apps/docs/`.

## Scope

- Follow root `AGENTS.md` first.
- This file enforces docs accuracy for OSS readers.

## Non-Negotiables

- Docs must reflect implemented behavior, not planned behavior.
- OpenAPI + server routes are canonical for API claims.
- No speculative examples, fake payloads, or guessed route params.
- No development-history notes in published docs.

## Uncertainty Protocol

If docs and code differ:

1. Validate behavior in OpenAPI and server route code.
2. Update docs to canonical behavior.
3. If code is wrong, file/fix contract drift before publishing docs.
4. Do not commit unresolved ambiguity.

## Commit Blocker (Strict)

Do not commit docs changes unless API references are verified against:

- OpenAPI contract, and
- backend server behavior/conventions.

If either is unverified, stop and reconcile first.

## Stale Reference Gate

- Every referenced file path must exist.
- Every command snippet must be executable in this repo.
- Every endpoint example must exist in OpenAPI and/or server routes.

## Definition Of Done

1. Updated pages in `apps/docs/content/docs/` for affected features.
2. API/auth language matches workspace/control model.
3. Cross-package docs drift checked (`web`, `cli`, `skills`).
4. Docs lint/typecheck pass.

## Verification Commands (From Repo Root)

```bash
pnpm --filter @mdplane/shared openapi:lint
pnpm --filter @mdplane/shared generate:check
pnpm check:docs-routes
pnpm --filter @mdplane/docs lint
pnpm --filter @mdplane/docs typecheck
```

