import { Elysia } from 'elysia';
import { zFolderSettingsUpdateRequest } from '@mdplane/shared';
import type { FolderSettingsUpdateRequest } from '@mdplane/shared';

type HandlerResult = {
  status: number;
  body: unknown;
};

type FolderSettingsRouteDeps = {
  handleGetFolderSettings: (input: { key: string; folderPathParam: string }) => Promise<HandlerResult>;
  handleUpdateFolderSettings: (input: {
    key: string;
    folderPathParam: string;
    body: FolderSettingsUpdateRequest;
    request: Request;
  }) => Promise<HandlerResult>;
};

export function createFolderSettingsRoute(
  {
    handleGetFolderSettings,
    handleUpdateFolderSettings,
  }: FolderSettingsRouteDeps
) {
  return new Elysia()
    .get('/w/:key/folders/settings', async ({ params, set }) => {
      const key = params.key;
      const result = await handleGetFolderSettings({ key, folderPathParam: '/' });

      set.status = result.status;
      set.headers['Content-Type'] = 'application/json';
      return result.body;
    })
    .get('/w/:key/folders/:path/settings', async ({ params, set }) => {
      const key = params.key;
      const folderPath = decodeURIComponent(params.path || '');
      const result = await handleGetFolderSettings({ key, folderPathParam: folderPath });

      set.status = result.status;
      set.headers['Content-Type'] = 'application/json';
      return result.body;
    })
    .patch('/w/:key/folders/settings', async ({ params, body, set, request }) => {
      const key = params.key;
      const result = await handleUpdateFolderSettings({
        key,
        folderPathParam: '/',
        body,
        request,
      });

      set.status = result.status;
      set.headers['Content-Type'] = 'application/json';
      return result.body;
    }, {
      body: zFolderSettingsUpdateRequest,
    })
    .patch('/w/:key/folders/:path/settings', async ({ params, body, set, request }) => {
      const key = params.key;
      const folderPath = decodeURIComponent(params.path || '');
      const result = await handleUpdateFolderSettings({
        key,
        folderPathParam: folderPath,
        body,
        request,
      });

      set.status = result.status;
      set.headers['Content-Type'] = 'application/json';
      return result.body;
    }, {
      body: zFolderSettingsUpdateRequest,
    });
}
