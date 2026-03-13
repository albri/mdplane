import { cn } from '../lib/utils'

export type LogoSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl'
export type LogoVariant = 'default' | 'inverted'

interface LogoProps {
  size?: LogoSize
  variant?: LogoVariant
  className?: string
  showWordmark?: boolean
}

const sizeConfig: Record<LogoSize, { square: string; text: string; shadow: string }> = {
  sm: { square: 'w-4 h-4', text: 'text-xl', shadow: '3px 3px 0px 0px' },
  md: { square: 'w-5 h-5', text: 'text-2xl', shadow: '4px 4px 0px 0px' },
  lg: { square: 'w-6 h-6', text: 'text-2xl', shadow: '4px 4px 0px 0px' },
  xl: { square: 'w-8 h-8', text: 'text-3xl', shadow: '6px 6px 0px 0px' },
  '2xl': { square: 'w-10 h-10', text: 'text-4xl', shadow: '6px 6px 0px 0px' },
}

const colorConfig: Record<LogoVariant, { square: string; text: string; shadowColor: string }> = {
  default: { square: 'bg-amber', text: 'text-foreground', shadowColor: 'var(--foreground)' },
  inverted: { square: 'bg-amber', text: 'text-white', shadowColor: '#FFFFFF' },
}

export function Logo({
  size = 'md',
  variant = 'default',
  className = '',
  showWordmark = true
}: LogoProps) {
  const sizes = sizeConfig[size]
  const colors = colorConfig[variant]

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        data-testid="logo-mark"
        className={cn(sizes.square, colors.square, 'origin-top')}
        style={{
          boxShadow: `${sizes.shadow} ${colors.shadowColor}`,
          transform: 'rotate(-2deg) perspective(100px) rotateX(-2deg)'
        }}
      />
      {showWordmark && (
        <span className={cn('font-display font-bold tracking-tighter', sizes.text, colors.text)}>
          mdplane
        </span>
      )}
    </span>
  )
}

export function LogoMark({
  size = 'md',
  variant = 'default',
  className = ''
}: Pick<LogoProps, 'size' | 'variant' | 'className'>) {
  const sizes = sizeConfig[size]
  const colors = colorConfig[variant]

  return (
    <span
      className={cn(sizes.square, colors.square, 'origin-top inline-block', className)}
      style={{
        boxShadow: `${sizes.shadow} ${colors.shadowColor}`,
        transform: 'rotate(-2deg) perspective(100px) rotateX(-2deg)'
      }}
    />
  )
}

/**
 * Brand colors - use CSS variables when possible (bg-amber, text-terracotta, etc.)
 * These hex values are provided for contexts where CSS vars aren't available.
 */
export const BRAND_COLORS = {
  amber: '#E8A851',
  terracotta: '#D97757',
  sage: '#8B9A8B',
} as const
