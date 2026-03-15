import type { ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'

interface BorderedIconProps {
  children: ReactNode
  variant?: VariantProps<typeof borderedIconVariants>['variant']
  size?: VariantProps<typeof borderedIconVariants>['size']
  className?: string
}

const borderedIconVariants = cva(
  'inline-flex h-auto w-fit items-center justify-center border',
  {
    variants: {
      variant: {
        primary: 'border-foreground bg-primary/10 text-foreground shadow-[3px_3px_0_0_var(--foreground)]',
        terracotta: 'border-foreground bg-brand-terracotta text-foreground shadow-[3px_3px_0_0_var(--foreground)]',
        amber: 'border-foreground bg-brand-amber text-foreground shadow-[3px_3px_0_0_var(--foreground)]',
        sage: 'border-foreground bg-brand-sage text-foreground shadow-[3px_3px_0_0_var(--foreground)]',
        success: 'border-green-600/30 bg-green-500/10 text-green-600 dark:text-green-400 shadow-[2px_2px_0_0_rgba(22,163,74,0.3)]',
        error: 'border-red-600/30 bg-red-500/10 text-red-600 dark:text-red-400 shadow-[2px_2px_0_0_rgba(220,38,38,0.3)]',
        warning: 'border-amber-600/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-[2px_2px_0_0_rgba(217,119,6,0.3)]',
        info: 'border-blue-600/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-[2px_2px_0_0_rgba(37,99,235,0.3)]',
        muted: 'border-border bg-muted/60 text-muted-foreground shadow-[2px_2px_0_0_var(--border)]',
        secondary: 'border-border bg-secondary/70 text-secondary-foreground shadow-[2px_2px_0_0_var(--border)]',
      },
      size: {
        sm: 'p-1.5 [&_svg]:size-4',
        md: 'p-2 [&_svg]:size-5',
        lg: 'p-2.5 [&_svg]:size-6',
      },
    },
    defaultVariants: {
      variant: 'muted',
      size: 'md',
    },
  }
)

export function BorderedIcon({ children, variant = 'muted', size = 'md', className }: BorderedIconProps) {
  return <div className={cn(borderedIconVariants({ variant, size }), className)}>{children}</div>
}
