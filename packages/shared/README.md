# @mdplane/shared

Shared types and Zod schemas for the mdplane API. **All types are generated from the OpenAPI spec.**

## Fresh Clone Setup

Run from repository root:

```bash
pnpm install
pnpm --filter @mdplane/shared build
```

Build this package before running app-level builds that import `@mdplane/shared` (for example `@mdplane/server`, `@mdplane/web`, and `@mdplane/landing`).

## Usage

### Types

All API types are auto-generated from the OpenAPI spec:

```typescript
import type {
  Append,
  AppendType,
  AppendRequest,
  CapabilityUrls,
  BootstrapRequest,
  BootstrapResponse,
  FileReadResponse,
  Error,
} from '@mdplane/shared';
```

### Zod Schemas

Runtime validation schemas are auto-generated with `z` prefix:

```typescript
import {
  zAppend,
  zAppendType,
  zAppendRequest,
  zCapabilityUrls,
  zBootstrapRequest,
  zError,
} from '@mdplane/shared';

// Validate request body
const result = zAppendRequest.safeParse(requestBody);
if (!result.success) {
  console.error(result.error);
}
```

### Custom Key Pattern Schemas

These schemas validate capability key formats and are **NOT** in the OpenAPI spec:

```typescript
import {
  rootCapabilityKeySchema,  // Base62, 22+ chars
  scopedKeySchema,          // r_/a_/w_ prefixed
  apiKeySchema,             // sk_live_/sk_test_ prefixed
} from '@mdplane/shared';
```

## Package Structure

```
packages/shared/src/
├── index.ts                     # Main exports
├── generated/
│   ├── api.types.ts             # OpenAPI paths/operations types
│   └── client/
│       ├── types.gen.ts         # Generated TypeScript types
│       └── zod.gen.ts           # Generated Zod schemas
└── schemas/
    └── index.ts                 # Custom key pattern schemas only
```

## Regenerating Types

Types are generated from the OpenAPI spec:

```bash
pnpm --filter @mdplane/shared generate
```
