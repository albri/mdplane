/**
 * Webhook Event Filtering Tests
 *
 * Tests webhook event filtering and subscription options.
 *
 * Scenarios:
 * - Subscribe to specific event types
 * - Filter by append type (task, comment, etc.)
 * - Filter by labels
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest, bootstrap, type BootstrappedWorkspace } from '../helpers/api-client';
import { uniqueName } from '../helpers/test-utils';

describe('43 - Webhook Event Filtering', () => {
  let workspace: BootstrappedWorkspace;
  const testFile = `${uniqueName('webhook-filter')}.md`;

  beforeAll(async () => {
    workspace = await bootstrap();

    await apiRequest('PUT', `/w/${workspace.writeKey}/${testFile}`, {
      body: { content: '# Webhook Filter Test\n\nContent.' },
    });
  });

  describe('Event Type Filtering', () => {
    test('can subscribe to append.created only', async () => {
      const response = await apiRequest('POST', `/w/${workspace.writeKey}/webhooks`, {
        body: {
          url: 'https://append-only.example.com/callback',
          events: ['append.created'],
        },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.data.events).toEqual(['append.created']);
    });

    test('can subscribe to task events only', async () => {
      const response = await apiRequest('POST', `/w/${workspace.writeKey}/webhooks`, {
        body: {
          url: 'https://task-only.example.com/callback',
          events: ['task.created', 'task.claimed', 'task.completed'],
        },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.data.events).toContain('task.created');
      expect(data.data.events).toContain('task.claimed');
      expect(data.data.events).toContain('task.completed');
      expect(data.data.events).not.toContain('append.created');
    });

    test('can subscribe to file events only', async () => {
      const response = await apiRequest('POST', `/w/${workspace.writeKey}/webhooks`, {
        body: {
          url: 'https://file-only.example.com/callback',
          events: ['file.created', 'file.updated', 'file.deleted'],
        },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.data.events).toContain('file.created');
      expect(data.data.events).toContain('file.updated');
      expect(data.data.events).toContain('file.deleted');
    });

    test('can subscribe to all task lifecycle events', async () => {
      const response = await apiRequest('POST', `/w/${workspace.writeKey}/webhooks`, {
        body: {
          url: 'https://task-lifecycle.example.com/callback',
          events: ['task.created', 'task.claimed', 'task.completed', 'task.cancelled', 'task.blocked'],
        },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.data.events.length).toBe(5);
    });
  });

  describe('Filter Options', () => {
    test('can add type filter to webhook', async () => {
      const response = await apiRequest('POST', `/w/${workspace.writeKey}/webhooks`, {
        body: {
          url: 'https://filtered-type.example.com/callback',
          events: ['append.created'],
          filters: {
            types: ['task'],
          },
        },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.ok).toBe(true);
    });

    test('can add label filter to webhook', async () => {
      const response = await apiRequest('POST', `/w/${workspace.writeKey}/webhooks`, {
        body: {
          url: 'https://filtered-label.example.com/callback',
          events: ['append.created'],
          filters: {
            labels: ['urgent', 'bug'],
          },
        },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.ok).toBe(true);
    });

    test('can combine type and label filters', async () => {
      const response = await apiRequest('POST', `/w/${workspace.writeKey}/webhooks`, {
        body: {
          url: 'https://filtered-combined.example.com/callback',
          events: ['append.created'],
          filters: {
            types: ['task'],
            labels: ['urgent'],
          },
        },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.ok).toBe(true);
    });
  });

  describe('Invalid Events', () => {
    test('invalid event type returns 400', async () => {
      const response = await apiRequest('POST', `/w/${workspace.writeKey}/webhooks`, {
        body: {
          url: 'https://invalid-event.example.com/callback',
          events: ['invalid.event.type'],
        },
      });

      expect(response.status).toBe(400);
    });

    test('empty events array is accepted by API', async () => {
      const response = await apiRequest('POST', `/w/${workspace.writeKey}/webhooks`, {
        body: {
          url: 'https://all-events.example.com/callback',
          events: [],
        },
      });

      expect(response.status).toBe(201);
    });
  });
});
