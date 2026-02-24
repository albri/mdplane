import { sqlite } from '../../db';

export type FtsRow = {
  kind: 'file' | 'append' | 'task';
  file_id: string;
  file_path: string;
  result_id: string;
  content: string;
  author: string | null;
  status: string | null;
  created_at: string | null;
  rank: number | null;
};

type FtsCountParams = {
  ftsQuery: string;
  workspaceId: string;
  scopeParam: string;
  isFileScope: boolean;
  type: string | null;
  status: string | null;
  author: string | null;
};

export function queryFtsTotal({
  ftsQuery,
  workspaceId,
  scopeParam,
  isFileScope,
  type,
  status,
  author,
}: FtsCountParams): number {
  const fileScopeClause = isFileScope ? 'f.path = ?' : 'f.path LIKE ?';

  const row = sqlite
    .query<{ total: number }, [string, string, string, string, string, string, string | null, string | null, string | null, string | null, string | null, string | null]>(
      `SELECT
        (
          SELECT count(1)
          FROM files_fts
          JOIN files f ON f.rowid = files_fts.rowid
          WHERE files_fts MATCH ?
            AND f.workspace_id = ?
            AND f.deleted_at IS NULL
            AND ${fileScopeClause}
        ) + (
          SELECT count(1)
          FROM appends_fts
          JOIN appends a ON a.rowid = appends_fts.rowid
          JOIN files f ON f.id = a.file_id
          WHERE appends_fts MATCH ?
            AND f.workspace_id = ?
            AND f.deleted_at IS NULL
            AND ${fileScopeClause}
            AND (? IS NULL OR a.type = ?)
            AND (? IS NULL OR a.status = ?)
            AND (? IS NULL OR a.author = ?)
        ) AS total;`
    )
    .get(
      ftsQuery, workspaceId, scopeParam,
      ftsQuery, workspaceId, scopeParam,
      type, type, status, status, author, author
    );

  return row?.total ?? 0;
}

type FtsSearchParams = FtsCountParams & {
  limit: number;
  offset: number;
};

export function queryFtsResults({
  ftsQuery,
  workspaceId,
  scopeParam,
  isFileScope,
  type,
  status,
  author,
  limit,
  offset,
}: FtsSearchParams): FtsRow[] {
  const fileScopeClause = isFileScope ? 'f.path = ?' : 'f.path LIKE ?';

  return sqlite
    .query<FtsRow, [string, string, string, string, string, string, string | null, string | null, string | null, string | null, string | null, string | null, number, number]>(
      `SELECT
        'file' AS kind,
        f.id AS file_id,
        f.path AS file_path,
        f.id AS result_id,
        snippet(files_fts, 0, '', '', '...', 16) AS content,
        NULL AS author,
        NULL AS status,
        f.created_at AS created_at,
        bm25(files_fts) AS rank
      FROM files_fts
      JOIN files f ON f.rowid = files_fts.rowid
      WHERE files_fts MATCH ?
        AND f.workspace_id = ?
        AND f.deleted_at IS NULL
        AND ${fileScopeClause}

      UNION ALL

      SELECT
        CASE WHEN a.type = 'task' THEN 'task' ELSE 'append' END AS kind,
        f.id AS file_id,
        f.path AS file_path,
        a.append_id AS result_id,
        coalesce(a.content_preview, '') AS content,
        a.author AS author,
        a.status AS status,
        a.created_at AS created_at,
        bm25(appends_fts) AS rank
      FROM appends_fts
      JOIN appends a ON a.rowid = appends_fts.rowid
      JOIN files f ON f.id = a.file_id
      WHERE appends_fts MATCH ?
        AND f.workspace_id = ?
        AND f.deleted_at IS NULL
        AND ${fileScopeClause}
        AND (? IS NULL OR a.type = ?)
        AND (? IS NULL OR a.status = ?)
        AND (? IS NULL OR a.author = ?)

      ORDER BY rank ASC
      LIMIT ? OFFSET ?;`
    )
    .all(
      ftsQuery, workspaceId, scopeParam,
      ftsQuery, workspaceId, scopeParam,
      type, type, status, status, author, author,
      limit, offset
    );
}

