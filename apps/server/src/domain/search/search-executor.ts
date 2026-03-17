import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { appends } from '../../db/schema';
import { createErrorResponse } from '../../core/errors';
import type { SearchResponse, SearchResult, FileReference } from '@mdplane/shared';
import type { ElysiaContextSet } from '../../shared';
import { buildFtsQuery, computeHighlights, computeScore } from './helpers';
import { parseFrontmatter, parseCommaSeparated, hasCommonElements } from './validation';
import { queryFtsTotal, queryFtsResults, type FtsRow } from './search-sql';

export const MAX_FILES_PER_SEARCH = 1000;

type WorkspaceFile = {
  id: string;
  path: string;
  workspaceId: string;
  createdAt: string;
  content?: string;
};

type ExecuteFtsSearchInput = {
  workspaceId: string;
  qString: string;
  scopeParam: string;
  isFileScope: boolean;
  type: string | undefined;
  status: string | undefined;
  author: string | undefined;
  limit: number;
  cursor: string | undefined;
  set: ElysiaContextSet;
};

export function executeFtsSearch({
  workspaceId,
  qString,
  scopeParam,
  isFileScope,
  type,
  status,
  author,
  limit,
  cursor,
  set,
}: ExecuteFtsSearchInput): SearchResponse {
  const ftsQuery = buildFtsQuery(qString);
  const offset = cursor ? parseInt(Buffer.from(cursor, 'base64').toString()) || 0 : 0;

  const total = queryFtsTotal({
    ftsQuery,
    workspaceId,
    scopeParam,
    isFileScope,
    type: type ?? null,
    status: status ?? null,
    author: author ?? null,
  });

  const rows = queryFtsResults({
    ftsQuery,
    workspaceId,
    scopeParam,
    isFileScope,
    type: type ?? null,
    status: status ?? null,
    author: author ?? null,
    limit,
    offset,
  });

  const pageResults = mapFtsRowsToResults(rows, qString);
  const hasMore = offset + limit < total;
  const nextCursor = hasMore ? Buffer.from(String(offset + limit)).toString('base64') : undefined;

  set.status = 200;
  return {
    ok: true,
    data: { results: pageResults, total },
    pagination: { cursor: nextCursor, hasMore },
  };
}

function mapFtsRowsToResults(rows: FtsRow[], qString: string): SearchResult[] {
  return rows.map((row) => {
    const rawRank = typeof row.rank === 'number' ? Math.abs(row.rank) : 0;
    const score = Math.max(0, Math.min(1, 1 / (1 + rawRank)));

    return {
      type: row.kind,
      id: row.result_id,
      file: { id: row.file_id, path: row.file_path },
      content: row.content,
      highlights: computeHighlights(row.content, qString),
      score,
      status: row.status || undefined,
      author: row.author || undefined,
      createdAt: row.created_at || undefined,
    };
  });
}

type ExecuteFallbackSearchInput = {
  files: WorkspaceFile[];
  q: string | undefined;
  type: string | undefined;
  status: string | undefined;
  author: string | undefined;
  limit: number;
  cursor: string | undefined;
  set: ElysiaContextSet;
  frontmatterFilters?: Record<string, string[]>;
  hasCustomFrontmatter?: boolean;
};

export async function executeFallbackSearch({
  files: scopeFiles,
  q,
  type,
  status,
  author,
  limit,
  cursor,
  set,
  frontmatterFilters,
  hasCustomFrontmatter,
}: ExecuteFallbackSearchInput): Promise<SearchResponse> {
  const results: SearchResult[] = [];
  const hasFrontmatterFilters = frontmatterFilters && Object.keys(frontmatterFilters).length > 0;

  for (const file of scopeFiles) {
    const fileRef: FileReference = { id: file.id, path: file.path };

    if (hasFrontmatterFilters && file.content) {
      const fileFrontmatter = parseFrontmatter(file.content);
      let matches = true;

      for (const [field, values] of Object.entries(frontmatterFilters!)) {
        const fieldValue = fileFrontmatter[field];
        if (!fieldValue) { matches = false; break; }
        if (Array.isArray(fieldValue)) {
          if (!hasCommonElements(values, fieldValue as string[])) { matches = false; break; }
        } else if (!values.includes(String(fieldValue))) { matches = false; break; }
      }

      if (!matches) continue;

      results.push({
        type: 'file',
        id: file.id,
        file: fileRef,
        content: file.content.substring(0, 200),
        highlights: [],
        score: 1.0,
        frontmatter: fileFrontmatter,
      });
    }

    const fileAppends = await db.query.appends.findMany({ where: eq(appends.fileId, file.id) });

    for (const append of fileAppends) {
      if (type && append.type !== type) continue;
      if (status && append.status !== status) continue;
      if (author && append.author !== author) continue;
      if (q && !append.contentPreview?.toLowerCase().includes(q.toLowerCase())) continue;

      const resultType: SearchResult['type'] = append.type === 'task' ? 'task' : 'append';
      results.push({
        type: resultType,
        id: append.appendId,
        file: fileRef,
        content: append.contentPreview || '',
        highlights: computeHighlights(append.contentPreview || '', q),
        score: computeScore(append.contentPreview || '', q),
        status: append.status || undefined,
        author: append.author || undefined,
        createdAt: append.createdAt,
      });
    }
  }

  return paginateResults({ results, limit, cursor, set, hasCustomFrontmatter });
}

type PaginateResultsInput = {
  results: SearchResult[];
  limit: number;
  cursor: string | undefined;
  set: ElysiaContextSet;
  hasCustomFrontmatter?: boolean;
};

function paginateResults({
  results,
  limit,
  cursor,
  set,
  hasCustomFrontmatter,
}: PaginateResultsInput): SearchResponse {
  const startIndex = cursor ? parseInt(Buffer.from(cursor, 'base64').toString()) || 0 : 0;
  const paginatedResults = results.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < results.length;
  const nextCursor = hasMore ? Buffer.from(String(startIndex + limit)).toString('base64') : undefined;

  if (hasCustomFrontmatter) {
    set.headers['X-RateLimit-Remaining'] = '19';
    set.headers['X-RateLimit-Limit'] = '20';
  }

  set.status = 200;
  return {
    ok: true,
    data: { results: paginatedResults, total: results.length },
    pagination: { cursor: nextCursor, hasMore },
  };
}

