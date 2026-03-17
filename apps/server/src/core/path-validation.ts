import type { ErrorCode } from './errors';

export interface PathValidationError {
  code: ErrorCode;
  message: string;
}

export const LIMITS = {
  PATH_MAX_LENGTH: 1024,
  FILENAME_MAX_LENGTH: 255,
};

export function validatePath(path: string): PathValidationError | null {
  // Check path length limit
  if (path.length > LIMITS.PATH_MAX_LENGTH) {
    return { code: 'INVALID_PATH', message: `Path exceeds maximum length of ${LIMITS.PATH_MAX_LENGTH} characters` };
  }

  // Decode URL encoding first for proper checking
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // Invalid URL encoding
    return { code: 'INVALID_PATH', message: 'Invalid URL encoding' };
  }

  // Check for null bytes (both encoded %00 and actual \0)
  if (path.includes('%00') || decoded.includes('\0')) {
    return { code: 'INVALID_PATH', message: 'Path contains null bytes' };
  }

  // Block CRLF to prevent path/header injection via downstream usage.
  if (path.toLowerCase().includes('%0d') || path.toLowerCase().includes('%0a') || /[\r\n]/.test(decoded)) {
    return { code: 'INVALID_PATH', message: 'Path contains CRLF characters' };
  }

  // Check for directory traversal (before and after decoding)
  // Check raw path for encoded forms like %2e%2e
  if (path.includes('..') || decoded.includes('..')) {
    return { code: 'INVALID_PATH', message: 'Path traversal not allowed' };
  }

  // Check filename length in each path segment
  const segments = decoded.split('/').filter((s) => s.length > 0);
  for (const segment of segments) {
    if (segment.length > LIMITS.FILENAME_MAX_LENGTH) {
      return { code: 'INVALID_PATH', message: `Filename exceeds maximum length of ${LIMITS.FILENAME_MAX_LENGTH} characters` };
    }
  }

  return null;
}

export function normalizePath(path: string): string {
  // Decode URL encoding first
  let decoded = decodeURIComponent(path);

  // Replace multiple slashes with single slash
  decoded = decoded.replace(/\/+/g, '/');

  // Ensure leading slash
  if (!decoded.startsWith('/')) {
    decoded = '/' + decoded;
  }

  // Remove trailing slash (unless it's just "/")
  if (decoded.length > 1 && decoded.endsWith('/')) {
    decoded = decoded.slice(0, -1);
  }

  return decoded;
}

export function normalizeFolderPath(path: string): string {
  // Decode URL encoding first
  let decoded = decodeURIComponent(path);

  // Replace multiple slashes with single slash
  decoded = decoded.replace(/\/+/g, '/');

  // Ensure leading slash
  if (!decoded.startsWith('/')) {
    decoded = '/' + decoded;
  }

  // Ensure trailing slash for folders (unless it's just "/")
  if (!decoded.endsWith('/')) {
    decoded = decoded + '/';
  }

  // Handle root case
  if (decoded === '//' || decoded === '') {
    decoded = '/';
  }

  return decoded;
}

export function isPathWithinScope(filePath: string, scopePath: string): boolean {
  const normalizedFile = normalizePath(filePath);
  let normalizedScope = scopePath;

  // Ensure scope path ends with / for directory matching
  if (!normalizedScope.endsWith('/')) {
    normalizedScope = normalizedScope + '/';
  }

  // File path must start with scope path, or match the directory itself
  return normalizedFile.startsWith(normalizedScope) || normalizedFile === normalizedScope.slice(0, -1);
}

export function hasPathTraversal(rawUrl: string): boolean {
  return rawUrl.includes('..') || rawUrl.includes('%2e%2e') || rawUrl.includes('%2E%2E');
}

