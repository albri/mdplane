import { Globe, Folder, FileText } from 'lucide-react'
import { Section, SectionHeader } from '../ui/section'

interface FileItem {
  name: string
  type: 'file' | 'folder'
  color?: string
  children?: FileItem[]
}

const FILE_TREE: FileItem[] = [
  {
    name: 'project-alpha',
    type: 'folder',
    color: 'fill-amber',
    children: [
      { name: 'README.md', type: 'file' },
      { name: 'api-spec.md', type: 'file' },
      {
        name: 'logs',
        type: 'folder',
        color: 'fill-sage',
        children: [{ name: 'agent-run-01.md', type: 'file', color: 'text-terracotta' }],
      },
    ],
  },
]

function FileTreeItem({ item, depth = 0 }: { item: FileItem; depth?: number }) {
  const Icon = item.type === 'folder' ? Folder : FileText
  const isRoot = depth === 0

  return (
    <li>
      <div className={`flex items-center gap-3 ${isRoot ? 'font-bold' : ''} ${item.color || ''}`}>
        <Icon size={isRoot ? 20 : 18} className={item.type === 'folder' ? item.color : ''} aria-hidden="true" />
        <span>{item.name}</span>
      </div>
      {item.children && (
        <ul className="pl-8 space-y-3 mt-3" role="group">
          {item.children.map((child) => (
            <FileTreeItem key={child.name} item={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function WorkspacesSection() {
  return (
    <Section id="workspaces" className="bg-background">
      <div className="grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <SectionHeader title="Workspaces" />
          <p className="text-2xl font-medium mb-8 leading-relaxed">
            A workspace is a container for your markdown files — like a folder you can share with a URL.
          </p>
          <div className="inline-block bg-amber px-6 py-4 border-3 border-border shadow-sm rotate-1">
            <p className="text-xl font-bold font-display">Like a mini repo — instantly shareable.</p>
          </div>
        </div>

        <figure className="bg-card p-8 border-3 border-border shadow-lg -rotate-1" aria-label="Example workspace structure">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b-3 border-foreground">
            <Globe size={24} aria-hidden="true" />
            <span className="font-mono font-bold text-lg">app.mdplane.dev/w/abc-123</span>
          </div>
          <ul className="space-y-4 font-mono text-lg" role="tree" aria-label="File tree">
            {FILE_TREE.map((item) => (
              <FileTreeItem key={item.name} item={item} />
            ))}
          </ul>
        </figure>
      </div>
    </Section>
  )
}

