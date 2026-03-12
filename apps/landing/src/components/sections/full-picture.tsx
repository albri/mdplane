import { ArrowRight, Check, RefreshCw } from 'lucide-react'
import { Section, SectionHeader } from '../ui/section'

export function FullPictureSection() {
  return (
    <Section className="bg-background">
      <SectionHeader 
        title="The full picture" 
        subtitle="From workspace to completion." 
      />
      
      <div className="py-12 flex justify-center">
        <div className="max-w-4xl w-full flex flex-col items-center">
          {/* Setup Row */}
          <div className="flex flex-wrap justify-center gap-4 mb-8 w-full">
            <div className="bg-card px-6 py-3 border-3 border-border shadow-sm font-bold">Create workspace</div>
            <ArrowRight className="self-center hidden md:block" />
            <div className="bg-card px-6 py-3 border-3 border-border shadow-sm font-bold">Get keys</div>
            <ArrowRight className="self-center hidden md:block" />
            <div className="bg-card px-6 py-3 border-3 border-border shadow-sm font-bold">Add files</div>
            <ArrowRight className="self-center hidden md:block" />
            <div className="bg-card px-6 py-3 border-3 border-border shadow-sm font-bold">Share</div>
          </div>
          
          <div className="w-1 h-12 bg-foreground mb-8"></div>
          
          <div className="bg-sage text-white px-8 py-4 border-3 border-border shadow-sm font-bold text-xl mb-8 w-64 text-center">
            Watcher subscribes
          </div>
          
          <div className="w-1 h-12 bg-foreground mb-8"></div>
          
          <div className="bg-foreground text-background px-8 py-4 border-3 border-border shadow-sm font-bold text-xl mb-8 w-64 text-center">
            Task arrives
          </div>
          
          <div className="w-1 h-12 bg-foreground mb-8"></div>
          
          <div className="bg-card px-8 py-4 border-3 border-border shadow-sm font-bold text-xl mb-8 w-64 text-center">
            Agent spawns
          </div>
          
          <div className="w-1 h-12 bg-foreground mb-8"></div>
          
          <div className="bg-amber px-10 py-5 border-3 border-border shadow-lg font-bold text-2xl mb-8 w-72 text-center transform scale-110 rotate-2">
            Claim
          </div>
          
          <div className="w-1 h-12 bg-foreground mb-8"></div>
          
          <div className="bg-card px-8 py-4 border-3 border-border shadow-sm font-bold text-xl mb-8 w-64 text-center">
            Work
          </div>
          
          <div className="w-1 h-12 bg-foreground mb-8"></div>
          
          {/* Branch */}
          <div className="flex w-full max-w-2xl justify-between relative">
            <div className="absolute top-0 left-1/4 right-1/4 h-1 bg-foreground"></div>
            <div className="absolute top-0 left-1/4 w-1 h-8 bg-foreground"></div>
            <div className="absolute top-0 right-1/4 w-1 h-8 bg-foreground"></div>
            
            <div className="w-1/2 flex flex-col items-center pt-8">
              <div className="text-sage font-bold mb-4 uppercase tracking-widest">Success</div>
              <div className="bg-card px-6 py-3 border-3 border-border shadow-sm font-bold mb-4 w-48 text-center">Response</div>
              <div className="w-1 h-6 bg-foreground mb-4"></div>
              <div className="bg-sage text-white px-6 py-3 border-3 border-border shadow-sm font-bold w-48 text-center flex justify-center items-center gap-2">
                Done <Check size={20} />
              </div>
            </div>
            
            <div className="w-1/2 flex flex-col items-center pt-8">
              <div className="text-terracotta font-bold mb-4 uppercase tracking-widest">Stuck</div>
              <div className="bg-card px-6 py-3 border-3 border-border shadow-sm font-bold mb-4 w-48 text-center">Blocked</div>
              <div className="w-1 h-6 bg-foreground mb-4"></div>
              <div className="bg-card px-6 py-3 border-3 border-border shadow-sm font-bold mb-4 w-48 text-center">Answer</div>
              <div className="w-1 h-6 bg-foreground mb-4"></div>
              <div className="text-foreground font-bold flex items-center gap-2">
                <RefreshCw size={16} /> retry
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-16 text-center font-mono text-sm opacity-70">
        First to claim wins • Claims expire automatically • Blocked tasks wait for answers
      </div>
    </Section>
  )
}

