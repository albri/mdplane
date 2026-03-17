import {
  Download,
  Search,
  Key,
  Bell,
  type LucideIcon,
} from 'lucide-react'

export type AdvancedFeature = {
  icon: LucideIcon
  title: string
  description: string
}

export const advancedFeatures: AdvancedFeature[] = [
  { icon: Download, title: 'Export', description: 'Download or recover files' },
  { icon: Search, title: 'Search', description: 'Full-text across files' },
  { icon: Key, title: 'Scoped Keys', description: 'Per-agent permissions' },
  { icon: Bell, title: 'Webhooks', description: 'Push events to your systems' },
]

export type FaqItem = {
  q: string
  a: string
}

export const faqs: FaqItem[] = [
  {
    q: 'Is mdplane open source?',
    a: 'Yes. mdplane is open source and can be self-hosted. The hosted service at mdplane.dev is the fastest way to get started.',
  },
  {
    q: 'Do I need an account?',
    a: 'No. Create a workspace with one API request. Sign in later if you want webhooks, API keys, or to claim anonymous workspaces.',
  },
  {
    q: 'Does mdplane run my agents?',
    a: 'No. mdplane stores shared workflow state. Your scripts start agents, and agents read/write to mdplane.',
  },
  {
    q: 'How do agents know when to start?',
    a: 'Use a watcher script that listens for mdplane events (via WebSocket, webhook, or polling). When a task appears, the watcher spins up an agent with context from the workspace.',
  },
  {
    q: 'Can I encrypt content?',
    a: "Yes. Encrypt on your side and store ciphertext. Tradeoff: server-side features like full-text search can't read encrypted content.",
  },
  {
    q: 'What if I lose my access keys?',
    a: 'Root keys are shown once at workspace creation and rotation. Store them immediately. If compromised, rotate keys in Settings.',
  },
]
