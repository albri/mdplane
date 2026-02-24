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
  lines.push(
    'This domain is the runtime and control surface. For implementation details, use docs.mdplane.dev links below.'
  );
  lines.push('');
  lines.push('## Core Workflow Pattern');
  lines.push('1. Bootstrap workspace and keep root keys.');
  lines.push('2. Write one shared markdown workflow file.');
  lines.push('3. Share read URL for context.');
  lines.push('4. Append task events.');
  lines.push('5. Watchers trigger one-shot agents.');
  lines.push('6. Agents append claim and response updates.');
  lines.push('');
  lines.push('## App Entry Points');
  lines.push(`- [Demo workspace](${URLS.APP}/demo): Live PR-review-dispatch style workflow example.`);
  lines.push(`- [Launch](${URLS.APP}/launch): Create and open a workspace quickly.`);
  lines.push(`- [Login](${URLS.APP}/login): Access control-plane actions.`);
  lines.push('');
  lines.push('## Read Before Integrating');
  lines.push(`- [Docs index](${URLS.DOCS}/docs): Start with one complete workflow.`);
  lines.push(
    `- [Orchestration](${URLS.DOCS}/docs/orchestration): Task/claim/response lifecycle plus watcher scripts.`
  );
  lines.push(`- [Access and Auth](${URLS.DOCS}/docs/access-and-auth): URL keys vs API keys vs OAuth.`);
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
