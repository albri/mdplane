export function hasRequiredScope(scopes: readonly string[], requiredScope: string): boolean {
  return scopes.includes(requiredScope)
}
