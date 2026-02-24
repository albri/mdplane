/**
 * Real WebSocket Tests (- )
 *
 * Actually connect via WebSocket and verify event delivery.
 * These tests use real WebSocket connections, not HTTP endpoints.
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { bootstrap, type BootstrappedWorkspace } from '../helpers/api-client';
import { integrationLock } from '../helpers/test-lock';
import {
  connectWebSocket,
  waitForConnected,
  waitForEvent,
  createFile,
  appendToFile,
  deleteFile,
  closeWebSocket,
  sleep,
  type WebSocketLike,
} from '../helpers/websocket';

describe('60 - Real WebSocket Tests', () => {
  let writeKey: string;
  let readKey: string;
  let appendKey: string;
  const openSockets: WebSocketLike[] = [];

  beforeAll(async () => {
    const workspace: BootstrappedWorkspace = await bootstrap();
    writeKey = workspace.writeKey;
    readKey = workspace.readKey;
    appendKey = workspace.appendKey;
  });

  afterEach(async () => {
    await Promise.all(openSockets.map((ws) => closeWebSocket(ws)));
    openSockets.length = 0;
    // Give the server a beat to process close handlers and decrement counts
    await sleep(50);
  });

  describe('WebSocket Connection', () => {
    test('connects with valid token', async () => {
      await integrationLock.runExclusive(async () => {
        const ws = await connectWebSocket(readKey);
        openSockets.push(ws);

        expect(ws.readyState).toBe(WebSocket.OPEN);
      });
    });

    test('receives connected confirmation', async () => {
      await integrationLock.runExclusive(async () => {
        const ws = await connectWebSocket(readKey);
        openSockets.push(ws);

        const connected = await waitForConnected(ws, 5000);
        expect(connected.connectionId).toBeDefined();
        expect(connected.events).toBeInstanceOf(Array);
      });
    });

    test('multiple connections on same key work', async () => {
      await integrationLock.runExclusive(async () => {
        const ws1 = await connectWebSocket(readKey);
        const ws2 = await connectWebSocket(readKey);
        openSockets.push(ws1, ws2);

        expect(ws1.readyState).toBe(WebSocket.OPEN);
        expect(ws2.readyState).toBe(WebSocket.OPEN);
      });
    });
  });

  describe('Event Delivery - file.created', () => {
    test('receives file.created event when file is created', async () => {
      await integrationLock.runExclusive(async () => {
        const testPath = `/__int_ws_create_${Date.now()}.md`;

        const ws = await connectWebSocket(readKey);
        openSockets.push(ws);
        await waitForConnected(ws);

        const eventPromise = waitForEvent(ws, 'file.created', 10000);

        await createFile(writeKey, testPath, '# WebSocket Test\n\nContent');

        const event = await eventPromise;
        expect(event.event).toBe('file.created');
        expect(event.file.path).toBe(testPath);
        expect(event.eventId).toBeDefined();
        expect(event.sequence).toBeGreaterThan(0);

        await deleteFile(writeKey, testPath);
      });
    });

    test('receives file.updated event when file is updated', async () => {
      await integrationLock.runExclusive(async () => {
        const testPath = `/__int_ws_update_${Date.now()}.md`;

        await createFile(writeKey, testPath, '# Initial');

        const ws = await connectWebSocket(readKey);
        openSockets.push(ws);
        await waitForConnected(ws);

        const eventPromise = waitForEvent(ws, 'file.updated', 10000);

        await createFile(writeKey, testPath, '# Updated');

        const event = await eventPromise;
        expect(event.event).toBe('file.updated');
        expect(event.file.path).toBe(testPath);

        await deleteFile(writeKey, testPath);
      });
    });

    test('receives file.deleted event when file is deleted', async () => {
      await integrationLock.runExclusive(async () => {
        const testPath = `/__int_ws_delete_${Date.now()}.md`;

        await createFile(writeKey, testPath, '# To Delete');

        const ws = await connectWebSocket(readKey);
        openSockets.push(ws);
        await waitForConnected(ws);

        const eventPromise = waitForEvent(ws, 'file.deleted', 10000);

        await deleteFile(writeKey, testPath);

        const event = await eventPromise;
        expect(event.event).toBe('file.deleted');
        expect(event.file.path).toBe(testPath);
      });
    });
  });

  describe('Event Delivery - append events', () => {
    test('receives append event when append is created', async () => {
      await integrationLock.runExclusive(async () => {
        const testPath = `/__int_ws_append_${Date.now()}.md`;

        await createFile(writeKey, testPath, '# Append Test');

        const ws = await connectWebSocket(readKey);
        openSockets.push(ws);
        await waitForConnected(ws);

        const eventPromise = waitForEvent(ws, 'append', 10000);

        await appendToFile(appendKey, testPath, {
          content: 'Test append content',
          type: 'comment',
          author: 'integration-test',
        });

        const event = await eventPromise;
        expect(event.event).toBe('append');

        await deleteFile(writeKey, testPath);
      });
    });

    test('receives task.created event for task appends', async () => {
      await integrationLock.runExclusive(async () => {
        const testPath = `/__int_ws_task_${Date.now()}.md`;

        await createFile(writeKey, testPath, '# Task Test');

        const ws = await connectWebSocket(appendKey, { keyType: 'a' });
        openSockets.push(ws);
        await waitForConnected(ws);

        const eventPromise = waitForEvent(ws, 'task.created', 10000);

        await appendToFile(appendKey, testPath, {
          content: 'Test task',
          type: 'task',
          author: 'integration-test',
        });

        const event = await eventPromise;
        expect(event.event).toBe('task.created');

        await deleteFile(writeKey, testPath);
      });
    });
  });
});

