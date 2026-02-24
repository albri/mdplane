'use client'

import { ThemeProvider } from 'next-themes'
import { QueryClientProvider } from './query-client-provider'
import { ShortcutsProvider } from './shortcuts-provider'
import { AppToastProvider } from '@/components/ui/toast'

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider>
        <AppToastProvider>
          <ShortcutsProvider>
            {children}
          </ShortcutsProvider>
        </AppToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}


