/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import {
  CONTROL_LAST_WORKSPACE_COOKIE,
  buildControlWorkspacePath,
  extractControlWorkspaceId,
  isWorkspaceId,
} from './control-workspace-routing'

describe('control workspace routing helpers', () => {
  test('validates workspace id format', () => {
    expect(isWorkspaceId('ws_demoWorkspace')).toBe(true)
    expect(isWorkspaceId('ws_123')).toBe(true)
    expect(isWorkspaceId('api-keys')).toBe(false)
    expect(isWorkspaceId('ws-123')).toBe(false)
    expect(isWorkspaceId('')).toBe(false)
  })

  test('extracts workspace id from control path', () => {
    expect(extractControlWorkspaceId('/control/ws_demo')).toBe('ws_demo')
    expect(extractControlWorkspaceId('/control/ws_demo/settings')).toBe('ws_demo')
    expect(extractControlWorkspaceId('/control')).toBeNull()
    expect(extractControlWorkspaceId('/control/api-keys')).toBeNull()
    expect(extractControlWorkspaceId('/launch')).toBeNull()
  })

  test('builds workspace-scoped path preserving sub-route segments', () => {
    expect(buildControlWorkspacePath('/control/ws_old', 'ws_new')).toBe('/control/ws_new')
    expect(buildControlWorkspacePath('/control/ws_old/api-keys', 'ws_new')).toBe('/control/ws_new/api-keys')
    expect(buildControlWorkspacePath('/control', 'ws_new')).toBe('/control/ws_new')
    expect(buildControlWorkspacePath('/control/api-keys', 'ws_new')).toBe('/control/ws_new')
    expect(buildControlWorkspacePath('/launch', 'ws_new')).toBe('/control/ws_new')
  })

  test('uses stable cookie name for last workspace', () => {
    expect(CONTROL_LAST_WORKSPACE_COOKIE).toBe('mdplane_last_workspace_id')
  })
})

