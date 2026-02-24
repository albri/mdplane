'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@mdplane/ui/lib/utils'

type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl'

interface SpinnerProps {
  /** Size preset: sm (16px), md (20px), lg (32px), xl (48px) */
  size?: SpinnerSize
  /** Additional CSS classes */
  className?: string
  /** Screen reader label */
  label?: string
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
}

/**
 * Accessible spinner component with motion-reduce support.
 *
 * Respects `prefers-reduced-motion` by stopping animation.
 * Includes screen reader announcement via aria-label.
 *
 * @example
 * // In a button
 * <Button disabled={isLoading}>
 *   {isLoading && <Spinner size="sm" />}
 *   Save
 * </Button>
 *
 * @example
 * // Centered loading state
 * <div className="flex items-center justify-center py-12">
 *   <Spinner size="lg" label="Loading claims..." />
 * </div>
 */
export function Spinner({
  size = 'md',
  className,
  label = 'Loading...',
}: SpinnerProps) {
  return (
    <Loader2
      className={cn(
        sizeClasses[size],
        'animate-spin motion-reduce:animate-none text-muted-foreground',
        className
      )}
      aria-label={label}
      role="status"
    />
  )
}


