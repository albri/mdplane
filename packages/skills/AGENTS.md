# Skills Agent Instructions

> Loaded automatically when working in `packages/skills/`.

## Scope

- Follow root `AGENTS.md` first.
- This file enforces truthfulness of skill instructions/examples.

## Non-Negotiables

- Skills must be compliant with OpenAPI and backend server conventions.
- No hallucinated endpoints, params, request bodies, or response fields.
- Capability/API key/OAuth examples must use real auth-layer boundaries.
- No development-history narration in skill content.

## Uncertainty Protocol

If a skill example is uncertain:

1. Verify in `packages/shared/openapi/`.
2. Verify route behavior in `apps/server/src/routes/`.
3. Update or remove the example.
4. Do not commit unverified examples.

## Commit Blocker (Strict)

Do not commit skill edits unless examples are validated against:

- OpenAPI contract, and
- implemented backend behavior.

## Stale Reference Gate

- All referenced endpoints must exist.
- All command snippets must be runnable with current tooling.
- All auth requirements in docs must match server behavior.

## Definition Of Done

1. Skill examples map to real mdplane behavior.
2. Workspace vs control guidance is explicit and consistent.
3. Related docs (`apps/docs/`, `packages/cli/`) are updated for changed guidance.
4. Skill checks and OpenAPI checks pass.

## Verification Commands (From Repo Root)

```bash
pnpm --filter @mdplane/shared openapi:lint
pnpm --filter @mdplane/shared generate:check
pnpm check:docs-routes
```

