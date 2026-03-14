import { cn } from '../lib/utils'

export type LogoSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl'
export type LogoVariant = 'default' | 'inverted'

interface LogoProps {
  size?: LogoSize
  variant?: LogoVariant
  className?: string
  showWordmark?: boolean
}

const sizeConfig: Record<LogoSize, { square: string; text: string; shadow: string; icon: string; gap: string }> = {
  sm: { square: 'w-4 h-4', text: 'text-xl',  shadow: '3px 3px 0px 0px', icon: 'size-3',   gap: 'gap-2' },
  md: { square: 'w-5 h-5', text: 'text-2xl', shadow: '4px 4px 0px 0px', icon: 'size-3.5', gap: 'gap-2.5' },
  lg: { square: 'w-6 h-6', text: 'text-2xl', shadow: '4px 4px 0px 0px', icon: 'size-4',   gap: 'gap-2.5' },
  xl: { square: 'w-8 h-8', text: 'text-3xl', shadow: '6px 6px 0px 0px', icon: 'size-6',   gap: 'gap-4' },
  '2xl': { square: 'w-10 h-10', text: 'text-4xl', shadow: '6px 6px 0px 0px', icon: 'size-7', gap: 'gap-4' },
}

const colorConfig: Record<LogoVariant, { square: string; text: string; shadowColor: string; iconColor: string }> = {
  default: { square: 'bg-amber', text: 'text-foreground', shadowColor: 'var(--foreground)', iconColor: '#1A1A1A' },
  inverted: { square: 'bg-amber', text: 'text-white', shadowColor: '#FFFFFF', iconColor: '#1A1A1A' },
}

function RobotIcon({ className, color }: { className?: string; color: string }) {
  return (
    <svg
      className={className}
      stroke={color}
      fill={color}
      strokeWidth="0"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17 2H13V1H11V2H7C5.34315 2 4 3.34315 4 5V8C4 10.7614 6.23858 13 9 13H15C17.7614 13 20 10.7614 20 8V5C20 3.34315 18.6569 2 17 2ZM11 7.5C11 8.32843 10.3284 9 9.5 9C8.67157 9 8 8.32843 8 7.5C8 6.67157 8.67157 6 9.5 6C10.3284 6 11 6.67157 11 7.5ZM16 7.5C16 8.32843 15.3284 9 14.5 9C13.6716 9 13 8.32843 13 7.5C13 6.67157 13.6716 6 14.5 6C15.3284 6 16 6.67157 16 7.5ZM4 22C4 17.5817 7.58172 14 12 14C16.4183 14 20 17.5817 20 22H4Z" />
    </svg>
  )
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
    <span className={cn('inline-flex items-center', sizes.gap, className)}>
      <span
        data-testid="logo-mark"
        className={cn(sizes.square, colors.square, 'origin-top flex items-center justify-center')}
        style={{
          boxShadow: `${sizes.shadow} ${colors.shadowColor}`,
          transform: 'rotate(-2deg) perspective(100px) rotateX(-2deg)'
        }}
      >
        <RobotIcon className={sizes.icon} color={colors.iconColor} />
      </span>
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
      className={cn(sizes.square, colors.square, 'origin-top inline-flex items-center justify-center', className)}
      style={{
        boxShadow: `${sizes.shadow} ${colors.shadowColor}`,
        transform: 'rotate(-2deg) perspective(100px) rotateX(-2deg)'
      }}
    >
      <RobotIcon className={sizes.icon} color={colors.iconColor} />
    </span>
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
