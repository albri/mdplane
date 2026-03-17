'use client'

import * as React from 'react'
import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox'
import { Check } from 'lucide-react'
import { cn } from '@mdplane/ui/lib/utils'

type ComboboxProps<Value, Multiple extends boolean | undefined = false> =
  ComboboxPrimitive.Root.Props<Value, Multiple>

function Combobox<Value, Multiple extends boolean | undefined = false>({
  ...props
}: ComboboxProps<Value, Multiple>) {
  return <ComboboxPrimitive.Root data-slot='combobox' {...props} />
}

function ComboboxInput({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Input>) {
  return (
    <ComboboxPrimitive.Input
      data-slot='combobox-input'
      className={cn(
        'h-auto min-h-11 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        className
      )}
      {...props}
    />
  )
}

function ComboboxTrigger({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Trigger>) {
  return (
    <ComboboxPrimitive.Trigger
      data-slot='combobox-trigger'
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-[color,box-shadow] hover:bg-muted/70 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        className
      )}
      {...props}
    />
  )
}

function ComboboxContent({
  className,
  sideOffset = 8,
  align = 'start',
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Popup> & {
  sideOffset?: number
  align?: 'start' | 'center' | 'end'
}) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner className='z-[260]' sideOffset={sideOffset} align={align}>
        <ComboboxPrimitive.Popup
          data-slot='combobox-content'
          className={cn(
            'z-[260] max-h-(--available-height) w-[var(--anchor-width)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-popover/60 text-popover-foreground shadow-lg backdrop-blur-lg outline-hidden',
            className
          )}
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}

function ComboboxList({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.List>) {
  return <ComboboxPrimitive.List data-slot='combobox-list' className={cn('p-1', className)} {...props} />
}

function ComboboxItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Item>) {
  return (
    <ComboboxPrimitive.Item
      data-slot='combobox-item'
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm outline-none transition-[color,box-shadow] data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/60 data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator className='ms-auto shrink-0 text-primary'>
        <Check className='size-3.5' />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  )
}

function ComboboxEmpty({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Empty>) {
  return (
    <ComboboxPrimitive.Empty
      data-slot='combobox-empty'
      className={cn('px-2 py-2 text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Combobox,
  ComboboxInput,
  ComboboxTrigger,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
}
