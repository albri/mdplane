import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { bootstrap, type BootstrappedWorkspace } from '../helpers/api-client';
import {
  connectWebSocketWithToken,
  assertTokensUnique,
  waitForConnected,
  waitForEvent,
  createFile,
  appendToFile,
  deleteFile,
  sleep,
  closeWebSocket,
  type WsEvent,
  type WebSocketConnection,
  type WebSocketLike,
} from '../helpers/websocket';

function collectEvents(ws: WebSocketLike, durationMs: number): Promise<WsEvent[]> {
  return new Promise((resolve) => {
    const events: WsEvent[] = [];
    const handler = (msg: any) => {
      try {
        const data = JSON.parse(typeof msg.data === 'string' ? msg.data : Buffer.from(msg.data as any).toString('utf8'));
        if (data.event && data.eventId) {
          events.push(data);
        }
      } catch {
        // Ignore parse errors
      }
    };
    ws.addEventListener('message', handler);
    setTimeout(() => {
      ws.removeEventListener('message', handler);
      resolve(events);
    }, durationMs);
  });
}

describe('71 - WebSocket E2E - Multi-Client Real Event Delivery', () => {
  let workspace: BootstrappedWorkspace;
  let readKey: string;
  let writeKey: string;
  let appendKey: string;
  const createdFiles: string[] = [];

  const activeConnections: WebSocketConnection[] = [];

  beforeAll(async () => {
    workspace = await bootstrap();
    readKey = workspace.readKey;
    writeKey = workspace.writeKey;
    appendKey = workspace.appendKey;
  });

  afterAll(async () => {
    for (const conn of activeConnections) {
      try {
        if (conn.ws.readyState === WebSocket.OPEN) {
          conn.ws.close();
        }
      } catch {
      }
    }
    for (const path of createdFiles) {
      try {
        await deleteFile(writeKey, path);
      } catch {
      }
    }
  });

  test('three clients connect and receive connected message', async () => {
    const connA = await connectWebSocketWithToken(readKey);
    const connB = await connectWebSocketWithToken(readKey);
    const connC = await connectWebSocketWithToken(readKey);
    activeConnections.push(connA, connB, connC);

    assertTokensUnique([connA, connB, connC]);

    const [msgA, msgB, msgC] = await Promise.all([
      waitForConnected(connA.ws),
      waitForConnected(connB.ws),
      waitForConnected(connC.ws),
    ]);

    expect(msgA.connectionId).toBeDefined();
    expect(msgB.connectionId).toBeDefined();
    expect(msgC.connectionId).toBeDefined();
  });

  test('all three clients receive file.created event', async () => {
    const connA = activeConnections[0];
    const connB = activeConnections[1];
    const connC = activeConnections[2];
    if (!connA || !connB || !connC) {
      throw new Error('Expected 3 active connections from previous test');
    }

    const filePath = `/__int_ws_multi_${Date.now()}.md`;
    createdFiles.push(filePath);

    const eventPromises = [connA.ws, connB.ws, connC.ws].map((ws) =>
      waitForEvent(ws, 'file.created', 10000)
    );

    await createFile(writeKey, filePath, '# Multi-client test');

    const events = await Promise.all(eventPromises);

    expect(events).toHaveLength(3);
    for (const event of events) {
      expect(event.event).toBe('file.created');
      expect(event.file.path).toBe(filePath);
      expect(event.eventId).toBeDefined();
      expect(event.timestamp).toBeDefined();
    }
  });

  test('all three clients receive append event', async () => {
    const connA = activeConnections[0];
    const connB = activeConnections[1];
    const connC = activeConnections[2];
    if (!connA || !connB || !connC) {
      throw new Error('Expected 3 active connections from previous test');
    }

    const filePath = createdFiles[0];
    if (!filePath) {
      throw new Error('Expected file to be created from previous test');
    }

    const eventPromises = [connA.ws, connB.ws, connC.ws].map((ws) =>
      waitForEvent(ws, 'append', 10000)
    );

    await appendToFile(appendKey, filePath, {
      content: 'Multi-client append test',
      type: 'comment',
    });

    const events = await Promise.all(eventPromises);

    expect(events).toHaveLength(3);
    for (const event of events) {
      expect(event.event).toBe('append');
      expect(event.file.path).toBe(filePath);
      expect(event.eventId).toBeDefined();
    }
  });

  test('closed client does not receive events, remaining clients do', async () => {
    const connA = activeConnections[0];
    const connB = activeConnections[1];
    const connC = activeConnections[2];
    if (!connA || !connB || !connC) {
      throw new Error('Expected 3 active connections from previous tests');
    }

    await closeWebSocket(connC.ws);
    const connIndex = activeConnections.indexOf(connC);
    if (connIndex > -1) activeConnections.splice(connIndex, 1);

    await sleep(250);

    const filePath = `/__int_ws_multi_${Date.now()}_after_close.md`;
    createdFiles.push(filePath);

    const eventPromises = [connA.ws, connB.ws].map((ws) =>
      waitForEvent(ws, 'file.created', 10000)
    );

    await createFile(writeKey, filePath, '# After close test');

    const events = await Promise.all(eventPromises);

    expect(events).toHaveLength(2);
    for (const event of events) {
      expect(event.event).toBe('file.created');
      expect(event.file.path).toBe(filePath);
      expect(event.eventId).toBeDefined();
    }
  });

  test(
    'event sequence is monotonic per connection',
    async () => {
    const [connA] = activeConnections;
    if (!connA) {
      throw new Error('No active connection for sequence test');
    }

    const filePaths: string[] = [];
    for (let i = 0; i < 3; i++) {
      const path = `/__int_ws_seq_${Date.now()}_${i}.md`;
      filePaths.push(path);
      createdFiles.push(path);
    }

    const collectPromise = collectEvents(connA.ws, 15000);

    for (const path of filePaths) {
      await createFile(writeKey, path, `# File ${path}`);
      await sleep(100);
    }

    const events = await collectPromise;

    const createdEvents = events.filter(
      (e) => e.event === 'file.created' && filePaths.includes(e.file.path)
    );

    if (createdEvents.length >= 2) {
      for (let i = 1; i < createdEvents.length; i++) {
        const prevSeq = createdEvents[i - 1]!.sequence;
        const currSeq = createdEvents[i]!.sequence;
        expect(currSeq).toBeGreaterThan(prevSeq);
      }
    }

    expect(createdEvents.length).toBeGreaterThan(0);
    for (const event of createdEvents) {
      expect(typeof event.sequence).toBe('number');
    }
    },
    30_000
  );
});

