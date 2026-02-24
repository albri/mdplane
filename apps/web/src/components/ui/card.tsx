import * as React from "react"

import { cn } from '@mdplane/ui/lib/utils'

type CardTone = "default" | "muted" | "interactive"
type CardSize = "default" | "sm"

const cardToneClasses: Record<CardTone, string> = {
  default: "bg-card text-card-foreground rounded-lg border border-border/80 shadow-sm",
  muted: "bg-card text-card-foreground rounded-lg border border-border/80 shadow-sm",
  interactive:
    "bg-card text-card-foreground rounded-lg border border-border/80 shadow-sm transition-colors hover:border-foreground/20 hover:bg-accent/20",
}

const cardSizeClasses: Record<CardSize, string> = {
  default: "gap-6 py-6",
  sm: "gap-4 py-4",
}

function Card({
  className,
  tone = "default",
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { tone?: CardTone; size?: CardSize }) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col",
        cardToneClasses[tone],
        cardSizeClasses[size],
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-4",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-4", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}

