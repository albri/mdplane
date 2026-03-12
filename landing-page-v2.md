# Landing Page v2 — Planning Document

> Working document for the mdplane landing page redesign.
> Last updated after wireframe completion.

---

## Current Status: WIREFRAME COMPLETE

The v2 landing page wireframe is live at `/v2`. Content and structure are finalized. Ready for high-fidelity styling pass.

---

## Final Section Order

1. **Hero** — "Share markdown beautifully"
2. **Why mdplane?** — The problem (you have markdown, current options don't cut it)
3. **Workspaces** — Container for files, shareable via URL
4. **Three keys** — Read/Append/Write capability URLs
5. **Anyone with the key can read** — Humans get web UI, agents get API
6. **Automating agents** — Skills + Watchers (how agents know when to act)
7. **The append model** — Main doc vs appends, 10 append types
8. **The full picture** — Flow diagram (setup → watcher → claim → work → done/blocked)
9. **Why markdown?** — Appendix-style (agents read it, humans too, no schema)
10. **FAQs** — Common questions
11. **Footer** — CTA + links

---

## Key Design Decisions

1. **No interactive demo on landing page** — The landing page explains concepts. Actual workspace creation lives in the app/docs.

2. **CLI-first, not web-first** — We hint that workspace creation is via API/CLI. Docs have the details.

3. **Progressive complexity** — Simple concepts first (workspaces, keys), complex later (watchers, appends).

4. **"Why markdown?" as appendix** — Foundational but not the main story. Sits after the full picture.

5. **No defensive positioning** — We don't say "why not Gist" or "why not a database." Just explain what mdplane does.

6. **Honest, not buzzwordy** — Removed vague phrases like "coordination layer" and "working asynchronously."

---

## Visualizations Used

| Section | Visualization |
|---------|--------------|
| Hero | Text + CTAs (add floating docs animation in HiFi) |
| Why mdplane? | Bullet list |
| Workspaces | ASCII file tree |
| Three keys | 3 stacked cards with key format |
| Anyone can read | 2-column grid (Human vs Agent) |
| Automating agents | Tabbed code blocks (WebSocket/Webhook/Poll) |
| The append model | Split box (main doc / appends) + 10-item grid |
| The full picture | Component-based flow diagram |
| Why markdown? | 3-column cards |
| FAQs | Left-bordered list |
| Footer | CTA + link row |

---

## What Lives in Docs (Not Landing Page)

- Curl commands for workspace/file creation
- API reference
- CLI reference
- Detailed examples
- Skills installation details
- Webhook/WebSocket setup
- Authentication flows
- All the "how to" content

---

## Next Steps

1. [ ] High-fidelity styling pass (neo-brutalist warm palette)
2. [ ] Hero animation (floating markdown docs)
3. [ ] Flow diagram animation (step-by-step reveal)
4. [ ] Mobile responsiveness
5. [ ] Replace v1 landing page with v2

---

## High-Fidelity Prompt

Use this prompt to generate the styled version:

```
Design a high-fidelity landing page for mdplane — a markdown workspace platform.

## Aesthetic Direction

Neo-brutalist with a warm palette. Reference v0's style:
- Cream/off-white backgrounds
- Earthy accent colors (sage greens, terracotta, amber)
- Dark ink for text
- Thick borders, hard offset shadows (no blur)
- Bold, chunky typography
- Cards with slight rotation for visual interest
- Space Grotesk for headings, Space Mono for code

Keep it bold, warm, and confident. Not sterile or corporate.

---

## Content & Structure (Follow Exactly)

### 1. HERO
**Headline:** "Share markdown beautifully"
**Subhead:** "A workspace for your docs — organized, shareable, and readable by your agents."
**CTAs:** "Get started" (primary), "Read the docs" (secondary)
**Visual:** Floating/drifting markdown document cards. Calm, ambient. Not busy.

### 2. WHY MDPLANE?
**Headline:** "Why mdplane?"
**Subhead:** "You have markdown you want to share — a spec, a runbook, some notes."
**Content:** Bullet list of pain points:
- Share it instantly, no account required
- See it formatted nicely, no friction
- Share it securely, with access control
- Let agents read it — or even coordinate around it
**Closing:** "mdplane gives your markdown a workspace — secure, shareable, readable by humans and agents alike."

### 3. WORKSPACES
**Headline:** "Workspaces"
**Content:** "A workspace is a container for your markdown files — like a folder you can share with a URL."
**Visual:** File tree showing workspace structure (folders, .md files, shareable URL indicator)
**Closing:** "Like a mini repo — instantly shareable."

### 4. THREE KEYS
**Headline:** "Three keys"
**Content:** "Creating a workspace gives you three capability URLs. Share the right one for the right access level."
**Visual:** Three stacked cards:
- READ (view files, copy content) — show key format r_xxx...
- APPEND (read + add content) — show key format a_xxx...
- WRITE (full control) — show key format w_xxx...
**Closing:** "No accounts needed. The URL is the credential."

### 5. ANYONE WITH THE KEY CAN READ
**Headline:** "Anyone with the key can read"
**Subhead:** "Humans and agents each get what they need."
**Visual:** Two-column comparison:
- Humans: Web URL (app.mdplane.dev/r/...) → beautifully formatted
- Agents: API URL (api.mdplane.dev/r/.../raw) → raw markdown or JSON
**Bullets:**
- Same key, different endpoints for different needs
- Persistent context — survives sessions
- Update the file, everyone gets the latest

### 6. AUTOMATING AGENTS
**Headline:** "Automating agents"
**Subhead:** "Humans check when they want. But how does an agent know when to read — and how to use mdplane?"
**Content - Skills:** Brief explanation + code block: `npx skills add albri/mdplane`
**Content - Watchers:** Tabbed interface showing three patterns:
- WebSocket (connect, listen for events, spawn agent)
- Webhook (register URL, receive POST, spawn agent)
- Polling (periodically check for claimable tasks)
Each tab shows pseudocode for that pattern.

### 7. THE APPEND MODEL
**Headline:** "The append model"
**Subhead:** "Now that agents can read and be triggered — how do they contribute safely?"
**Visual:** Split box showing:
- Top: MAIN DOCUMENT (write key) — "# Project Spec, your content, requirements, instructions"
- Bottom: APPENDS (append key) — "[task] Review API, [claim] Working on this, [response] Done"
**Content:** "Appends live at the end of the file — structured entries that accumulate. Safe contributions: agents can add, but can't modify or delete."
**Visual:** Grid of 10 append types with colored labels:
task, claim, response, blocked, answer, comment, renew, cancel, vote, heartbeat
**Closing:** "Every entry is timestamped and attributed to an author."

### 8. THE FULL PICTURE
**Headline:** "The full picture"
**Subhead:** "From workspace to completion."
**Visual:** Top-down flow diagram with these nodes:
- Setup row: Create workspace → Get keys → Add files → Share
- Watcher subscribes
- Task arrives
- Agent spawns
- Claim (highlighted)
- Work
- Branch into two paths:
  - Success: Response → Done ✓
  - Stuck: Blocked → Answer → retry
**Footer notes:** "First to claim wins • Claims expire automatically • Blocked tasks wait for answers"

### 9. WHY MARKDOWN?
**Headline:** "Why markdown?"
**Subhead:** "The de facto interface language for agent and human collaboration."
**Visual:** Three cards:
- "Agents read it reliably" — format they're most reliable at reading/writing/reasoning over
- "Humans read it too" — inspect and edit the same artifact agents use
- "No schema needed" — structure emerges from headings and appends

### 10. FAQS
**Headline:** "Questions"
**Format:** Left-bordered list of Q&A:
- Is mdplane open source?
- Do I need an account?
- Does mdplane run my agents?
- How do agents know when to start?
- Can I encrypt content?
- What if I lose my access keys?

### 11. FOOTER
**CTA Headline:** "Get started"
**Subhead:** "Create a workspace. Share it with anyone (or anything)."
**Buttons:** "Open app", "Read the docs"
**Footer bar:** "mdplane — Shareable markdown workspaces." + links (Docs, API, GitHub, Privacy, Terms)

---

## Important Notes

- Make section backgrounds alternate for visual rhythm (cream, slightly darker cream, accent color sections for key moments)
- The flow diagram in "The full picture" should be the visual centerpiece — make it beautiful
- Keep code blocks clean and readable
- Mobile-first but should look great on desktop
- No generic stock illustrations or SaaS clichés
```

---

## Visual Direction (Decided)

**Neo-brutalist warm** — cherry-picked from the best generations:

| Element | Source | Details |
|---------|--------|---------|
| **Palette** | v0 | Cream `#FDF6E3`, sage `#6B8F71`, terracotta `#E07A5F`, amber `#F2CC8F`, ink `#1A1510` |
| **Typography** | v0 | Space Grotesk (headings), Space Mono (code/keys) |
| **Borders** | v0 | Thick (3-4px), hard shadows (no blur), offset 4-8px |
| **Cards** | v0 | Slight rotation, chunky, bold |
| **Concepts** | Gemini | Envelopes for keys, paper metaphor |
| **Hero** | New | Papers with appends/stamps arriving — NOT plane animation |

**What NOT to do:**
- No gradient blobs
- No soft shadows
- No rounded corners (or very minimal)
- No generic SaaS illustrations
- No emoji overuse

---

## The Story (Refined)

Every section must connect to the next. We introduce concepts **in context**, not upfront.

### The Narrative Arc

```
1. HERO         → "Share markdown beautifully" (the promise)
2. WHAT IS IT?  → Workspaces, files, folders, URLs (the mental model)
3. START SHARING → Create workspace → get keys → add files (the real flow)
4. ACCESS MODEL → Three keys: read/append/write (in context now)
5. AGENTS READ  → Give them the read URL (first unlock)
6. AGENTS WRITE → Give them the append URL (second unlock)
7. COLLABORATE  → Watchers, claims, scale (third unlock)
8. FULL PICTURE → Everything connected (optional summary)
9. WHY MARKDOWN → Supporting argument
10. FOOTER      → CTA
```

**Key insight:** We don't introduce "Three Keys" until AFTER we've explained workspaces and files. Keys make sense only when you understand what you're sharing.

---

## Section-by-Section Breakdown

### 1. HERO

**Emotional beat:** "Finally, someone gets it."

**Headline:**
> SHARE MARKDOWN
> BEAUTIFULLY

**Subhead:**
> A workspace for your docs — organized, shareable, and readable by your agents.

**Visual:**
Floating markdown document representations. Various document/paper cards drifting gently. Different sizes, slight rotations. Some show glimpses of markdown content (headings, bullets, code blocks). Calm, ambient motion.

NOT showing appends or complex features yet. Just: "markdown lives here."

**CTAs:**
- "Get started" (primary)
- "Read the docs" (secondary)

---

### 2. WHAT IS MDPLANE?

**Emotional beat:** "Oh, I get the structure."

**Headline:**
> A WORKSPACE FOR YOUR MARKDOWN

**Visual:** Simple diagram showing the hierarchy:
```
┌─────────────────────────────┐
│  WORKSPACE: my-project      │
│  ├── docs/                  │
│  │   ├── api-spec.md        │
│  │   └── getting-started.md │
│  └── notes.md               │
│                             │
│  🔗 Shareable URLs          │
└─────────────────────────────┘
```

**Copy:**
> Create a workspace. Add files and folders. Share with a URL.
> Like a mini repo — but instantly shareable, no git required.

**Transition:**
> "Let's create one."

---

### 3. START SHARING

**Emotional beat:** "This is straightforward, not a toy."

**Headline:**
> START SHARING

**Visual:** The REAL flow, shown prominently:

**Step 1: Create your workspace**
```
┌─────────────────────────────┐
│ Workspace name: my-project  │
│                             │
│ [Create Workspace]          │
└─────────────────────────────┘
```

**Step 2: Get your keys**
```
┌─────────────────────────────┐
│ READ:   r_k7x9m2p4q8n1...  │ ← Anyone can view
│ APPEND: a_k7x9m2p4q8n1...  │ ← Add content
│ WRITE:  w_k7x9m2p4q8n1...  │ ← Full control
└─────────────────────────────┘
```

**Step 3: Add files**
```
┌─────────────────────────────┐
│ my-project/                 │
│ └── notes.md               │
│                             │
│ [+ Add file] [+ Add folder] │
└─────────────────────────────┘
```

**Copy:**
> No account required for basic sharing.
> Your workspace is live immediately.

This section should feel **robust and real**, not like a demo widget.

**Transition:**
> "Now you have a workspace with shareable URLs. But who can access it?"

---

### 4. THREE KEYS — The Access Model

**Emotional beat:** "Ah, that's clever."

**Headline:**
> THREE KEYS. THREE LEVELS.

**Now this makes sense** — the user understands workspaces and files, so keys have context.

**Visual:** Three cards showing:

| Key | Color | What it unlocks |
|-----|-------|-----------------|
| **READ** | warm-blue | View files, copy content, share with anyone |
| **APPEND** | amber | Everything in Read + add tasks, notes, responses |
| **WRITE** | sage | Full control, edit anything, owner-level access |

**Copy:**
> Share exactly what you need to.
> Read for viewers. Append for contributors. Write for you.

**Transition:**
> "Give an agent the read key, and they have context. Give them append..."

---

### 5. AGENTS CAN READ

**Emotional beat:** "I could use this today."

**Headline:**
> GIVE YOUR AGENT CONTEXT

**Visual:** Diagram showing File → Agent

**Copy:**
> Share the read URL with Claude, Cursor, or any agent.
> Persistent context — survives sessions. No more pasting into chat.
> Update the file, agent sees changes instantly.

**Feature cards:**
- Share the read key with any agent
- Persistent context — survives sessions
- Update file, agent sees changes instantly

**Transition:**
> "But what if they could respond?"

---

### 6. AGENTS CAN WRITE BACK

**Emotional beat:** "Oh, this is powerful."

**Headline:**
> AGENTS CAN WRITE BACK

**Copy:**
> Give them the append URL. They can add structured entries.
> They can add, but can't delete — safe by default.
> Every entry timestamped. Every action auditable.

**Visual:** Append types with colored badges:

| Type | Color | Purpose |
|------|-------|---------|
| TASK | warm-blue | Create work that needs doing |
| CLAIM | amber | Take ownership of a task |
| RESPONSE | sage | Complete the task |
| BLOCKED | terracotta | Signal you need a decision |

Show these stacking on a document.

**Transition:**
> "One agent is useful. But what about five? Or someone else's agent?"

---

### 7. COLLABORATION AT SCALE

**Emotional beat:** "This is what I've been looking for."

**Headline:**
> COLLABORATION AT SCALE

**Subhead:**
> Multiple agents. External collaborators. No chaos.

**The Watcher Pattern:**
> mdplane doesn't run your agents — you do.
> A watcher script subscribes to your workspace (via webhook or WebSocket).
> When a task arrives, it spawns an agent.
> The agent claims the task, does the work, posts a response.
> Your watcher can be anywhere: a bash script, a cloud function, inside an app.

**Visual:** The flow:
```
Task posted → Watcher notified → Agent spawned → Claim → Work → Response
```

**Claims prevent collision:**
> Two agents, one task. First to claim wins. Second sees "claimed" and moves on.

**Feature cards:**
- **Claims expire** — No stuck work, auto-release after timeout
- **Webhooks** — Get notified when tasks arrive
- **Real-time** — WebSocket updates, see changes instantly

---

### 8. THE COMPLETE PICTURE (Optional)

**Emotional beat:** "Now I see how it all fits together."

**Headline:**
> THE COMPLETE FLOW

**Visual:** A comprehensive diagram showing the full journey:

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  CREATE  │ →  │  ADD     │ →  │  SHARE   │ →  │  AGENT   │
│WORKSPACE │    │  FILES   │    │  KEYS    │    │  READS   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                     ↓
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│   DONE   │ ← │ RESPONSE │ ←  │  CLAIM   │ ←  │   TASK   │
│          │    │          │    │          │    │  POSTED  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

This brings everything together in one view. Could be interactive.

**OR** — if the page has already told the story well, this section can just be a CTA:
> "See it for yourself →" (link to docs or app)

---

### 9. WHY MARKDOWN

**Emotional beat:** "Makes sense."

**Headline:**
> WHY MARKDOWN?

**Three cards:**
- **Agents read it reliably** — The format LLMs understand best
- **Humans read it too** — No special viewer needed
- **No schema needed** — Structure emerges from headings

---

### 10. FOOTER

**Headline:**
> READY?

**Subhead:**
> Built for humans. Ready for agents.

**CTAs:**
- "Read the docs"
- "Create a workspace"
- "See GitHub"

---

## Hero Animation

**Concept: Floating Markdown Documents**

Various document/paper cards drifting gently. Different sizes, slight rotations. Some show glimpses of markdown content (headings, bullets, code blocks). Calm, ambient motion — documents fading in/out.

**NOT** showing appends or complex features yet. Just: "markdown lives here."

---

## Key Copy Principles

1. **Short sentences.** Brutal editing.
2. **Verbs over nouns.** "Share" not "sharing solution."
3. **Concrete over abstract.** "Create workspace, add files" not "seamless workflow."
4. **Progressive disclosure.** Each section reveals one new thing.
5. **Transitions matter.** Every section ends with a hook to the next.
6. **Explain watchers.** Don't assume people know how agents get notified.

---

## Technical Notes

- **New landing page from scratch** — Don't reskin existing. Delete old at end.
- **Section 3 "Start Sharing" must feel robust** — Not a toy demo widget.
- **Show the real flow** — Workspace creation → keys → files (two steps, not one).
- **Mobile-first** — Test at every breakpoint.

---

## LLM Design Prompt (Refined)

Use this prompt to generate the landing page design:

```
Create a landing page for mdplane — a markdown sharing and coordination platform.

## Design System

Neo-brutalist warm:
- Palette: cream #FDF6E3, cream-dark #F5ECD5, ink #1A1510, sage #6B8F71, terracotta #E07A5F, amber #F2CC8F, warm-blue #5B8DBE
- Typography: Space Grotesk (headings), Space Mono (code/keys)
- Borders: 4px solid ink, hard shadows (4-8px offset, no blur)
- No rounded corners, no gradients, no glass effects
- Cards can have slight rotation for visual interest

## The Story

The page tells a progressive story. Start simple, reveal complexity. Each section introduces concepts IN CONTEXT — don't explain things before the user understands why they matter.

---

## SECTION 1: Hero

**Background:** cream

**Headline:**
SHARE MARKDOWN
BEAUTIFULLY

**Subhead:** A workspace for your docs — organized, shareable, and readable by your agents.

**Visual:** Floating markdown document representations
- Various document/paper cards drifting gently
- Different sizes, slight rotations
- Some show glimpses of markdown content (headings, bullets, code blocks)
- Calm, ambient motion — NOT busy, NOT showing appends yet

**CTAs:** "Get started" (primary), "Read the docs" (secondary)

**Nav:** Logo left, "Docs" and "GitHub" links right

---

## SECTION 2: What is mdplane?

**Background:** cream-dark

**Headline:** A WORKSPACE FOR YOUR MARKDOWN

**Visual:** Simple diagram showing the hierarchy:
- A workspace box containing files and folders
- Show: workspace name, nested folders, .md files
- Below: "Shareable URLs" indicator

**Copy:**
> Create a workspace. Add files and folders. Share with a URL.
> Like a mini repo — but instantly shareable, no git required.

**Transition:** "Let's create one."

---

## SECTION 3: Start Sharing

**Background:** terracotta (make this section prominent, not a toy)

**Headline:** START SHARING

**Visual:** Show the REAL three-step flow with prominent UI mockups:

**Step 1: Create your workspace**
- Input field for workspace name
- "Create Workspace" button

**Step 2: Get your keys**
- Three keys displayed: READ, APPEND, WRITE
- Each with its prefix (r_, a_, w_) and truncated key

**Step 3: Add files**
- File tree showing workspace with one file
- "Add file" and "Add folder" buttons

This section should feel ROBUST and REAL, not like a demo widget.

**Copy:**
> No account required for basic sharing.
> Your workspace is live immediately.

**Transition:** "Now you have a workspace. But who can access it?"

---

## SECTION 4: Three Keys

**Background:** cream

**Headline:** THREE KEYS. THREE LEVELS.

**Visual:** Three cards (use the v0 design — colored backgrounds, key format in cream row):

| Key | Card Color | What it unlocks |
|-----|------------|-----------------|
| READ | warm-blue | View files, copy content, share with anyone |
| APPEND | amber | Everything in Read + add tasks, notes, responses |
| WRITE | sage | Full control, edit anything, owner-level access |

**Copy:**
> Share exactly what you need to.
> Read for viewers. Append for contributors. Write for you.

**Transition:** "Give an agent the read key, and they have context. Give them append..."

---

## SECTION 5: Agents Can Read

**Background:** cream-dark

**Headline:** GIVE YOUR AGENT CONTEXT

**Visual:** Diagram showing the connection:
- Left: Document/file box (with amber header, content preview)
- Center: Arrow
- Right: Agent box (with bot icon)
- Below: Large URL display

**Feature cards (3 across):**
- Share the read key with any agent
- Persistent context — survives sessions
- Update file, agent sees changes instantly

**Transition:** "But what if they could respond?"

---

## SECTION 6: Agents Can Write Back

**Background:** cream

**Headline:** AGENTS CAN WRITE BACK

**Layout:** Two columns

**Left column:**
Copy explaining append-only safety, plus append type badges:
- TASK (warm-blue) — Create work that needs doing
- CLAIM (amber) — Take ownership of a task
- RESPONSE (sage) — Complete the task
- BLOCKED (terracotta) — Signal you need a decision

**Right column:**
Activity feed visual showing append entries stacking with colored badges.

**Transition:** "One agent is useful. But what about five? Or someone else's agent?"

---

## SECTION 7: Collaboration at Scale

**Background:** warm-blue

**Headline:** COLLABORATION AT SCALE

**Subhead:** Multiple agents. External collaborators. No chaos.

**The Watcher Pattern (IMPORTANT — actually explain this):**
> mdplane doesn't run your agents — you do.
> A watcher script subscribes to your workspace (via webhook or WebSocket).
> When a task arrives, it spawns an agent.
> The agent claims the task, does the work, posts a response.
> Your watcher can be anywhere: a bash script, a cloud function, inside an app.

**Visual:** Flow diagram:
Task posted → Watcher notified → Agent spawned → Claim → Work → Response

**Claims diagram:**
- Agent 1 → claims TASK → succeeds
- Agent 2 → tries same TASK → blocked (X)

**Feature cards:**
- Claims expire — No stuck work, auto-release after timeout
- Webhooks — Get notified when tasks arrive
- Real-time — WebSocket updates, see changes instantly

---

## SECTION 8: The Complete Flow (Optional)

**Background:** cream

**Headline:** THE COMPLETE PICTURE

**Visual:** Comprehensive flow diagram showing everything connected:

CREATE WORKSPACE → ADD FILES → SHARE KEYS → AGENT READS
                                                ↓
DONE ← RESPONSE ← CLAIM ← TASK POSTED ← WATCHER

This brings everything together visually.

**OR** — if the story is already clear, this can just be a CTA:
> "See it for yourself →"

---

## SECTION 9: Why Markdown

**Background:** amber

**Headline:** WHY MARKDOWN?

**Visual:** Three cards:
- Agents read it reliably — The format LLMs understand best
- Humans read it too — No special viewer needed
- No schema needed — Structure emerges from headings

---

## SECTION 10: Footer

**Background:** ink (dark)

**Headline:** READY?

**Subhead:** Built for humans. Ready for agents.

**CTAs:** "Read the docs", "Create a workspace", "See GitHub"

---

## Important Notes

1. **Story flow is critical** — each section builds on the previous
2. **Transitions** — every section ends with a hook to the next
3. **Section 3 must feel robust** — this is real product, not a toy demo
4. **Explain watchers** — don't assume people know how agents get notified
5. **Use the full color palette** — alternate section backgrounds for rhythm
6. **All visuals should EXPLAIN** — no decoration for decoration's sake
```

---

## Progress Tracking

### Completed
- [x] Initial landing page v1 built
- [x] Identified problems with v1 (jumped to complex, no mental model)
- [x] Generated design variations (v0, Gemini, Claude, GPT)
- [x] Identified v0 as best visual design
- [x] Refined story structure through musing sessions
- [x] Decided on section order and content
- [x] Documented the watcher pattern requirement
- [x] Created refined LLM prompt

### In Progress
- [ ] Generate new design with refined story structure

### To Do
- [ ] Review generated design against story requirements
- [ ] Ensure section 3 shows real 2-step flow (workspace → files)
- [ ] Verify watcher explanation in section 7
- [ ] Decide on section 8 (full picture) — keep or remove
- [ ] Build final implementation
- [ ] Mobile testing
- [ ] Replace old landing page with new

### Key Decisions Made
1. **Hero:** Floating markdown docs, NOT paper plane, NOT appends
2. **Section 2:** Added "What is mdplane?" — explain before interact
3. **Section 3:** "Start Sharing" — show real flow (workspace → keys → files)
4. **Three Keys:** Moved to section 4, AFTER explaining workspaces
5. **Section 7:** Must explain watcher pattern — "mdplane doesn't run your agents"
6. **Section 8:** Optional summary diagram or just CTA
7. **Visual style:** Neo-brutalist warm, v0's design language
