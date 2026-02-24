import { cn } from '@mdplane/ui/lib/utils'

interface GeometricGridProps {
  /** Grid cell size in pixels */
  size?: number
  className?: string
}

/**
 * Subtle geometric grid pattern for empty states and backgrounds.
 */
export function GeometricGrid({ size = 28, className }: GeometricGridProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0',
        'opacity-[0.06] dark:opacity-[0.04]',
        className
      )}
      style={{
        backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.15) 1px, transparent 1px)`,
        backgroundSize: `${size}px ${size}px`,
      }}
    />
  )
}


