'use client'

import * as React from 'react'
import { Button as BaseButton } from '@base-ui/react/button'
import { cn } from '../lib/utils'

const buttonBaseClasses =
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"

const buttonVariantClasses = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  destructive:
    'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
  outline:
    'border bg-background text-foreground shadow-xs hover:bg-muted hover:text-foreground dark:bg-input/30 dark:border-input dark:hover:bg-muted/80',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  ghost: 'text-foreground/90 hover:bg-muted hover:text-foreground dark:hover:bg-muted/80',
  link: 'text-primary underline-offset-4 hover:underline',
} as const

const buttonSizeClasses = {
  default: 'h-9 px-4 py-2 has-[>svg]:px-3',
  sm: 'h-8 gap-1.5 px-3 has-[>svg]:px-2.5',
  lg: 'h-10 px-6 has-[>svg]:px-4',
  icon: 'size-9',
  'icon-sm': 'size-8',
  'icon-lg': 'size-10',
} as const

type ButtonVariant = keyof typeof buttonVariantClasses
type ButtonSize = keyof typeof buttonSizeClasses

function buttonVariants({
  variant = 'default',
  size = 'default',
  className,
}: {
  variant?: ButtonVariant | null
  size?: ButtonSize | null
  className?: string
} = {}) {
  return cn(
    buttonBaseClasses,
    buttonVariantClasses[variant ?? 'default'],
    buttonSizeClasses[size ?? 'default'],
    className
  )
}

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  children,
  ...props
}: Omit<
  React.ComponentProps<typeof BaseButton>,
  'render' | 'nativeButton' | 'className'
> & {
  className?: string
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
}) {
  const classes = buttonVariants({
    variant,
    size,
    ...(className != null && className !== '' ? { className } : {}),
  })

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement
    const isNativeButton =
      typeof child.type === 'string' ? child.type === 'button' : false

    return (
      <BaseButton
        data-slot='button'
        data-variant={variant}
        data-size={size}
        className={cn(classes)}
        render={child}
        nativeButton={isNativeButton}
        {...props}
      />
    )
  }

  return (
    <BaseButton
      data-slot='button'
      data-variant={variant}
      data-size={size}
      className={cn(classes)}
      {...props}
    >
      {children}
    </BaseButton>
  )
}

export { Button, buttonVariants }
