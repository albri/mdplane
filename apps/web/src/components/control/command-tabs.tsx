'use client'

import { CodeBlock } from '@mdplane/ui/ui/code-block'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CopyButton } from '@/components/ui/copy-button'

interface CommandTabsProps {
  command?: string
  apiCommand?: string
  cliCommand?: string
  label?: string
  testId?: string
  copyMode?: 'external' | 'inline'
}

export function CommandTabs({
  command,
  apiCommand,
  cliCommand,
  label = 'Copy command',
  testId,
  copyMode = 'external',
}: CommandTabsProps) {
  const singleCommand = command ?? apiCommand
  const hasApiCliTabs = apiCommand != null && apiCommand !== '' && cliCommand != null && cliCommand !== ''

  if (hasApiCliTabs) {
    return (
      <div className="space-y-3" data-testid={testId}>
        <Tabs defaultValue="api">
          <TabsList>
            <TabsTrigger value="api">API (curl)</TabsTrigger>
            <TabsTrigger value="cli">CLI</TabsTrigger>
          </TabsList>
          <TabsContent value="api">
            <CodeBlock language="bash" showLanguageHeader={false}>{apiCommand}</CodeBlock>
            {copyMode === 'external' ? (
              <CopyButton text={apiCommand} label={`${label} (API)`} className="mt-3 w-full sm:w-auto" />
            ) : null}
          </TabsContent>
          <TabsContent value="cli">
            <CodeBlock language="bash" showLanguageHeader={false}>{cliCommand}</CodeBlock>
            {copyMode === 'external' ? (
              <CopyButton text={cliCommand} label={`${label} (CLI)`} className="mt-3 w-full sm:w-auto" />
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  if (singleCommand == null || singleCommand === '') {
    return null
  }

  return (
    <div className="space-y-3" data-testid={testId}>
      <CodeBlock language="bash" showLanguageHeader={false}>{singleCommand}</CodeBlock>
      {copyMode === 'external' ? (
        <CopyButton text={singleCommand} label={label} className="w-full sm:w-auto" />
      ) : null}
    </div>
  )
}

