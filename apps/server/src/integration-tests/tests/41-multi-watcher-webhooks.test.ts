/**
 * Multi-Watcher Webhook Tests
 *
 * Tests multiple webhook subscribers on the same file/folder.
 *
 * Use Cases Covered:
 * - Subscribe to someone else's public file
 * - Watch a folder for changes
 *
 * Multi-Watcher Scenarios:
 * - Multiple webhooks on same file (fan-out)
 * - Each webhook has unique ID/secret
 * - Deleting one webhook doesn't affect others
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest, bootstrap, type BootstrappedWorkspace } from '../helpers/api-client';
import { uniqueName } from '../helpers/test-utils';

const WEBHOOK_ID_PATTERN = /^wh_[A-Za-z0-9]+$/;
const WEBHOOK_SECRET_PATTERN = /^whsec_[A-Za-z0-9]+$/;

describe('41 - Multi-Watcher Webhooks', () => {
  let workspace: BootstrappedWorkspace;
  const testFile = `${uniqueName('multi-webhook')}.md`;

  beforeAll(async () => {
    workspace = await bootstrap();

    await apiRequest('PUT', `/w/${workspace.writeKey}/${testFile}`, {
      body: { content: '# Multi-Watcher Test\n\nShared file.' },
    });
  });

  describe('Multiple Webhooks on Same File', () => {
    test('can create 3 webhooks on same workspace', async () => {
      const webhooks: Array<{ id: string; secret: string }> = [];

      for (let i = 1; i <= 3; i++) {
        const response = await apiRequest('POST', `/w/${workspace.writeKey}/webhooks`, {
          body: {
            url: `https://agent${i}.example.com/callback`,
            events: ['append.created'],
          },
        });

        expect(response.status).toBe(201);
        const data = await response.json();
        expect(data.ok).toBe(true);
        expect(data.data.id).toMatch(WEBHOOK_ID_PATTERN);
        expect(data.data.secret).toMatch(WEBHOOK_SECRET_PATTERN);

        webhooks.push({ id: data.data.id, secret: data.data.secret });
      }

      const ids = webhooks.map((w) => w.id);
      expect(new Set(ids).size).toBe(3);

      const secrets = webhooks.map((w) => w.secret);
      expect(new Set(secrets).size).toBe(3);
    });

    test('list shows all webhooks', async () => {
      const response = await apiRequest('GET', `/w/${workspace.writeKey}/webhooks`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThanOrEqual(3);
    });

    test('each webhook in list has unique ID', async () => {
      const response = await apiRequest('GET', `/w/${workspace.writeKey}/webhooks`);
      const data = await response.json();

      const ids = data.data.map((w: { id: string }) => w.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    test('secrets not exposed in list', async () => {
      const response = await apiRequest('GET', `/w/${workspace.writeKey}/webhooks`);
      const data = await response.json();

      for (const webhook of data.data) {
        expect(webhook.secret).toBeUndefined();
      }
    });
  });

  describe('Webhook Independence', () => {
    test('deleting one webhook does not affect others', async () => {
      const listBefore = await apiRequest('GET', `/w/${workspace.writeKey}/webhooks`);
      const dataBefore = await listBefore.json();
      const countBefore = dataBefore.data.length;

      const firstId = dataBefore.data[0].id;
      const deleteResponse = await apiRequest('DELETE', `/w/${workspace.writeKey}/webhooks/${firstId}`);
      expect(deleteResponse.status).toBe(200);

      const deleteData = await deleteResponse.json();
      expect(deleteData.ok).toBe(true);
      expect(deleteData.data.id).toBe(firstId);
      expect(deleteData.data.deleted).toBe(true);

      const listAfter = await apiRequest('GET', `/w/${workspace.writeKey}/webhooks`);
      const dataAfter = await listAfter.json();
      expect(dataAfter.data.length).toBe(countBefore - 1);

      const found = dataAfter.data.find((w: { id: string }) => w.id === firstId);
      expect(found).toBeUndefined();
    });
  });

  describe('Event Filtering', () => {
    test('webhook can subscribe to specific events', async () => {
      const response = await apiRequest('POST', `/w/${workspace.writeKey}/webhooks`, {
        body: {
          url: 'https://task-watcher.example.com/callback',
          events: ['task.created', 'task.completed'],
        },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.data.events).toContain('task.created');
      expect(data.data.events).toContain('task.completed');
      expect(data.data.events).not.toContain('append.created');
    });

    test('webhook can subscribe to file events', async () => {
      const response = await apiRequest('POST', `/w/${workspace.writeKey}/webhooks`, {
        body: {
          url: 'https://file-watcher.example.com/callback',
          events: ['file.created', 'file.updated', 'file.deleted'],
        },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.data.events).toContain('file.created');
      expect(data.data.events).toContain('file.updated');
      expect(data.data.events).toContain('file.deleted');
    });
  });
});

