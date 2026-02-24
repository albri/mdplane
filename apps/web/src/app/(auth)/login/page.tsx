import type { Metadata } from 'next'
import { APP_NAME } from '@mdplane/shared'
import { LoginForm } from '@/components/auth'
import { ControlModeNotConfiguredState } from '@/components/control'
import { webEnv } from '@/config/env'
import { DiagonalStripes, IntersectionMarks } from '@/components/ui/patterns'

export const metadata: Metadata = {
  title: 'Sign In',
  description: `Sign in to your ${APP_NAME} account to access your workspaces.`,
}

export default function LoginPage() {
  if (!webEnv.governedModeEnabled) {
    return <ControlModeNotConfiguredState />
  }

  return (
    <main className="state-shell">
      <DiagonalStripes angle={135} spacing={24} className="opacity-30" />
      <IntersectionMarks size={52} className="opacity-20" />

      <div className="state-shell-content">
        <div className="state-shell-card max-w-lg rounded-xl">
          <LoginForm />
        </div>
      </div>
    </main>
  )
}


