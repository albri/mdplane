import { cn } from '@mdplane/ui/lib/utils'

interface IntersectionMarksProps {
  /** Distance between + marks in pixels */
  size?: number
  className?: string
}

/**
 * Small + symbols at grid intersections.
 * Technical/blueprint aesthetic for "coming soon" states.
 */
export function IntersectionMarks({
  size = 48,
  className,
}: IntersectionMarksProps) {
  // SVG path for a + mark centered in the cell
  const svg = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'><path d='M${size / 2 - 4} ${size / 2} h8 M${size / 2} ${size / 2 - 4} v8' stroke='currentColor' stroke-width='1' fill='none' opacity='0.15'/></svg>`
  )

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0',
        'opacity-60 dark:opacity-40',
        className
      )}
      style={{
        backgroundImage: `url("data:image/svg+xml,${svg}")`,
        backgroundSize: `${size}px ${size}px`,
      }}
    />
  )
}


