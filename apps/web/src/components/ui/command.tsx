"use client"

import * as React from "react"
import { Search } from "lucide-react"

import { cn } from '@mdplane/ui/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

function Command({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command"
      className={cn(
        "bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className={cn("overflow-hidden p-0", className)}
        showCloseButton={showCloseButton}
      >
        <Command>{children}</Command>
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({
  className,
  value,
  onChange,
  onValueChange,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange"> & {
  value?: string
  onChange?: React.ChangeEventHandler<HTMLInputElement>
  onValueChange?: (value: string) => void
}) {
  return (
    <div
      data-slot="command-input-wrapper"
      className="flex h-10 items-center gap-2 border-b border-border px-3"
    >
      <Search className="size-4 shrink-0 opacity-50" />
      <input
        data-slot="command-input"
        value={value}
        onChange={(event) => {
          onChange?.(event)
          onValueChange?.(event.target.value)
        }}
        aria-label={props["aria-label"] ?? "Search commands"}
        className={cn(
          "placeholder:text-muted-foreground h-10 w-full bg-transparent text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    </div>
  )
}

function CommandList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-list"
      className={cn(
        "max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto",
        className
      )}
      {...props}
    />
  )
}

function CommandEmpty({ ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-empty"
      className="py-6 text-center text-sm text-muted-foreground"
      {...props}
    />
  )
}

function CommandGroup({
  className,
  heading,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  heading?: React.ReactNode
}) {
  return (
    <div
      data-slot="command-group"
      className={cn("text-foreground overflow-hidden p-1", className)}
      {...props}
    >
      {heading ? (
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {heading}
        </div>
      ) : null}
      {children}
    </div>
  )
}

function CommandSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

function CommandItem({
  className,
  onSelect,
  value,
  ...props
}: Omit<React.ComponentProps<"button">, "onSelect"> & {
  onSelect?: (value: string) => void
  value?: string
}) {
  return (
    <button
      type="button"
      data-slot="command-item"
      className={cn(
        "hover:bg-accent hover:text-accent-foreground relative flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none transition-colors disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      onClick={() => onSelect?.(value ?? "")}
      {...props}
    />
  )
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn("text-muted-foreground ml-auto text-xs tracking-widest", className)}
      {...props}
    />
  )
}

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
}

