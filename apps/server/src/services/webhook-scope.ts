/**
 * Webhook Scope Matching Module
 *
 * Provides functions to check if a file path matches a webhook's scope.
 * Supports workspace, file, and folder scopes with recursive/non-recursive matching.
 *
 * @module services/webhook-scope
 */

/**
 * Check if a file path is within a webhook's scope.
 *
 * @param filePath - The file path to check
 * @param scopeType - The webhook scope type ('workspace', 'file', 'folder')
 * @param scopePath - The scope path for file/folder scopes
 * @param recursive - For folder scope: true=match nested files, false=direct children only
 */
export function isPathInScope(
  filePath: string,
  scopeType: string,
  scopePath: string | null,
  recursive: boolean = true
): boolean {
  if (scopeType === 'workspace') {
    return true;
  }
  // Null check (but allow empty string for root folder)
  if (scopePath === null || scopePath === undefined) {
    return false;
  }
  if (scopeType === 'file') {
    return filePath === scopePath;
  }
  if (scopeType === 'folder') {
    // Normalize scope path (ensure no trailing slash for comparison)
    const normalizedScope = scopePath.endsWith('/') ? scopePath.slice(0, -1) : scopePath;

    // Root folder special case
    if (normalizedScope === '' || normalizedScope === '/') {
      if (recursive) {
        return true;
      }
      // Direct children only: file at /<name> with no further slashes after the leading one
      const pathWithoutLeadingSlash = filePath.startsWith('/') ? filePath.slice(1) : filePath;
      return !pathWithoutLeadingSlash.includes('/');
    }

    const folderPrefix = `${normalizedScope}/`;
    if (!filePath.startsWith(folderPrefix)) {
      return false;
    }

    if (recursive) {
      return true;
    }

    // Direct children only: no additional path separators after the folder prefix
    const relativePath = filePath.slice(folderPrefix.length);
    return !relativePath.includes('/');
  }
  return false;
}

