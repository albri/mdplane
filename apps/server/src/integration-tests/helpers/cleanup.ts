/**
 * Integration Tests Cleanup
 *
 * Cleans up all test data created during integration tests.
 */

import { CONFIG } from '../config';
import { apiRequest } from './api-client';

interface FolderItem {
  name: string;
  path: string;
  type: 'file' | 'folder';
}

/** Tracked workspaces for cleanup */
interface TrackedWorkspace {
  workspaceId: string;
  readKey: string;
  appendKey: string;
  writeKey: string;
}

const testWorkspaces: TrackedWorkspace[] = [];

/** Register a workspace for cleanup after tests */
export function registerWorkspace(ws: TrackedWorkspace): void {
  testWorkspaces.push(ws);
}

/** Get all registered workspaces */
export function getTestWorkspaces(): TrackedWorkspace[] {
  return [...testWorkspaces];
}

/** Clear tracked workspaces (after cleanup) */
export function clearTrackedWorkspaces(): void {
  testWorkspaces.length = 0;
}

/**
 * List all items in a workspace folder
 */
async function listFolderItems(readKey: string, folderPath: string = ''): Promise<FolderItem[]> {
  const path = folderPath ? `/r/${readKey}/folders/${folderPath}` : `/r/${readKey}/folders`;
  const response = await apiRequest('GET', path);

  if (!response.ok) {
    console.warn(`  ⚠ Could not list folder ${folderPath}: ${response.status}`);
    return [];
  }

  const data = await response.json();
  return data.data?.items ?? [];
}

/**
 * Recursively find all integration test items
 */
async function findIntegrationTestItems(
  readKey: string,
  folderPath: string = ''
): Promise<string[]> {
  const items = await listFolderItems(readKey, folderPath);
  const paths: string[] = [];

  for (const item of items) {
    if (item.name.startsWith(CONFIG.TEST_PREFIX)) {
      paths.push(item.path);
    }
    if (item.type === 'folder') {
      const subPaths = await findIntegrationTestItems(readKey, item.path);
      paths.push(...subPaths);
    }
  }

  return paths;
}

/**
 * Delete a file or folder permanently
 */
async function deleteItem(writeKey: string, itemPath: string): Promise<boolean> {
  const response = await apiRequest('DELETE', `/w/${writeKey}/${itemPath}?permanent=true`);
  return response.ok;
}

/**
 * Clean up all test data from all registered workspaces
 */
export async function cleanupAllTestData(): Promise<void> {
  const workspaces = getTestWorkspaces();

  if (workspaces.length === 0) {
    console.log('🧹 No test workspaces to clean up');
    return;
  }

  console.log(`🧹 Cleaning up ${workspaces.length} test workspace(s)...`);

  let totalDeleted = 0;
  let totalErrors = 0;

  for (const ws of workspaces) {
    try {
      const items = await findIntegrationTestItems(ws.readKey);

      if (items.length === 0) {
        console.log(`  ✓ Workspace ${ws.workspaceId}: no test items to delete`);
        continue;
      }

      const sortedItems = items.sort((a, b) => b.length - a.length);

      for (const itemPath of sortedItems) {
        const success = await deleteItem(ws.writeKey, itemPath);
        if (success) {
          totalDeleted++;
        } else {
          totalErrors++;
          console.warn(`  ⚠ Failed to delete: ${itemPath}`);
        }
      }

      console.log(`  ✓ Workspace ${ws.workspaceId}: deleted ${items.length} item(s)`);
    } catch (error) {
      totalErrors++;
      console.error(`  ✗ Error cleaning workspace ${ws.workspaceId}:`, error);
    }
  }

  clearTrackedWorkspaces();

  console.log(`🧹 Cleanup complete: ${totalDeleted} deleted, ${totalErrors} errors`);
}
