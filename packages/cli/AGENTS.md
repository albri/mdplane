# CLI Agent Instructions

> Loaded automatically when working in `packages/cli/`.

## Scope

- Follow root `AGENTS.md` first.
- This file prevents contract drift in CLI behavior and examples.

## File Topology

```
packages/cli/src/
├── api/                  # API client decomposition
│   ├── client.ts         # ApiClient class with all methods
│   ├── request.ts        # Request wrapper, headers, error mapping
│   ├── types.ts          # Exported CLI type aliases
│   └── index.ts          # Barrel export
├── config/               # Configuration decomposition
│   ├── context.ts        # Command context and key resolution
│   ├── migrate.ts        # Old format detection and migration
│   ├── paths.ts          # Path builders and discovery functions
│   ├── profile.ts        # Active profile and key resolution
│   ├── store.ts          # Load/save operations
│   ├── types.ts          # Profile and config interfaces
│   └── index.ts          # Barrel export
├── commands/             # CLI commands
│   ├── _runtime/         # Shared command runtime helpers
│   │   ├── action.ts     # runCommandAction wrapper
│   │   ├── auth.ts       # requireContextAndKey, requireApiKey
│   │   ├── options.ts    # parseBoundedIntOption
│   │   └── index.ts      # Barrel export
│   └── *.ts              # Individual command implementations
├── __tests__/            # All test files
│   ├── api/              # API client tests
│   ├── commands/         # Command-level tests
│   ├── config/           # Config tests
│   ├── cli/              # CLI integration tests
│   └── utils/            # Utility tests
├── api.ts                # Thin re-export of api/index.ts
├── config.ts             # Thin re-export of config/index.ts
└── index.ts              # CLI entry point
```

## Test Topology Rules

- All tests must be under `src/__tests__/` directory.
- Top-level inline tests (`src/*.test.ts`) are **disallowed**.
- Test files should mirror the structure of the source they test.

## Contract-Type Policy

- **Shared contract types** must come from `@mdplane/shared` when available.
- **Local-only execution types** (e.g., `*Input`, `*Context`, `*Result`) remain local.
- If a local DTO is unavoidable, suffix with `Local` and add one-line reason comment.

## Non-Negotiables

- CLI must stay compliant with OpenAPI and backend server conventions.
- Do not invent commands, options, endpoint paths, or response fields.
- Prefer shared constants/types from `@mdplane/shared`.
- No development-history narration in command docs/help text.

## Uncertainty Protocol

If command behavior is unclear:

1. Verify route and schema in `packages/shared/openapi/`.
2. Verify server behavior in `apps/server/src/routes/`.
3. Update CLI only after both align.
4. Do not commit guessed behavior.

## Commit Blocker (Strict)

Do not commit CLI changes unless:

- affected routes/params are valid against OpenAPI, and
- behavior is compliant with backend server conventions.

If either condition is unverified, stop and reconcile first.

## Stale Reference Gate

- Help text, docs snippets, and examples must reference real routes.
- Command flags must match actual implementation.

## Definition Of Done

1. CLI behavior matches OpenAPI + server behavior.
2. Tests updated for changed command flows.
3. Related docs (`apps/docs/`, `packages/skills/`) updated when needed.
4. Verification commands pass.

## Verification Commands (From Repo Root)

```bash
pnpm --filter @mdplane/shared generate:check
pnpm --filter @mdplane/shared openapi:lint
pnpm --filter @mdplane/cli typecheck
pnpm --filter @mdplane/cli test
pnpm check:docs-routes
pnpm lint
```

