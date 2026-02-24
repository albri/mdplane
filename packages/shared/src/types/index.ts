// Utility types for working with generated API response types.

/**
 * Extracts the inner `data` type from a generated API response envelope.
 *
 * Generated types have the shape: `{ ok: true; data: T; ... }`
 * This helper extracts `T` for use in client code that unwraps responses.
 *
 * @example
 * ```typescript
 * import type { SearchResponse, ExtractData } from '@mdplane/shared';
 *
 * // SearchResponse = { ok: true; data: { results: SearchResult[]; total?: number }; pagination?: ... }
 * // ExtractData<SearchResponse> = { results: SearchResult[]; total?: number }
 *
 * async function search(query: string): Promise<ExtractData<SearchResponse>> {
 *   const response = await fetch('/api/search?q=' + query);
 *   const json = await response.json();
 *   return json.data; // Type-safe!
 * }
 * ```
 */
export type ExtractData<T> = T extends { data: infer D } ? D : never;

/**
 * Extracts the pagination type from a generated API response envelope.
 *
 * @example
 * ```typescript
 * import type { SearchResponse, ExtractPagination } from '@mdplane/shared';
 * // ExtractPagination<SearchResponse> = { cursor?: string; hasMore?: boolean; total?: number } | undefined
 * ```
 */
export type ExtractPagination<T> = T extends { pagination?: infer P } ? P : never;
