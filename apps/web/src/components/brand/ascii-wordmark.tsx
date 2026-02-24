import { cn } from '@mdplane/ui/lib/utils'
import { APP_NAME, splitWordmarkLines } from '@mdplane/shared'

type AsciiWordmarkProps = {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'text-[6px] leading-[6px]',
  md: 'text-[8px] leading-[8px]',
  lg: 'text-[10px] leading-[10px]',
}

export function AsciiWordmark({ className, size = 'md' }: AsciiWordmarkProps) {
  const lines = splitWordmarkLines()

  return (
    <pre
      className={cn('select-none whitespace-pre font-mono', sizeClasses[size], className)}
      aria-label={APP_NAME}
      data-testid="ascii-wordmark"
    >
      {lines.map((line, i) => (
        <span key={i}>
          <span className="text-primary">{line.accent}</span>
          <span className="text-foreground">{line.base}</span>
          {i < lines.length - 1 && '\n'}
        </span>
      ))}
    </pre>
  )
}

export function TextWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-mono font-semibold', className)} data-testid="text-wordmark">
      <span className="text-primary">md</span>
      <span className="text-foreground">plane</span>
    </span>
  )
}


