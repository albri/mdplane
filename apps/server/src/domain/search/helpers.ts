export function buildFtsQuery(q: string): string {
  const terms = q
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);

  const quoted = terms.map((t) => `"${t.replace(/"/g, '""')}"`);
  return quoted.join(' AND ');
}

export function computeHighlights(content: string, query: string | undefined): Array<{ start: number; end: number }> {
  if (!query || !content) return [];

  const highlights: Array<{ start: number; end: number }> = [];
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();

  let startIndex = 0;
  while (true) {
    const index = lowerContent.indexOf(lowerQuery, startIndex);
    if (index === -1) break;
    highlights.push({ start: index, end: index + query.length });
    startIndex = index + 1;
  }

  return highlights;
}

export function computeScore(content: string, query: string | undefined): number {
  if (!query || !content) return 1.0;

  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();

  let count = 0;
  let startIndex = 0;
  while (true) {
    const index = lowerContent.indexOf(lowerQuery, startIndex);
    if (index === -1) break;
    count++;
    startIndex = index + 1;
  }

  const coverage = (count * query.length) / content.length;
  return Math.min(1.0, 0.5 + coverage);
}

export function extractFolderPath(url: string, endpoint: 'search' | 'tasks'): string {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;

  const foldersIndex = pathname.indexOf('/folders/');
  const endpointIndex = pathname.lastIndexOf(`/${endpoint}`);

  if (foldersIndex === -1 || endpointIndex === -1) return '';

  const folderPath = pathname.substring(foldersIndex + 9, endpointIndex);
  return folderPath;
}

const SYSTEM_PATH_INDICATORS = ['etc', 'passwd', 'shadow', 'hosts', 'root', 'var', 'usr', 'bin', 'proc', 'sys', 'dev'];

export function createTraversalHandler(_prefix: string) {
  return ({ params, set }: { params: Record<string, string>; set: { status: number } }) => {
    const path = params['*'] || params.path || '';
    const firstSegment = path.split('/')[0].toLowerCase();

    if (SYSTEM_PATH_INDICATORS.includes(firstSegment)) {
      set.status = 400;
      return { ok: false, error: { code: 'INVALID_PATH', message: 'Path traversal not allowed' } };
    }

    set.status = 404;
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Resource not found' } };
  };
}

