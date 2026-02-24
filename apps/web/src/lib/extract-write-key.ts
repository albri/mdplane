export function extractWriteKey(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const bareKeyPattern = /^[A-Za-z0-9_-]{22,}$/
  if (bareKeyPattern.test(trimmed)) {
    return trimmed
  }

  const pathLike = trimmed.includes('://')
    ? (() => {
        try {
          return new URL(trimmed).pathname
        } catch {
          return trimmed
        }
      })()
    : trimmed

  const claimMatch = pathLike.match(/\/claim\/([A-Za-z0-9_-]{22,})/)
  if (claimMatch?.[1]) return claimMatch[1]

  const writeMatch = pathLike.match(/\/w\/([A-Za-z0-9_-]{22,})/)
  if (writeMatch?.[1]) return writeMatch[1]

  return null
}
