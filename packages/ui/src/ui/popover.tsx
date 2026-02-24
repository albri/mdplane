'use client'

import * as React from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { cn } from '../lib/utils'

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot='popover' {...props} />
}

function PopoverTrigger({
  asChild = false,
  children,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger> & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return <PopoverPrimitive.Trigger data-slot='popover-trigger' render={children} {...props} />
  }

  return (
    <PopoverPrimitive.Trigger data-slot='popover-trigger' {...props}>
      {children}
    </PopoverPrimitive.Trigger>
  )
}

function PopoverContent({
  className,
  align = 'center',
  side = 'bottom',
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Popup> & {
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
}) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner className='z-[200]' align={align} side={side} sideOffset={sideOffset}>
        <PopoverPrimitive.Popup
          data-slot='popover-content'
          className={cn(
            'z-[200] origin-(--transform-origin) max-h-(--available-height) min-w-[240px] max-w-[98vw] overflow-y-auto rounded-xl border bg-popover/60 p-2 text-sm text-popover-foreground leading-normal shadow-lg backdrop-blur-lg outline-hidden focus-visible:outline-none [&_li]:leading-normal [&_p]:leading-normal',
            className
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

function PopoverHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot='popover-header' className={cn('flex flex-col gap-1 text-sm leading-normal', className)} {...props} />
  )
}

function PopoverTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <div data-slot='popover-title' className={cn('font-medium', className)} {...props} />
}

function PopoverDescription({
  className,
  ...props
}: React.ComponentProps<'p'>) {
  return <p data-slot='popover-description' className={cn('text-muted-foreground leading-normal', className)} {...props} />
}

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
}
