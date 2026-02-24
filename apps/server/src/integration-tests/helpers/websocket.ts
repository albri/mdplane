/**
 * WebSocket Test Helpers
 *
 * Reusable utilities for testing real WebSocket connections.
 */

import { CONFIG } from '../config';
import WebSocket from 'ws';

const API = CONFIG.TEST_API_URL;

function messageDataToString(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  // ws uses Buffer for binary messages
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return Buffer.from(data as any).toString('utf8');
}

/**
 * Compute a hash prefix for logging (first 6 chars of SHA256).
 * Uses Web Crypto API available in Bun.
 */
async function tokenHashPrefix(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 6);
}

export interface WebSocketLike {
  readyState: number;
  close: (code?: number, data?: string) => void;
  // ws (node) supports terminate(); browsers do not.
  terminate?: () => void;
  send: (data: string) => void;
  addEventListener: (type: string, listener: (event: any) => void) => void;
  removeEventListener: (type: string, listener: (event: any) => void) => void;
}

type WsMessageEvent = { data: unknown };

// WebSocket event type
export interface WsEvent {
  eventId: string;
  sequence: number;
  event: string;
  timestamp: string;
  file: { path: string };
  data: Record<string, unknown>;
}

// Subscribe response
export interface SubscribeResponse {
  token: string;
  wsUrl: string;
  events: string[];
  expiresAt: string;
  keyTier: string;
  scope?: string;
}

/**
 * Get a WebSocket subscription token via HTTP.
 */
export async function getSubscribeToken(
  key: string,
  keyType: 'r' | 'a' | 'w' = 'r'
): Promise<SubscribeResponse> {
  const res = await fetch(`${API}/${keyType}/${key}/ops/subscribe`);

  if (!res.ok) {
    throw new Error(`Subscribe failed: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  if (!json.ok || !json.data) {
    throw new Error(`Subscribe response invalid: ${JSON.stringify(json)}`);
  }

  return json.data as SubscribeResponse;
}

/**
 * Validate that returned wsUrl is localhost (for integration tests).
 * Throws an error if there's a mismatch.
 */
function validateWsUrl(wsUrl: string): void {
  const actualUrl = new URL(wsUrl);
  const hostname = actualUrl.hostname;

  // Accept localhost, 127.0.0.1, or [::1] (IPv6 localhost)
  const isLocalhost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.startsWith('127.') ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.');

  if (!isLocalhost) {
    throw new Error(
      `WebSocket host must be localhost for integration tests. Got: ${hostname}. ` +
        `Returned wsUrl: ${wsUrl}.`
    );
  }
}

/**
 * Result of connectWebSocketWithToken - includes token for uniqueness assertion.
 */
export interface WebSocketConnection {
  ws: WebSocketLike;
  token: string;
  tokenHashPrefix: string;
}

/**
 * Connect a WebSocket and return both socket and token info.
 * Use this for multi-client tests that need to assert token uniqueness.
 *
 * IMPORTANT: Buffers messages that arrive before waitForConnected is called
 * to prevent race conditions with concurrent connections.
 */
export async function connectWebSocketWithToken(
  key: string,
  options?: { keyType?: 'r' | 'a' | 'w'; timeout?: number }
): Promise<WebSocketConnection> {
  const { keyType = 'r', timeout = CONFIG.TIMEOUTS.WEBSOCKET } = options || {};

  const subscribe = await getSubscribeToken(key, keyType);

  // Validate wsUrl is localhost for integration tests
  validateWsUrl(subscribe.wsUrl);

  // Log token hash prefix for observability
  const hashPrefix = await tokenHashPrefix(subscribe.token);
  console.log(`[WS TEST] Connecting with token hash=${hashPrefix} keyType=${keyType}`);

  const fullUrl = `${subscribe.wsUrl}?token=${subscribe.token}`;
  const ws = new WebSocket(fullUrl);

  // Buffer messages that arrive before waitForConnected is called
  const messageBuffer: WsMessageEvent[] = [];
  const bufferHandler = (msg: WsMessageEvent) => {
    messageBuffer.push(msg);
  };
  ws.addEventListener('message', bufferHandler);

  // Attach buffer to WebSocket for retrieval by waitForConnected
  (ws as unknown as WebSocketLike & { __messageBuffer?: WsMessageEvent[]; __bufferHandler?: (msg: WsMessageEvent) => void }).__messageBuffer = messageBuffer;
  (ws as unknown as WebSocketLike & { __messageBuffer?: WsMessageEvent[]; __bufferHandler?: (msg: WsMessageEvent) => void }).__bufferHandler = bufferHandler;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`WebSocket connection timeout after ${timeout}ms (token hash=${hashPrefix})`));
    }, timeout);

    ws.onopen = () => {
      clearTimeout(timer);
      console.log(`[WS TEST] WebSocket opened, token hash=${hashPrefix}`);
       resolve({ ws: ws as unknown as WebSocketLike, token: subscribe.token, tokenHashPrefix: hashPrefix });
     };

    ws.onerror = (err: unknown) => {
      clearTimeout(timer);
      reject(new Error(`WebSocket connection error (token hash=${hashPrefix}): ${err}`));
    };
  });
}

/**
 * Connect a WebSocket and wait for it to open.
 * For backward compatibility - use connectWebSocketWithToken for multi-client tests.
 */
export async function connectWebSocket(
  key: string,
  options?: { keyType?: 'r' | 'a' | 'w'; timeout?: number }
): Promise<WebSocketLike> {
  const result = await connectWebSocketWithToken(key, options);
  return result.ws;
}

/**
 * Assert that all tokens in an array are unique.
 * Use this in multi-client tests to verify token uniqueness.
 */
export function assertTokensUnique(connections: WebSocketConnection[]): void {
  const tokens = connections.map(c => c.token);
  const uniqueTokens = new Set(tokens);
  if (uniqueTokens.size !== tokens.length) {
    const hashPrefixes = connections.map(c => c.tokenHashPrefix);
    throw new Error(
      `Token uniqueness violation! Expected ${tokens.length} unique tokens, got ${uniqueTokens.size}. ` +
        `Token hash prefixes: ${hashPrefixes.join(', ')}`
    );
  }
  console.log(`[WS TEST] Token uniqueness verified: ${connections.length} unique tokens`);
}

/**
 * Wait for a specific event type on a WebSocket connection.
 */
export function waitForEvent(
  ws: WebSocketLike,
  eventType: string,
  timeoutMs: number = CONFIG.TIMEOUTS.WEBSOCKET
): Promise<WsEvent> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for ${eventType} event after ${timeoutMs}ms`));
    }, timeoutMs);

    const handler = (msg: WsMessageEvent) => {
      try {
        const data = JSON.parse(messageDataToString(msg.data));
        if (data.event === eventType) {
          clearTimeout(timer);
          ws.removeEventListener('message', handler);
          resolve(data as WsEvent);
        }
      } catch {
        // Ignore parse errors for non-event messages
      }
    };

    ws.addEventListener('message', handler);
  });
}

/**
 * Wait for any event on a WebSocket connection.
 */
export function waitForAnyEvent(
  ws: WebSocketLike,
  timeoutMs: number = CONFIG.TIMEOUTS.WEBSOCKET
): Promise<WsEvent> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for any event after ${timeoutMs}ms`));
    }, timeoutMs);

    const handler = (msg: WsMessageEvent) => {
      try {
        const data = JSON.parse(messageDataToString(msg.data));
        // Only resolve for actual events (not ack, connected, pong messages)
        if (data.event && data.eventId) {
          clearTimeout(timer);
          ws.removeEventListener('message', handler);
          resolve(data as WsEvent);
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.addEventListener('message', handler);
  });
}

/**
 * Wait for connection confirmation message.
 * Checks buffered messages first (for messages that arrived before this was called).
 */
export function waitForConnected(
  ws: WebSocketLike,
  timeoutMs: number = 5000
): Promise<{ connectionId: string; events: string[] }> {
  // Type for extended WebSocket with buffer
  type BufferedWs = WebSocketLike & {
    __messageBuffer?: WsMessageEvent[];
    __bufferHandler?: (msg: WsMessageEvent) => void
  };
  const bufferedWs = ws as BufferedWs;

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = (handler?: (msg: WsMessageEvent) => void, closeHandler?: () => void) => {
      if (handler) ws.removeEventListener('message', handler);
      if (closeHandler) ws.removeEventListener('close', closeHandler);
    };

    // Check buffered messages first (handles race condition)
    if (bufferedWs.__messageBuffer) {
      for (const msg of bufferedWs.__messageBuffer) {
        try {
            const data = JSON.parse(messageDataToString(msg.data));
          if (data.type === 'connected') {
            console.log(`[WS TEST] Message received (buffered): type=${data.type}`);
            // Clean up buffer handler since we found what we need
            if (bufferedWs.__bufferHandler) {
              ws.removeEventListener('message', bufferedWs.__bufferHandler);
            }
            settled = true;
            resolve(data);
            return;
          }
        } catch {
          // Ignore parse errors
        }
      }
      // Remove buffer handler, set up our own
      if (bufferedWs.__bufferHandler) {
        ws.removeEventListener('message', bufferedWs.__bufferHandler);
      }
    }

      const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.log(`[WS TEST] Timeout waiting for connected: readyState=${ws.readyState}`);
      try {
        if (ws.readyState !== 3) {
          ws.close();
        }
      } catch {
        // Ignore close errors
      }
      reject(new Error(`Timeout waiting for connected message after ${timeoutMs}ms`));
    }, timeoutMs);

    const handler = (msg: WsMessageEvent) => {
      try {
        const data = JSON.parse(messageDataToString(msg.data));
        console.log(`[WS TEST] Message received: type=${data.type}`);
        if (data.type === 'connected') {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          cleanup(handler, closeHandler);
          resolve(data);
        }
      } catch (e) {
        console.log(`[WS TEST] Failed to parse message: ${msg.data}`);
      }
    };

    const closeHandler = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup(handler, closeHandler);
      reject(new Error('WebSocket closed before connected message'));
    };

    ws.addEventListener('message', handler);
    ws.addEventListener('close', closeHandler);
  });
}

/**
 * Close a WebSocket and wait for onclose.
 * Used by integration tests to avoid leaking open connections across tests.
 */
export function closeWebSocket(ws: WebSocketLike, timeoutMs: number = 2000): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === 3) {
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.removeEventListener('close', onClose);
      resolve();
    };

    const onClose = () => {
      finish();
    };

    const timer = setTimeout(() => {
      // Best-effort: force close to avoid leaking connections across tests.
      try {
        if (typeof ws.terminate === 'function') {
          ws.terminate();
        } else {
          ws.close(1000, 'INTEGRATION_TEST_CLOSE_TIMEOUT');
        }
      } catch {
        // Ignore termination errors
      }
      finish();
    }, timeoutMs);

    ws.addEventListener('close', onClose);

    try {
      ws.close(1000, 'INTEGRATION_TEST_CLOSE');
    } catch {
      finish();
    }
  });
}

/**
 * Create a file via API (for triggering events).
 */
export async function createFile(
  writeKey: string,
  path: string,
  content: string
): Promise<{ id: string }> {
  const res = await fetch(`${API}/w/${writeKey}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) {
    throw new Error(`Create file failed: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  return { id: json.data?.id };
}

/**
 * Append to a file via API (for triggering events).
 */
export async function appendToFile(
  appendKey: string,
  path: string,
  data: { content: string; type?: string; author?: string }
): Promise<{ id: string }> {
  const res = await fetch(`${API}/a/${appendKey}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: data.type || 'comment',
      content: data.content,
      author: data.author || 'integration-test',
    }),
  });

  if (!res.ok) {
    throw new Error(`Append failed: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  return { id: json.data?.id };
}

/**
 * Delete a file via API (for cleanup).
 */
export async function deleteFile(
  writeKey: string,
  path: string
): Promise<void> {
  await fetch(`${API}/w/${writeKey}${path}`, {
    method: 'DELETE',
  });
}

/**
 * Small delay helper.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
