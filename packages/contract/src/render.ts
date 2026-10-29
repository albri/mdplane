// Markdown views for agents. JSON clients get the contract's types; these are for reading.
import { instructions, start } from './generated/instructions.gen.ts'
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

export type TaskCounts = Record<TaskView['status'], number>
const STATUSES = ['open', 'claimed', 'done', 'cancelled'] as const

export function tallyTasks(tasks: TaskView[]): TaskCounts {
  const counts: TaskCounts = { open: 0, claimed: 0, done: 0, cancelled: 0 }
  for (const task of tasks) counts[task.status] += 1
  return counts
}

// Done and cancelled tasks aren't listed, so the counts are how an agent tells finished work from
// none at all.
function tally(counts: TaskCounts): string {
  const parts = STATUSES.filter((s) => counts[s] > 0).map((s) => `${counts[s]} ${s}`)
  return parts.length > 0 ? `: ${parts.join(', ')}` : ''
}

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
      ? [
          '',
          `${plural(omitted.tasks, 'more task isn’t', 'more tasks aren’t')} shown. Each is a \`task\` entry at \`GET $URL/log?path=${view.path}&after=${view.since}\`.`,
        ]
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

// `counts` covers every task in each file, when `tasks` holds only the open and claimed ones.
export function renderNow(
  workspace: Workspace,
  tasks: Record<string, TaskView[]>,
  counts: Record<string, TaskCounts> = {},
): string {
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
    const all = tasks[file.path] ?? []
    const active = all.filter((task) => task.status === 'open' || task.status === 'claimed')
    const counted = counts[file.path] ?? tallyTasks(all)
    lines.push(`- \`${file.path}\`, version ${file.version}${tally(counted)}`)
    for (const task of active)
      lines.push(`  - #${task.seq} ${status(task)}: ${firstLine(task.body)}`)
  }
  return `${lines.join('\n').trimEnd()}\n`
}

// What `GET $URL` returns to an agent: how to use its link, then what is happening now.
export function renderInstructions(
  workspace: Workspace,
  tasks: Record<string, TaskView[]>,
  counts: Record<string, TaskCounts> = {},
): string {
  return `${instructions[workspace.link.tier].trimEnd()}\n\n${renderNow(workspace, tasks, counts)}`
}

// What `GET /` returns to an agent that has no link yet, with requests addressed to this server.
export const renderStart = (origin: string): string => start.replaceAll('{{origin}}', origin)
