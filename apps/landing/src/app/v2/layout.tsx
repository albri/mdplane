import type { Metadata } from 'next'
import { APP_NAME, TAGLINE } from '@mdplane/shared'

export const metadata: Metadata = {
  title: `${APP_NAME} v2 — ${TAGLINE}`,
  description: 'Landing page v2 wireframe',
}

export default function V2Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {children}
    </div>
  )
}

