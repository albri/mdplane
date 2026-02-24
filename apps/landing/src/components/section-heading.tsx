import type { ReactNode } from 'react'

type SectionHeadingProps = {
  children: ReactNode
}

export function SectionHeading({ children }: SectionHeadingProps) {
  return (
    <h2 className="font-mono text-xs font-semibold tracking-wider text-primary">
      {children}
    </h2>
  )
}
