// Markdown views for agents. JSON clients get the contract's types; these are for reading.
import { instructions } from './generated/instructions.gen.ts'
import type { Entry, FileView, Link, TaskView, Workspace } from './generated/types.gen.ts'

const time = (iso: string) => `${iso.slice(11, 16)} UTC`
const dateTime = (iso: string) => `${iso.slice(0, 10)} ${time(iso)}`

// Continuation lines are indented so a multi-line body stays inside its list item.
const indent = (text: string) => text.replaceAll('\n', '\n  ')

const firstLine = (text: string, max = 120) => {
  const line = text.split('\n', 1)[0] ?? ''
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

function status(task: TaskView): string {
  if (task.status === 'claimed' && task.holder && task.leaseExpiresAt) {
    return `claimed by ${task.holder} until ${time(task.leaseExpiresAt)}`
  }
  return task.status
}

function entryLine(entry: Entry): string {
  const about = entry.ref === null ? '' : ` on #${entry.ref}`
  const detail =
    entry.type === 'write'
      ? `version ${entry.version}`
      : entry.type === 'delete'
        ? 'deleted the file'
        : (entry.body ?? '')
  return `- #${entry.seq} ${time(entry.at)} ${entry.author}, ${entry.type}${about}: ${indent(detail)}`
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function renderFile(view: FileView): string {
  const tasks = view.tasks.map(
    (task) => `- #${task.seq} ${status(task)}: ${indent(task.body)} (from ${task.author})`,
  )
  const { omitted } = view
  return [
    view.body.trimEnd(),
    '',
    '---',
    '',
    `## Tasks in ${view.path}`,
    '',
    tasks.length > 0 ? tasks.join('\n') : 'No tasks yet.',
    ...(omitted.tasks > 0
      ? ['', `${plural(omitted.tasks, 'more task isn’t', 'more tasks aren’t')} shown.`]
      : []),
    '',
    '## Log',
    '',
    ...(omitted.entries > 0
      ? [
          `The newest ${view.entries.length} entries. ${plural(omitted.entries, 'older entry is', 'older entries are')} at \`GET $URL/log?path=${view.path}&after=${view.since}\`.`,
          '',
        ]
      : []),
    view.entries.map(entryLine).join('\n'),
    '',
    `Version ${view.version} of ${view.path}, as of entry ${view.at}. The workspace log is at entry ${view.head.seq}.`,
    '',
  ].join('\n')
}

function scopeLine(link: Link): string {
  return link.folder === null ? '' : ` This link is limited to the \`${link.folder}\` folder.`
}

export function renderNow(workspace: Workspace, tasks: Record<string, TaskView[]>): string {
  const name = workspace.name === null ? 'This workspace' : `The workspace \`${workspace.name}\``
  const expiry =
    workspace.expiresAt === null ? '' : ` It expires at ${dateTime(workspace.expiresAt)}.`
  const lines = [
    '## Right now',
    '',
    `${name} is at log entry ${workspace.head.seq}.${expiry}${scopeLine(workspace.link)}`,
    '',
  ]
  if (workspace.files.length === 0) {
    lines.push(
      workspace.link.tier === 'w'
        ? 'There are no files yet. Create one with `PUT $URL/files/{path}`.'
        : 'There are no files yet.',
      '',
    )
  }
  for (const file of workspace.files) {
    const active = (tasks[file.path] ?? []).filter(
      (task) => task.status === 'open' || task.status === 'claimed',
    )
    lines.push(`- \`${file.path}\`, version ${file.version}`)
    for (const task of active)
      lines.push(`  - #${task.seq} ${status(task)}: ${firstLine(task.body)}`)
  }
  return `${lines.join('\n').trimEnd()}\n`
}

// What `GET $URL` returns to an agent: how to use its link, then what is happening now.
export function renderInstructions(
  workspace: Workspace,
  tasks: Record<string, TaskView[]>,
): string {
  return `${instructions[workspace.link.tier].trimEnd()}\n\n${renderNow(workspace, tasks)}`
}
