import type { PathValidationResult } from './types';

export function decodeAndValidatePath(rawPath: string): PathValidationResult {
  if (rawPath.includes('..')) {
    return { ok: false, status: 400, error: { code: 'INVALID_REQUEST', message: 'Path traversal not allowed' } };
  }

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    return { ok: false, status: 400, error: { code: 'INVALID_REQUEST', message: 'Invalid URL encoding' } };
  }

  if (decodedPath.includes('..')) {
    return { ok: false, status: 400, error: { code: 'INVALID_REQUEST', message: 'Path traversal not allowed' } };
  }

  return { ok: true, path: decodedPath };
}

export function toFolderPathNoSlash(decodedPath: string): string {
  let folderPath = decodedPath.startsWith('/') ? decodedPath : '/' + decodedPath;
  folderPath = folderPath.replace(/\/+/g, '/');
  if (folderPath !== '/' && folderPath.endsWith('/')) {
    folderPath = folderPath.slice(0, -1);
  }
  return folderPath;
}

export function validateFolderName(name: string | undefined): PathValidationResult {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { ok: false, status: 400, error: { code: 'INVALID_REQUEST', message: 'name is required' } };
  }

  const folderName = name.trim();

  if (folderName.includes('/') || folderName.includes('\\')) {
    return { ok: false, status: 400, error: { code: 'INVALID_REQUEST', message: 'Folder name cannot contain slashes' } };
  }

  if (folderName.length > 255) {
    return { ok: false, status: 400, error: { code: 'INVALID_REQUEST', message: 'Folder name too long (max 255 characters)' } };
  }

  return { ok: true, path: folderName };
}

