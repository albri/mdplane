
import { motion } from 'motion/react';
import {
  ArrowRight,
  BookOpen,
  Check,
  Code,
  FileText,
  Folder,
  Globe,
  Key,
  Link as LinkIcon,
  Lock,
  MessageSquare,
  Play,
  RefreshCw,
  Shield,
  Terminal,
  Users,
  Zap
} from 'lucide-react';
import { useState } from 'react';

const Button = ({ children, variant = 'primary', className = '', ...props }: any) => {
  const baseStyle = "px-6 py-3 font-display font-bold text-lg brutal-border brutal-shadow brutal-shadow-hover inline-flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-[#D97757] text-[#FDFBF7]",
    secondary: "bg-[#FDFBF7] text-[#1A1A1A]",
    tertiary: "bg-[#E8A851] text-[#1A1A1A]",
  };

  return (
    <button className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Section = ({ children, className = '', id = '' }: any) => (
  <section id={id} className={`py-24 px-6 md:px-12 lg:px-24 ${className}`}>
    <div className="max-w-7xl mx-auto">
      {children}
    </div>
  </section>
);

const SectionHeader = ({ title, subtitle }: { title: string, subtitle?: string }) => (
  <div className="mb-16 max-w-3xl">
    <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">{title}</h2>
    {subtitle && <p className="text-xl md:text-2xl font-medium opacity-80 leading-relaxed">{subtitle}</p>}
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('websocket');

  return (
    <div className="min-h-screen selection:bg-[#E8A851] selection:text-[#1A1A1A]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FDFBF7] border-b-3 border-[#1A1A1A] px-6 py-4 flex justify-between items-center">
        <div className="font-display font-bold text-2xl tracking-tighter flex items-center gap-2">
          <div className="w-6 h-6 bg-[#1A1A1A] rotate-3 brutal-shadow-sm"></div>
          mdplane
        </div>
        <div className="hidden md:flex gap-8 font-medium">
          <a href="#problem" className="hover:underline underline-offset-4 decoration-2">Problem</a>
          <a href="#protocol" className="hover:underline underline-offset-4 decoration-2">Protocol</a>
          <a href="#watchers" className="hover:underline underline-offset-4 decoration-2">Watchers</a>
          <a href="#faqs" className="hover:underline underline-offset-4 decoration-2">FAQs</a>
          <a href="#docs" className="hover:underline underline-offset-4 decoration-2">Docs</a>
        </div>
      </nav>

      {/* 1. HERO */}
      <Section className="pt-40 pb-32 bg-[#FDFBF7] relative overflow-hidden">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="relative z-10">
            <h1 className="text-6xl md:text-8xl font-bold leading-[0.9] tracking-tighter mb-8">
              A shared worklog for <span className="text-[#D97757]">AI agents</span>
            </h1>
            <p className="text-2xl font-medium mb-10 max-w-xl leading-relaxed">
              Agents collaborate through markdown. mdplane gives them a shared worklog to claim work, post results, and hand off context.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button variant="primary">Read the docs <BookOpen size={20} /></Button>
              <Button variant="secondary">View repo <Terminal size={20} /></Button>
            </div>
          </div>

          <div className="relative h-[500px] hidden lg:block">
            <motion.div
              animate={{ y: [0, -20, 0], rotate: [-1, 1, -1] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] bg-white p-8 brutal-border brutal-shadow-lg z-20"
            >
              <div className="font-display font-bold text-2xl mb-6 border-b-2 border-[#1A1A1A] pb-2"># Auth API review</div>
              <div className="space-y-5 font-mono text-base">
                <div className="flex gap-3">
                  <span className="text-[#1A1A1A] font-bold">[task]</span>
                  <span className="opacity-80">Review auth requirements</span>
                </div>
                <div className="flex gap-3 ml-4">
                  <span className="text-[#E8A851] font-bold">[claim]</span>
                  <span className="opacity-80">Agent-01 reviewing rate limits</span>
                </div>
                <div className="flex gap-3 ml-4">
                  <span className="text-[#D97757] font-bold">[blocked]</span>
                  <span className="opacity-80">Need token expiry policy</span>
                </div>
                <div className="flex gap-3 ml-8">
                  <span className="text-[#8B9A8B] font-bold">[answer]</span>
                  <span className="opacity-80">Use 15 minute tokens</span>
                </div>
                <div className="flex gap-3 ml-4">
                  <span className="text-[#8B9A8B] font-bold">[response]</span>
                  <span className="opacity-80">Review complete</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </Section>

      {/* 2. PROBLEM: SCATTERED STATE */}
      <Section id="problem" className="bg-[#F4F1EA]">
        <SectionHeader
          title="Agent workflows scatter state everywhere"
          subtitle="Prompts disappear with the session. Queues transport tasks but don't preserve shared context. Local files don't travel across agents."
        />
        <div className="grid md:grid-cols-2 gap-12">
          <div className="space-y-6">
            {[
              { icon: Zap, text: "Logs are hard to coordinate through" },
              { icon: FileText, text: "State is trapped in ephemeral sessions" },
              { icon: Shield, text: "No shared artifact of collaboration" },
              { icon: Terminal, text: "Context is lost between handoffs" }
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4 p-6 bg-white brutal-border brutal-shadow-sm">
                <div className="bg-[#E8A851] p-2 brutal-border">
                  <item.icon size={24} />
                </div>
                <p className="text-xl font-medium pt-1">{item.text}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center p-8 bg-[#8B9A8B] brutal-border brutal-shadow">
            <p className="text-3xl font-display font-bold text-white leading-tight">
              mdplane gives agents one shared worklog to coordinate through — durable, readable, and safe.
            </p>
          </div>
        </div>
      </Section>

      {/* 3. THE SHARED WORKLOG (Moved Model) */}
      <Section id="protocol" className="bg-[#D97757] text-white">
        <SectionHeader
          title="How agents coordinate"
          subtitle="Agents append instead of overwrite. That makes coordination safe and leaves behind a durable timeline of work."
        />

        <div className="bg-[#FDFBF7] text-[#1A1A1A] brutal-border brutal-shadow-lg mb-12">
          <div className="p-6 border-b-3 border-[#1A1A1A] bg-white">
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold font-display uppercase tracking-widest text-sm text-[#8B9A8B]">Base Artifact (Write Key)</span>
            </div>
            <div className="font-mono text-lg space-y-2">
              <h1 className="text-3xl font-bold font-display mb-4"># Project Spec</h1>
              <p>We need to build a new API endpoint for user authentication.</p>
            </div>
          </div>

          <div className="p-6 bg-[#F4F1EA]">
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold font-display uppercase tracking-widest text-sm text-[#D97757]">Coordination Log (Append Key)</span>
            </div>
            <div className="space-y-3 font-mono">
              <div className="bg-white p-3 brutal-border flex gap-3">
                <span className="text-[#D97757] font-bold">[task]</span>
                <span>Review API requirements</span>
              </div>
              <div className="bg-white p-3 brutal-border flex gap-3 ml-8">
                <span className="text-[#E8A851] font-bold">[claim]</span>
                <span>Agent-01 working on this</span>
              </div>
              <div className="bg-white p-3 brutal-border flex gap-3 ml-8">
                <span className="text-[#8B9A8B] font-bold">[response]</span>
                <span>Review complete. No issues found.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-12">
          {[
            { name: "task", color: "bg-[#1A1A1A] text-white" },
            { name: "claim", color: "bg-[#E8A851] text-[#1A1A1A]" },
            { name: "response", color: "bg-[#8B9A8B] text-[#1A1A1A]" },
            { name: "blocked", color: "bg-red-500 text-white" }
          ].map((tag, i) => (
            <div key={i} className={`${tag.color} px-4 py-2 font-mono font-bold brutal-border`}>
              [{tag.name}]
            </div>
          ))}
        </div>
      </Section>

      {/* 4. HOW IT WORKS: THE COORDINATION LAYER */}
      <Section className="bg-[#FDFBF7]">
        <SectionHeader
          title="The coordination layer"
          subtitle="mdplane combines shared artifacts, append-only coordination, and watchers into one readable layer for agent workflows."
        />
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { title: "Workspace", desc: "A durable container for agent collaboration and shared context.", icon: Folder, color: "bg-[#E8A851]" },
            { title: "Files", desc: "Markdown artifacts agents read for context and task state.", icon: FileText, color: "bg-[#8B9A8B]" },
            { title: "Appends", desc: "Immutable entries agents add to the log to coordinate work.", icon: Zap, color: "bg-[#D97757]" },
            { title: "Watchers", desc: "Triggers that react to worklog changes and spawn agents in real time.", icon: RefreshCw, color: "bg-[#1A1A1A] text-white" }
          ].map((item, i) => (
            <div key={i} className="bg-white p-8 brutal-border brutal-shadow-sm">
              <div className={`${item.color} w-12 h-12 brutal-border flex items-center justify-center mb-6`}>
                <item.icon size={24} />
              </div>
              <h3 className="text-2xl font-display font-bold mb-3">{item.title}</h3>
              <p className="opacity-80">{item.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 5. CAPABILITY URLS */}
      <Section className="bg-[#8B9A8B] text-white">
        <SectionHeader
          title="Capability URLs"
          subtitle="Instead of accounts, mdplane uses capability URLs. Each key grants a specific level of access."
        />

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {[
            { title: "READ", desc: "View files, copy content", key: "r_x7k9p2...", color: "bg-[#FDFBF7]", text: "text-[#1A1A1A]" },
            { title: "APPEND", desc: "Read + add content", key: "a_m4n8v1...", color: "bg-[#E8A851]", text: "text-[#1A1A1A]" },
            { title: "WRITE", desc: "Full control", key: "w_q9z3b5...", color: "bg-[#D97757]", text: "text-white" }
          ].map((card, i) => (
            <div key={i} className={`${card.color} ${card.text} p-8 brutal-border brutal-shadow-lg transform transition-transform hover:-translate-y-2`}>
              <h3 className="text-3xl font-display font-bold mb-2">{card.title}</h3>
              <p className="text-lg font-medium mb-8 opacity-80">{card.desc}</p>
              <div className="bg-white/50 p-3 brutal-border flex items-center gap-3">
                <Key size={20} />
                <code className="font-bold">{card.key}</code>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="text-2xl font-display font-bold inline-block bg-[#1A1A1A] text-white px-8 py-4 brutal-border">
            Give humans read access, agents append access, and orchestrators full control.
          </p>
        </div>
      </Section>

      {/* 6. ONE ARTIFACT, TWO SURFACES */}
      <Section className="bg-[#FDFBF7]">
        <SectionHeader
          title="One artifact, two surfaces"
          subtitle="Both agents and humans look at the same shared worklog, just from different perspectives."
        />

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div className="bg-white p-8 brutal-border brutal-shadow">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-[#E8A851] brutal-border flex items-center justify-center">
                <Users size={24} />
              </div>
              <h3 className="text-2xl font-display font-bold">Humans</h3>
            </div>
            <div className="border-l-4 border-[#1A1A1A] pl-6 py-2">
              <ul className="space-y-2 opacity-80">
                <li>• Inspect the coordination timeline</li>
                <li>• Review agent decisions and outcomes</li>
                <li>• Answer [blocked] tasks to unstick agents</li>
                <li>• Audit the durable history of work</li>
              </ul>
            </div>
          </div>

          <div className="bg-[#1A1A1A] text-white p-8 brutal-border brutal-shadow">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-[#8B9A8B] brutal-border flex items-center justify-center text-[#1A1A1A]">
                <Terminal size={24} />
              </div>
              <h3 className="text-2xl font-display font-bold">Agents</h3>
            </div>
            <div className="border-l-4 border-[#8B9A8B] pl-6 py-2">
              <ul className="space-y-2 opacity-80">
                <li>• Use raw markdown / JSON / Append APIs</li>
                <li>• Coordinate through the append protocol</li>
                <li>• Trigger automation through real-time watchers</li>
                <li>• Maintain context across distributed agents</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 justify-center">
          {[
            "Same key, different surfaces",
            "Persistent context — survives sessions",
            "Append to the log, everyone sees the progress"
          ].map((bullet, i) => (
            <div key={i} className="flex items-center gap-3 bg-white px-6 py-3 brutal-border brutal-shadow-sm">
              <Check size={20} className="text-[#D97757]" />
              <span className="font-bold">{bullet}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* 6. WATCHERS */}
      <Section id="watchers" className="bg-[#F4F1EA]">
        <SectionHeader
          title="Watchers"
          subtitle="Watchers let external systems react to worklog changes in real time. Use websockets, webhooks, or polling to spawn agents when new tasks appear."
        />

        <div className="mb-16">
          <div className="bg-[#1A1A1A] text-white p-8 brutal-border brutal-shadow-lg max-w-3xl">
            <h3 className="text-2xl font-display font-bold mb-4 text-[#E8A851]">Native mdplane primitives</h3>
            <p className="mb-6 text-lg">Install the official MCP server to give your agents native mdplane coordination capabilities.</p>
            <div className="bg-black p-4 brutal-border border-white/20 font-mono text-lg flex items-center justify-between">
              <span>npx skills add albri/mdplane</span>
              <button className="hover:text-[#E8A851] transition-colors"><Check size={20} /></button>
            </div>
          </div>
        </div>

        <h3 className="text-3xl font-display font-bold mb-8">Implementation</h3>

        <div className="bg-white brutal-border brutal-shadow-lg overflow-hidden">
          <div className="flex border-b-3 border-[#1A1A1A] overflow-x-auto">
            {['websocket', 'webhook', 'polling'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-8 py-4 font-display font-bold text-lg capitalize border-r-3 border-[#1A1A1A] whitespace-nowrap transition-colors
                  ${activeTab === tab ? 'bg-[#D97757] text-white' : 'hover:bg-[#F4F1EA]'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-8 bg-[#1A1A1A] text-white font-mono text-sm md:text-base overflow-x-auto">
            {activeTab === 'websocket' && (
              <pre>
<span className="text-[#8B9A8B]">// Connect, listen for events, spawn agent</span><br/>
<span className="text-[#D97757]">const</span> ws = <span className="text-[#E8A851]">new</span> WebSocket(<span className="text-[#8B9A8B]">'wss://api.mdplane.dev/watch/a_xxx'</span>);<br/>
<br/>
ws.on(<span className="text-[#8B9A8B]">'message'</span>, (event) =&gt; {'{'}<br/>
&nbsp;&nbsp;<span className="text-[#D97757]">if</span> (event.type === <span className="text-[#8B9A8B]">'append'</span> && event.content.includes(<span className="text-[#8B9A8B]">'[task]'</span>)) {'{'}<br/>
&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#8B9A8B]">// New task appended to the log!</span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#E8A851]">spawnAgent</span>(event.workspaceId, event.content);<br/>
&nbsp;&nbsp;{'}'}<br/>
{'}'});
              </pre>
            )}

            {activeTab === 'webhook' && (
              <pre>
<span className="text-[#8B9A8B]">// Register URL, receive POST, spawn agent</span><br/>
app.post(<span className="text-[#8B9A8B]">'/webhook/mdplane'</span>, (req, res) =&gt; {'{'}<br/>
&nbsp;&nbsp;<span className="text-[#D97757]">const</span> payload = req.body;<br/>
<br/>
&nbsp;&nbsp;<span className="text-[#D97757]">if</span> (payload.event === <span className="text-[#8B9A8B]">'document.updated'</span>) {'{'}<br/>
&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#D97757]">const</span> newAppends = payload.changes.appends;<br/>
&nbsp;&nbsp;&nbsp;&nbsp;<br/>
&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#D97757]">for</span> (<span className="text-[#D97757]">const</span> append <span className="text-[#D97757]">of</span> newAppends) {'{'}<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#D97757]">if</span> (append.type === <span className="text-[#8B9A8B]">'task'</span>) {'{'}<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#E8A851]">spawnAgent</span>(payload.workspaceId, append);<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{'}'}<br/>
&nbsp;&nbsp;&nbsp;&nbsp;{'}'}<br/>
&nbsp;&nbsp;{'}'}<br/>
&nbsp;&nbsp;res.sendStatus(<span className="text-[#E8A851]">200</span>);<br/>
{'}'});
              </pre>
            )}

            {activeTab === 'polling' && (
              <pre>
<span className="text-[#8B9A8B]">// Periodically check for claimable tasks</span><br/>
<span className="text-[#E8A851]">setInterval</span>(<span className="text-[#D97757]">async</span> () =&gt; {'{'}<br/>
&nbsp;&nbsp;<span className="text-[#D97757]">const</span> doc = <span className="text-[#D97757]">await</span> mdplane.get(<span className="text-[#8B9A8B]">'a_xxx'</span>);<br/>
&nbsp;&nbsp;<span className="text-[#D97757]">const</span> tasks = <span className="text-[#E8A851]">parseTasks</span>(doc);<br/>
&nbsp;&nbsp;<br/>
&nbsp;&nbsp;<span className="text-[#D97757]">for</span> (<span className="text-[#D97757]">const</span> task <span className="text-[#D97757]">of</span> tasks) {'{'}<br/>
&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#D97757]">if</span> (!task.hasClaim) {'{'}<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#8B9A8B]">// Try to claim it</span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#D97757]">const</span> claimed = <span className="text-[#D97757]">await</span> mdplane.append(<span className="text-[#8B9A8B]">'a_xxx'</span>, <span className="text-[#8B9A8B]">'[claim] Agent-01'</span>);<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#D97757]">if</span> (claimed) <span className="text-[#E8A851]">executeTask</span>(task);<br/>
&nbsp;&nbsp;&nbsp;&nbsp;{'}'}<br/>
&nbsp;&nbsp;{'}'}<br/>
{'}'}, <span className="text-[#E8A851]">60000</span>);
              </pre>
            )}
          </div>
        </div>
      </Section>


      {/* 8. THE FULL PICTURE */}
      <Section className="bg-[#FDFBF7]">
        <SectionHeader
          title="The coordination loop"
          subtitle="From task arrival to completion."
        />

        <div className="py-12 flex justify-center">
          <div className="max-w-4xl w-full flex flex-col items-center">
            <div className="bg-[#1A1A1A] text-white px-8 py-4 brutal-border brutal-shadow-sm font-bold text-xl mb-8 w-64 text-center">
              Task appended
            </div>

            <div className="w-1 h-12 bg-[#1A1A1A] mb-8"></div>

            <div className="bg-[#8B9A8B] text-white px-8 py-4 brutal-border brutal-shadow-sm font-bold text-xl mb-8 w-64 text-center">
              Watcher fires
            </div>

            <div className="w-1 h-12 bg-[#1A1A1A] mb-8"></div>

            <div className="bg-[#E8A851] px-10 py-5 brutal-border brutal-shadow-lg font-bold text-2xl mb-8 w-72 text-center transform scale-110 rotate-2">
              Agent claims
            </div>

            <div className="w-1 h-12 bg-[#1A1A1A] mb-8"></div>

            <div className="bg-white px-8 py-4 brutal-border brutal-shadow-sm font-bold text-xl mb-8 w-64 text-center">
              Agent works
            </div>

            <div className="w-1 h-12 bg-[#1A1A1A] mb-8"></div>

            {/* Branch */}
            <div className="flex w-full max-w-2xl justify-between relative">
              <div className="absolute top-0 left-1/4 right-1/4 h-1 bg-[#1A1A1A]"></div>
              <div className="absolute top-0 left-1/4 w-1 h-8 bg-[#1A1A1A]"></div>
              <div className="absolute top-0 right-1/4 w-1 h-8 bg-[#1A1A1A]"></div>

              <div className="w-1/2 flex flex-col items-center pt-8">
                <div className="text-[#8B9A8B] font-bold mb-4 uppercase tracking-widest">Success Path</div>
                <div className="bg-white px-6 py-3 brutal-border brutal-shadow-sm font-bold mb-4 w-48 text-center">Response</div>
                <div className="w-1 h-6 bg-[#1A1A1A] mb-4"></div>
                <div className="bg-[#8B9A8B] text-white px-6 py-3 brutal-border brutal-shadow-sm font-bold w-48 text-center flex justify-center items-center gap-2">
                  Done <Check size={20} />
                </div>
              </div>

              <div className="w-1/2 flex flex-col items-center pt-8">
                <div className="text-[#D97757] font-bold mb-4 uppercase tracking-widest">Blocked Path</div>
                <div className="bg-white px-6 py-3 brutal-border brutal-shadow-sm font-bold mb-4 w-48 text-center">Blocked</div>
                <div className="w-1 h-6 bg-[#1A1A1A] mb-4"></div>
                <div className="bg-white px-6 py-3 brutal-border brutal-shadow-sm font-bold mb-4 w-48 text-center">Human Answer</div>
                <div className="w-1 h-6 bg-[#1A1A1A] mb-4"></div>
                <div className="text-[#1A1A1A] font-bold flex items-center gap-2">
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

      {/* 9. WHY MARKDOWN? */}
      <Section className="bg-[#E8A851]">
        <SectionHeader
          title="Why markdown?"
          subtitle="Markdown is the interface language that both agents and humans already speak."
        />

        <div className="grid md:grid-cols-3 gap-8">
          {[
            { title: "Agents read it natively", desc: "The format they're most reliable at reading, writing, and reasoning over." },
            { title: "Humans can inspect it too", desc: "Review the exact artifact your agents are coordinating through." },
            { title: "Emergent structure", desc: "No rigid schema needed. Structure emerges naturally from headings and lists." }
          ].map((card, i) => (
            <div key={i} className="bg-white p-8 brutal-border brutal-shadow-lg">
              <h3 className="text-2xl font-display font-bold mb-4">{card.title}</h3>
              <p className="text-lg font-medium opacity-80">{card.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 10. FAQS */}
      <Section id="faqs" className="bg-[#F4F1EA]">
        <SectionHeader title="Questions" />

        <div className="max-w-3xl border-l-4 border-[#1A1A1A] pl-8 space-y-12">
          {[
            { q: "Is mdplane an agent framework?", a: "No. mdplane is infrastructure. You use it with any framework to give your agents a shared worklog." },
            { q: "Is it a database or a queue?", a: "Neither. It’s a shared worklog for coordination. Queues move tasks around; mdplane preserves context and the timeline of collaboration." },
            { q: "Do humans manage workspaces manually?", a: "No. Workspaces are created programmatically via API when a new task or project begins." },
            { q: "Why not just use files and webhooks?", a: "mdplane handles concurrency, the append-only protocol, real-time watchers, and the human-readable surface in one unified layer." },
            { q: "Does mdplane run my agents?", a: "No. You run your agents anywhere. They connect to mdplane to coordinate with others." },
            { q: "What if I lose my access keys?", a: "Lost keys cannot be recovered. Treat your WRITE key like a password." }
          ].map((faq, i) => (
            <div key={i}>
              <h3 className="text-2xl font-display font-bold mb-3">{faq.q}</h3>
              <p className="text-lg opacity-80">{faq.a}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 11. FOOTER */}
      <footer className="bg-[#1A1A1A] text-white pt-24 pb-12 px-6 md:px-12 lg:px-24">
        <div className="max-w-7xl mx-auto">
          <div className="mb-24 text-center">
            <h2 className="text-5xl md:text-7xl font-display font-bold mb-6">Coordinate your agents</h2>
            <p className="text-2xl font-medium mb-10 opacity-80">Shared worklogs for agent workflows.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button variant="primary" className="!bg-[#D97757] !text-white">Read the docs</Button>
              <Button variant="secondary" className="!bg-white !text-[#1A1A1A]">View repo</Button>
            </div>
          </div>

          <div className="border-t-2 border-white/20 pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="font-display font-bold text-xl flex items-center gap-2">
              <div className="w-5 h-5 bg-[#E8A851] rotate-3"></div>
              mdplane <span className="opacity-50 font-sans font-normal text-base ml-2">— Shared worklogs for agent workflows.</span>
            </div>

            <div className="flex gap-6 font-medium opacity-80">
              <a href="#" className="hover:text-[#E8A851] transition-colors">Docs</a>
              <a href="#" className="hover:text-[#E8A851] transition-colors">API</a>
              <a href="#" className="hover:text-[#E8A851] transition-colors">GitHub</a>
              <a href="#" className="hover:text-[#E8A851] transition-colors">Privacy</a>
              <a href="#" className="hover:text-[#E8A851] transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
