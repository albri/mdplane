"use client"

import { useCallback } from "react"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"

type ToastType = "info" | "success" | "warning" | "error"

interface ToastMessage {
  title: string
  description?: string
  timeout?: number
}

export function useToast() {
  const { add, close } = ToastPrimitive.useToastManager()

  const show = useCallback(
    (type: ToastType, { title, description, timeout }: ToastMessage) =>
      add({ type, title, description, timeout }),
    [add]
  )

  return {
    close,
    info: (message: ToastMessage) => show("info", message),
    success: (message: ToastMessage) => show("success", message),
    warning: (message: ToastMessage) => show("warning", message),
    error: (message: ToastMessage) => show("error", message),
  }
}

