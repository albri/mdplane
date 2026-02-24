import { cn } from '@mdplane/ui/lib/utils'
import { Hammer } from 'lucide-react'
import { IntersectionMarks } from '@/components/ui/patterns'

interface ComingSoonProps {
  feature: string
  description?: string
  eta?: string // e.g., "Q2 2026"
  className?: string
}

/**
 * ComingSoon Component
 *
 * Placeholder for unimplemented features.
 * Uses dashed border per design system.
 *
 * @example
 * ```tsx
 * <ComingSoon
 *   feature="Webhooks"
 *   description="Get notified when files change in your workspace."
 *   eta="Q2 2026"
 * />
 * ```
 */
export function ComingSoon({
  feature,
  description,
  eta,
  className,
}: ComingSoonProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center border border-dashed border-border py-16 text-center',
        className
      )}
      data-testid="coming-soon"
    >
      <IntersectionMarks size={48} />
      <Hammer className="relative mb-4 h-8 w-8 text-muted-foreground" aria-hidden="true" />

      <p className="relative mb-2 font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Coming Soon
      </p>

      <p className="relative text-lg font-medium">{feature}</p>

      {description && (
        <p className="relative mt-1 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      )}

      {eta && (
        <p className="relative mt-4 font-mono text-xs text-muted-foreground">
          Expected: {eta}
        </p>
      )}
    </div>
  )
}


