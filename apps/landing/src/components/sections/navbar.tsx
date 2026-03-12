import Link from 'next/link'

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FDFBF7] border-b-3 border-[#1A1A1A] px-6 py-4 flex justify-between items-center">
      <Link href="/" className="font-display font-bold text-2xl tracking-tighter flex items-center gap-2">
        <div className="w-6 h-6 bg-[#1A1A1A] rotate-3 brutal-shadow-sm"></div>
        mdplane
      </Link>
      <div className="hidden md:flex gap-8 font-medium">
        <a href="#why" className="hover:underline underline-offset-4 decoration-2">Why</a>
        <a href="#workspaces" className="hover:underline underline-offset-4 decoration-2">Workspaces</a>
        <a href="#agents" className="hover:underline underline-offset-4 decoration-2">Agents</a>
        <a href="#faqs" className="hover:underline underline-offset-4 decoration-2">FAQs</a>
      </div>
      <Link href="https://app.mdplane.dev" className="px-4 py-2 font-display font-bold text-base brutal-border brutal-shadow brutal-shadow-hover bg-[#FDFBF7] text-[#1A1A1A]">
        Open app
      </Link>
    </nav>
  )
}

