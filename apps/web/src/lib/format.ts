/**
 * Format helpers for displaying file metadata
 */

/**
 * Format file size in human-readable format
 * @param bytes - Size in bytes
 * @returns Formatted string like "4.2 KB" or "1.3 MB"
 */
export function formatSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return ''

  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/**
 * Format date as relative time
 * @param dateString - ISO date string or Date object
 * @returns Formatted string like "30m ago" or "2 days ago"
 */
export function formatRelativeTime(dateString?: string | Date): string {
  if (!dateString) return ''

  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffWeeks < 4) return `${diffWeeks}w ago`

  return date.toLocaleDateString()
}

