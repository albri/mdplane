'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Section, SectionHeader } from '../ui/section'

export function AutomatingAgentsSection() {
  const [activeTab, setActiveTab] = useState('websocket')

  return (
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
<span className="text-[#D97757]">const</span> ws = <span className="text-[#E8A851]">new</span> WebSocket(<span className="text-[#8B9A8B]">&apos;wss://api.mdplane.dev/watch/a_xxx&apos;</span>);<br/>
<br/>
ws.on(<span className="text-[#8B9A8B]">&apos;message&apos;</span>, (event) =&gt; {'{'}<br/>
&nbsp;&nbsp;<span className="text-[#D97757]">if</span> (event.type === <span className="text-[#8B9A8B]">&apos;append&apos;</span> && event.content.includes(<span className="text-[#8B9A8B]">&apos;[task]&apos;</span>)) {'{'}<br/>
&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#8B9A8B]">// New task added to the document!</span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#E8A851]">spawnAgent</span>(event.workspaceId, event.content);<br/>
&nbsp;&nbsp;{'}'}<br/>
{'}'});
            </pre>
          )}
          
          {activeTab === 'webhook' && (
            <pre>
<span className="text-[#8B9A8B]">// Register URL, receive POST, spawn agent</span><br/>
app.post(<span className="text-[#8B9A8B]">&apos;/webhook/mdplane&apos;</span>, (req, res) =&gt; {'{'}<br/>
&nbsp;&nbsp;<span className="text-[#D97757]">const</span> payload = req.body;<br/>
<br/>
&nbsp;&nbsp;<span className="text-[#D97757]">if</span> (payload.event === <span className="text-[#8B9A8B]">&apos;document.updated&apos;</span>) {'{'}<br/>
&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#D97757]">const</span> newAppends = payload.changes.appends;<br/>
&nbsp;&nbsp;&nbsp;&nbsp;<br/>
&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#D97757]">for</span> (<span className="text-[#D97757]">const</span> append <span className="text-[#D97757]">of</span> newAppends) {'{'}<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#D97757]">if</span> (append.type === <span className="text-[#8B9A8B]">&apos;task&apos;</span>) {'{'}<br/>
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
&nbsp;&nbsp;<span className="text-[#D97757]">const</span> doc = <span className="text-[#D97757]">await</span> mdplane.get(<span className="text-[#8B9A8B]">&apos;a_xxx&apos;</span>);<br/>
&nbsp;&nbsp;<span className="text-[#D97757]">const</span> tasks = <span className="text-[#E8A851]">parseTasks</span>(doc);<br/>
&nbsp;&nbsp;<br/>
&nbsp;&nbsp;<span className="text-[#D97757]">for</span> (<span className="text-[#D97757]">const</span> task <span className="text-[#D97757]">of</span> tasks) {'{'}<br/>
&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#D97757]">if</span> (!task.hasClaim) {'{'}<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#8B9A8B]">// Try to claim it</span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#D97757]">const</span> claimed = <span className="text-[#D97757]">await</span> mdplane.append(<span className="text-[#8B9A8B]">&apos;a_xxx&apos;</span>, <span className="text-[#8B9A8B]">&apos;[claim] Agent-01&apos;</span>);<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#D97757]">if</span> (claimed) <span className="text-[#E8A851]">executeTask</span>(task);<br/>
&nbsp;&nbsp;&nbsp;&nbsp;{'}'}<br/>
&nbsp;&nbsp;{'}'}<br/>
{'}'}, <span className="text-[#E8A851]">60000</span>);
            </pre>
          )}
        </div>
      </div>
    </Section>
  )
}

