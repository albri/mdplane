/**
 * HTTP request utilities for API client.
 * Provides header construction, request wrapper, and fetch error mapping.
 */
import type { ApiClientOptions } from './types.js';

/** Generic API response envelope */
export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Builds HTTP headers for API requests.
 * @param options - Client configuration with auth credentials
 * @param extra - Additional headers to merge
 * @returns Headers object ready for fetch
 */
export function buildHeaders(
  options: Pick<ApiClientOptions, 'apiKey' | 'sessionToken'>,
  extra: Record<string, string> = {}
): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  if (options.apiKey != null && options.apiKey !== '') {
    h.Authorization = `Bearer ${options.apiKey}`;
  } else if (options.sessionToken != null && options.sessionToken !== '') {
    h.Cookie = `session=${options.sessionToken}`;
  }
  return h;
}

export interface ApiRequestOptions {
  baseUrl: string;
  auth: Pick<ApiClientOptions, 'apiKey' | 'sessionToken'>;
  method: string;
  path: string;
  body?: unknown;
  extraHeaders?: Record<string, string>;
}
export async function apiRequest<T>(opts: ApiRequestOptions): Promise<T> {
  const url = `${opts.baseUrl}${opts.path}`;
  const requestOptions: RequestInit = {
    method: opts.method,
    headers: buildHeaders(opts.auth, opts.extraHeaders ?? {}),
  };
  if (opts.body != null) {
    requestOptions.body = JSON.stringify(opts.body);
  }

  const response = await fetch(url, requestOptions);
  const json = (await response.json()) as ApiResponse<T>;

  if (!json.ok || json.data == null) {
    if (response.status === 412) {
      throw new Error(
        json.error?.message ?? 'Conflict: File was modified by another process. Use --force to override.'
      );
    }
    throw new Error(json.error?.message ?? `Request failed: ${response.status.toString()}`);
  }

  return json.data;
}

