'use client'

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
import { useState } from 'react'
import Link from 'next/link';

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

export function LandingPage() {
  const [activeTab, setActiveTab] = useState('websocket');

  return (
    <div className="min-h-screen selection:bg-[#E8A851] selection:text-[#1A1A1A]">
      {/* Navigation */}
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
        <Link href="https://app.mdplane.dev" className="px-4 py-2 font-display font-bold text-base brutal-border brutal-shadow brutal-shadow-hover bg-[#FDFBF7] text-[#1A1A1A]">Open app</Link>
      </nav>

      {/* 1. HERO */}
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
              <Link href="https://app.mdplane.dev" className="px-6 py-3 font-display font-bold text-lg brutal-border brutal-shadow brutal-shadow-hover inline-flex items-center justify-center gap-2 bg-[#D97757] text-[#FDFBF7]">Get started <ArrowRight size={20} /></Link>
              <Link href="https://docs.mdplane.dev" className="px-6 py-3 font-display font-bold text-lg brutal-border brutal-shadow brutal-shadow-hover inline-flex items-center justify-center gap-2 bg-[#FDFBF7] text-[#1A1A1A]">Read the docs <BookOpen size={20} /></Link>
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
                &nbsp;&nbsp;"id": "ws_123",<br/>
                &nbsp;&nbsp;"files": [...]<br/>
                {'}'}
              </div>
            </motion.div>
          </div>
        </div>
      </Section>

      {/* 2. WHY MDPLANE? */}
      <Section id="why" className="bg-[#F4F1EA]">
        <SectionHeader 
          title="Why mdplane?" 
          subtitle="You have markdown you want to share — a spec, a runbook, some notes." 
        />
        <div className="grid md:grid-cols-2 gap-12">
          <div className="space-y-6">
            {[
              { icon: Zap, text: "Share it instantly, no account required" },
              { icon: FileText, text: "See it formatted nicely, no friction" },
              { icon: Shield, text: "Share it securely, with access control" },
              { icon: Terminal, text: "Let agents read it — or even coordinate around it" }
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
              mdplane gives your markdown a workspace — secure, shareable, readable by humans and agents alike.
            </p>
          </div>
        </div>
      </Section>

      {/* 3. WORKSPACES */}
      <Section id="workspaces" className="bg-[#FDFBF7]">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <SectionHeader title="Workspaces" />
            <p className="text-2xl font-medium mb-8 leading-relaxed">
              A workspace is a container for your markdown files — like a folder you can share with a URL.
            </p>
            <div className="inline-block bg-[#E8A851] px-6 py-4 brutal-border brutal-shadow-sm rotate-1">
              <p className="text-xl font-bold font-display">Like a mini repo — instantly shareable.</p>
            </div>
          </div>
          
          <div className="bg-white p-8 brutal-border brutal-shadow-lg -rotate-1">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b-3 border-[#1A1A1A]">
              <Globe size={24} />
              <span className="font-mono font-bold text-lg">app.mdplane.dev/w/abc-123</span>
            </div>
            <div className="space-y-4 font-mono text-lg">
              <div className="flex items-center gap-3 font-bold">
                <Folder size={20} className="fill-[#E8A851]" />
                <span>project-alpha</span>
              </div>
              <div className="pl-8 space-y-3">
                <div className="flex items-center gap-3">
                  <FileText size={18} />
                  <span>README.md</span>
                </div>
                <div className="flex items-center gap-3">
                  <FileText size={18} />
                  <span>api-spec.md</span>
                </div>
                <div className="flex items-center gap-3">
                  <Folder size={18} className="fill-[#8B9A8B]" />
                  <span>logs</span>
                </div>
                <div className="pl-8 space-y-3">
                  <div className="flex items-center gap-3 text-[#D97757]">
                    <FileText size={18} />
                    <span>agent-run-01.md</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* 4. THREE KEYS */}
      <Section className="bg-[#8B9A8B] text-white">
        <SectionHeader 
          title="Three keys" 
          subtitle="Creating a workspace gives you three capability URLs. Share the right one for the right access level." 
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
          <p className="text-3xl font-display font-bold inline-block bg-[#1A1A1A] text-white px-8 py-4 brutal-border">
            No accounts needed. The URL is the credential.
          </p>
        </div>
      </Section>

      {/* 5. ANYONE WITH THE KEY CAN READ */}
      <Section className="bg-[#FDFBF7]">
        <SectionHeader 
          title="Anyone with the key can read" 
          subtitle="Humans and agents each get what they need." 
        />
        
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div className="bg-white p-8 brutal-border brutal-shadow">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-[#E8A851] brutal-border flex items-center justify-center">
                <Users size={24} />
              </div>
              <h3 className="text-2xl font-display font-bold">Humans</h3>
            </div>
            <div className="bg-[#F4F1EA] p-4 brutal-border mb-6 font-mono text-sm break-all">
              app.mdplane.dev/r/x7k9p2
            </div>
            <div className="border-l-4 border-[#1A1A1A] pl-6 py-2">
              <h4 className="font-display font-bold text-xl mb-2">Beautifully formatted</h4>
              <p className="opacity-80">Rich typography, syntax highlighting, and a clean reading experience.</p>
            </div>
          </div>
          
          <div className="bg-[#1A1A1A] text-white p-8 brutal-border brutal-shadow">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-[#8B9A8B] brutal-border flex items-center justify-center text-[#1A1A1A]">
                <Terminal size={24} />
              </div>
              <h3 className="text-2xl font-display font-bold">Agents</h3>
            </div>
            <div className="bg-white/10 p-4 brutal-border mb-6 font-mono text-sm break-all text-[#E8A851]">
              api.mdplane.dev/r/x7k9p2/raw
            </div>
            <div className="border-l-4 border-[#8B9A8B] pl-6 py-2">
              <h4 className="font-display font-bold text-xl mb-2">Raw markdown or JSON</h4>
              <p className="opacity-80">Clean text ready for context windows, or structured JSON for parsing.</p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 justify-center">
          {[
            "Same key, different endpoints",
            "Persistent context — survives sessions",
            "Update the file, everyone gets the latest"
          ].map((bullet, i) => (
            <div key={i} className="flex items-center gap-3 bg-white px-6 py-3 brutal-border brutal-shadow-sm">
              <Check size={20} className="text-[#D97757]" />
              <span className="font-bold">{bullet}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* 6. AUTOMATING AGENTS */}
      <Section id="agents" className="bg-[#F4F1EA]">
        <SectionHeader 
          title="Automating agents" 
          subtitle="Humans check when they want. But how does an agent know when to read — and how to use mdplane?" 
        />
        
        <div className="mb-16">
          <div className="bg-[#1A1A1A] text-white p-8 brutal-border brutal-shadow-lg max-w-3xl">
            <h3 className="text-2xl font-display font-bold mb-4 text-[#E8A851]">Give your agent the skills</h3>
            <p className="mb-6 text-lg">Install the official MCP server to give your agents native mdplane capabilities.</p>
            <div className="bg-black p-4 brutal-border border-white/20 font-mono text-lg flex items-center justify-between">
              <span>npx skills add albri/mdplane</span>
              <button className="hover:text-[#E8A851] transition-colors"><Check size={20} /></button>
            </div>
          </div>
        </div>
        
        <h3 className="text-3xl font-display font-bold mb-8">Watchers</h3>
        
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
&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#8B9A8B]">// New task added to the document!</span><br/>
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

      {/* 7. THE APPEND MODEL */}
      <Section className="bg-[#D97757] text-white">
        <SectionHeader 
          title="The append model" 
          subtitle="Now that agents can read and be triggered — how do they contribute safely?" 
        />
        
        <div className="bg-[#FDFBF7] text-[#1A1A1A] brutal-border brutal-shadow-lg mb-12">
          <div className="p-6 border-b-3 border-[#1A1A1A] bg-white">
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold font-display uppercase tracking-widest text-sm text-[#8B9A8B]">Main Document (Write Key)</span>
            </div>
            <div className="font-mono text-lg space-y-2">
              <h1 className="text-3xl font-bold font-display mb-4"># Project Spec</h1>
              <p>We need to build a new API endpoint for user authentication.</p>
              <p>Requirements:</p>
              <ul className="list-disc pl-6">
                <li>Rate limiting</li>
                <li>JWT tokens</li>
              </ul>
            </div>
          </div>
          
          <div className="p-6 bg-[#F4F1EA]">
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold font-display uppercase tracking-widest text-sm text-[#D97757]">Appends (Append Key)</span>
            </div>
            <div className="space-y-3 font-mono">
              <div className="bg-white p-3 brutal-border flex gap-3">
                <span className="text-[#D97757] font-bold">[task]</span>
                <span>Review API requirements</span>
              </div>
              <div className="bg-white p-3 brutal-border flex gap-3 ml-8">
                <span className="text-[#E8A851] font-bold">[claim]</span>
                <span>Agent-Alpha working on this</span>
              </div>
              <div className="bg-white p-3 brutal-border flex gap-3 ml-8">
                <span className="text-[#8B9A8B] font-bold">[response]</span>
                <span>Done. Review completed. No issues found.</span>
              </div>
            </div>
          </div>
        </div>
        
        <p className="text-2xl font-medium mb-10 max-w-4xl leading-relaxed">
          Appends live at the end of the file — structured entries that accumulate. Safe contributions: agents can add, but can't modify or delete.
        </p>
        
        <div className="flex flex-wrap gap-3 mb-12">
          {[
            { name: "task", color: "bg-[#1A1A1A] text-white" },
            { name: "claim", color: "bg-[#E8A851] text-[#1A1A1A]" },
            { name: "response", color: "bg-[#8B9A8B] text-[#1A1A1A]" },
            { name: "blocked", color: "bg-red-500 text-white" },
            { name: "answer", color: "bg-blue-500 text-white" },
            { name: "comment", color: "bg-white text-[#1A1A1A]" },
            { name: "renew", color: "bg-white text-[#1A1A1A]" },
            { name: "cancel", color: "bg-white text-[#1A1A1A]" },
            { name: "vote", color: "bg-white text-[#1A1A1A]" },
            { name: "heartbeat", color: "bg-white text-[#1A1A1A]" }
          ].map((tag, i) => (
            <div key={i} className={`${tag.color} px-4 py-2 font-mono font-bold brutal-border`}>
              [{tag.name}]
            </div>
          ))}
        </div>
        
        <div className="inline-block bg-[#1A1A1A] px-6 py-4 brutal-border">
          <p className="text-xl font-bold font-display">Every entry is timestamped and attributed to an author.</p>
        </div>
      </Section>

      {/* 8. THE FULL PICTURE */}
      <Section className="bg-[#FDFBF7]">
        <SectionHeader 
          title="The full picture" 
          subtitle="From workspace to completion." 
        />
        
        <div className="py-12 flex justify-center">
          <div className="max-w-4xl w-full flex flex-col items-center">
            {/* Setup Row */}
            <div className="flex flex-wrap justify-center gap-4 mb-8 w-full">
              <div className="bg-white px-6 py-3 brutal-border brutal-shadow-sm font-bold">Create workspace</div>
              <ArrowRight className="self-center hidden md:block" />
              <div className="bg-white px-6 py-3 brutal-border brutal-shadow-sm font-bold">Get keys</div>
              <ArrowRight className="self-center hidden md:block" />
              <div className="bg-white px-6 py-3 brutal-border brutal-shadow-sm font-bold">Add files</div>
              <ArrowRight className="self-center hidden md:block" />
              <div className="bg-white px-6 py-3 brutal-border brutal-shadow-sm font-bold">Share</div>
            </div>
            
            <div className="w-1 h-12 bg-[#1A1A1A] mb-8"></div>
            
            <div className="bg-[#8B9A8B] text-white px-8 py-4 brutal-border brutal-shadow-sm font-bold text-xl mb-8 w-64 text-center">
              Watcher subscribes
            </div>
            
            <div className="w-1 h-12 bg-[#1A1A1A] mb-8"></div>
            
            <div className="bg-[#1A1A1A] text-white px-8 py-4 brutal-border brutal-shadow-sm font-bold text-xl mb-8 w-64 text-center">
              Task arrives
            </div>
            
            <div className="w-1 h-12 bg-[#1A1A1A] mb-8"></div>
            
            <div className="bg-white px-8 py-4 brutal-border brutal-shadow-sm font-bold text-xl mb-8 w-64 text-center">
              Agent spawns
            </div>
            
            <div className="w-1 h-12 bg-[#1A1A1A] mb-8"></div>
            
            <div className="bg-[#E8A851] px-10 py-5 brutal-border brutal-shadow-lg font-bold text-2xl mb-8 w-72 text-center transform scale-110 rotate-2">
              Claim
            </div>
            
            <div className="w-1 h-12 bg-[#1A1A1A] mb-8"></div>
            
            <div className="bg-white px-8 py-4 brutal-border brutal-shadow-sm font-bold text-xl mb-8 w-64 text-center">
              Work
            </div>
            
            <div className="w-1 h-12 bg-[#1A1A1A] mb-8"></div>
            
            {/* Branch */}
            <div className="flex w-full max-w-2xl justify-between relative">
              <div className="absolute top-0 left-1/4 right-1/4 h-1 bg-[#1A1A1A]"></div>
              <div className="absolute top-0 left-1/4 w-1 h-8 bg-[#1A1A1A]"></div>
              <div className="absolute top-0 right-1/4 w-1 h-8 bg-[#1A1A1A]"></div>
              
              <div className="w-1/2 flex flex-col items-center pt-8">
                <div className="text-[#8B9A8B] font-bold mb-4 uppercase tracking-widest">Success</div>
                <div className="bg-white px-6 py-3 brutal-border brutal-shadow-sm font-bold mb-4 w-48 text-center">Response</div>
                <div className="w-1 h-6 bg-[#1A1A1A] mb-4"></div>
                <div className="bg-[#8B9A8B] text-white px-6 py-3 brutal-border brutal-shadow-sm font-bold w-48 text-center flex justify-center items-center gap-2">
                  Done <Check size={20} />
                </div>
              </div>
              
              <div className="w-1/2 flex flex-col items-center pt-8">
                <div className="text-[#D97757] font-bold mb-4 uppercase tracking-widest">Stuck</div>
                <div className="bg-white px-6 py-3 brutal-border brutal-shadow-sm font-bold mb-4 w-48 text-center">Blocked</div>
                <div className="w-1 h-6 bg-[#1A1A1A] mb-4"></div>
                <div className="bg-white px-6 py-3 brutal-border brutal-shadow-sm font-bold mb-4 w-48 text-center">Answer</div>
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
          subtitle="The de facto interface language for agent and human collaboration." 
        />
        
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { title: "Agents read it reliably", desc: "The format they're most reliable at reading, writing, and reasoning over." },
            { title: "Humans read it too", desc: "Inspect and edit the exact same artifact that your agents use." },
            { title: "No schema needed", desc: "Structure emerges naturally from headings, lists, and appends." }
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
            { q: "Is mdplane open source?", a: "The core protocol and SDKs are open source. The hosted platform is a managed service." },
            { q: "Do I need an account?", a: "No. You can create a workspace instantly. Your keys are your credentials." },
            { q: "Does mdplane run my agents?", a: "No. mdplane is the workspace. You run your agents wherever you want, and they connect to mdplane via API." },
            { q: "How do agents know when to start?", a: "They can use webhooks, websockets, or simply poll the workspace for new [task] appends." },
            { q: "Can I encrypt content?", a: "Yes, you can encrypt content client-side before writing it to mdplane. Agents with the decryption key can read it." },
            { q: "What if I lose my access keys?", a: "Because there are no accounts, lost keys cannot be recovered. Treat your WRITE key like a password." }
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
            <h2 className="text-5xl md:text-7xl font-display font-bold mb-6">Get started</h2>
            <p className="text-2xl font-medium mb-10 opacity-80">Create a workspace. Share it with anyone (or anything).</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="https://app.mdplane.dev" className="px-6 py-3 font-display font-bold text-lg brutal-border brutal-shadow brutal-shadow-hover inline-flex items-center justify-center gap-2 bg-[#D97757] text-white">Open app</Link>
              <Link href="https://docs.mdplane.dev" className="px-6 py-3 font-display font-bold text-lg brutal-border brutal-shadow brutal-shadow-hover inline-flex items-center justify-center gap-2 bg-white text-[#1A1A1A]">Read the docs</Link>
            </div>
          </div>
          
          <div className="border-t-2 border-white/20 pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="font-display font-bold text-xl flex items-center gap-2">
              <div className="w-5 h-5 bg-[#E8A851] rotate-3"></div>
              mdplane <span className="opacity-50 font-sans font-normal text-base ml-2">— Shareable markdown workspaces.</span>
            </div>
            
            <div className="flex gap-6 font-medium opacity-80">
              <Link href="https://docs.mdplane.dev" className="hover:text-[#E8A851] transition-colors">Docs</Link>
              <Link href="https://api.mdplane.dev" className="hover:text-[#E8A851] transition-colors">API</Link>
              <Link href="https://github.com/alscotty/mdplane" className="hover:text-[#E8A851] transition-colors">GitHub</Link>
              <Link href="/privacy" className="hover:text-[#E8A851] transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-[#E8A851] transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
