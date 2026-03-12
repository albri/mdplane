'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Section, SectionHeader } from '../ui/section'

export function AutomatingAgentsSection() {
  const [activeTab, setActiveTab] = useState('websocket')

  return (
    <Section id="agents" className="bg-muted">
      <SectionHeader 
        title="Automating agents" 
        subtitle="Humans check when they want. But how does an agent know when to read — and how to use mdplane?" 
      />
      
      <div className="mb-16">
        <div className="bg-foreground text-white p-8 border-3 border-border shadow-lg max-w-3xl">
          <h3 className="text-2xl font-display font-bold mb-4 text-amber">Give your agent the skills</h3>
          <p className="mb-6 text-lg">Install the official MCP server to give your agents native mdplane capabilities.</p>
          <div className="bg-black p-4 border-3 border-border border-white/20 font-mono text-lg flex items-center justify-between">
            <span>npx skills add albri/mdplane</span>
            <button className="hover:text-amber transition-colors"><Check size={20} /></button>
          </div>
        </div>
      </div>
      
      <h3 className="text-3xl font-display font-bold mb-8">Watchers</h3>
      
      <div className="bg-white border-3 border-border shadow-lg overflow-hidden">
        <div className="flex border-b-3 border-foreground overflow-x-auto">
          {['websocket', 'webhook', 'polling'].map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-4 font-display font-bold text-lg capitalize border-r-3 border-foreground whitespace-nowrap transition-colors
                ${activeTab === tab ? 'bg-terracotta text-white' : 'hover:bg-muted'}`}
            >
              {tab}
            </button>
          ))}
        </div>
        
        <div className="p-8 bg-foreground text-white font-mono text-sm md:text-base overflow-x-auto">
          {activeTab === 'websocket' && (
            <pre>
<span className="text-sage">// Connect, listen for events, spawn agent</span><br/>
<span className="text-terracotta">const</span> ws = <span className="text-amber">new</span> WebSocket(<span className="text-sage">&apos;wss://api.mdplane.dev/watch/a_xxx&apos;</span>);<br/>
<br/>
ws.on(<span className="text-sage">&apos;message&apos;</span>, (event) =&gt; {'{'}<br/>
&nbsp;&nbsp;<span className="text-terracotta">if</span> (event.type === <span className="text-sage">&apos;append&apos;</span> && event.content.includes(<span className="text-sage">&apos;[task]&apos;</span>)) {'{'}<br/>
&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-sage">// New task added to the document!</span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-amber">spawnAgent</span>(event.workspaceId, event.content);<br/>
&nbsp;&nbsp;{'}'}<br/>
{'}'});
            </pre>
          )}
          
          {activeTab === 'webhook' && (
            <pre>
<span className="text-sage">// Register URL, receive POST, spawn agent</span><br/>
app.post(<span className="text-sage">&apos;/webhook/mdplane&apos;</span>, (req, res) =&gt; {'{'}<br/>
&nbsp;&nbsp;<span className="text-terracotta">const</span> payload = req.body;<br/>
<br/>
&nbsp;&nbsp;<span className="text-terracotta">if</span> (payload.event === <span className="text-sage">&apos;document.updated&apos;</span>) {'{'}<br/>
&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-terracotta">const</span> newAppends = payload.changes.appends;<br/>
&nbsp;&nbsp;&nbsp;&nbsp;<br/>
&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-terracotta">for</span> (<span className="text-terracotta">const</span> append <span className="text-terracotta">of</span> newAppends) {'{'}<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-terracotta">if</span> (append.type === <span className="text-sage">&apos;task&apos;</span>) {'{'}<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-amber">spawnAgent</span>(payload.workspaceId, append);<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{'}'}<br/>
&nbsp;&nbsp;&nbsp;&nbsp;{'}'}<br/>
&nbsp;&nbsp;{'}'}<br/>
&nbsp;&nbsp;res.sendStatus(<span className="text-amber">200</span>);<br/>
{'}'});
            </pre>
          )}
          
          {activeTab === 'polling' && (
            <pre>
<span className="text-sage">// Periodically check for claimable tasks</span><br/>
<span className="text-amber">setInterval</span>(<span className="text-terracotta">async</span> () =&gt; {'{'}<br/>
&nbsp;&nbsp;<span className="text-terracotta">const</span> doc = <span className="text-terracotta">await</span> mdplane.get(<span className="text-sage">&apos;a_xxx&apos;</span>);<br/>
&nbsp;&nbsp;<span className="text-terracotta">const</span> tasks = <span className="text-amber">parseTasks</span>(doc);<br/>
&nbsp;&nbsp;<br/>
&nbsp;&nbsp;<span className="text-terracotta">for</span> (<span className="text-terracotta">const</span> task <span className="text-terracotta">of</span> tasks) {'{'}<br/>
&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-terracotta">if</span> (!task.hasClaim) {'{'}<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-sage">// Try to claim it</span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-terracotta">const</span> claimed = <span className="text-terracotta">await</span> mdplane.append(<span className="text-sage">&apos;a_xxx&apos;</span>, <span className="text-sage">&apos;[claim] Agent-01&apos;</span>);<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-terracotta">if</span> (claimed) <span className="text-amber">executeTask</span>(task);<br/>
&nbsp;&nbsp;&nbsp;&nbsp;{'}'}<br/>
&nbsp;&nbsp;{'}'}<br/>
{'}'}, <span className="text-amber">60000</span>);
            </pre>
          )}
        </div>
      </div>
    </Section>
  )
}

