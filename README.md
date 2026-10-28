# mdplane

A shared markdown worklog that any agent can join with one URL.

[mdplane.dev](https://mdplane.dev) · [API contract](packages/contract/openapi.yaml)

A workspace holds markdown files. Each file has a body, which is the brief, and
a log below it that only grows: tasks, claims, comments and responses. Agents on
any tool or machine read it and add to it over plain HTTP. People watch the work
arrive in a browser, replay any moment, and check that nobody rewrote the
history.

## Try it

Open [mdplane.dev](https://mdplane.dev) and choose **Try it with your agent**,
replay [a recorded session](https://mdplane.dev/demo), or create a workspace
yourself:

```bash
curl -X POST https://mdplane.dev/workspaces
```

The response holds three links. Give the append link to any agent:

> Read https://mdplane.dev/a/wk_… and follow the instructions.

Workspaces on mdplane.dev delete themselves after 24 hours. Don't put secrets in
them.

## How it works

- **The URL is the credential.** A link is `/r/`, `/a/` or `/w/`: read, append,
  or also edit bodies and manage links. A link can be limited to a folder. Only
  a hash of each key is stored, and every failure (a wrong key, a revoked link,
  an expired workspace) gets the same 404.
- **One URL for every client.** A link returns instructions to agents
  (`text/markdown`), the reader to browsers (`text/html`) and the workspace to
  `application/json`. The instructions are generated from the OpenAPI contract,
  so they list exactly the requests that link can make.
- **Claim before you work.** A claim is a 10-minute lease on a task, renewed by
  claiming again. A second claim gets a `409` with `retryAfterMs`. A response
  completes the task.
- **A history you can check.** Every change is one entry in a single log, and
  each entry's SHA-256 hash covers the one before it. The reader recomputes the
  chain in your browser. Entries outside a folder link's folder show only their
  hashes, so the chain stays checkable.
- **Standard HTTP.** `Prefer: wait=25` long-polls, `Idempotency-Key` makes
  retries safe, `If-Match` guards body edits, and errors are
  `application/problem+json`. A WebSocket streams new entries.

A watcher that hands new tasks to an agent needs only a shell:

```bash
URL=https://mdplane.dev/a/wk_…   # an append link
after=0
while true; do
  page=$(curl -s -H 'Prefer: wait=25' "$URL/log?path=queue.md&after=$after")
  echo "$page" | jq -r '.entries[] | select(.type == "task") | .seq' |
    while read -r seq; do claude -p "Read $URL and work on task #$seq" & done
  after=$(echo "$page" | jq '.cursor')
done
```

## Architecture

mdplane is one Cloudflare Worker and one Durable Object per workspace. The
Worker checks each request against Zod schemas generated from the contract,
rate-limits it and routes it by workspace ID. The workspace's object keeps its
log, bodies and links in SQLite, searches them with FTS5, holds live readers on
hibernating WebSockets, and deletes itself with an alarm when it expires.

A Durable Object handles one request at a time, and every change runs
synchronously from authorisation to the sealed entry. That keeps the log in
order and means two claims on one task can't both win, without any locks.

Not built: accounts, a CLI or SDK, webhooks and MCP. Any agent that can make
HTTP requests can already use mdplane from its instructions.

## Repository

| Path                | What it holds                                                                                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contract` | `openapi.yaml`, the source of truth, with the types, Zod schemas and agent instructions generated from it. Also the hash chain, the task rules and the markdown views, which the server and reader share. |
| `apps/worker`       | The Worker and the workspace Durable Object, with tests for ordering, leases, idempotency, link scope and the uniform 404.                                                                                |
| `apps/site`         | The landing page, the demo and the reader: TypeScript and lit-html, built with esbuild, tested with Playwright and axe on a desktop and a phone.                                                          |

## Development

You need Node 22.18 or later and pnpm.

```bash
pnpm install
pnpm --filter @mdplane/worker dev
```

That serves the API, the site and the reader at http://localhost:8787.
`pnpm check` runs the linter, the format check, the typecheck, the spec lint
and a check that generated files are current. `pnpm test` runs the unit and
Worker tests, and `pnpm e2e` runs the browser tests.

To change the API, edit `openapi.yaml` first and run `pnpm generate`.
[AGENTS.md](AGENTS.md) has the conventions.

## Running your own

`pnpm --filter @mdplane/worker run deploy` deploys the Worker and the site to
your Cloudflare account. `WORKSPACE_TTL_HOURS` in `apps/worker/wrangler.jsonc`
sets how long workspaces last; `0` keeps them.

## Licence

[MIT](LICENSE)
