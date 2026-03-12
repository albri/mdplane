'use client'

import { motion } from 'motion/react'
import { ArrowRight, BookOpen, FileText, Bot } from 'lucide-react'
import Link from 'next/link'
import { Section } from '../ui/section'
import { useState, useEffect, useCallback } from 'react'

type LineType = 'h1' | 'h2' | 'text' | 'space' | 'badge' | 'badge-indent'

interface Line {
  type: LineType
  width?: string
  color?: string
}

interface Paper {
  name: string
  lines: Line[]
}

interface Position {
  x: number
  y: number
  rotate: number
}

type AnimationPhase = 'resetting' | 'stacking' | 'unstacking'

const TIMING = {
  stackDelay: 100,
  viewPause: 2500,
  flyOutDelay: 800,
  resetDelay: 600,
  resetDuration: 200,
}

const PAPERS: Paper[] = [
  {
    name: 'readme.md',
    lines: [
      { type: 'h1', width: '55%' },
      { type: 'text', width: '90%' },
      { type: 'text', width: '75%' },
      { type: 'text', width: '82%' },
      { type: 'space' },
      { type: 'h2', width: '40%' },
      { type: 'text', width: '85%' },
      { type: 'text', width: '70%' },
      { type: 'text', width: '78%' },
      { type: 'text', width: '65%' },
      { type: 'space' },
      { type: 'h2', width: '35%' },
      { type: 'text', width: '72%' },
      { type: 'text', width: '80%' },
    ],
  },
  {
    name: 'tasks.md',
    lines: [
      { type: 'h1', width: '45%' },
      { type: 'space' },
      { type: 'badge', color: 'bg-badge-task', width: '70%' },
      { type: 'badge-indent', color: 'bg-badge-claim', width: '50%' },
      { type: 'badge-indent', color: 'bg-badge-response', width: '55%' },
      { type: 'space' },
      { type: 'badge', color: 'bg-badge-task', width: '65%' },
      { type: 'badge-indent', color: 'bg-badge-claim', width: '45%' },
      { type: 'badge-indent', color: 'bg-badge-heartbeat', width: '50%' },
      { type: 'space' },
      { type: 'badge', color: 'bg-badge-task', width: '60%' },
      { type: 'text', width: '40%' },
    ],
  },
  {
    name: 'reviews.md',
    lines: [
      { type: 'h1', width: '50%' },
      { type: 'space' },
      { type: 'badge', color: 'bg-badge-task', width: '80%' },
      { type: 'badge-indent', color: 'bg-badge-claim', width: '45%' },
      { type: 'badge-indent', color: 'bg-badge-blocked', width: '50%' },
      { type: 'badge-indent', color: 'bg-badge-answer', width: '55%' },
      { type: 'badge-indent', color: 'bg-badge-response', width: '40%' },
      { type: 'space' },
      { type: 'badge', color: 'bg-badge-task', width: '72%' },
      { type: 'badge-indent', color: 'bg-badge-claim', width: '48%' },
      { type: 'badge-indent', color: 'bg-badge-response', width: '52%' },
    ],
  },
  {
    name: 'notes.md',
    lines: [
      { type: 'h1', width: '42%' },
      { type: 'text', width: '85%' },
      { type: 'text', width: '70%' },
      { type: 'text', width: '78%' },
      { type: 'text', width: '62%' },
      { type: 'space' },
      { type: 'h2', width: '38%' },
      { type: 'badge', color: 'bg-badge-comment', width: '60%' },
      { type: 'badge', color: 'bg-badge-comment', width: '72%' },
      { type: 'badge', color: 'bg-badge-vote', width: '45%' },
      { type: 'badge', color: 'bg-badge-vote', width: '38%' },
    ],
  },
  {
    name: 'sprint.md',
    lines: [
      { type: 'h1', width: '48%' },
      { type: 'space' },
      { type: 'h2', width: '35%' },
      { type: 'badge', color: 'bg-badge-task', width: '75%' },
      { type: 'badge-indent', color: 'bg-badge-claim', width: '40%' },
      { type: 'badge-indent', color: 'bg-badge-response', width: '52%' },
      { type: 'space' },
      { type: 'h2', width: '40%' },
      { type: 'badge', color: 'bg-badge-task', width: '68%' },
      { type: 'badge-indent', color: 'bg-badge-claim', width: '42%' },
      { type: 'badge-indent', color: 'bg-badge-renew', width: '48%' },
      { type: 'badge-indent', color: 'bg-badge-heartbeat', width: '50%' },
    ],
  },
]

const STACK_POSITIONS: Position[] = [
  { x: 0, y: 0, rotate: -2 },
  { x: 10, y: 20, rotate: 1.5 },
  { x: 20, y: 40, rotate: -1 },
  { x: 30, y: 60, rotate: 2 },
  { x: 40, y: 80, rotate: -0.5 },
]

const FLY_IN_POSITIONS: Position[] = [
  { x: -150, y: 250, rotate: -25 },
  { x: -180, y: 280, rotate: -18 },
  { x: -130, y: 260, rotate: -30 },
  { x: -160, y: 240, rotate: -22 },
  { x: -190, y: 300, rotate: -15 },
]

const FLY_OUT_POSITION: Position = { x: 350, y: -150, rotate: 20 }

function PaperLine({ line }: { line: Line }) {
  switch (line.type) {
    case 'space':
      return <div className="h-3" />
    case 'h1':
      return (
        <div className="flex items-center gap-2">
          <span className="text-terracotta font-mono text-sm font-bold">#</span>
          <div className="h-3 bg-terracotta/80 rounded-sm" style={{ width: line.width }} />
        </div>
      )
    case 'h2':
      return (
        <div className="flex items-center gap-2">
          <span className="text-terracotta font-mono text-xs font-bold">##</span>
          <div className="h-2.5 bg-terracotta/60 rounded-sm" style={{ width: line.width }} />
        </div>
      )
    case 'text':
      return <div className="h-2 bg-muted-foreground/30 rounded-sm" style={{ width: line.width }} />
    case 'badge':
      return (
        <div className="flex items-center gap-2">
          <div className={`w-4 h-4 rounded-sm ${line.color} flex items-center justify-center`}>
            <Bot size={10} className="text-white" />
          </div>
          <div className="h-2 bg-muted-foreground/30 rounded-sm flex-1" style={{ maxWidth: line.width }} />
        </div>
      )
    case 'badge-indent':
      return (
        <div className="flex items-center gap-2 ml-5">
          <div className={`w-3.5 h-3.5 rounded-sm ${line.color} flex items-center justify-center`}>
            <Bot size={8} className="text-white" />
          </div>
          <div className="h-2 bg-muted-foreground/20 rounded-sm flex-1" style={{ maxWidth: line.width }} />
        </div>
      )
    default:
      return null
  }
}

function PaperCard({ name, lines, className = '' }: { name: string; lines: Line[]; className?: string }) {
  return (
    <div className={`bg-card border-3 border-border ${className}`}>
      <div className="px-3 py-2 border-b-3 border-border bg-muted flex items-center gap-2">
        <FileText size={14} className="text-muted-foreground" />
        <span className="font-mono text-sm font-bold">{name}</span>
      </div>
      <div className="p-4 space-y-2 min-h-[280px]">
        {lines.map((line, i) => (
          <PaperLine key={i} line={line} />
        ))}
      </div>
    </div>
  )
}

function useStackAnimation() {
  const [phase, setPhase] = useState<AnimationPhase>('resetting')
  const [visibleCount, setVisibleCount] = useState(0)
  const [flyingOutIndex, setFlyingOutIndex] = useState(-1)

  const runAnimation = useCallback(() => {
    if (phase === 'resetting') {
      setTimeout(() => setPhase('stacking'), TIMING.resetDuration)
    } else if (phase === 'stacking') {
      if (visibleCount < PAPERS.length) {
        setTimeout(() => setVisibleCount((v) => v + 1), TIMING.stackDelay)
      } else {
        setTimeout(() => {
          setPhase('unstacking')
          setFlyingOutIndex(0)
        }, TIMING.viewPause)
      }
    } else if (phase === 'unstacking') {
      if (flyingOutIndex < PAPERS.length) {
        setTimeout(() => setFlyingOutIndex((i) => i + 1), TIMING.flyOutDelay)
      } else {
        setTimeout(() => {
          setVisibleCount(0)
          setFlyingOutIndex(-1)
          setPhase('resetting')
        }, TIMING.resetDelay)
      }
    }
  }, [phase, visibleCount, flyingOutIndex])

  useEffect(() => {
    runAnimation()
  }, [runAnimation])

  return { phase, visibleCount, flyingOutIndex }
}

function getAnimationState(
  index: number,
  phase: AnimationPhase,
  visibleCount: number,
  flyingOutIndex: number
): { position: Position; isVisible: boolean } {
  const isStacked = index < visibleCount
  const hasFlownOut = flyingOutIndex > index

  if (phase === 'resetting') {
    return { position: FLY_IN_POSITIONS[index], isVisible: false }
  }
  if (phase === 'stacking') {
    return {
      position: isStacked ? STACK_POSITIONS[index] : FLY_IN_POSITIONS[index],
      isVisible: isStacked,
    }
  }
  return {
    position: hasFlownOut ? FLY_OUT_POSITION : STACK_POSITIONS[index],
    isVisible: !hasFlownOut,
  }
}

function PaperStack() {
  const { phase, visibleCount, flyingOutIndex } = useStackAnimation()

  return (
    <div className="relative h-[520px] flex items-center justify-center">
      <div className="relative w-[24rem] h-[420px]">
        {PAPERS.map((paper, index) => {
          const { position, isVisible } = getAnimationState(index, phase, visibleCount, flyingOutIndex)
          const hasFlownOut = flyingOutIndex > index

          return (
            <motion.div
              key={paper.name}
              animate={{
                x: position.x,
                y: position.y,
                rotate: position.rotate,
                opacity: isVisible ? 1 : 0,
              }}
              transition={{
                duration: phase === 'resetting' ? 0.05 : hasFlownOut ? 0.4 : 0.3,
                ease: [0.4, 0, 0.2, 1],
              }}
              className="absolute top-0 left-0 w-full"
              style={{ zIndex: PAPERS.length - index }}
            >
              <PaperCard name={paper.name} lines={paper.lines} className={index === 0 ? 'shadow-lg' : 'shadow'} />
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

export function HeroSection() {
  return (
    <Section className="pt-40 pb-32 bg-background relative overflow-hidden">
      <div className="flex flex-col xl:grid xl:grid-cols-2 gap-12 items-center">
        <div className="relative z-10">
          <h1 className="text-6xl md:text-8xl font-bold leading-[0.9] tracking-tighter mb-8">
            Share markdown <span className="text-terracotta">beautifully</span>
          </h1>
          <p className="text-2xl font-medium mb-10 max-w-xl leading-relaxed">
            Drop in a file, get a link. Share with your team — or your agents.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="https://app.mdplane.dev/launch"
              className="px-6 py-3 font-display font-bold text-lg border-3 border-border shadow shadow-hover inline-flex items-center justify-center gap-2 bg-terracotta text-background"
            >
              Share Markdown <ArrowRight size={20} />
            </Link>
            <Link
              href="https://docs.mdplane.dev"
              className="px-6 py-3 font-display font-bold text-lg border-3 border-border shadow shadow-hover inline-flex items-center justify-center gap-2 bg-background text-foreground"
            >
              Read the docs <BookOpen size={20} />
            </Link>
          </div>
        </div>
        <PaperStack />
      </div>
    </Section>
  )
}
