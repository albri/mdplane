import { Elysia } from 'elysia';
import { zWebhookCreateRequest, zWebhookUpdateRequest } from '@mdplane/shared';
import {
  createFolderWebhook,
  deleteFolderWebhook,
  listFolderWebhooks,
  updateFolderWebhook,
} from './handlers';

export const folderWebhooksRoute = new Elysia()
  .post(
    '/w/:key/folders/:path/webhooks',
    async ({ params, body, set }) => {
      const result = await createFolderWebhook({
        keyString: params.key,
        path: params.path,
        body,
      });
      set.status = result.status;
      return result.body;
    },
    {
      body: zWebhookCreateRequest,
    }
  )
  .get('/w/:key/folders/:path/webhooks', async ({ params, set }) => {
    const result = await listFolderWebhooks({
      keyString: params.key,
      path: params.path,
    });
    set.status = result.status;
    return result.body;
  })
  .delete('/w/:key/folders/:path/webhooks/:webhookId', async ({ params, set }) => {
    const result = await deleteFolderWebhook({
      keyString: params.key,
      path: params.path,
      webhookId: params.webhookId,
    });
    set.status = result.status;
    return result.body;
  })
  .patch(
    '/w/:key/folders/:path/webhooks/:webhookId',
    async ({ params, body, set }) => {
      const result = await updateFolderWebhook({
        keyString: params.key,
        path: params.path,
        webhookId: params.webhookId,
        body,
      });
      set.status = result.status;
      return result.body;
    },
    {
      body: zWebhookUpdateRequest,
    }
  );
