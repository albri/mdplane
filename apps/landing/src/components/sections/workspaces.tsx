import { Globe, Folder, FileText } from 'lucide-react'
import { Section, SectionHeader } from '../ui/section'

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
        
        <div className="bg-card p-8 border-3 border-border shadow-lg -rotate-1">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b-3 border-foreground">
            <Globe size={24} />
            <span className="font-mono font-bold text-lg">app.mdplane.dev/w/abc-123</span>
          </div>
          <div className="space-y-4 font-mono text-lg">
            <div className="flex items-center gap-3 font-bold">
              <Folder size={20} className="fill-amber" />
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
                <Folder size={18} className="fill-sage" />
                <span>logs</span>
              </div>
              <div className="pl-8 space-y-3">
                <div className="flex items-center gap-3 text-terracotta">
                  <FileText size={18} />
                  <span>agent-run-01.md</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}

