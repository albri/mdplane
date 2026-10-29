// Checks a live mdplane from the outside: the pages and their headers, the uniform 404, and one
// workspace from a task to its response. The "Production check" workflow runs it against
// mdplane.dev every 6 hours, and a failed run notifies the repository owner.
//
//   node apps/site/monitor.ts https://mdplane.dev
//
// It prints statuses only. Actions logs are public and every link is a credential, so no link,
// token or response body is ever printed. On Actions each one is masked as soon as it arrives as
// well, so a slip would print *** instead.
import { readFileSync } from 'node:fs'
import { zAppendResult, zCreateWorkspaceResponse, zFileView, zProblem } from '@mdplane/contract'

const base = new URL(process.argv[2] ?? 'https://mdplane.dev').origin
// workers.dev can't turn off NEL or Browser Integrity Check, so a preview skips those checks.
const preview = new URL(base).hostname.endsWith('.workers.dev')
const onActions = process.env.GITHUB_ACTIONS === 'true'
// Made up, like the keys in the tests. It never matches a workspace.
const MADE_UP = 'wk_AAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
// The instructions ask agents to name their tool, so the monitor names itself.
const AGENT = 'mdplane-monitor (+https://github.com/albri/mdplane)'
// A library's default, which Browser Integrity Check refuses before the Worker runs.
const LIBRARY = 'Python-urllib/3.12'

// Cloudflare answers some failures itself, with a code in the body. 1027 means the account's
// Worker requests for the day are used up, so mdplane.dev is down until midnight UTC.
const CLOUDFLARE: Record<string, string> = {
  '1010': 'Browser Integrity Check refused the user agent',
  '1027': "the day's Worker requests are used up",
  '1042': 'no Worker answers here',
  '1102': 'the Worker ran out of CPU time',
}

let failed = 0

function check(label: string, got: string, wanted: string): boolean {
  if (got === wanted) {
    console.log(`ok    ${label.padEnd(42)} ${got}`)
    return true
  }
  failed++
  console.log(`FAIL  ${label.padEnd(42)} got ${got}, wanted ${wanted}`)
  return false
}

function mask(...values: string[]) {
  if (onActions) for (const value of values) console.log(`::add-mask::${value}`)
}

// Masks each link in a response, and the secret in its key, before anything else reads them.
function maskLinks(value: unknown): unknown {
  for (const link of JSON.stringify(value).match(/https?:\/\/[^"\\]+/g) ?? []) {
    mask(link, link.slice(link.lastIndexOf('.') + 1))
  }
  return value
}

type Init = { method?: string; headers?: Record<string, string>; body?: string }

function request(url: string, init: Init = {}) {
  return fetch(new URL(url, base), {
    ...init,
    headers: { 'User-Agent': AGENT, ...init.headers },
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
  })
}

function append(link: string, body: Record<string, unknown>) {
  return request(`${link}/appends`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'monitor.md', author: 'monitor', ...body }),
  })
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

// The status, with the problem's code or Cloudflare's error code when there is one. The body is
// read for those codes and nothing else.
async function outcome(response: Response): Promise<string> {
  const text = await response.text()
  // The plain-text page says "error code: 1027"; the HTML one has errorCode and links error-1027.
  const code = /(?:error\s?code:?\s*|error[\s-])(1\d{3})\b/i.exec(text)?.[1]
  if (code) return `${response.status} Cloudflare ${code}: ${CLOUDFLARE[code] ?? 'unexpected'}`
  const problem = zProblem.safeParse(parseJson(text))
  return problem.success ? `${response.status} ${problem.data.code}` : String(response.status)
}

async function expectStatus(label: string, response: Response, wanted: number) {
  const got = response.status === wanted ? String(wanted) : await outcome(response)
  return check(label, got, String(wanted))
}

async function expectJson<T>(
  label: string,
  response: Response,
  wanted: number,
  parse: (value: unknown) => T,
): Promise<T | undefined> {
  return (await expectStatus(label, response, wanted)) ? parse(await response.json()) : undefined
}

async function pages() {
  // The static pages' headers. The Worker sends the same ones with the pages it serves itself.
  const wanted: string[] = []
  let block = ''
  for (const line of readFileSync(new URL('public/_headers', import.meta.url), 'utf8').split(
    '\n',
  )) {
    if (/^[^\s#]/.test(line)) block = line.trim()
    const name = /^\s+([\w-]+):/.exec(line)?.[1]
    if (block === '/*' && name) wanted.push(name)
  }
  for (const path of ['/', '/demo']) {
    const response = await request(path, { headers: { Accept: 'text/html' } })
    await expectStatus(`GET ${path}`, response, 200)
    const missing = wanted.filter((name) => !response.headers.has(name))
    check(`GET ${path}: security headers`, missing.join(', ') || 'all', 'all')
    // A NEL report carries the full URL of a failed request, and the URL holds a key.
    if (!preview) check(`GET ${path}: no NEL header`, String(response.headers.has('NEL')), 'false')
  }
  if (preview) {
    console.log("info  workers.dev can't turn off NEL or Browser Integrity Check, so skipped")
    return
  }
  // Agents use libraries, so a library's user agent must get through.
  const response = await request('/demo', { headers: { 'User-Agent': LIBRARY } })
  await expectStatus(`GET /demo as ${LIBRARY}`, response, 200)
}

async function notFound(url: string) {
  const response = await request(url, { headers: { Accept: 'application/json' } })
  const type = response.headers.get('Content-Type')
  return { status: response.status, type, body: await response.text() }
}

async function workspace() {
  const madeUp = await notFound(`/r/${MADE_UP}`)
  check('made-up key', `${madeUp.status} ${madeUp.type}`, '404 application/problem+json')

  // One workspace a run, of the 100 mdplane.dev makes a day. It expires after 72 hours.
  const created = await expectJson(
    'POST /workspaces',
    await request('/workspaces', { method: 'POST' }),
    201,
    (value) => zCreateWorkspaceResponse.parse(maskLinks(value)),
  )
  if (!created) return
  const { read, append: appendLink, write } = created.links
  const here = [read, appendLink, write].filter((link) => link.startsWith(`${base}/`))
  if (!check('links use this origin', String(here.length), '3')) return

  const put = await request(`${write}/files/monitor.md`, {
    method: 'PUT',
    headers: { 'If-None-Match': '*', 'Content-Type': 'text/markdown' },
    body: '# Production check\n',
  })
  if (!(await expectStatus('write a file', put, 201))) return

  const task = await expectJson(
    'add a task',
    await append(appendLink, { type: 'task', body: 'Check that mdplane is up.' }),
    201,
    (value) => zAppendResult.parse(value),
  )
  if (!task) return
  const ref = task.entry.seq

  const claim = await expectJson(
    'claim it',
    await append(appendLink, { type: 'claim', ref }),
    201,
    (value) => {
      const result = zAppendResult.parse(value)
      if (result.lease) mask(result.lease.token)
      return result
    },
  )
  const token = claim?.lease?.token
  if (!check('the claim returns a token', String(Boolean(token)), 'true')) return

  const done = await append(appendLink, { type: 'response', ref, body: 'Up.', token })
  if (!(await expectStatus('respond with the token', done, 201))) return

  const file = await expectJson(
    'read the file',
    await request(`${read}/files/monitor.md`, { headers: { Accept: 'application/json' } }),
    200,
    (value) => zFileView.parse(value),
  )
  if (!file) return
  check('the task is done', file.tasks.find((t) => t.seq === ref)?.status ?? 'missing', 'done')

  // A real workspace with the wrong secret must look exactly like a key that never existed.
  const wrong = await notFound(`${read.slice(0, read.lastIndexOf('.') + 1)}${'x'.repeat(32)}`)
  check('wrong secret, same 404', String(JSON.stringify(wrong) === JSON.stringify(madeUp)), 'true')
}

console.log(`info  checking ${preview ? 'a preview on workers.dev' : base}`)
for (const [label, section] of [
  ['pages', pages],
  ['workspace', workspace],
] as const) {
  try {
    await section()
  } catch (error) {
    // The error's name only: a message can quote a response body, and a body can hold a link.
    check(`${label}: no errors`, error instanceof Error ? error.name : 'unknown', 'none')
  }
}
if (failed > 0 && onActions) console.log(`::error title=mdplane check::${failed} checks failed`)
process.exitCode = failed > 0 ? 1 : 0
