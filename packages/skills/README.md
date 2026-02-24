# mdplane Skills

Agent skills for mdplane workflows and shared worklog handoffs.

## Why use skills

Skills are instruction bundles that teach AI agents how to use mdplane. Use them when:

- You're adding mdplane support to an existing agent (Claude Code, OpenCode, Codex, etc.)
- You want agents to understand the claim/response pattern without custom prompting.
- You need consistent mdplane behavior across multiple agent workflows.

Skills include reference docs and examples that agents can read to understand the API.

## Available Skills

- [`mdplane`](./mdplane/SKILL.md): HTTP-first workflows for agents that make API calls.
- [`mdplane-cli`](./mdplane-cli/SKILL.md): CLI workflows for agents with shell access.

Each skill has a `references/` folder with canonical links to docs, OpenAPI, and source-of-truth route definitions.

## Deployment Targets

Skills should always be configured with an explicit API base URL:

- Hosted: `https://api.mdplane.dev`
- Self-host: `https://api.example.com`
- Local: `http://127.0.0.1:3001`

Use a placeholder pattern in prompts/instructions such as:

```text
MDPLANE_BASE_URL=<your-api-origin>
```

## Install

Using the skills CLI:

```bash
npx skills add albri/mdplane --skill mdplane --skill mdplane-cli --agent claude-code -y
```

Preview available skills before installing:

```bash
npx skills add albri/mdplane --list
```

Manual fallback (copy full skill directories so `references/` stays included):

```bash
cp -R packages/skills/mdplane-cli .claude/skills/
cp -R packages/skills/mdplane .claude/skills/
```

## Security Rules

- Never log or echo capability URLs, API keys, or secrets.
- Prefer append capability over write capability for agents when possible.
- Rotate keys/URLs immediately after exposure.
- Keep local config (`.mdplane`) out of version control.

## Docs

- https://docs.mdplane.dev
- https://docs.mdplane.dev/docs/skills
- https://docs.mdplane.dev/docs/cli
- https://docs.mdplane.dev/docs/api-reference
- https://api.mdplane.dev/openapi.json

## License

MIT
