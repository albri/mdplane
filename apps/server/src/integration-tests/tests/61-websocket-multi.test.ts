/**
 * Multi-Client WebSocket Tests (- )
 *
 * Test multiple clients receiving same events,
 * scope filtering, and disconnect handling.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { bootstrap, type BootstrappedWorkspace } from '../helpers/api-client';
import { integrationLock } from '../helpers/test-lock';
import {
  connectWebSocketWithToken,
  assertTokensUnique,
  waitForConnected,
  waitForEvent,
  createFile,
  deleteFile,
  closeWebSocket,
  sleep,
  type WebSocketConnection,
} from '../helpers/websocket';

describe('61 - Multi-Client WebSocket Tests', () => {
  const openConnections: WebSocketConnection[] = [];

  afterEach(async () => {
    await Promise.all(openConnections.map((conn) => closeWebSocket(conn.ws)));
    openConnections.length = 0;
    // Give the server a beat to process close handlers and decrement counts.
    await sleep(50);
  });

  describe('Multi-Client Event Delivery', () => {
    test('two clients receive same event', async () => {
      await integrationLock.runExclusive(async () => {
        const workspace: BootstrappedWorkspace = await bootstrap();
        const writeKey = workspace.writeKey;
        const readKey = workspace.readKey;

        const testPath = `/__int_ws_multi2_${Date.now()}.md`;

        const conn1 = await connectWebSocketWithToken(readKey);
        const conn2 = await connectWebSocketWithToken(readKey);
        openConnections.push(conn1, conn2);

        assertTokensUnique([conn1, conn2]);

        await Promise.all([waitForConnected(conn1.ws), waitForConnected(conn2.ws)]);

        const promises = [
          waitForEvent(conn1.ws, 'file.created', 10000),
          waitForEvent(conn2.ws, 'file.created', 10000),
        ];

        await createFile(writeKey, testPath, '# Multi Test');

        const events = await Promise.all(promises);
        expect(events).toHaveLength(2);
        events.forEach((e) => {
          expect(e.event).toBe('file.created');
          expect(e.file.path).toBe(testPath);
        });

        await deleteFile(writeKey, testPath);
      });
    });

    test('three clients receive same event', async () => {
      await integrationLock.runExclusive(async () => {
        const workspace: BootstrappedWorkspace = await bootstrap();
        const writeKey = workspace.writeKey;
        const readKey = workspace.readKey;

        const testPath = `/__int_ws_multi3_${Date.now()}.md`;

        const conn1 = await connectWebSocketWithToken(readKey);
        const conn2 = await connectWebSocketWithToken(readKey);
        const conn3 = await connectWebSocketWithToken(readKey);
        openConnections.push(conn1, conn2, conn3);

        assertTokensUnique([conn1, conn2, conn3]);

        await Promise.all([
          waitForConnected(conn1.ws),
          waitForConnected(conn2.ws),
          waitForConnected(conn3.ws),
        ]);

        const promises = [
          waitForEvent(conn1.ws, 'file.created', 10000),
          waitForEvent(conn2.ws, 'file.created', 10000),
          waitForEvent(conn3.ws, 'file.created', 10000),
        ];

        await createFile(writeKey, testPath, '# Multi 3 Test');

        const events = await Promise.all(promises);
        expect(events).toHaveLength(3);
        events.forEach((e) => {
          expect(e.file.path).toBe(testPath);
        });

        await deleteFile(writeKey, testPath);
      });
    });

    test('events have unique eventIds across clients', async () => {
      await integrationLock.runExclusive(async () => {
        const workspace: BootstrappedWorkspace = await bootstrap();
        const writeKey = workspace.writeKey;
        const readKey = workspace.readKey;

        const testPath = `/__int_ws_ids_${Date.now()}.md`;

        const conn1 = await connectWebSocketWithToken(readKey);
        const conn2 = await connectWebSocketWithToken(readKey);
        openConnections.push(conn1, conn2);

        assertTokensUnique([conn1, conn2]);

        await Promise.all([waitForConnected(conn1.ws), waitForConnected(conn2.ws)]);

        const promises = [
          waitForEvent(conn1.ws, 'file.created', 10000),
          waitForEvent(conn2.ws, 'file.created', 10000),
        ];

        await createFile(writeKey, testPath, '# ID Test');

        const events = await Promise.all(promises);

        expect(events[0].eventId).toBeDefined();
        expect(events[1].eventId).toBeDefined();

        await deleteFile(writeKey, testPath);
      });
    });
  });

  describe('Disconnect Handling', () => {
    test('disconnected client stops receiving events', async () => {
      await integrationLock.runExclusive(async () => {
        const workspace: BootstrappedWorkspace = await bootstrap();
        const writeKey = workspace.writeKey;
        const readKey = workspace.readKey;

        const testPath1 = `/__int_ws_disc1_${Date.now()}.md`;
        const testPath2 = `/__int_ws_disc2_${Date.now()}.md`;

        const conn1 = await connectWebSocketWithToken(readKey);
        const conn2 = await connectWebSocketWithToken(readKey);
        openConnections.push(conn1, conn2);

        assertTokensUnique([conn1, conn2]);

        await Promise.all([waitForConnected(conn1.ws), waitForConnected(conn2.ws)]);

        const promises = [
          waitForEvent(conn1.ws, 'file.created', 10000),
          waitForEvent(conn2.ws, 'file.created', 10000),
        ];

        await createFile(writeKey, testPath1, '# Test 1');
        await Promise.all(promises);

        await closeWebSocket(conn1.ws);

        const conn2Promise = waitForEvent(conn2.ws, 'file.created', 10000);

        await createFile(writeKey, testPath2, '# Test 2');

        const event = await conn2Promise;
        expect(event.file.path).toBe(testPath2);

        await deleteFile(writeKey, testPath1);
        await deleteFile(writeKey, testPath2);
      });
    });

    test('remaining clients unaffected by disconnect', async () => {
      await integrationLock.runExclusive(async () => {
        const workspace: BootstrappedWorkspace = await bootstrap();
        const writeKey = workspace.writeKey;
        const readKey = workspace.readKey;

        const testPath = `/__int_ws_remain_${Date.now()}.md`;

        const conn1 = await connectWebSocketWithToken(readKey, { keyType: 'r' });
        const conn2 = await connectWebSocketWithToken(readKey, { keyType: 'r' });
        const conn3 = await connectWebSocketWithToken(readKey, { keyType: 'r' });
        openConnections.push(conn1, conn2, conn3);

        assertTokensUnique([conn1, conn2, conn3]);

        await Promise.all([
          waitForConnected(conn1.ws),
          waitForConnected(conn2.ws),
          waitForConnected(conn3.ws),
        ]);

        await closeWebSocket(conn2.ws);

        const promises = [
          waitForEvent(conn1.ws, 'file.created', 10000),
          waitForEvent(conn3.ws, 'file.created', 10000),
        ];

        await createFile(writeKey, testPath, '# Remaining Test');

        const events = await Promise.all(promises);
        expect(events).toHaveLength(2);

        await deleteFile(writeKey, testPath);
      });
    });
  });
});

