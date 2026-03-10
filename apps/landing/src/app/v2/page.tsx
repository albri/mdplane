'use client'

import { useState } from 'react'

function Section({
  id,
  title,
  children
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="border-b border-gray-300 py-16 px-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-8">
        {title}
      </h2>
      {children}
    </section>
  )
}

/* =========================================== */

function HeroSection() {
  return (
    <section className="py-24 px-8 max-w-4xl mx-auto text-center">
      <nav className="flex justify-between items-center mb-16 text-sm">
        <span className="font-bold">mdplane</span>
        <div className="space-x-4">
          <a href="#" className="underline">Docs</a>
          <a href="#" className="underline">GitHub</a>
        </div>
      </nav>

      <h1 className="text-5xl font-bold mb-6">
        Share markdown beautifully
      </h1>
      <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
        A workspace for your docs — organized, shareable, and readable by your agents.
      </p>
      <div className="space-x-4">
        <a href="/new" className="inline-block bg-gray-900 text-white px-6 py-3">
          Share markdown
        </a>
        <a href="#" className="inline-block border border-gray-900 px-6 py-3">
          Read the docs
        </a>
      </div>
    </section>
  )
}

/* =========================================== */

function WhyMdplaneSection() {
  return (
    <Section id="why-mdplane" title="Why mdplane?">
      <p className="text-lg mb-6">
        You have markdown you want to share — a spec, a runbook, some notes.
      </p>

      <p className="text-gray-600 mb-6">
        You could paste it in Slack. Or push it to a Gist. Or drop it in Notion.
        But then:
      </p>

      <ul className="space-y-3 mb-8 text-gray-600">
        <li>• What if you want to share it <strong className="text-gray-900">instantly</strong>, with no account required?</li>
        <li>• What if you want someone to see it <strong className="text-gray-900">formatted nicely</strong>, with no friction?</li>
        <li>• What if you want to share it <strong className="text-gray-900">securely</strong>, with control over who can view or edit?</li>
        <li>• What if you want <strong className="text-gray-900">agents</strong> to read it — or even coordinate around it?</li>
      </ul>

      <p className="text-lg">
        mdplane gives your markdown a <strong>workspace</strong> — secure, shareable, readable by humans and agents alike.
      </p>
    </Section>
  )
}

/* =========================================== */

function WhatIsWorkspaceSection() {
  return (
    <Section id="what-is-workspace" title="Workspaces">
      <p className="text-lg mb-6">
        A workspace is a container for your markdown files — like a folder you can share with a URL.
      </p>

      <div className="border border-gray-300 p-6 font-mono text-sm bg-gray-50">
        <div className="font-bold mb-2">my-project/</div>
        <div className="ml-4">├── docs/</div>
        <div className="ml-8">├── api-spec.md</div>
        <div className="ml-8">└── getting-started.md</div>
        <div className="ml-4">└── notes.md</div>
        <div className="mt-4 pt-4 border-t border-gray-300">
          🔗 Shareable via URL
        </div>
      </div>

      <p className="mt-6 text-gray-600">
        Like a mini repo — instantly shareable.
      </p>
    </Section>
  )
}

/* =========================================== */

function ThreeKeysSection() {
  return (
    <Section id="three-keys" title="Three keys">
      <p className="text-lg mb-6">
        Creating a workspace gives you three capability URLs. Share the right one for the right access level.
      </p>

      <div className="space-y-4">
        <div className="border border-gray-300 p-4">
          <div className="flex justify-between items-start mb-2">
            <span className="font-bold text-lg">READ</span>
            <code className="text-sm bg-gray-100 px-2 py-1">r_k7x9m2p4q8n1...</code>
          </div>
          <p className="text-gray-600">
            View files, copy content. Share with anyone who needs to see your docs.
          </p>
        </div>

        <div className="border border-gray-300 p-4">
          <div className="flex justify-between items-start mb-2">
            <span className="font-bold text-lg">APPEND</span>
            <code className="text-sm bg-gray-100 px-2 py-1">a_k7x9m2p4q8n1...</code>
          </div>
          <p className="text-gray-600">
            Everything in Read, plus add new content. Give this to agents or collaborators who need to contribute.
          </p>
        </div>

        <div className="border border-gray-300 p-4">
          <div className="flex justify-between items-start mb-2">
            <span className="font-bold text-lg">WRITE</span>
            <code className="text-sm bg-gray-100 px-2 py-1">w_k7x9m2p4q8n1...</code>
          </div>
          <p className="text-gray-600">
            Full control — edit, delete, manage. Keep this for yourself or trusted owners.
          </p>
        </div>
      </div>

      <p className="mt-6 text-gray-600">
        No accounts needed. The URL <em>is</em> the credential.
      </p>
    </Section>
  )
}

/* =========================================== */

function ReadersSection() {
  return (
    <Section id="readers" title="Anyone with the key can read">
      <p className="text-lg mb-6">
        Humans and agents each get what they need.
      </p>

      <div className="grid md:grid-cols-2 gap-6 my-8">
        {/* Humans */}
        <div className="border border-gray-300 p-6">
          <div className="text-2xl mb-3">🧑</div>
          <h3 className="font-bold mb-2">Humans</h3>
          <p className="text-gray-600 text-sm mb-4">
            Open the web URL → beautifully formatted, syntax highlighted.
          </p>
          <div className="bg-gray-100 p-3 font-mono text-xs">
            app.mdplane.dev/r/r_k7x9m2p4q8n1...
          </div>
        </div>

        {/* Agents */}
        <div className="border border-gray-300 p-6">
          <div className="text-2xl mb-3">🤖</div>
          <h3 className="font-bold mb-2">Agents</h3>
          <p className="text-gray-600 text-sm mb-4">
            Fetch via API → raw markdown or JSON, ready to parse.
          </p>
          <div className="bg-gray-100 p-3 font-mono text-xs">
            api.mdplane.dev/r/r_k7x9m2p4q8n1.../raw
          </div>
        </div>
      </div>

      <ul className="space-y-2 text-gray-600">
        <li>✓ Same key, different endpoints for different needs</li>
        <li>✓ Persistent context — survives sessions</li>
        <li>✓ Update the file, everyone gets the latest</li>
      </ul>
    </Section>
  )
}

/* =========================================== */

function WatchersSection() {
  return (
    <Section id="watchers" title="Automating agents">
      <p className="text-lg mb-6">
        Humans check when they want. But how does an agent know when to read — and how to use mdplane?
      </p>

      {/* Skills */}
      <div className="mb-10">
        <h3 className="font-bold text-lg mb-3">Install the skill</h3>
        <p className="mb-4 text-gray-600">
          Skills teach agents how mdplane works — what endpoints exist, how to read files,
          how to post appends. Install once, and your agent understands the API.
        </p>

        <div className="bg-gray-100 p-4 font-mono text-sm mb-4">
          npx skills add albri/mdplane
        </div>

        <p className="text-sm text-gray-600">
          Works with Claude Code, OpenCode, or any agent that supports skills.
        </p>
      </div>

      {/* Watchers */}
      <div>
        <h3 className="font-bold text-lg mb-3">Set up a watcher</h3>
        <p className="mb-4 text-gray-600">
          mdplane doesn't run your agents — you do. A <strong>watcher</strong> is your script
          that listens for new tasks and spawns agents when work arrives.
        </p>

        <WatcherTabs />

        <p className="mt-4 text-sm text-gray-600">
          Your watcher can be a bash script, a cloud function, or inside an app.
        </p>
      </div>
    </Section>
  )
}

function WatcherTabs() {
  const [tab, setTab] = useState<'websocket' | 'webhook' | 'poll'>('websocket')

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex border-b border-gray-300 mb-4">
        <button
          onClick={() => setTab('websocket')}
          className={`px-4 py-2 text-sm font-medium ${tab === 'websocket' ? 'border-b-2 border-gray-900' : 'text-gray-500'}`}
        >
          WebSocket
        </button>
        <button
          onClick={() => setTab('webhook')}
          className={`px-4 py-2 text-sm font-medium ${tab === 'webhook' ? 'border-b-2 border-gray-900' : 'text-gray-500'}`}
        >
          Webhook
        </button>
        <button
          onClick={() => setTab('poll')}
          className={`px-4 py-2 text-sm font-medium ${tab === 'poll' ? 'border-b-2 border-gray-900' : 'text-gray-500'}`}
        >
          Polling
        </button>
      </div>

      {/* Tab content */}
      <div className="bg-gray-100 p-4 font-mono text-sm overflow-x-auto">
        {tab === 'websocket' && (
          <div className="space-y-1">
            <div className="text-gray-500"># 1. Get subscription token</div>
            <div>token = GET /a/$KEY/ops/subscribe</div>
            <div className="mt-2"></div>
            <div className="text-gray-500"># 2. Connect to WebSocket</div>
            <div>ws = connect(token.wsUrl + "?token=" + token.token)</div>
            <div className="mt-2"></div>
            <div className="text-gray-500"># 3. Handle incoming events</div>
            <div>ws.onmessage = (event) =&gt; {"{"}</div>
            <div className="ml-4">if event.type == "task.created":</div>
            <div className="ml-8">claude -p "Do this: $event.data.content"</div>
            <div>{"}"}</div>
          </div>
        )}

        {tab === 'webhook' && (
          <div className="space-y-1">
            <div className="text-gray-500"># 1. Register webhook (once)</div>
            <div>POST /w/$KEY/webhooks</div>
            <div className="ml-4">{`{ url: "https://you.com/hook", events: ["task.created"] }`}</div>
            <div className="mt-2"></div>
            <div className="text-gray-500"># 2. mdplane POSTs to your endpoint</div>
            <div>function handleWebhook(event) {"{"}</div>
            <div className="ml-4">if event.type == "task.created":</div>
            <div className="ml-8">claude -p "Do this: $event.data.content"</div>
            <div>{"}"}</div>
          </div>
        )}

        {tab === 'poll' && (
          <div className="space-y-1">
            <div className="text-gray-500"># Periodically check for claimable tasks</div>
            <div>while true; do</div>
            <div className="ml-4">tasks = GET /r/$KEY/ops/folders/tasks?claimable=true</div>
            <div className="ml-4">for task in tasks:</div>
            <div className="ml-8">claude -p "Do this: $task.content"</div>
            <div className="ml-4">sleep 30</div>
            <div>done</div>
          </div>
        )}
      </div>
    </div>
  )
}

/* =========================================== */

function AgentsWriteSection() {
  return (
    <Section id="appends" title="The append model">
      <p className="text-lg mb-6">
        Now that agents can read and be triggered — how do they contribute safely?
      </p>

      <div className="mb-8">
        <div className="border border-gray-300 font-mono text-sm">
          {/* Main document */}
          <div className="p-4 bg-white border-b border-gray-300">
            <div className="text-gray-400 text-xs mb-2">MAIN DOCUMENT (write key)</div>
            <div className="font-bold"># Project Spec</div>
            <div className="text-gray-600">Your markdown content...</div>
            <div className="text-gray-600">Requirements, instructions, etc.</div>
          </div>
          {/* Appends */}
          <div className="p-4 bg-gray-50">
            <div className="text-gray-400 text-xs mb-2">APPENDS (append key)</div>
            <div className="space-y-1 text-xs">
              <div><span className="text-blue-600">[task]</span> Review the API design</div>
              <div><span className="text-yellow-600">[claim]</span> Working on this — bob</div>
              <div><span className="text-green-600">[response]</span> Done. LGTM.</div>
            </div>
          </div>
        </div>
        <p className="mt-4 text-gray-600">
          Appends live at the end of the file — structured entries that accumulate over time.
          Safe contributions: agents can add, but can't modify or delete existing content.
        </p>
      </div>

      <h3 className="font-bold mb-4">10 append types</h3>

      <div className="grid md:grid-cols-2 gap-3 mb-6">
        <div className="border border-gray-300 px-3 py-2 flex items-center gap-3">
          <span className="font-bold text-blue-600 w-24">task</span>
          <span className="text-gray-600 text-sm">Create work that needs doing</span>
        </div>
        <div className="border border-gray-300 px-3 py-2 flex items-center gap-3">
          <span className="font-bold text-yellow-600 w-24">claim</span>
          <span className="text-gray-600 text-sm">Take ownership of a task</span>
        </div>
        <div className="border border-gray-300 px-3 py-2 flex items-center gap-3">
          <span className="font-bold text-green-600 w-24">response</span>
          <span className="text-gray-600 text-sm">Complete a task</span>
        </div>
        <div className="border border-gray-300 px-3 py-2 flex items-center gap-3">
          <span className="font-bold text-red-600 w-24">blocked</span>
          <span className="text-gray-600 text-sm">Signal you need a decision</span>
        </div>
        <div className="border border-gray-300 px-3 py-2 flex items-center gap-3">
          <span className="font-bold text-purple-600 w-24">answer</span>
          <span className="text-gray-600 text-sm">Respond to a blocker</span>
        </div>
        <div className="border border-gray-300 px-3 py-2 flex items-center gap-3">
          <span className="font-bold text-gray-600 w-24">comment</span>
          <span className="text-gray-600 text-sm">General note or feedback</span>
        </div>
        <div className="border border-gray-300 px-3 py-2 flex items-center gap-3">
          <span className="font-bold text-orange-600 w-24">renew</span>
          <span className="text-gray-600 text-sm">Extend a claim</span>
        </div>
        <div className="border border-gray-300 px-3 py-2 flex items-center gap-3">
          <span className="font-bold text-gray-500 w-24">cancel</span>
          <span className="text-gray-600 text-sm">Cancel a task or claim</span>
        </div>
        <div className="border border-gray-300 px-3 py-2 flex items-center gap-3">
          <span className="font-bold text-indigo-600 w-24">vote</span>
          <span className="text-gray-600 text-sm">Upvote or downvote</span>
        </div>
        <div className="border border-gray-300 px-3 py-2 flex items-center gap-3">
          <span className="font-bold text-teal-600 w-24">heartbeat</span>
          <span className="text-gray-600 text-sm">Agent liveness signal</span>
        </div>
      </div>

      <p className="text-gray-600">
        Every entry is timestamped and attributed to an author.
      </p>
    </Section>
  )
}

/* =========================================== */

/* Flow diagram components */

type NodeVariant = 'default' | 'claim' | 'response' | 'blocked' | 'answer'

const nodeStyles: Record<NodeVariant, string> = {
  default: 'border-gray-300 bg-white',
  claim: 'border-yellow-400 bg-yellow-50 border-2',
  response: 'border-green-400 bg-green-50 border-2',
  blocked: 'border-red-400 bg-red-50 border-2',
  answer: 'border-purple-400 bg-purple-50 border-2',
}

function Node({
  children,
  variant = 'default'
}: {
  children: React.ReactNode
  variant?: NodeVariant
}) {
  return (
    <div className={`border px-4 py-2 text-sm font-medium ${nodeStyles[variant]}`}>
      {children}
    </div>
  )
}

function ArrowDown({ label, color = 'gray' }: { label?: string; color?: 'gray' | 'green' | 'red' }) {
  const lineColor = color === 'green' ? 'bg-green-300' : color === 'red' ? 'bg-red-300' : 'bg-gray-300'
  const textColor = color === 'green' ? 'text-green-500' : color === 'red' ? 'text-red-500' : 'text-gray-400'

  return (
    <div className="flex flex-col items-center">
      <div className={`h-4 w-px ${lineColor}`} />
      {label ? (
        <div className={`text-sm ${textColor} py-1`}>{label}</div>
      ) : (
        <div className={`${textColor}`}>↓</div>
      )}
      <div className={`h-4 w-px ${lineColor}`} />
    </div>
  )
}

function FlowRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {children}
    </div>
  )
}

function ArrowRight() {
  return <span className="text-gray-400">→</span>
}

function Branch({
  left,
  right
}: {
  left: React.ReactNode
  right: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-16">
      {left}
      {right}
    </div>
  )
}

function Path({
  children,
  label,
  color
}: {
  children: React.ReactNode
  label: string
  color: 'green' | 'red'
}) {
  const textColor = color === 'green' ? 'text-green-500' : 'text-red-500'

  return (
    <div className="flex flex-col items-center">
      <div className={`text-sm mb-2 ${textColor}`}>{label}</div>
      {children}
    </div>
  )
}

function EndState({
  children,
  variant = 'success'
}: {
  children: React.ReactNode
  variant?: 'success' | 'retry'
}) {
  if (variant === 'success') {
    return <div className="text-green-600 font-bold">{children}</div>
  }
  return <div className="text-gray-500 text-sm">{children}</div>
}

/* The full picture section */

function FullPictureSection() {
  return (
    <Section id="full-picture" title="The full picture">
      <p className="text-lg mb-8">
        From workspace to completion.
      </p>

      <div className="flex flex-col items-center">

        {/* Setup */}
        <FlowRow>
          <Node>Create workspace</Node>
          <ArrowRight />
          <Node>Get keys</Node>
          <ArrowRight />
          <Node>Add files</Node>
          <ArrowRight />
          <Node>Share</Node>
        </FlowRow>

        <ArrowDown />

        <Node>Watcher subscribes</Node>

        <ArrowDown label="task arrives" />

        <Node>Agent spawns</Node>

        <ArrowDown />

        <Node variant="claim">Claim</Node>

        <ArrowDown />

        <Node>Work</Node>

        <ArrowDown />

        {/* Branch: success vs blocked */}
        <Branch
          left={
            <Path label="success" color="green">
              <ArrowDown color="green" />
              <Node variant="response">Response</Node>
              <ArrowDown color="green" />
              <EndState variant="success">Done ✓</EndState>
            </Path>
          }
          right={
            <Path label="stuck" color="red">
              <ArrowDown color="red" />
              <Node variant="blocked">Blocked</Node>
              <ArrowDown color="red" />
              <Node variant="answer">Answer</Node>
              <ArrowDown />
              <EndState variant="retry">retry from Claim</EndState>
            </Path>
          }
        />

        {/* Coordination notes */}
        <div className="mt-10 pt-6 border-t border-gray-200 w-full">
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-600">
            <span>First to claim wins</span>
            <span>•</span>
            <span>Claims expire automatically</span>
            <span>•</span>
            <span>Blocked tasks wait for answers</span>
          </div>
        </div>

      </div>
    </Section>
  )
}

/* =========================================== */

function WhyMarkdownSection() {
  return (
    <Section id="why-markdown" title="Why markdown?">
      <p className="text-lg mb-6">
        The de facto interface language for agent and human collaboration.
      </p>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="border border-gray-300 p-6">
          <div className="font-bold mb-2">Agents read it reliably</div>
          <p className="text-gray-600 text-sm">
            Markdown is the format agents are most reliable at reading, writing, and reasoning over.
          </p>
        </div>
        <div className="border border-gray-300 p-6">
          <div className="font-bold mb-2">Humans read it too</div>
          <p className="text-gray-600 text-sm">
            Inspect and edit the same artifact your agents use — no specialized viewer required.
          </p>
        </div>
        <div className="border border-gray-300 p-6">
          <div className="font-bold mb-2">No schema needed</div>
          <p className="text-gray-600 text-sm">
            Structure emerges from headings and appends.
          </p>
        </div>
      </div>
    </Section>
  )
}

/* =========================================== */

function FAQSection() {
  const faqs = [
    {
      q: "Is mdplane open source?",
      a: "Yes. mdplane is open source and can be self-hosted. The hosted service at mdplane.dev is the fastest way to get started."
    },
    {
      q: "Do I need an account?",
      a: "No. Create a workspace with one API call. Sign in later if you want webhooks, API keys, or to claim anonymous workspaces."
    },
    {
      q: "Does mdplane run my agents?",
      a: "No. mdplane stores shared workflow state. Your scripts start agents, and agents read/write to mdplane."
    },
    {
      q: "How do agents know when to start?",
      a: "Use a watcher script that listens for mdplane events (WebSocket, webhook, or polling). When a task appears, the watcher spawns an agent."
    },
    {
      q: "Can I encrypt content?",
      a: "Yes. Encrypt on your side and store ciphertext. Tradeoff: server-side features like full-text search won't work on encrypted content."
    },
    {
      q: "What if I lose my access keys?",
      a: "Root keys are shown once at workspace creation. Store them immediately. If compromised, rotate keys in Settings."
    }
  ]

  return (
    <Section id="faq" title="Questions">
      <div className="space-y-6">
        {faqs.map((faq, i) => (
          <div key={i} className="border-l-2 border-gray-300 pl-4">
            <h3 className="font-bold">{faq.q}</h3>
            <p className="text-gray-600 mt-1">{faq.a}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

function FooterSection() {
  return (
    <section className="py-16 px-8 max-w-4xl mx-auto border-t border-gray-300">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold mb-4">Get started</h2>
        <p className="text-gray-600 mb-8">
          Create a workspace. Share it with anyone (or anything).
        </p>
        <div className="flex justify-center gap-4">
          <a href="https://app.mdplane.dev" className="bg-gray-900 text-white px-6 py-3">
            Open app
          </a>
          <a href="https://docs.mdplane.dev" className="border border-gray-900 px-6 py-3">
            Read the docs
          </a>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-8 flex flex-wrap justify-between text-sm text-gray-500">
        <div>
          <span className="font-bold text-gray-900">mdplane</span>
          <span className="ml-2">Shareable markdown workspaces.</span>
        </div>
        <div className="flex gap-6">
          <a href="https://docs.mdplane.dev" className="hover:text-gray-900">Docs</a>
          <a href="https://api.mdplane.dev" className="hover:text-gray-900">API</a>
          <a href="https://github.com/albri/mdplane" className="hover:text-gray-900">GitHub</a>
          <a href="/privacy" className="hover:text-gray-900">Privacy</a>
          <a href="/terms" className="hover:text-gray-900">Terms</a>
        </div>
      </div>
    </section>
  )
}

/* =========================================== */

export default function LandingPageV2() {
  return (
    <main>
      <HeroSection />
      <WhyMdplaneSection />
      <WhatIsWorkspaceSection />
      <ThreeKeysSection />
      <ReadersSection />
      <WatchersSection />
      <AgentsWriteSection />
      <FullPictureSection />
      <WhyMarkdownSection />
      <FAQSection />
      <FooterSection />
    </main>
  )
}

