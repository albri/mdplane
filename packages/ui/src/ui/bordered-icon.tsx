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
  'inline-flex h-auto w-fit items-center justify-center rounded-lg border shadow-md',
  {
    variants: {
      variant: {
        primary: 'border-primary/30 bg-primary/10 text-primary',
        info: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
        warning: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
        error: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
        success: 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400',
        muted: 'border-border bg-muted/60 text-muted-foreground',
        secondary: 'border-border bg-secondary/70 text-secondary-foreground',
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
