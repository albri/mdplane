'use client'

import * as React from 'react'
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import { cn } from '../lib/utils'

type TooltipProviderProps = Omit<React.ComponentProps<typeof TooltipPrimitive.Provider>, 'delay'> & {
  delayDuration?: number
}

function TooltipProvider({ delayDuration = 0, ...props }: TooltipProviderProps) {
  return <TooltipPrimitive.Provider data-slot='tooltip-provider' delay={delayDuration} {...props} />
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot='tooltip' {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger({
  asChild = false,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger> & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return <TooltipPrimitive.Trigger data-slot='tooltip-trigger' render={children} {...props} />
  }

  return (
    <TooltipPrimitive.Trigger data-slot='tooltip-trigger' {...props}>
      {children}
    </TooltipPrimitive.Trigger>
  )
}

function TooltipContent({
  className,
  sideOffset = 4,
  side = 'top',
  align = 'center',
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Popup> & {
  sideOffset?: number
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner side={side} align={align} sideOffset={sideOffset}>
        <TooltipPrimitive.Popup
          data-slot='tooltip-content'
          className={cn(
            'bg-popover text-popover-foreground z-50 max-w-xs overflow-hidden rounded-md border border-border px-3 py-1.5 text-sm shadow-md',
            className
          )}
          {...props}
        />
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
