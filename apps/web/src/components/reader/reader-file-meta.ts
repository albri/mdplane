export function formatFileDisplayName(fileName?: string): string {
  const trimmed = fileName?.trim()
  if (!trimmed) return 'Document'
  return trimmed.replace(/\.md$/i, '')
}

export function formatFileSize(sizeInBytes: number): string {
  if (!Number.isFinite(sizeInBytes) || sizeInBytes < 0) return '0 B'
  if (sizeInBytes < 1024) return `${sizeInBytes} B`

  const units = ['KB', 'MB', 'GB', 'TB']
  let value = sizeInBytes / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`
}

export function estimateReadingTimeMinutes(content: string, wordsPerMinute = 220): number {
  const words = content
    .trim()
    .split(/\s+/)
    .filter(Boolean).length

  return Math.max(1, Math.ceil(words / wordsPerMinute))
}

export function formatUpdatedTimestamp(isoTimestamp?: string): string {
  if (!isoTimestamp) return 'Unknown'

  const parsed = new Date(isoTimestamp)
  if (Number.isNaN(parsed.getTime())) return 'Unknown'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)
}
