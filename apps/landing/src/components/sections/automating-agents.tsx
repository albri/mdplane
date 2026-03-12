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
        <div className="bg-foreground text-background p-8 border-3 border-border shadow-lg max-w-3xl">
          <h3 className="text-2xl font-display font-bold mb-4 text-amber">Give your agent the skills</h3>
          <p className="mb-6 text-lg">Install skills to teach agents the claim/response pattern and mdplane API.</p>
          <div className="bg-black p-4 border-3 border-border border-white/20 font-mono text-lg flex items-center justify-between">
            <span>npx skills add albri/mdplane</span>
            <button className="hover:text-amber transition-colors"><Check size={20} /></button>
          </div>
        </div>
      </div>
      
      <p className="text-xl mb-12 max-w-3xl">
        Your agent now knows the full mdplane API — reading files, appending updates, and coordinating work via claims.
        You can set up a watcher to react to new tasks, <span className="font-bold">or let the agent build one itself</span>.
      </p>

      <h3 className="text-3xl font-display font-bold mb-8">Watcher patterns</h3>
      
      <div className="bg-card border-3 border-border shadow-lg overflow-hidden">
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
        
        <div className="p-8 bg-foreground text-background font-mono text-sm md:text-base overflow-x-auto">
          {activeTab === 'websocket' && (
            <pre>
<span className="text-sage">// 1. Get subscription credentials</span><br/>
<span className="text-terracotta">const</span> {'{'} wsUrl, token {'}'} = <span className="text-terracotta">await</span> fetch(<span className="text-sage">&apos;/a/a_xxx/ops/subscribe&apos;</span>);<br/>
<br/>
<span className="text-sage">// 2. Connect and listen for new tasks</span><br/>
<span className="text-terracotta">const</span> ws = <span className="text-amber">new</span> WebSocket(<span className="text-sage">`$&#123;wsUrl&#125;?token=$&#123;token&#125;`</span>);<br/>
<br/>
ws.on(<span className="text-sage">&apos;message&apos;</span>, (msg) =&gt; {'{'}<br/>
&nbsp;&nbsp;<span className="text-terracotta">if</span> (msg.type === <span className="text-sage">&apos;append&apos;</span> && msg.data.type === <span className="text-sage">&apos;task&apos;</span>) {'{'}<br/>
&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-sage">// Spin up a one-shot agent with the task</span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;exec(<span className="text-amber">`claude -p &quot;$&#123;msg.data.content&#125;&quot;`</span>);<br/>
&nbsp;&nbsp;{'}'}<br/>
{'}'});
            </pre>
          )}

          {activeTab === 'webhook' && (
            <pre>
<span className="text-sage">// Your server receives events from mdplane</span><br/>
app.post(<span className="text-sage">&apos;/mdplane-webhook&apos;</span>, (req, res) =&gt; {'{'}<br/>
&nbsp;&nbsp;<span className="text-terracotta">const</span> {'{'} event, data {'}'} = req.body;<br/>
<br/>
&nbsp;&nbsp;<span className="text-terracotta">if</span> (event === <span className="text-sage">&apos;append&apos;</span> && data.type === <span className="text-sage">&apos;task&apos;</span>) {'{'}<br/>
&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-sage">// Spin up Claude Code with the task prompt</span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;exec(<span className="text-amber">`claude -p &quot;$&#123;data.content&#125;&quot;`</span>);<br/>
&nbsp;&nbsp;{'}'}<br/>
<br/>
&nbsp;&nbsp;res.sendStatus(<span className="text-amber">200</span>);<br/>
{'}'});
            </pre>
          )}

          {activeTab === 'polling' && (
            <pre>
<span className="text-sage">// Check for unclaimed tasks, claim and execute</span><br/>
<span className="text-amber">setInterval</span>(<span className="text-terracotta">async</span> () =&gt; {'{'}<br/>
&nbsp;&nbsp;<span className="text-terracotta">const</span> res = <span className="text-terracotta">await</span> fetch(<span className="text-sage">&apos;/a/a_xxx/files/tasks.md&apos;</span>);<br/>
&nbsp;&nbsp;<span className="text-terracotta">const</span> {'{'} content {'}'} = <span className="text-terracotta">await</span> res.json();<br/>
&nbsp;&nbsp;<span className="text-terracotta">const</span> unclaimed = <span className="text-amber">parseTasks</span>(content).filter(t =&gt; !t.claimed);<br/>
&nbsp;&nbsp;<br/>
&nbsp;&nbsp;<span className="text-terracotta">for</span> (<span className="text-terracotta">const</span> task <span className="text-terracotta">of</span> unclaimed) {'{'}<br/>
&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-sage">// Claim it, then run the agent</span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-terracotta">await</span> fetch(<span className="text-sage">&apos;/a/a_xxx/files/tasks.md/append&apos;</span>, {'{'}<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;method: <span className="text-sage">&apos;POST&apos;</span>,<br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;body: JSON.stringify({'{'} type: <span className="text-sage">&apos;claim&apos;</span> {'}'})<br/>
&nbsp;&nbsp;&nbsp;&nbsp;{'}'});<br/>
&nbsp;&nbsp;&nbsp;&nbsp;exec(<span className="text-amber">`claude -p &quot;$&#123;task.content&#125;&quot;`</span>);<br/>
&nbsp;&nbsp;{'}'}<br/>
{'}'}, <span className="text-amber">60000</span>);
            </pre>
          )}
        </div>
      </div>
    </Section>
  )
}

