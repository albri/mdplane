'use client'

import Link from 'next/link'
import type { ElementType } from 'react'
import { ArrowRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@mdplane/ui/ui/button'
import { BorderedIcon } from '@mdplane/ui/ui/bordered-icon'
import { cn } from '@mdplane/ui/lib/utils'

type IconVariant = 'primary' | 'info' | 'warning' | 'error' | 'success' | 'muted' | 'secondary'
type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'

interface IconActionCardAction {
  label: string
  href: string
  variant?: ButtonVariant
}

interface IconActionCardProps {
  title: string
  description: string
  icon: ElementType
  iconVariant?: IconVariant
  primaryAction: IconActionCardAction
  secondaryAction?: IconActionCardAction
  className?: string
}

export function IconActionCard({
  title,
  description,
  icon,
  iconVariant = 'secondary',
  primaryAction,
  secondaryAction,
  className,
}: IconActionCardProps) {
  const Icon = icon

  return (
    <Card tone="interactive" size="sm" className={cn('h-full py-6', className)}>
      <CardHeader className="pb-2">
        <BorderedIcon variant={iconVariant} className="mb-2">
          <Icon className="h-5 w-5" />
        </BorderedIcon>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto space-y-2 pt-0">
        <Button variant={primaryAction.variant ?? 'outline'} asChild className="w-full justify-between">
          <Link href={primaryAction.href}>
            {primaryAction.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        {secondaryAction ? (
          <Button variant={secondaryAction.variant ?? 'outline'} asChild className="w-full justify-between">
            <Link href={secondaryAction.href}>
              {secondaryAction.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

