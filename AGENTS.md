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
- `apps/site`: the landing page, `/demo` and the reader. Pages are templates
  in `src/pages/`; `{{> name}}` includes a partial and `{{file}}` becomes the
  hashed URL of a built file. Styles are in `src/styles/`, one cascade layer
  per concern. `src/reader.ts` is the reader component, rendered with
  lit-html. `pnpm build` bundles everything into `dist/`, which the Worker
  serves as static assets, with `public/` copied as it is. A browser opening a
  link gets `reader.html`, which reads the key from its own URL.
- `video`: the film at the top of the README, made with Remotion from the
  site's tokens and sample session. `pnpm --filter @mdplane/video render`
  re-renders it; `video/README.md` explains the rest.

## Commands

Run from the repository root, with Node 22.18 or later and pnpm.

- `pnpm generate` regenerates everything derived from `openapi.yaml`.
- `pnpm check` runs oxlint (type-aware), the oxfmt format check, the
  TypeScript typecheck, the spec lint, a check that generated files are
  current, and the JavaScript budget: it builds the site and fails if `/`,
  `/demo` or the reader sends more gzipped JavaScript than `apps/site/budget.ts`
  allows. The README's size claim depends on it.
- `pnpm test` runs the unit and Worker tests.
- `pnpm e2e` runs the Playwright tests, with axe, against `wrangler dev` in
  Chromium, WebKit and Firefox, on desktops and phones. Install the browsers
  once with `pnpm --filter @mdplane/site exec playwright install chromium webkit firefox`.
  `pnpm e2e --project=desktop` runs one of them.
- `pnpm format` formats the code.
- `pnpm build` builds the site. The Worker's `dev` and `deploy` build it first.
- `pnpm --filter @mdplane/worker dev` runs the Worker and the site locally.
- `pnpm --filter @mdplane/worker run deploy` deploys the preview Worker with no
  public URL, because it shares the account with mdplane.dev and workers.dev is
  outside the zone's rate-limiting rule.
- `pnpm --filter @mdplane/worker run deploy:open` deploys the same Worker with
  its workers.dev URL on, for a test. Run `deploy` when the test is done, to
  take the URL off again.
- mdplane.dev is the `production` environment in `wrangler.jsonc`. Only CI
  deploys it, after a reviewer approves, so never pass `--env production`
  yourself.
- `node apps/site/monitor.ts <base URL>` checks a live deployment end to end
  and prints statuses only. The scheduled "Production check" workflow runs it
  against mdplane.dev once the `PROD_MONITOR` repository variable is `true`.
  Each run makes one workspace.

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
- In the site, render with lit-html and never assign HTML strings: the
  content security policy enforces Trusted Types, and only lit-html may create
  HTML. Set dynamic styles through the CSSOM (`cssProps()`), never a `style`
  attribute.
- Keep the site accessible: `pnpm e2e` fails on any axe finding and on any
  console error.
- Comments say why, not what.
- Commit subjects are short imperative sentences, without prefixes.

## Security

- A capability URL is a credential. Never put a real one in code, tests, docs,
  logs or screenshots; examples use made-up keys.
- Every authorisation failure returns the same 404, so keys can't be probed.
- Text in a workspace comes from whoever holds a link. The reader parses
  markdown into nodes and lit-html escapes every string; links keep only
  http(s), root-relative and fragment targets. Pages load nothing from other
  origins and never show a link's secret on screen.
- The security headers live in two places: `apps/site/public/_headers` for
  static pages and `PAGE_HEADERS` in the Worker for the pages it serves. Change
  both; an e2e test checks they match.
- Never commit credentials, account identifiers or connection details. Before
  infrastructure work, check the live state with the provider instead of
  inferring it from config or Git history.
