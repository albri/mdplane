'use client'

import { motion } from 'motion/react'
import { ArrowRight, BookOpen } from 'lucide-react'
import Link from 'next/link'
import { Section } from '../ui/section'

export function HeroSection() {
  return (
    <Section className="pt-40 pb-32 bg-[#FDFBF7] relative overflow-hidden">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <div className="relative z-10">
          <h1 className="text-6xl md:text-8xl font-bold leading-[0.9] tracking-tighter mb-8">
            Share markdown <span className="text-[#D97757]">beautifully</span>
          </h1>
          <p className="text-2xl font-medium mb-10 max-w-xl leading-relaxed">
            A workspace for your docs — organized, shareable, and readable by your agents.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="https://app.mdplane.dev" className="px-6 py-3 font-display font-bold text-lg brutal-border brutal-shadow brutal-shadow-hover inline-flex items-center justify-center gap-2 bg-[#D97757] text-[#FDFBF7]">
              Get started <ArrowRight size={20} />
            </Link>
            <Link href="https://docs.mdplane.dev" className="px-6 py-3 font-display font-bold text-lg brutal-border brutal-shadow brutal-shadow-hover inline-flex items-center justify-center gap-2 bg-[#FDFBF7] text-[#1A1A1A]">
              Read the docs <BookOpen size={20} />
            </Link>
          </div>
        </div>
        
        <div className="relative h-[500px] hidden lg:block">
          <motion.div 
            animate={{ y: [0, -20, 0], rotate: [-2, 1, -2] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-10 right-10 w-80 bg-white p-6 brutal-border brutal-shadow-lg z-20"
          >
            <div className="w-3/4 h-4 bg-[#1A1A1A] mb-4"></div>
            <div className="w-full h-2 bg-gray-200 mb-2"></div>
            <div className="w-5/6 h-2 bg-gray-200 mb-2"></div>
            <div className="w-full h-2 bg-gray-200 mb-6"></div>
            <div className="flex gap-2">
              <div className="w-16 h-6 bg-[#8B9A8B] brutal-border"></div>
              <div className="w-16 h-6 bg-[#E8A851] brutal-border"></div>
            </div>
          </motion.div>
          
          <motion.div 
            animate={{ y: [0, 20, 0], rotate: [3, -1, 3] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-20 left-10 w-72 bg-[#F4F1EA] p-6 brutal-border brutal-shadow-lg z-10"
          >
            <div className="font-mono text-xs mb-4 text-[#D97757]"># API Spec</div>
            <div className="font-mono text-[10px] leading-relaxed opacity-70">
              GET /api/v1/workspaces<br/>
              Authorization: Bearer r_xxx<br/>
              <br/>
              Response:<br/>
              {'{'}<br/>
              &nbsp;&nbsp;&quot;id&quot;: &quot;ws_123&quot;,<br/>
              &nbsp;&nbsp;&quot;files&quot;: [...]<br/>
              {'}'}
            </div>
          </motion.div>
        </div>
      </div>
    </Section>
  )
}

