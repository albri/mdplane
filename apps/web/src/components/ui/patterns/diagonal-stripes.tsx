import { cn } from '@mdplane/ui/lib/utils'

interface DiagonalStripesProps {
  /** 45 = top-right to bottom-left, 135 = top-left to bottom-right */
  angle?: 45 | 135
  /** Spacing between stripes in pixels */
  spacing?: number
  className?: string
}

/**
 * Subtle diagonal stripe pattern for page backgrounds.
 * Matches landing page aesthetic.
 */
export function DiagonalStripes({
  angle = 135,
  spacing = 24,
  className,
}: DiagonalStripesProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0',
        'opacity-30 dark:opacity-20',
        className
      )}
      style={{
        backgroundImage: `repeating-linear-gradient(${angle}deg, rgba(0,0,0,0.08) 0 1px, transparent 1px ${spacing}px)`,
      }}
    />
  )
}

// Dark mode styles applied via CSS custom properties would be cleaner,
// but this works and avoids the complexity of CSS-in-JS solutions.
// The dark: variant in className handles opacity; we use a single
// gradient that works in both modes (black lines fade in dark mode).


