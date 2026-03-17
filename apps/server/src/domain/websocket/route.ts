import { Elysia } from 'elysia';
import {
  zSubscribeReadKeyResponse,
  zSubscribeAppendKeyResponse,
  zSubscribeWriteKeyResponse,
  zSubscribeFolderEventsQuery,
  zSubscribeFolderEventsViaAppendKeyQuery,
  zSubscribeFolderEventsViaWriteKeyQuery,
  zSubscribeFolderEventsResponse,
  zError,
} from '@mdplane/shared';
import {
  initWebSocketModule,
} from './init';
import {
  handleSubscribe,
  getEventsForTier,
  resetRateLimitState,
  type SubscribeResult,
} from './subscription';
import {
  validateWsToken,
  markTokenUsed,
  tokenHashPrefix,
  type WsTokenPayload,
} from './token';
import { checkKeyNotRevoked } from './key-validation';
import {
  checkConnectionLimits,
  registerConnection,
  unregisterConnection,
  getActiveConnectionCount,
  getConnectionCounts,
  resetConnectionTracking,
} from './connection';
import { clearUsedTokens as resetUsedTokens } from './state';
import { matchesScope, broadcastEvent } from './broadcast';
import { WS_DEBUG } from './constants';

// Re-export for external consumers
export {
  initWebSocketModule,
  getActiveConnectionCount,
  getConnectionCounts,
  resetConnectionTracking,
  resetRateLimitState,
  resetUsedTokens,
  matchesScope,
  broadcastEvent,
};

// Initialize on module load
setTimeout(initWebSocketModule, 0);

function applySubscribeResult(
  result: SubscribeResult,
  set: { status?: number | string; headers: Record<string, unknown> },
) {
  set.status = result.status;
  set.headers['Content-Type'] = 'application/json';
  if (!result.ok && result.retryAfter) {
    set.headers['Retry-After'] = String(result.retryAfter);
  }
  return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error };
}

export const websocketRoute = new Elysia()
  .onError(({ code, set, error }) => {
    if (code === 'VALIDATION') {
      set.status = 400;
      return { ok: false, error: { code: 'INVALID_REQUEST', message: 'Request validation failed' } };
    }
    throw error;
  })

  .get('/r/:key/ops/subscribe', async ({ params, set }) => {
    const result = await handleSubscribe({ keyString: params.key, expectedTier: 'read' });
    return applySubscribeResult(result, set);
  }, { response: { 200: zSubscribeReadKeyResponse, 404: zError, 410: zError, 429: zError } })

  .get('/a/:key/ops/subscribe', async ({ params, set }) => {
    const result = await handleSubscribe({ keyString: params.key, expectedTier: 'append' });
    return applySubscribeResult(result, set);
  }, { response: { 200: zSubscribeAppendKeyResponse, 404: zError, 410: zError, 429: zError } })

  .get('/w/:key/ops/subscribe', async ({ params, set }) => {
    const result = await handleSubscribe({ keyString: params.key, expectedTier: 'write' });
    return applySubscribeResult(result, set);
  }, { response: { 200: zSubscribeWriteKeyResponse, 404: zError, 410: zError, 429: zError } })

  // Folder Subscribe Endpoints
  .get('/r/:key/ops/folders/subscribe', async ({ params, query, set }) => {
    const folderPath = query.path ?? '';
    if (folderPath.includes('..')) {
      set.status = 400;
      return { ok: false, error: { code: 'INVALID_PATH', message: 'Path traversal not allowed' } };
    }
    const scope = folderPath ? `/${folderPath}` : '/';
    const result = await handleSubscribe({ keyString: params.key, expectedTier: 'read', scope });
    return applySubscribeResult(result, set);
  }, { query: zSubscribeFolderEventsQuery, response: { 200: zSubscribeFolderEventsResponse, 404: zError, 410: zError, 429: zError } })

  .get('/a/:key/ops/folders/subscribe', async ({ params, query, set }) => {
    const folderPath = query.path ?? '';
    if (folderPath.includes('..')) {
      set.status = 400;
      return { ok: false, error: { code: 'INVALID_PATH', message: 'Path traversal not allowed' } };
    }
    const scope = folderPath ? `/${folderPath}` : '/';
    const result = await handleSubscribe({ keyString: params.key, expectedTier: 'append', scope });
    return applySubscribeResult(result, set);
  }, { query: zSubscribeFolderEventsViaAppendKeyQuery, response: { 200: zSubscribeFolderEventsResponse, 404: zError, 410: zError, 429: zError } })

  .get('/w/:key/ops/folders/subscribe', async ({ params, query, set }) => {
    const folderPath = query.path ?? '';
    if (folderPath.includes('..')) {
      set.status = 400;
      return { ok: false, error: { code: 'INVALID_PATH', message: 'Path traversal not allowed' } };
    }
    const scope = folderPath ? `/${folderPath}` : '/';
    const result = await handleSubscribe({ keyString: params.key, expectedTier: 'write', scope });
    return applySubscribeResult(result, set);
  }, { query: zSubscribeFolderEventsViaWriteKeyQuery, response: { 200: zSubscribeFolderEventsResponse, 404: zError, 410: zError, 429: zError } })

  // WebSocket Connection Endpoint (HTTP path for tests)
  .onRequest(({ request, set }) => {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      const upgradeHeader = request.headers.get('upgrade');
      const isWebSocketUpgrade = upgradeHeader?.toLowerCase() === 'websocket';

      if (isWebSocketUpgrade) {
        return;
      }

      const token = url.searchParams.get('token');
      if (!token) {
        set.status = 401;
        return { ok: false, error: { code: 'TOKEN_INVALID' } };
      }

      const tokenResult = validateWsToken(token);
      if (!tokenResult.ok) {
        set.status = tokenResult.status;
        return { ok: false, error: tokenResult.error };
      }

      const { workspaceId, keyHash, keyTier } = tokenResult.payload;
      const hashPrefix = tokenHashPrefix(token);

      const keyCheck = checkKeyNotRevoked(keyHash);
      if (!keyCheck.ok) {
        console.log(`[WS] HTTP connection rejected: hash=${hashPrefix} reason=${keyCheck.code}`);
        set.status = keyCheck.status;
        return { ok: false, error: { code: keyCheck.code === 'KEY_NOT_FOUND' ? 'TOKEN_INVALID' : keyCheck.code } };
      }

      const limitCheck = checkConnectionLimits(keyHash, workspaceId);
      if (!limitCheck.allowed) {
        set.status = limitCheck.status;
        return { ok: false, error: { code: limitCheck.code, message: limitCheck.message } };
      }

      markTokenUsed(token);
      registerConnection({ ws: { send: () => {} }, workspaceId, keyHash, keyTier });

      set.status = 200;
      return { ok: true, data: { connected: true } };
    }
  })

  // WebSocket handler (for real WebSocket connections in production)
  .ws('/ws', {
    open(ws) {
      const url = new URL(ws.data.request.url);
      const token = url.searchParams.get('token');
      const hashPrefix = token ? tokenHashPrefix(token) : 'empty';

      if (!token) {
        console.log(`[WS] Connection rejected: hash=${hashPrefix} reason=NO_TOKEN`);
        ws.close(4002, 'Token invalid');
        return;
      }

      const tokenResult = validateWsToken(token);
      if (!tokenResult.ok) {
        const code = tokenResult.error.code === 'TOKEN_EXPIRED' ? 4001 :
                     tokenResult.error.code === 'KEY_REVOKED' ? 4003 : 4002;
        console.log(`[WS] Connection rejected: hash=${hashPrefix} reason=${tokenResult.error.code} closeCode=${code}`);
        ws.close(code, tokenResult.error.code);
        return;
      }

      const { workspaceId, keyHash, keyTier, scope } = tokenResult.payload;

      const keyCheck = checkKeyNotRevoked(keyHash);
      if (!keyCheck.ok) {
        const closeCode = keyCheck.code === 'KEY_REVOKED' ? 4003 : 4002;
        console.log(`[WS] Connection rejected: hash=${hashPrefix} reason=${keyCheck.code}`);
        ws.close(closeCode, keyCheck.code === 'KEY_NOT_FOUND' ? 'TOKEN_INVALID' : keyCheck.code);
        return;
      }

      const limitCheck = checkConnectionLimits(keyHash, workspaceId);
      if (!limitCheck.allowed) {
        const closeCode = limitCheck.code === 'CONNECTION_LIMIT_EXCEEDED' ? 4004 : 4005;
        console.log(`[WS] Connection rejected: hash=${hashPrefix} reason=${limitCheck.code}`);
        ws.close(closeCode, limitCheck.code);
        return;
      }

      markTokenUsed(token);
      const { connectionId, events } = registerConnection({
        ws: ws.raw,
        workspaceId,
        keyHash,
        keyTier,
        scope,
      });

      // Store connection info on the WebSocket for close handler
      (ws as unknown as Record<string, unknown>).connectionId = connectionId;
      (ws as unknown as Record<string, unknown>).tokenPayload = tokenResult.payload;

      if (WS_DEBUG) console.log(`[WS] Connected sent: connId=${connectionId} workspace=${workspaceId} tier=${keyTier} scope=${scope || '/'}`);
      ws.send(JSON.stringify({
        type: 'connected',
        connectionId,
        events,
        scope: scope || '/',
      }));
    },

    message(ws, message) {
      if (typeof message === 'object' && message !== null) {
        const msg = message as Record<string, unknown>;
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }
      }
      ws.send(JSON.stringify({ type: 'ack', received: message }));
    },

    close(ws) {
      const connectionId = (ws as unknown as Record<string, string>).connectionId;
      const payload = (ws as unknown as Record<string, WsTokenPayload>).tokenPayload;

      if (connectionId && payload) {
        unregisterConnection(connectionId, payload.workspaceId, payload.keyHash);
      }
    },
  });
