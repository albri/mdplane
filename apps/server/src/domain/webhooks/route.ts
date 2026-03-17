import { Elysia } from 'elysia';
import {
  zWebhookCreateRequest,
  zWebhookTestRequest,
  zWebhookUpdateRequest,
  zWebhookUpdateResponse,
  zWebhookCreateResponse,
  zListWebhooksResponse,
  zWebhookDeleteResponse,
  zWebhookTestResponse,
  zGetWebhookLogsResponse,
  zGetWebhookLogsQuery,
  zError,
} from '@mdplane/shared';
import {
  validateAdminKey,
  invalidCapabilityKeyResponse,
} from './validation';
import {
  handleCreateWebhook,
  handleListWebhooks,
  handleDeleteWebhook,
  handleUpdateWebhook,
  handleTestWebhook,
  handleGetLogs,
} from './handlers';
import { validateSessionForWorkspace } from './auth';
import { serverEnv } from '../../config/env';

import { isUrlBlocked as _isUrlBlocked, ssrfConfig as _ssrfConfig } from '../../core/ssrf';
export const ssrfConfig = _ssrfConfig;
export const isUrlBlocked = _isUrlBlocked;

const APP_URL = serverEnv.appUrl;

export const webhooksRoute = new Elysia()
  .onError(({ error, set, code }) => {
    if (code === 'VALIDATION') {
      set.status = 400;
      return { ok: false, error: { code: 'INVALID_REQUEST', message: 'Request validation failed' } };
    }
    if (code === 'PARSE') {
      set.status = 400;
      return { ok: false, error: { code: 'INVALID_REQUEST', message: 'Invalid JSON in request body' } };
    }
    throw error;
  })

  .post('/w/:key/webhooks', async ({ params, body, set }) => {
    const keyValidation = await validateAdminKey(params.key);
    if (!keyValidation.valid) {
      set.status = 404;
      return invalidCapabilityKeyResponse();
    }

    const result = await handleCreateWebhook({
      workspaceId: keyValidation.workspaceId!,
      url: body.url,
      events: body.events,
      secret: body.secret,
    }, { actorType: 'capability_url' });

    if (!result.ok) {
      set.status = result.status;
      return { ok: false, error: result.error };
    }
    set.status = 201;
    return { ok: true, data: result.data };
  }, {
    body: zWebhookCreateRequest,
    response: { 201: zWebhookCreateResponse, 400: zError, 404: zError },
  })

  .get('/w/:key/webhooks', async ({ params, set }) => {
    const keyValidation = await validateAdminKey(params.key);
    if (!keyValidation.valid) {
      set.status = 404;
      return invalidCapabilityKeyResponse();
    }

    const result = await handleListWebhooks(keyValidation.workspaceId!);
    if (!result.ok) {
      set.status = result.status;
      return { ok: false as const, error: result.error };
    }
    return { ok: true as const, data: result.data, webUrl: `${APP_URL}/control/${keyValidation.workspaceId!}/webhooks` };
  }, {
    response: { 200: zListWebhooksResponse, 404: zError },
  })

  .delete('/w/:key/webhooks/:webhookId', async ({ params, set }) => {
    const keyValidation = await validateAdminKey(params.key);
    if (!keyValidation.valid) {
      set.status = 404;
      return invalidCapabilityKeyResponse();
    }

    const result = await handleDeleteWebhook({
      webhookId: params.webhookId,
      workspaceId: keyValidation.workspaceId!,
    }, { actorType: 'capability_url' });

    if (!result.ok) {
      set.status = result.status;
      return { ok: false, error: result.error };
    }
    return { ok: true, data: result.data };
  }, {
    response: { 200: zWebhookDeleteResponse, 404: zError },
  })

  .patch('/w/:key/webhooks/:webhookId', async ({ params, body, set }) => {
    const keyValidation = await validateAdminKey(params.key);
    if (!keyValidation.valid) {
      set.status = 404;
      return invalidCapabilityKeyResponse();
    }

    const result = await handleUpdateWebhook({
      webhookId: params.webhookId,
      workspaceId: keyValidation.workspaceId!,
      url: body.url,
      events: body.events,
      active: body.active,
      secret: body.secret,
    }, { actorType: 'capability_url' });

    if (!result.ok) {
      set.status = result.status;
      return { ok: false, error: result.error };
    }
    return { ok: true, data: result.data };
  }, {
    body: zWebhookUpdateRequest,
  })

  .post('/w/:key/webhooks/:webhookId/test', async ({ params, body, set }) => {
    const keyValidation = await validateAdminKey(params.key);
    if (!keyValidation.valid) {
      set.status = 404;
      return invalidCapabilityKeyResponse();
    }

    const result = await handleTestWebhook({
      webhookId: params.webhookId,
      workspaceId: keyValidation.workspaceId!,
      event: body?.event,
    });

    if (!result.ok) {
      set.status = result.status;
      return { ok: false, error: result.error };
    }
    return { ok: true, data: result.data };
  }, {
    body: zWebhookTestRequest.optional(),
    response: { 200: zWebhookTestResponse, 404: zError },
  })

  .get('/w/:key/webhooks/:webhookId/logs', async ({ params, query, set }) => {
    const keyValidation = await validateAdminKey(params.key);
    if (!keyValidation.valid) {
      set.status = 404;
      return invalidCapabilityKeyResponse();
    }

    const result = await handleGetLogs({
      webhookId: params.webhookId,
      workspaceId: keyValidation.workspaceId!,
      limit: query.limit,
      since: query.since,
    });

    if (!result.ok) {
      set.status = result.status;
      return { ok: false, error: result.error };
    }
    return { ok: true, data: result.data };
  }, {
    query: zGetWebhookLogsQuery,
    response: { 200: zGetWebhookLogsResponse, 404: zError },
  })

  .get('/workspaces/:workspaceId/webhooks', async ({ params, request, set }) => {
    const authResult = await validateSessionForWorkspace({
      request,
      workspaceId: params.workspaceId,
    });
    if (!authResult.ok) {
      set.status = authResult.status;
      return { ok: false as const, error: authResult.error };
    }

    const result = await handleListWebhooks(params.workspaceId);
    if (!result.ok) {
      set.status = result.status;
      return { ok: false as const, error: result.error };
    }

    return { ok: true as const, data: result.data, webUrl: `${APP_URL}/control/${params.workspaceId}/webhooks` };
  }, {
    response: { 200: zListWebhooksResponse, 401: zError, 404: zError },
  })

  .post('/workspaces/:workspaceId/webhooks', async ({ params, request, body, set }) => {
    const authResult = await validateSessionForWorkspace({
      request,
      workspaceId: params.workspaceId,
    });
    if (!authResult.ok) {
      set.status = authResult.status;
      return { ok: false as const, error: authResult.error };
    }

    const result = await handleCreateWebhook({
      workspaceId: params.workspaceId,
      url: body.url,
      events: body.events,
      secret: body.secret,
    }, { actorType: 'session', actor: authResult.userId });
    if (!result.ok) {
      set.status = result.status;
      return { ok: false as const, error: result.error };
    }

    set.status = 201;
    return { ok: true as const, data: result.data };
  }, {
    body: zWebhookCreateRequest,
    response: { 201: zWebhookCreateResponse, 400: zError, 401: zError, 404: zError },
  })

  .patch('/workspaces/:workspaceId/webhooks/:webhookId', async ({ params, request, body, set }) => {
    const authResult = await validateSessionForWorkspace({
      request,
      workspaceId: params.workspaceId,
    });
    if (!authResult.ok) {
      set.status = authResult.status;
      return { ok: false as const, error: authResult.error };
    }

    const result = await handleUpdateWebhook({
      webhookId: params.webhookId,
      workspaceId: params.workspaceId,
      url: body.url,
      events: body.events,
      active: body.active,
      secret: body.secret,
    }, { actorType: 'session', actor: authResult.userId });
    if (!result.ok) {
      set.status = result.status;
      return { ok: false as const, error: result.error };
    }

    return { ok: true as const, data: result.data };
  }, {
    body: zWebhookUpdateRequest,
    response: { 200: zWebhookUpdateResponse, 400: zError, 401: zError, 404: zError },
  })

  .delete('/workspaces/:workspaceId/webhooks/:webhookId', async ({ params, request, set }) => {
    const authResult = await validateSessionForWorkspace({
      request,
      workspaceId: params.workspaceId,
    });
    if (!authResult.ok) {
      set.status = authResult.status;
      return { ok: false as const, error: authResult.error };
    }

    const result = await handleDeleteWebhook({
      webhookId: params.webhookId,
      workspaceId: params.workspaceId,
    }, { actorType: 'session', actor: authResult.userId });
    if (!result.ok) {
      set.status = result.status;
      return { ok: false as const, error: result.error };
    }

    return { ok: true as const, data: result.data };
  }, {
    response: { 200: zWebhookDeleteResponse, 401: zError, 404: zError },
  })

  .post('/workspaces/:workspaceId/webhooks/:webhookId/test', async ({ params, request, body, set }) => {
    const authResult = await validateSessionForWorkspace({
      request,
      workspaceId: params.workspaceId,
    });
    if (!authResult.ok) {
      set.status = authResult.status;
      return { ok: false as const, error: authResult.error };
    }

    const result = await handleTestWebhook({
      webhookId: params.webhookId,
      workspaceId: params.workspaceId,
      event: body?.event,
    });
    if (!result.ok) {
      set.status = result.status;
      return { ok: false as const, error: result.error };
    }

    return { ok: true as const, data: result.data };
  }, {
    body: zWebhookTestRequest.optional(),
    response: { 200: zWebhookTestResponse, 401: zError, 404: zError },
  });

