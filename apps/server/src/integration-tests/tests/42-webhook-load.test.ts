/**
 * Webhook Load and Concurrent Creation Tests
 *
 * Tests webhook behavior under load and concurrent operations.
 *
 * Scenarios:
 * - Multiple webhooks with rapid appends
 * - Concurrent webhook creation (race conditions)
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest, bootstrap, type BootstrappedWorkspace } from '../helpers/api-client';
import { uniqueName } from '../helpers/test-utils';

describe('42 - Webhook Load Tests', () => {
  let workspace: BootstrappedWorkspace;
  const testFile = `${uniqueName('webhook-load')}.md`;

  beforeAll(async () => {
    workspace = await bootstrap();

    await apiRequest('PUT', `/w/${workspace.writeKey}/${testFile}`, {
      body: { content: '# Webhook Load Test\n\nContent.' },
    });
  });

  describe('Webhook Delivery Under Load', () => {
    test('can create 5 webhooks on same workspace', async () => {
      const webhookIds: string[] = [];

      for (let i = 1; i <= 5; i++) {
        const response = await apiRequest('POST', `/w/${workspace.writeKey}/webhooks`, {
          body: {
            url: `https://load-test-${i}.example.com/callback`,
            events: ['append.created'],
          },
        });

        expect(response.status).toBe(201);
        const data = await response.json();
        webhookIds.push(data.data.id);
      }

      expect(webhookIds.length).toBe(5);
    });

    test('rapid appends are accepted', async () => {
      const appendPromises = [];
      for (let i = 1; i <= 5; i++) {
        appendPromises.push(
          apiRequest('POST', `/a/${workspace.appendKey}/${testFile}`, {
            body: {
              type: 'comment',
              author: 'load-test',
              content: `Rapid append ${i}`,
            },
          })
        );
      }

      const results = await Promise.all(appendPromises);

      for (const response of results) {
        expect(response.status).toBe(201);
      }
    });

    test('file contains all appends after rapid writes', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/${testFile}?format=parsed`);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.data.appends.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Concurrent Webhook Creation', () => {
    test('5 concurrent webhook creations all succeed', async () => {
      const createPromises = [];
      for (let i = 1; i <= 5; i++) {
        createPromises.push(
          apiRequest('POST', `/w/${workspace.writeKey}/webhooks`, {
            body: {
              url: `https://concurrent-${i}.example.com/callback`,
              events: ['task.created'],
            },
          })
        );
      }

      const results = await Promise.all(createPromises);

      const ids: string[] = [];
      for (const response of results) {
        expect(response.status).toBe(201);
        const data = await response.json();
        ids.push(data.data.id);
      }

      expect(new Set(ids).size).toBe(5);
    });

    test('concurrent deletions all succeed', async () => {
      const listResponse = await apiRequest('GET', `/w/${workspace.writeKey}/webhooks`);
      const listData = await listResponse.json();

      const toDelete = listData.data.slice(0, 3).map((w: { id: string }) => w.id);

      const deletePromises = toDelete.map((id: string) =>
        apiRequest('DELETE', `/w/${workspace.writeKey}/webhooks/${id}`)
      );

      const results = await Promise.all(deletePromises);

      for (const response of results) {
        expect(response.status).toBe(200);
      }

      const listAfter = await apiRequest('GET', `/w/${workspace.writeKey}/webhooks`);
      const dataAfter = await listAfter.json();

      for (const id of toDelete) {
        const found = dataAfter.data.find((w: { id: string }) => w.id === id);
        expect(found).toBeUndefined();
      }
    });
  });
});

