# Server Testing Topology

This document defines where server tests belong and what each test layer is responsible for.

## Test Layers

| Layer | Location | Purpose |
| --- | --- | --- |
| Unit/component | `apps/server/src/**/__tests__/` | Validate route, domain, shared, lib, services, and job modules in isolation. |
| Integration | `apps/server/src/integration-tests/tests/` | Validate real HTTP behavior against a local server process and file-backed test DB. |
| Scenario | `apps/server/tests/scenarios/` | Validate cross-route workflows and behavioral contracts from an API consumer view. |
| Contract | `apps/server/tests/contract/` | Contract-specific assets/tests for schema and operation coverage. |
| Test helpers | `apps/server/tests/helpers/` | Shared testing utilities and helper-only unit tests. |
| Policy checks | `apps/server/tests/*.test.ts` | Repository policy tests (for example, fixture drift guards). |

## Placement Rules

1. Route/domain/module unit tests must be colocated in `src/**/__tests__/`.
2. Integration tests must stay under `src/integration-tests/tests/`.
3. Cross-route behavior tests must stay under `tests/scenarios/`.
4. Contract tests and artifacts must stay under `tests/contract/`.
5. Test helper utilities belong in `tests/helpers/`; helper-only tests are allowed there.
6. New `*.test.ts` files outside these locations are not allowed.

## Enforcement

Keep test placement aligned with these conventions during review. New topology drift should be corrected in the same change.
