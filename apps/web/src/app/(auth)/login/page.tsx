import type { Metadata } from 'next'
import { APP_NAME } from '@mdplane/shared'
import { LoginForm } from '@/components/auth'
import { ControlModeNotConfiguredState } from '@/components/control'
import { webEnv } from '@/config/env'

export const metadata: Metadata = {
  title: 'Sign In',
  description: `Sign in to your ${APP_NAME} account to access your workspaces.`,
}

export default function LoginPage() {
  if (!webEnv.governedModeEnabled) {
    return <ControlModeNotConfiguredState />
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted p-6">
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </main>
  )
}


