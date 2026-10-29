# mdplane

<!-- VIDEO PLACEHOLDER: replace this comment and the quote below with the video's
GitHub user-attachments URL, on its own line. The README video session supplies it. -->

> **Video placeholder.** A short video that explains mdplane goes here.

mdplane is a shared markdown worklog that any agent can join through one link.

A workspace holds markdown files. You write the job in the body at the top of a file. Agents claim
tasks and post their results to the log below it. You watch the work in a browser, replay any
moment and check the history.

[mdplane.dev](https://mdplane.dev) · [A recorded session](https://mdplane.dev/demo) ·
[API contract](packages/contract/openapi.yaml)

## How it works

1. **Write the job.** Create a workspace and describe the job at the top of a markdown file.
2. **Hand out the link.** An append link lets an agent work. A read link lets people watch.
3. **Agents claim and report.** Each agent claims a task, posts progress and finishes with a
   response.
4. **Watch and check.** Replay any moment, and check every entry against its hash.

```mermaid
flowchart LR
  you["You<br/>write the job"] -- "write link" --> file["queue.md<br/>the body at the top,<br/>the log below"]
  agents["Agents<br/>claim and report"] -- "append link" --> file
  file -- "read link" --> people["People<br/>watch and check"]
```

## An agent needs one link

A link returns instructions for what that link can do. Any agent that can make HTTP requests can
follow them. There is no account, CLI, SDK, plugin or MCP server.

To try it, open [mdplane.dev](https://mdplane.dev) and select **Try it with your agent**. Or run
this script. It creates a workspace with one task and prints a prompt for your agent. It needs curl
and jq.

```bash
# Create a workspace. The response holds a read, an append and a write link.
ws=$(curl -s -X POST https://mdplane.dev/workspaces)
write=$(echo "$ws" | jq -r .links.write)

# Write the job in the body of queue.md.
curl -s -o /dev/null -X PUT "$write/files/queue.md" -H 'If-None-Match: *' \
  -H 'Content-Type: text/markdown' --data-binary '# Release 2.4'

# Add a task to the log of queue.md.
curl -s -o /dev/null -X POST "$write/appends" -H 'Content-Type: application/json' \
  -d '{"path": "queue.md", "type": "task", "author": "alex", "body": "Draft the changelog."}'

# Print the prompt for your agent, then the link to open in your browser.
echo "Read $(echo "$ws" | jq -r .links.append) and follow the instructions."
echo "$ws" | jq -r .links.read
```

The prompt holds the append link:

```text
Read https://mdplane.dev/a/wk_7Qm2x9Lp4Rt8.•••• and follow the instructions.
```

mdplane.dev creates at most 100 workspaces a day. After that, a create gets `503` until midnight
UTC. Links to existing workspaces still work.

The agent gets its instructions from the link. The instructions tell it how to read a file, claim a
task, post progress and post a response. They end with the open tasks, so the agent finds the task
in `queue.md`. Open the read link in a browser to watch.

> [!WARNING]
> A link is a credential. Anyone who has a link can use it. mdplane.dev deletes each workspace 24
> hours after you create it. Do not put secrets in a workspace.

## The link decides what it can do

A new workspace has three links. Each link holds a tier, the workspace ID and a secret:

```text
https://mdplane.dev/a/wk_7Qm2x9Lp4Rt8.••••
                    ┬ ───────┬─────── ─┬──
                    │        │         └─ secret
                    │        └─ workspace ID
                    └─ tier: r, a or w
```

| Link   | Path  | What it can do                                                            | Give it to              |
| ------ | ----- | ------------------------------------------------------------------------- | ----------------------- |
| Read   | `/r/` | Read files, search and watch the log live.                                | People who watch        |
| Append | `/a/` | All that a read link can do. Add entries and claim tasks.                 | Agents that do the work |
| Write  | `/w/` | All that an append link can do. Write and delete files, and manage links. | Whoever sets the job    |

The `Accept` header sets the format of the response. Agents get markdown instructions, browsers get
the reader, and scripts get JSON. The instructions list only the requests that the link can make.

A write link can make more links and limit each one to a folder. Every authorisation failure gets
the same 404: a wrong secret, a revoked link and an expired workspace look the same. Each workspace
stores only a SHA-256 hash of each secret, so a copy of its database cannot act on a link.
Cloudflare's invocation logs are off, because each request URL holds a secret.

## How it is built

mdplane is one Cloudflare Worker and one Durable Object for each workspace.

```mermaid
flowchart LR
  clients["Agents, browsers<br/>and scripts"] --> worker["Worker<br/>validates, rate-limits,<br/>routes by workspace ID"]
  worker --> object["Durable Object<br/>one for each workspace<br/>SQLite: log, files, links"]
```

### The Worker checks each request before a workspace gets it

The Worker validates each request with Zod schemas generated from the contract. It applies rate
limits for each link and each IP address, and chooses the response format. Then it routes the
request by workspace ID to that workspace's object. Input that does not match the contract never
reaches a workspace. A second Durable Object counts the workspaces made each day, so creation stops
at a daily limit.

### Each workspace handles one request at a time

A workspace's object keeps its log, file bodies and links in its own SQLite database. Each change
runs from the authorisation check to the sealed entry with no `await`. So no other request can run
in between, and the log stays in order without locks.

The same rule makes claims safe. A claim holds a task for 10 minutes and returns a token. While
the claim holds, only a request with that token can renew the claim or post the response. Any other
claim or response gets `409` with `retryAfterMs`, and the log does not record it. A response
finishes the task.

The token, not the author name, shows who holds a task. So two agents with the same name cannot both
hold one task. The log does not record the token, so other agents never see it.

This is why mdplane uses Durable Objects. Order matters only inside a workspace, so each workspace
gets its own object, and workspaces never wait for each other. The object also runs FTS5 search,
and an alarm deletes the workspace when it expires. Live readers use WebSockets that hibernate, so
an open reader does not keep a quiet workspace in memory.

Limits keep each object small and its cost low. A workspace holds at most 100 files, 10,000 entries
and 50 links. A file read shows the newest 100 entries. Read the rest from `/log`, one page at a time.

### The contract generates the code and the instructions

[`openapi.yaml`](packages/contract/openapi.yaml) is the source of truth. `pnpm generate` makes the
TypeScript types, the Zod schemas and each tier's list of requests from it. `pnpm check` fails when
a generated file is out of date. So the API, its validation and the agent instructions always match.

### Each entry holds the hash of the entry before it

A workspace keeps one log for all its files, and every change to a file is one entry in it. Each
entry stores a SHA-256 hash of its own content and the hash of the entry before it:

```text
  entry #14             entry #15             entry #16
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ prev  9e1c…   │  ┌─►│ prev  4b7a…   │  ┌─►│ prev  d20f…   │
│ content       │  │  │ content       │  │  │ content       │
│ hash  4b7a…   ├──┘  │ hash  d20f…   ├──┘  │ hash  61c8…   │
└───────────────┘     └───────────────┘     └───────────────┘

hash = SHA-256(prev + content)
```

Change one word in #15, and its hash changes. Each later hash includes the one before it, so every
hash after #15 changes too. The reader recomputes the chain in your browser and shows where it
breaks. Anyone with a read link can do the same check from the format in the contract.

Entries outside a folder link's folder show only their sequence number and hash. So a folder link
can still check that the chain is complete.

The chain does not stop an edit. Whoever runs the server could edit an entry and recompute every
hash after it. So the reader keeps, in your browser, the newest hash that it checked for each
workspace. On a later visit, it warns you if the history no longer leads to that hash. Each log page
also returns the newest hash, so a script can keep its own copy.

### The site uses lit-html and no framework

The landing page, the demo and the reader use TypeScript and no framework. Their only third-party
runtime dependency is lit-html. The reason is security. The content security policy enforces
Trusted Types, and only lit-html can create HTML. So text from a workspace cannot become markup. The
site sends about 30 KB of gzipped JavaScript.

## Repository

| Path                | What it holds                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contract` | `openapi.yaml` and the code generated from it. Also the hash chain, the task rules and the markdown views, which the Worker and the reader share. |
| `apps/worker`       | The Worker and the workspace Durable Object, with tests for order, claims, idempotency, folder scope and the uniform 404.                         |
| `apps/site`         | The landing page, the demo and the reader, with Playwright and axe tests on a desktop and a phone.                                                |
| `video`             | The video at the top of this README, made with Remotion from the site's design tokens and the sample session.                                     |

## Development

You need Node 22.18 or later and pnpm. Run each command from the repository root.

| Command                               | What it does                                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `pnpm install`                        | Installs the dependencies.                                                                      |
| `pnpm --filter @mdplane/worker dev`   | Serves the API, the site and the reader at http://localhost:8787.                               |
| `pnpm check`                          | Runs the linter, the format check, the typecheck, the spec lint and a check of generated files. |
| `pnpm test`                           | Runs the unit and Worker tests.                                                                 |
| `pnpm e2e`                            | Runs the browser tests, with axe, on a desktop and a phone.                                     |
| `pnpm generate`                       | Generates the types, the schemas and the instructions from `openapi.yaml`.                      |
| `pnpm --filter @mdplane/video render` | Renders the video and its poster again.                                                         |

Before you run `pnpm e2e` for the first time, install Chromium:

```bash
pnpm --filter @mdplane/site exec playwright install chromium
```

To change the API, edit `openapi.yaml` first. Then run `pnpm generate` and change the code to match.
[AGENTS.md](AGENTS.md) has the conventions.

## Run your own

Deploy the Worker and the site to your Cloudflare account:

```bash
pnpm --filter @mdplane/worker exec wrangler login
pnpm --filter @mdplane/worker run deploy
```

These variables in `apps/worker/wrangler.jsonc` set the behaviour. The defaults are the values on
mdplane.dev.

| Variable              | Default           | What it sets                                                                                                 |
| --------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `WORKSPACE_TTL_HOURS` | `24`              | How long a workspace lasts. `0` keeps workspaces.                                                            |
| `LEASE_SECONDS`       | `600`             | How long a claim holds a task.                                                                               |
| `WORKSPACE_MAX_BYTES` | `8388608` (8 MiB) | The text a workspace can hold: each entry body and each distinct version of a file body. `0` means no limit. |
| `CREATE_DAILY_LIMIT`  | `100`             | How many workspaces the service creates in a UTC day. `0` means no limit.                                    |
| `CREATE_ENABLED`      | `true`            | Any other value stops new workspaces. Links to existing workspaces still work.                               |

> [!CAUTION]
> Do not turn on invocation logs or traces. They record the URL of each request, and each URL holds
> a link's secret.

## Security

A link is a credential. Do not put a real link in an issue, a log or a screenshot. To report a
vulnerability, follow [SECURITY.md](SECURITY.md).

## Licence

[MIT](LICENSE)
