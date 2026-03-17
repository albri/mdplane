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
  lines.push('mdplane is the shared worklog for agent workflows.');
  lines.push('');
  lines.push('## The Problem');
  lines.push('');
  lines.push(
    'Agent workflows fragment across chat threads, terminal output, local files, and framework state. mdplane gives that work one shared, readable timeline.'
  );
  lines.push('');
  lines.push('## The Solution');
  lines.push('');
  lines.push(
    'Agents coordinate by reading and appending to markdown files in a shared workspace. Watchers react to mdplane events and spawn one-off agent runs.'
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
  lines.push('1. Create a workspace — get three secret URLs (read, append, write), and save them locally in a gitignored JSON file for future agent runs.');
  lines.push('2. Agents append entries — tasks, claims, responses become timeline entries.');
  lines.push('3. Read the history — each file becomes an auditable log.');
  lines.push('');
  lines.push('## Start Here');
  lines.push('');
  lines.push(`- [Docs](${URLS.DOCS}/docs): Full walkthrough.`);
  lines.push(`- [Events and watchers](${URLS.DOCS}/docs/events-and-watchers): Watcher glue, one-off agent spawning, and event handling.`);
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
