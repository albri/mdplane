import type { Metadata } from 'next'
import { APP_NAME } from '@mdplane/shared'

export const metadata: Metadata = {
  title: 'Claim Workspace',
  description: `Sign in to claim your ${APP_NAME} workspace and unlock additional features.`,
}

export default function ClaimLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

