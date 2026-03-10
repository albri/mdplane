# App v2 — Runtime UX Improvements

> Planning document for improving the web app capability URL experience.

---

## Problem Statement

After creating a workspace, users are shown their keys but then hit a **terminal-first** empty state. The `RootOnboardingState` component shows curl commands, which alienates casual users who just want to paste markdown and share it.

The current flow:
1. User creates workspace at `/launch`
2. User sees keys in `WorkspaceCreatedState`
3. User clicks read URL → goes to `/r/[readKey]`
4. Workspace is empty → sees curl commands to create files
5. **Friction point**: casual user expected web UI, not terminal

---

## Current State

### Routes that exist:
- `/r/[readKey]` — Read-only runtime view ✓
- `/launch` — Workspace creation flow ✓

### Routes that DON'T exist:
- `/w/[writeKey]` — No web UI for write capability
- `/a/[appendKey]` — No web UI for append capability

Users with write/append keys are forced to use CLI/API.

---

## Proposed Solution

### 1. Add `/w/[writeKey]` routes

Mirror the `/r/` structure but with write actions:

**Folder view (`/w/[writeKey]` and `/w/[writeKey]/[...path]`):**
- Same file/folder listing as read view
- "+ New file" button
- "+ New folder" button  
- Delete actions (with confirmation)

**File view (`/w/[writeKey]/[...path]`):**
- Same rendered markdown as read view
- "Edit" button → inline editor with save/cancel
- "Delete" button (with confirmation)

**Create file UI (`/w/[writeKey]/new` or inline):**
- Two modes:
  - **Paste**: Textarea for markdown content
  - **Attach**: File picker (drag & drop?)
- Filename input (with .md default)
- Save button
- CLI/curl commands as **collapsed "Advanced" section**

### 2. Add `/a/[appendKey]` routes (lower priority)

- View existing appends
- Append form: type selector (task/response/blocked) + content
- Claim/unclaim buttons for tasks

### 3. Update empty workspace state

Replace terminal-first `RootOnboardingState` with web-first:

**Primary:**
- "Add your first file" → paste UI or file picker
- Inline creation, not a separate page

**Secondary (collapsed):**
- "Or use CLI/API" → shows curl commands

---

## Implementation Plan

### Phase 1: Write routes (critical path)

1. Create `/w/[writeKey]/page.tsx` — folder view with create actions
2. Create `/w/[writeKey]/[...path]/page.tsx` — file/folder view with edit/delete
3. Create file creation component — paste OR attach, filename input
4. Create file edit component — inline editor with save/cancel
5. Add delete confirmation modal

### Phase 2: Empty state improvement

1. Update `RootOnboardingState` to be web-first
2. Show paste/attach UI as primary action
3. Collapse CLI/curl to "Advanced" disclosure

### Phase 3: Append routes (nice to have)

1. Create `/a/[appendKey]/page.tsx`
2. Append form component
3. Task claim/unclaim UI

---

## UX Principles

1. **Web-first, CLI-second** — Casual users shouldn't need terminal
2. **Progressive disclosure** — Advanced features (CLI, curl) are collapsed
3. **Capability-appropriate UI** — Each key type shows relevant actions only
4. **No friction** — Paste, name, save. That's it.

---

## The Delightful Flow (After Changes)

1. User creates workspace at `/launch`
2. Sees keys + **"Add your first file →"** button
3. Goes to `/w/[writeKey]` → sees empty workspace with paste UI
4. Pastes markdown, names file, saves
5. File appears → can view, edit, share read URL
6. Casual user is happy. Power user can still use CLI.

---

## Open Questions

- Should `/w/` routes require any auth, or is the capability URL sufficient?
- Should we support folders in the initial release, or just flat files?
- Should file edit be inline or a separate "edit mode" page?
- Do we need autosave/draft support?

---

## Related

- See `landing-page-v2.md` for landing page work
- The `/new` route on landing will link to `/launch` or a similar flow

