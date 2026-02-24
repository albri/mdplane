import { cn } from '@mdplane/ui/lib/utils'

interface SectionHeaderProps {
  children: React.ReactNode
  variant?: 'default' | 'danger'
  className?: string
}

export function SectionHeader({
  children,
  variant = 'default',
  className,
}: SectionHeaderProps) {
  return (
    <h2
      className={cn(
        'mb-4 font-mono text-xs font-semibold uppercase tracking-wider',
        variant === 'danger' ? 'text-destructive' : 'text-muted-foreground',
        className
      )}
    >
      {children}
    </h2>
  )
}


