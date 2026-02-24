import { generateKey } from '../core/capability-keys'
import type { CapabilityUrls } from '@mdplane/shared'
import type { WorkspaceKeys } from './types'

export function generateFileId(): string {
  return generateKey(16).substring(0, 5)
}

export function generateRecordId(): string {
  return generateKey(16)
}

export function generateWebhookId(): string {
  return `wh_${generateKey(12)}`
}

export function generateWebhookSecret(): string {
  return `whsec_${generateKey(24)}`
}

type BuildFileUrlsInput = {
  baseUrl: string
  filePath: string
  keys: WorkspaceKeys
}

export function buildFileUrls({ baseUrl, filePath, keys }: BuildFileUrlsInput): CapabilityUrls {
  return {
    read: keys.readKey ? `${baseUrl}/r/${keys.readKey}/files${filePath}` : null,
    append: keys.appendKey ? `${baseUrl}/a/${keys.appendKey}/files${filePath}` : null,
    write: keys.writeKey ? `${baseUrl}/w/${keys.writeKey}/files${filePath}` : null,
  }
}
