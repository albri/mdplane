'use client'

import Link from 'next/link'
import { useId, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  BookText,
  Check,
  Copy,
  Play,
  RadioTower,
  Split,
  Terminal,
  type LucideIcon,
} from 'lucide-react'
import { Section, SectionHeader } from '../ui/section'

const TABS = ['polling', 'websocket', 'webhook'] as const
type TabId = (typeof TABS)[number]

const SKILL_INSTALL_COMMAND = 'npx skills add albri/mdplane'
const DOCS_LLMS_URL = 'https://docs.mdplane.dev/llms.txt'

interface WatcherFlowStep {
  label: string
  text: string
  icon: LucideIcon
  cardClassName: string
  iconBoxClassName: string
  iconClassName: string
}

const WATCHER_FLOW: readonly WatcherFlowStep[] = [
  {
    label: 'mdplane emits',
    text: 'The worklog changes and mdplane emits an event.',
    icon: RadioTower,
    cardClassName: 'bg-card text-foreground',
    iconBoxClassName: 'bg-amber',
    iconClassName: 'text-foreground',
  },
  {
    label: 'watcher decides',
    text: 'Your watcher catches it and decides what should happen next.',
    icon: Split,
    cardClassName: 'bg-sage text-white',
    iconBoxClassName: 'bg-white/20',
    iconClassName: 'text-white',
  },
  {
    label: 'agent runs',
    text: 'The watcher starts a one-off agent run with the right prompt or task content.',
    icon: Play,
    cardClassName: 'bg-terracotta text-white',
    iconBoxClassName: 'bg-white/20',
    iconClassName: 'text-white',
  },
] as const

const CODE_EXAMPLES: Record<TabId, React.ReactNode> = {
  polling: (
    <pre>
      <span className="text-amber">setInterval</span>(<span className="text-terracotta">async</span> () =&gt; {'{'}<br />
      &nbsp;&nbsp;<span className="text-terracotta">const</span> board = <span className="text-terracotta">await</span> fetch(<span className="text-sage">&apos;/r/r_xxx/orchestration?status=pending&amp;limit=1&apos;</span>);<br />
      &nbsp;&nbsp;<span className="text-terracotta">const</span> {'{'} data {'}'} = <span className="text-terracotta">await</span> board.json();<br />
      &nbsp;&nbsp;<span className="text-terracotta">const</span> task = data.tasks?.[<span className="text-amber">0</span>];<br />
      &nbsp;&nbsp;<span className="text-terracotta">if</span> (!task) <span className="text-terracotta">return</span>;<br />
      <br />
      &nbsp;&nbsp;<span className="text-sage">{'// Start a one-off Claude Code run for the pending task'}</span><br />
      &nbsp;&nbsp;exec(<span className="text-amber">`claude -p &quot;Use mdplane. Read $&#123;task.file.path&#125;, find task $&#123;task.id&#125;, claim it, do the work, append the result.&quot;`</span>);<br />
      {'}'}, <span className="text-amber">5000</span>);
    </pre>
  ),
  websocket: (
    <pre>
      <span className="text-sage">{'// 1. Ask mdplane for subscription credentials'}</span><br />
      <span className="text-terracotta">const</span> subscribe = <span className="text-terracotta">await</span> fetch(<span className="text-sage">&apos;/a/a_xxx/ops/subscribe&apos;</span>);<br />
      <span className="text-terracotta">const</span> {'{'} data {'}'} = <span className="text-terracotta">await</span> subscribe.json();<br />
      <br />
      <span className="text-sage">{'// 2. Connect your watcher and listen for task events'}</span><br />
      <span className="text-terracotta">const</span> ws = <span className="text-amber">new</span> WebSocket(<span className="text-sage">`$&#123;data.wsUrl&#125;?token=$&#123;data.token&#125;`</span>);<br />
      <br />
      ws.onmessage = (raw) =&gt; {'{'}<br />
      &nbsp;&nbsp;<span className="text-terracotta">const</span> message = JSON.parse(raw.data);<br />
      &nbsp;&nbsp;<span className="text-terracotta">if</span> (message.event !== <span className="text-sage">&apos;task.created&apos;</span>) <span className="text-terracotta">return</span>;<br />
      <br />
      &nbsp;&nbsp;<span className="text-sage">{'// 3. Start a one-off Claude Code run for this task'}</span><br />
      &nbsp;&nbsp;exec(<span className="text-amber">`claude -p &quot;Use mdplane. Read $&#123;message.file.path&#125;, find task $&#123;message.data.append.id&#125;, claim it, do the work, append the result.&quot;`</span>);<br />
      {'}'};
    </pre>
  ),
  webhook: (
    <pre>
      app.post(<span className="text-sage">&apos;/mdplane-webhook&apos;</span>, (req, res) =&gt; {'{'}<br />
      &nbsp;&nbsp;<span className="text-terracotta">const</span> {'{'} event, data {'}'} = req.body;<br />
      &nbsp;&nbsp;<span className="text-terracotta">if</span> (event !== <span className="text-sage">&apos;task.created&apos;</span>) <span className="text-terracotta">return</span> res.sendStatus(<span className="text-amber">200</span>);<br />
      <br />
      &nbsp;&nbsp;<span className="text-sage">{'// Start a one-off Claude Code run for this task'}</span><br />
      &nbsp;&nbsp;exec(<span className="text-amber">`claude -p &quot;Use mdplane. Read $&#123;data.file.path&#125;, find task $&#123;data.append.id&#125;, claim it, do the work, append the result.&quot;`</span>);<br />
      &nbsp;&nbsp;res.sendStatus(<span className="text-amber">200</span>);<br />
      {'}'});
    </pre>
  ),
}

interface TeachingOption {
  title: string
  description: string
  icon: LucideIcon
  cardClassName: string
  accentClassName: string
  content: React.ReactNode
}

function WatcherFlowCard({ step }: { step: WatcherFlowStep }) {
  const Icon = step.icon

  return (
    <article className={`${step.cardClassName} border-3 border-border shadow p-6 flex-1 flex flex-col self-stretch`} role="listitem">
      <div className={`w-12 h-12 ${step.iconBoxClassName} border-3 border-border flex items-center justify-center mb-5`}>
        <Icon size={22} className={step.iconClassName} aria-hidden="true" />
      </div>
      <p className="text-sm font-display font-bold uppercase tracking-widest mb-4 opacity-80">{step.label}</p>
      <p className="text-xl font-medium leading-relaxed">{step.text}</p>
    </article>
  )
}

function TeachingCard({
  title,
  description,
  icon: Icon,
  cardClassName,
  accentClassName,
  content,
}: TeachingOption) {
  return (
    <div className={`${cardClassName} min-w-0 p-6 md:p-8 border-3 border-border shadow-lg`}>
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-12 h-12 ${accentClassName} border-3 border-border flex items-center justify-center`}>
          <Icon size={22} aria-hidden="true" />
        </div>
        <h3 className="text-2xl font-display font-bold">{title}</h3>
      </div>
      <p className="mb-6 text-lg">{description}</p>
      {content}
    </div>
  )
}

function CodeExampleTabs({
  activeTab,
  onTabChange,
  onTabKeyDown,
  tabPanelId,
}: {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  onTabKeyDown: (e: React.KeyboardEvent, index: number) => void
  tabPanelId: string
}) {
  return (
    <div className="bg-card border-3 border-border shadow-lg overflow-hidden mb-12">
      <div role="tablist" aria-label="Code examples" className="flex border-b-3 border-foreground overflow-x-auto">
        {TABS.map((tab, index) => (
          <button
            key={tab}
            id={`tab-${tab}`}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`${tabPanelId}-${tab}`}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => onTabChange(tab)}
            onKeyDown={(e) => onTabKeyDown(e, index)}
            className={`px-8 py-4 font-display font-bold text-lg capitalize border-r-3 border-foreground whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-amber ${
              activeTab === tab ? 'bg-terracotta text-white' : 'hover:bg-muted'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {TABS.map((tab) => (
        <div
          key={tab}
          id={`${tabPanelId}-${tab}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          hidden={activeTab !== tab}
          className="p-8 bg-foreground text-background font-mono text-sm md:text-base overflow-x-auto"
        >
          {CODE_EXAMPLES[tab]}
        </div>
      ))}
    </div>
  )
}

export function EventsSection() {
  const [activeTab, setActiveTab] = useState<TabId>('polling')
  const [copied, setCopied] = useState(false)
  const tabPanelId = useId()

  const handleCopy = async () => {
    await navigator.clipboard.writeText(SKILL_INSTALL_COMMAND)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const tabCount = TABS.length
    let newIndex = index

    if (e.key === 'ArrowRight') {
      newIndex = (index + 1) % tabCount
    } else if (e.key === 'ArrowLeft') {
      newIndex = (index - 1 + tabCount) % tabCount
    } else if (e.key === 'Home') {
      newIndex = 0
    } else if (e.key === 'End') {
      newIndex = tabCount - 1
    } else {
      return
    }

    e.preventDefault()
    const nextTab = TABS[newIndex]
    setActiveTab(nextTab)
    document.getElementById(`tab-${nextTab}`)?.focus()
  }

  const teachingOptions: readonly TeachingOption[] = [
    {
      title: 'Install the skill',
      description: 'Best when your watcher starts local coding-agent runs like Claude Code, Codex, or OpenCode.',
      icon: Terminal,
      cardClassName: 'bg-foreground text-background',
      accentClassName: 'bg-amber text-foreground',
      content: (
        <div className="min-w-0 bg-black p-4 border-3 border-border border-white/20 font-mono text-lg flex items-center gap-3">
          <div className="min-w-0 flex-1 overflow-x-auto">
            <code className="block w-max min-w-full whitespace-nowrap pr-2">{SKILL_INSTALL_COMMAND}</code>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 hover:text-amber transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-sm p-1"
            aria-label={copied ? 'Copied' : 'Copy command'}
          >
            {copied ? <Check size={20} className="text-sage" /> : <Copy size={20} />}
          </button>
        </div>
      ),
    },
    {
      title: 'Use `llms.txt`',
      description: 'Best when your agent can read docs directly and you want to point it at one compact mdplane guide.',
      icon: BookText,
      cardClassName: 'bg-card text-foreground',
      accentClassName: 'bg-terracotta text-white',
      content: (
        <>
          <div className="min-w-0 bg-background p-4 border-3 border-border font-mono text-lg mb-6 overflow-x-auto">
            <code className="block w-max min-w-full whitespace-nowrap">{DOCS_LLMS_URL}</code>
          </div>
          <Link
            href={DOCS_LLMS_URL}
            className="px-6 py-3 font-display font-bold text-lg border-3 border-border shadow shadow-hover inline-flex items-center justify-center bg-amber text-foreground focus:outline-none focus-visible:ring-4 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            Open llms.txt
          </Link>
        </>
      ),
    },
  ] as const

  return (
    <Section id="events" className="bg-muted">
      <SectionHeader
        title="Events"
        subtitle="mdplane emits events when the worklog changes. Create a watcher to catch them, decide what should happen next, and start the next agent run."
      />

      <div className="mb-12 flex flex-col lg:flex-row lg:items-stretch lg:justify-center gap-4" role="list" aria-label="Watcher flow">
        {WATCHER_FLOW.map((step, index) => (
          <div key={step.label} className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 lg:flex-1">
            <WatcherFlowCard step={step} />
            {index < WATCHER_FLOW.length - 1 && (
              <div className="flex lg:hidden items-center justify-center text-foreground/60 py-1" aria-hidden="true">
                <ArrowDown size={28} />
              </div>
            )}
            {index < WATCHER_FLOW.length - 1 && (
              <div className="hidden lg:flex items-center justify-center text-foreground/60" aria-hidden="true">
                <ArrowRight size={28} />
              </div>
            )}
          </div>
        ))}
      </div>

      <CodeExampleTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onTabKeyDown={handleKeyDown}
        tabPanelId={tabPanelId}
      />

      <p className="text-xl mb-12 max-w-3xl">
        Teach your agents in whichever way fits your setup: install the local skill, or point them at the docs site `llms.txt`.
      </p>

      <div className="grid lg:grid-cols-2 gap-6 max-w-5xl">
        {teachingOptions.map((option) => (
          <TeachingCard key={option.title} {...option} />
        ))}
      </div>
    </Section>
  )
}
