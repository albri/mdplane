import { HERO_DESCRIPTION, TAGLINE, URLS } from '@mdplane/shared';

export const revalidate = false;

export async function GET() {
  const lines: string[] = [];

  lines.push('# mdplane app');
  lines.push('');
  lines.push(`> ${TAGLINE}`);
  lines.push('');
  lines.push(HERO_DESCRIPTION);
  lines.push('');
  lines.push('mdplane is the shared worklog for agent workflows.');
  lines.push('');
  lines.push(
    'This domain is the runtime and control surface. For implementation details, use docs.mdplane.dev links below.'
  );
  lines.push('');
  lines.push('## Core Workflow Pattern');
  lines.push('1. Bootstrap a workspace and save the returned capability URLs locally in a gitignored JSON file.');
  lines.push('2. Write one shared markdown workflow file.');
  lines.push('3. Share the read URL for visibility.');
  lines.push('4. Append tasks, claims, blockers, answers, and responses to the file.');
  lines.push('5. Let your watcher react through polling, WebSockets, or webhooks.');
  lines.push('6. Spawn one-off agent runs that read the file, do the work, and append the result.');
  lines.push('');
  lines.push('## App Entry Points');
  lines.push(`- [Demo workspace](${URLS.APP}/demo): Live PR-review-dispatch style workflow example.`);
  lines.push(`- [Login](${URLS.APP}/login): Access control-plane actions.`);
  lines.push(`- Workspace viewer: If you have a read key, visit ${URLS.APP}/r/{readKey} to inspect the workspace timeline, files, and orchestration view in the browser.`);
  lines.push('- Control plane: If your workspace is claimed, use the control surface for API keys, ownership, exports, and governance settings.');
  lines.push('');
  lines.push('## Read Before Integrating');
  lines.push(`- [Docs index](${URLS.DOCS}/docs): Start with one complete workflow.`);
  lines.push(
    `- [Coordination protocol](${URLS.DOCS}/docs/coordination-protocol): Task, claim, blocked, answer, and response lifecycle.`
  );
  lines.push(`- [Access and Auth](${URLS.DOCS}/docs/access-and-auth): Capability URLs vs API keys vs OAuth.`);
  lines.push(`- [API reference](${URLS.DOCS}/docs/api-reference): Endpoint-by-endpoint details.`);
  lines.push('');
  lines.push('## LLM-Friendly Sources');
  lines.push(`- [Docs llms.txt](${URLS.DOCS}/llms.txt): Curated docs links for traversal.`);
  lines.push(`- [Docs llms-full.txt](${URLS.DOCS}/llms-full.txt): Full markdown corpus.`);
  lines.push('');
  lines.push('## Project');
  lines.push(`- [Landing](${URLS.LANDING}): Product story and overview.`);
  lines.push(`- [API base](${URLS.API}): API host for app operations.`);
  lines.push(`- [GitHub repository](${URLS.GITHUB}): Source code and implementation details.`);

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
