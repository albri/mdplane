import { Globe, Folder, FileText } from 'lucide-react'
import { Section, SectionHeader } from '../ui/section'

export function WorkspacesSection() {
  return (
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
  )
}

