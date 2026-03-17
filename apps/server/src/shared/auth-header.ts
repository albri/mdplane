export function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return null
  if (!authHeader.startsWith('Bearer ')) return null
  return authHeader.substring(7)
}
