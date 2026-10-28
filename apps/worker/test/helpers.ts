import { zCreateWorkspaceResponse } from '@mdplane/contract'
import { exports } from 'cloudflare:workers'

export const ORIGIN = 'https://mdplane.test'

let address = 0

const pathOf = (url: string) => url.slice(ORIGIN.length)

export function call(path: string, init: RequestInit = {}): Promise<Response> {
  return exports.default.fetch(new Request(`${ORIGIN}${path}`, init))
}

// Each workspace comes from its own address, so the per-address create limit isn't shared.
export async function createWorkspace(name?: string) {
  address += 1
  const response = await call('/workspaces', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': `10.0.${Math.floor(address / 250)}.${address % 250}`,
    },
    body: JSON.stringify(name ? { name } : {}),
  })
  if (response.status !== 201) throw new Error(`create returned ${response.status}`)
  const created = zCreateWorkspaceResponse.parse(await response.json())
  return {
    id: created.id,
    read: pathOf(created.links.read),
    append: pathOf(created.links.append),
    write: pathOf(created.links.write),
  }
}

export async function writeFile(link: string, path: string, body: string, etag?: string) {
  return call(`${link}/files/${path}`, {
    method: 'PUT',
    headers: etag ? { 'If-Match': etag } : { 'If-None-Match': '*' },
    body,
  })
}

export async function append(link: string, entry: Record<string, unknown>, key?: string) {
  return call(`${link}/appends`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
    body: JSON.stringify(entry),
  })
}

export async function json(response: Response): Promise<unknown> {
  return response.json()
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
