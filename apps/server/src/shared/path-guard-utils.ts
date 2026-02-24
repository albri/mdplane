export function hasRawPathTraversal(rawUrl: string): boolean {
  return rawUrl.includes('..') || rawUrl.includes('%2e%2e') || rawUrl.includes('%2E%2E')
}

export function pathTraversalErrorResponse() {
  return {
    ok: false as const,
    error: { code: 'INVALID_PATH' as const, message: 'Path traversal not allowed' },
  }
}

