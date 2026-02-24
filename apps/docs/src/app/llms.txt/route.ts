import { source } from '@/lib/source';
import type { InferPageType } from 'fumadocs-core/source';
import { HERO_DESCRIPTION, TAGLINE } from '@mdplane/shared';

export const revalidate = false;

type DocsPage = InferPageType<typeof source>;

const DOCS_BASE_URL = stripTrailingSlash(process.env.NEXT_PUBLIC_DOCS_URL ?? 'https://docs.mdplane.dev');
const LANDING_BASE_URL = stripTrailingSlash(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mdplane.dev');
const APP_BASE_URL = stripTrailingSlash(process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.mdplane.dev');
const GITHUB_URL = 'https://github.com/albri/mdplane';

interface OpenApiFrontmatter {
  structuredData?: {
    contents?: Array<{
      content?: string | null;
    } | null> | null;
  } | null;
}

interface PageDataWithOptionalSummary {
  description?: string | null;
  _openapi?: OpenApiFrontmatter | null;
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function toAbsoluteUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `${DOCS_BASE_URL}${url}`;
}

function normalizeSummary(value: string | null | undefined): string | null {
  if (value == null) return null;
  const summary = value.replace(/\s+/g, ' ').trim();
  if (summary.length === 0) return null;
  if (summary.toLowerCase() === 'undefined') return null;
  return summary;
}

function truncateSummary(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

function makeConciseSummary(value: string | null): string | null {
  if (value == null) return null;
  const firstSentence = value.match(/^[^.!?]+[.!?]/)?.[0] ?? value;
  return truncateSummary(firstSentence, 180);
}

function getPageSummary(page: DocsPage): string | null {
  const data = page.data as DocsPage['data'] & PageDataWithOptionalSummary;
  const explicitDescription = makeConciseSummary(normalizeSummary(data.description));
  if (explicitDescription != null) {
    return explicitDescription;
  }

  const openApiSummary = makeConciseSummary(
    normalizeSummary(data._openapi?.structuredData?.contents?.[0]?.content)
  );
  if (openApiSummary != null) {
    return openApiSummary;
  }

  return null;
}

function formatPageLink(page: DocsPage): string {
  const title = normalizeSummary(page.data.title) ?? page.url;
  const summary = getPageSummary(page);
  const absoluteUrl = toAbsoluteUrl(page.url);

  if (summary == null) {
    return `- [${title}](${absoluteUrl})`;
  }

  return `- [${title}](${absoluteUrl}): ${summary}`;
}

function byUrl(a: DocsPage, b: DocsPage): number {
  return a.url.localeCompare(b.url);
}

export async function GET() {
  const allPages = source.getPages();
  const corePages = allPages
    .filter((page) => !page.url.startsWith('/docs/api-reference'))
    .sort(byUrl);
  const apiPages = allPages
    .filter((page) => page.url.startsWith('/docs/api-reference'))
    .sort(byUrl);

  const lines: string[] = [];
  lines.push('# mdplane docs');
  lines.push('');
  lines.push(`> ${TAGLINE}`);
  lines.push('');
  lines.push(HERO_DESCRIPTION);
  lines.push('');
  lines.push('## Core Workflow Pattern');
  lines.push('1. Bootstrap workspace and keep read/append/write keys.');
  lines.push('2. Write one shared markdown workflow file.');
  lines.push('3. Share read URL for context.');
  lines.push('4. Append task events.');
  lines.push('5. Watcher starts one-shot agents.');
  lines.push('6. Agents append claim and response updates.');
  lines.push('');
  lines.push('## Start Here');
  lines.push(
    `- [Docs index](${DOCS_BASE_URL}/docs): One workflow in five minutes, then deeper docs.`
  );
  lines.push(
    `- [What is mdplane](${DOCS_BASE_URL}/docs): Conceptual model and philosophy for shared markdown workflows.`
  );
  lines.push(
    `- [Orchestration](${DOCS_BASE_URL}/docs/orchestration): Task -> claim -> response flow, including watcher glue.`
  );
  lines.push(
    `- [Access and Auth](${DOCS_BASE_URL}/docs/access-and-auth): Choose URL keys, API keys, or OAuth by workflow role.`
  );
  lines.push('');
  lines.push('## Core Docs Pages');
  for (const page of corePages) {
    lines.push(formatPageLink(page));
  }
  lines.push('');
  lines.push('## API Reference Pages');
  for (const page of apiPages) {
    lines.push(formatPageLink(page));
  }
  lines.push('');
  lines.push('## Related mdplane Sources');
  lines.push(`- [Landing llms.txt](${LANDING_BASE_URL}/llms.txt): Product story and entry points.`);
  lines.push(`- [App llms.txt](${APP_BASE_URL}/llms.txt): Runtime/control surface map.`);
  lines.push(`- [Docs llms-full.txt](${DOCS_BASE_URL}/llms-full.txt): Full markdown corpus.`);
  lines.push(`- [Repository](${GITHUB_URL}): Source code and implementation details.`);

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
