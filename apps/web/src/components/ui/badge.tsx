import * as React from "react"

import { cn } from '@mdplane/ui/lib/utils'

const badgeBaseClasses =
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border px-2 py-0.5 whitespace-nowrap text-xs font-medium [&>svg]:size-3 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow]"

const badgeVariantClasses = {
  default:
    "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
  secondary:
    "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
  destructive:
    "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
  outline: "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
  pending: "border-status-pending/20 bg-status-pending/20 text-status-pending",
  claimed: "border-status-claimed/20 bg-status-claimed/20 text-status-claimed",
  completed: "border-status-completed/20 bg-status-completed/20 text-status-completed",
  blocked: "border-status-blocked/20 bg-status-blocked/20 text-status-blocked",
  expired: "border-status-expired/20 bg-status-expired/20 text-status-expired",
} as const

type BadgeVariant = keyof typeof badgeVariantClasses

function badgeVariants({
  variant = "default",
  className,
}: {
  variant?: BadgeVariant | null
  className?: string
} = {}) {
  return cn(badgeBaseClasses, badgeVariantClasses[variant ?? "default"], className)
}

function Badge({
  className,
  variant,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"span"> & {
  variant?: BadgeVariant
  asChild?: boolean
}) {
  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<Record<string, unknown>>

    return React.cloneElement(child, {
      ...(props as Record<string, unknown>),
      ...child.props,
      "data-slot": "badge",
      className: cn(badgeVariants({ variant }), className, child.props.className as string | undefined),
    } as Record<string, unknown>)
  }

  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props}>
      {children}
    </span>
  )
}

export { Badge, badgeVariants }

