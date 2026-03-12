import { type ReactNode } from 'react'

interface SectionProps {
  children: ReactNode
  className?: string
  id?: string
}

export function Section({ children, className = '', id = '' }: SectionProps) {
  return (
    <section id={id} className={`py-24 px-6 md:px-12 lg:px-24 ${className}`}>
      <div className="max-w-7xl mx-auto">
        {children}
      </div>
    </section>
  )
}

interface SectionHeaderProps {
  title: string
  subtitle?: string
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <div className="mb-16 max-w-3xl">
      <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">{title}</h2>
      {subtitle && <p className="text-xl md:text-2xl font-medium opacity-80 leading-relaxed">{subtitle}</p>}
    </div>
  )
}

