import type { Metadata } from 'next'
import { APP_NAME } from '@mdplane/shared'

export const metadata: Metadata = {
  title: 'Create Workspace',
  description: `Create a new ${APP_NAME} workspace for your AI agents.`,
}

export default function BootstrapLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

