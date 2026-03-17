import type { Metadata } from 'next'
import { APP_NAME } from '@mdplane/shared'

export const metadata: Metadata = {
  title: {
    template: `%s | Control | ${APP_NAME}`,
    default: 'Control',
  },
  description: `Manage your ${APP_NAME} workspace - files, claims, API keys, and settings.`,
}

export default function ControlLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

