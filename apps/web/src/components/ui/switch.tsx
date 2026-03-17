"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from '@mdplane/ui/lib/utils'

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "inline-flex h-5 w-9 items-center rounded-full border border-transparent bg-input transition-colors data-[checked]:bg-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="h-4 w-4 translate-x-[1px] rounded-full bg-background shadow-sm transition-transform data-[checked]:translate-x-[17px]"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }

