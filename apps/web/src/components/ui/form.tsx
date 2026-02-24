"use client"

import * as React from "react"
import { Field as FieldPrimitive } from "@base-ui/react/field"
import { Form as FormPrimitive } from "@base-ui/react/form"

import { cn } from '@mdplane/ui/lib/utils'

function Form({ className, ...props }: React.ComponentProps<typeof FormPrimitive>) {
  return <FormPrimitive className={cn("space-y-4", className)} {...props} />
}

function FormField({
  className,
  ...props
}: React.ComponentProps<typeof FieldPrimitive.Root>) {
  return (
    <FieldPrimitive.Root
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function FormLabel({
  className,
  ...props
}: React.ComponentProps<typeof FieldPrimitive.Label>) {
  return (
    <FieldPrimitive.Label
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    />
  )
}

function FormControl({
  className,
  ...props
}: React.ComponentProps<typeof FieldPrimitive.Control>) {
  return (
    <FieldPrimitive.Control
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

function FormDescription({
  className,
  ...props
}: React.ComponentProps<typeof FieldPrimitive.Description>) {
  return (
    <FieldPrimitive.Description
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function FormError({
  className,
  ...props
}: React.ComponentProps<typeof FieldPrimitive.Error>) {
  return (
    <FieldPrimitive.Error
      className={cn("text-sm text-destructive", className)}
      {...props}
    />
  )
}

export {
  Form,
  FormControl,
  FormDescription,
  FormError,
  FormField,
  FormLabel,
}

