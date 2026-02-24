"use client"

import * as React from "react"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { X } from "lucide-react"

import { cn } from '@mdplane/ui/lib/utils'

function getToastTypeClass(type: string | undefined) {
  switch (type) {
    case "success":
      return "border-success/30 bg-success/8"
    case "error":
      return "border-destructive/40 bg-destructive/10"
    case "warning":
      return "border-warning/40 bg-warning/10"
    default:
      return "border-border bg-background"
  }
}

function ToastViewport() {
  const { toasts } = ToastPrimitive.useToastManager()

  return (
    <ToastPrimitive.Portal>
      <ToastPrimitive.Viewport
        className={cn(
          "fixed right-4 top-4 z-[120] flex w-[calc(100vw-2rem)] max-w-md flex-col gap-2",
          "md:right-6 md:top-6"
        )}
      >
        {toasts.map((toast) => (
          <ToastPrimitive.Root
            key={toast.id}
            toast={toast}
            className={cn(
              "grid grid-cols-[1fr_auto] gap-3 rounded-lg border p-3 shadow-lg backdrop-blur-sm",
              "transition-all data-[starting-style]:translate-y-1 data-[starting-style]:opacity-0 data-[ending-style]:translate-y-1 data-[ending-style]:opacity-0",
              getToastTypeClass(toast.type)
            )}
          >
            <div className="flex min-w-0 flex-col gap-1">
              {toast.title ? (
                <ToastPrimitive.Title className="text-sm font-semibold text-foreground">
                  {toast.title}
                </ToastPrimitive.Title>
              ) : null}
              {toast.description ? (
                <ToastPrimitive.Description className="text-sm text-muted-foreground">
                  {toast.description}
                </ToastPrimitive.Description>
              ) : null}
            </div>
            <ToastPrimitive.Close className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss notification</span>
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
      </ToastPrimitive.Viewport>
    </ToastPrimitive.Portal>
  )
}

function AppToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <ToastPrimitive.Provider timeout={5000} limit={4}>
      {children}
      <ToastViewport />
    </ToastPrimitive.Provider>
  )
}

export { AppToastProvider }

