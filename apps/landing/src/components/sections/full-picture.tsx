import { ArrowRight, Check, RefreshCw } from 'lucide-react'
import { Section, SectionHeader } from '../ui/section'

const SETUP_STEPS = ['Create workspace', 'Get keys', 'Add files', 'Share']

const FLOW_STEPS = [
  { label: 'Watcher subscribes', style: 'bg-sage text-white' },
  { label: 'Task arrives', style: 'bg-foreground text-background' },
  { label: 'Agent spawns', style: 'bg-card' },
  { label: 'Claim', style: 'bg-amber', emphasized: true },
  { label: 'Work', style: 'bg-card' },
]

function FlowConnector() {
  return <div className="w-1 h-12 bg-foreground mb-8" aria-hidden="true" />
}

function FlowStep({ label, style, emphasized }: { label: string; style: string; emphasized?: boolean }) {
  const baseClasses = 'px-8 py-4 border-3 border-border shadow-sm font-bold text-xl mb-8 w-64 text-center'
  const emphasisClasses = emphasized ? 'px-10 py-5 text-2xl w-72 shadow-lg transform scale-110 rotate-2' : ''

  return (
    <>
      <div className={`${style} ${baseClasses} ${emphasisClasses}`}>{label}</div>
      <FlowConnector />
    </>
  )
}

export function FullPictureSection() {
  return (
    <Section className="bg-muted">
      <SectionHeader title="The full picture" subtitle="From workspace creation to task completion." />

      <figure className="py-12 flex justify-center" aria-label="Workflow diagram">
        <div className="max-w-4xl w-full flex flex-col items-center">
          <ol className="flex flex-wrap justify-center gap-4 mb-8 w-full" aria-label="Setup steps">
            {SETUP_STEPS.map((step, i) => (
              <li key={step} className="flex items-center gap-4">
                <span className="bg-card px-6 py-3 border-3 border-border shadow-sm font-bold">{step}</span>
                {i < SETUP_STEPS.length - 1 && <ArrowRight className="hidden md:block" aria-hidden="true" />}
              </li>
            ))}
          </ol>

          <FlowConnector />

          {FLOW_STEPS.map((step) => (
            <FlowStep key={step.label} {...step} />
          ))}

          <div className="flex w-full max-w-2xl justify-between relative" role="group" aria-label="Outcome branches">
            <div className="absolute top-0 left-1/4 right-1/4 h-1 bg-foreground" aria-hidden="true" />
            <div className="absolute top-0 left-1/4 w-1 h-8 bg-foreground" aria-hidden="true" />
            <div className="absolute top-0 right-1/4 w-1 h-8 bg-foreground" aria-hidden="true" />

            <div className="w-1/2 flex flex-col items-center pt-8">
              <p className="text-sage font-bold mb-4 uppercase tracking-widest">Success</p>
              <div className="bg-card px-6 py-3 border-3 border-border shadow-sm font-bold mb-4 w-48 text-center">Response</div>
              <div className="w-1 h-6 bg-foreground mb-4" aria-hidden="true" />
              <div className="bg-sage text-white px-6 py-3 border-3 border-border shadow-sm font-bold w-48 text-center flex justify-center items-center gap-2">
                Done <Check size={20} aria-hidden="true" />
              </div>
            </div>

            <div className="w-1/2 flex flex-col items-center pt-8">
              <p className="text-terracotta font-bold mb-4 uppercase tracking-widest">Stuck</p>
              <div className="bg-card px-6 py-3 border-3 border-border shadow-sm font-bold mb-4 w-48 text-center">Blocked</div>
              <div className="w-1 h-6 bg-foreground mb-4" aria-hidden="true" />
              <div className="bg-card px-6 py-3 border-3 border-border shadow-sm font-bold mb-4 w-48 text-center">Answer</div>
              <div className="w-1 h-6 bg-foreground mb-4" aria-hidden="true" />
              <p className="text-foreground font-bold flex items-center gap-2">
                <RefreshCw size={16} aria-hidden="true" /> retry
              </p>
            </div>
          </div>
        </div>
      </figure>

      <p className="mt-16 text-center font-mono text-sm opacity-70">
        First to claim wins • Claims expire automatically • Blocked tasks wait for answers
      </p>
    </Section>
  )
}

