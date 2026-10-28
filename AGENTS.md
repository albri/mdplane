# AGENTS.md

mdplane is a shared markdown worklog that agents join through one URL. It runs
as a Cloudflare Worker with one Durable Object per workspace: the Worker
validates and routes each request, and the workspace's object owns its log,
files and links in SQLite. Each object handles one request at a time, which is
what keeps appends ordered and claims safe without locks.

## Layout

- `packages/contract`: the API contract. `openapi.yaml` is the source of truth.
  The types, Zod schemas and agent instructions in `src/generated/` are
  generated from it. `src/chain.ts` implements the hash chain, `src/tasks.ts`
  derives task status and `src/render.ts` renders the markdown views; the
  Worker and the reader share all three. Browser code imports
  `@mdplane/contract/core`, which leaves out Zod.
- `apps/worker`: the Worker. `src/index.ts` routes and validates requests,
  and `src/workspace.ts` is the Durable Object that owns a workspace's state.
  `worker-configuration.d.ts` is generated from `wrangler.jsonc` by
  `pnpm --filter @mdplane/worker types`.
- `apps/site`: the landing page and the reader, as HTML, CSS and TypeScript.
  `pnpm build` bundles it into `dist/`, which the Worker serves as static
  assets. A browser opening a link gets `reader.html`, which reads the key from
  its own URL.

## Commands

Run from the repository root, with Node 22.18 or later and pnpm.

- `pnpm generate` regenerates everything derived from `openapi.yaml`.
- `pnpm check` runs oxlint (type-aware), the oxfmt format check, the
  TypeScript typecheck, the spec lint, and a check that generated files are
  current.
- `pnpm test` runs the tests.
- `pnpm format` formats the code.
- `pnpm build` builds the site. The Worker's `dev` and `deploy` build it first.
- `pnpm --filter @mdplane/worker dev` runs the Worker and the site locally.

## Changing the API

1. Edit `packages/contract/openapi.yaml` first, including its examples.
2. Run `pnpm generate` and commit the generated files with the spec.
3. Update the implementation to match.

The agent instructions come from the spec and `src/instructions.md`. Don't
write them by hand.

## Conventions

- Node runs TypeScript directly, so scripts are `.ts` with no build step. Use
  only erasable syntax: no enums or namespaces.
- `packages/contract` keeps TypeScript 6 because the code generator needs its
  JavaScript API. Everything is typechecked with TypeScript 7.
- Validate input at the boundary with the generated Zod schemas. Don't
  hand-write request or response types.
- In the Durable Object, keep each change synchronous from authorisation to
  the sealed entry. An `await` in between lets another request interleave.
- Write tests that fail when behaviour breaks: ordering, leases, idempotency,
  link scope, the hash chain. Skip tests that restate the implementation.
- Comments say why, not what.
- Commit subjects are short imperative sentences, without prefixes.

## Security

- A capability URL is a credential. Never put a real one in code, tests, docs,
  logs or screenshots; examples use made-up keys.
- Every authorisation failure returns the same 404, so keys can't be probed.
- Text in a workspace comes from whoever holds a link, so the reader escapes
  it before rendering. Pages load nothing from other origins and never show a
  link's secret on screen.
- Never commit credentials, account identifiers or connection details. Before
  infrastructure work, check the live state with the provider instead of
  inferring it from config or Git history.
