import { cn } from '@mdplane/ui/lib/utils'

type SectionDividerProps = {
  className?: string
}

export function SectionDivider({ className = '' }: SectionDividerProps) {
  return <div className={cn('mt-16 sm:mt-24 border-t border-dashed border-border', className)} />
}
