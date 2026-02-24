import { HERO_DESCRIPTION, TAGLINE, URLS } from '@mdplane/shared';

export const revalidate = false;

export async function GET() {
  const lines: string[] = [];

  lines.push('# mdplane');
  lines.push('');
  lines.push(`> ${TAGLINE}`);
  lines.push('');
  lines.push(HERO_DESCRIPTION);
  lines.push('');
  lines.push('## The Problem');
  lines.push('');
  lines.push("AI agents are good at doing work. They're bad at handing it off.");
  lines.push('');
  lines.push(
    "Every agent dumps output somewhere different — Slack threads, GitHub comments, Linear tickets, local files. When you run multiple agents, nobody knows what's been tried, what's blocked, or who's working on what."
  );
  lines.push('');
  lines.push('## The Solution');
  lines.push('');
  lines.push(
    "mdplane keeps workflow state in markdown — one readable file per workflow. Tasks, claims, progress, and handoffs all append to the same timeline. Agents read it, humans read it, everyone's in sync."
  );
  lines.push('');
  lines.push('## Why Markdown?');
  lines.push('');
  lines.push("- Agents already understand it — the format they're most reliable at reading and writing.");
  lines.push('- Human-readable without tooling — inspect and edit the same artifact your agents use.');
  lines.push('- No schema to define — structure emerges from headings and appends.');
  lines.push('');
  lines.push('## How It Works');
  lines.push('');
  lines.push('1. Create a workspace — get three secret URLs (read, append, write).');
  lines.push('2. Agents append entries — tasks, claims, responses become timeline entries.');
  lines.push('3. Read the history — each file becomes an auditable log.');
  lines.push('');
  lines.push('## Start Here');
  lines.push('');
  lines.push(`- [Docs](${URLS.DOCS}/docs): Full walkthrough.`);
  lines.push(`- [Orchestration guide](${URLS.DOCS}/docs/orchestration): Watcher glue and edge cases.`);
  lines.push(`- [Demo workspace](${URLS.APP}/demo): Live read-only example.`);
  lines.push('');
  lines.push('## LLM-Friendly Sources');
  lines.push('');
  lines.push(`- [Docs llms.txt](${URLS.DOCS}/llms.txt): Curated index.`);
  lines.push(`- [Docs llms-full.txt](${URLS.DOCS}/llms-full.txt): Full markdown corpus.`);
  lines.push('');
  lines.push('## Links');
  lines.push('');
  lines.push(`- [GitHub](${URLS.GITHUB}): Source code and issues.`);
  lines.push(`- [Web app](${URLS.APP}): Runtime and control UI.`);
  lines.push(`- [API](${URLS.API}): Capability and authenticated API.`);

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
