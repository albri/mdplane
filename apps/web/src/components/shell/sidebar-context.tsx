'use client'

import { createContext, type Dispatch, type MutableRefObject, type SetStateAction, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

type SidebarMode = 'full' | 'drawer'

interface SidebarContextValue {
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
  collapsed: boolean
  setCollapsed: Dispatch<SetStateAction<boolean>>
  mode: SidebarMode
  closeOnRouteChange: MutableRefObject<boolean>
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

function useSidebarMode(): SidebarMode {
  const [mode, setMode] = useState<SidebarMode>('full')

  useEffect(() => {
    const query = window.matchMedia('(width < 768px)')
    const update = () => {
      setMode(query.matches ? 'drawer' : 'full')
    }

    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return mode
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const mode = useSidebarMode()
  const pathname = usePathname()
  const closeOnRouteChange = useRef(true)

  useEffect(() => {
    if (!closeOnRouteChange.current) {
      closeOnRouteChange.current = true
      return
    }
    setOpen(false)
  }, [pathname, closeOnRouteChange])

  useEffect(() => {
    if (mode === 'drawer') {
      setCollapsed(false)
    }
  }, [mode])

  const value = useMemo(
    () => ({
      open,
      setOpen,
      collapsed,
      setCollapsed,
      mode,
      closeOnRouteChange,
    }),
    [collapsed, mode, open, closeOnRouteChange]
  )

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
}

export function useSidebarContext() {
  const ctx = useContext(SidebarContext)
  if (!ctx) {
    throw new Error('useSidebarContext must be used inside SidebarProvider')
  }
  return ctx
}
