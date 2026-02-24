import { Elysia } from 'elysia';
import {
  zBulkCreateFilesQuery,
  zBulkCreateFilesResponse,
  zCopyFileToFolderRequest,
  zCreateFileRequest,
  zCreateFileResponse,
  zError,
  zFolderBulkCreateRequest,
  zFolderCreateRequest,
  zFolderCreateResponse,
  zFolderDeleteRequest,
  zFolderDeleteResponse,
  zFolderMoveRequest,
  zFolderMoveResponse,
  zFolderRenameRequest,
} from '@mdplane/shared';
import { applyHandlerResponse } from '../../shared';
import type { FolderMutationsRouteDeps } from './types';

export function createFolderMutationsRoute({
  handleCreateFileInFolder,
  handleCopyFileToFolder,
  handleBulkCreateFiles,
  handleCreateFolder,
  handleRenameFolder,
  handleDeleteFolder,
  handleMoveFolder,
}: FolderMutationsRouteDeps) {
  return new Elysia()
  .post('/a/:key/folders/:path/files', async ({ params, body, set, request }) => {
    const result = await handleCreateFileInFolder({
      key: params.key,
      folderPathParam: decodeURIComponent(params.path || ''),
      body,
      idempotencyKey: request.headers.get('Idempotency-Key'),
      request,
    });
    return applyHandlerResponse(result, set);
  }, {
    body: zCreateFileRequest,
    response: {
      201: zCreateFileResponse,
      400: zError,
      404: zError,
      409: zError,
    },
  })
  .post('/a/:key/folders/files', async ({ params, body, set, request }) => {
    const result = await handleCreateFileInFolder({
      key: params.key,
      folderPathParam: '',
      body,
      idempotencyKey: request.headers.get('Idempotency-Key'),
      request,
    });
    return applyHandlerResponse(result, set);
  }, {
    body: zCreateFileRequest,
    response: {
      201: zCreateFileResponse,
      400: zError,
      404: zError,
      409: zError,
    },
  })
  // Create file in folder - POST /w/:key/folders/:path/files (admin permission)
  .post('/w/:key/folders/:path/files', async ({ params, body, set, request }) => {
    const result = await handleCreateFileInFolder({
      key: params.key,
      folderPathParam: decodeURIComponent(params.path || ''),
      body,
      idempotencyKey: request.headers.get('Idempotency-Key'),
      request,
    });
    return applyHandlerResponse(result, set);
  }, {
    body: zCreateFileRequest,
    response: {
      201: zCreateFileResponse,
      400: zError,
      404: zError,
      409: zError,
    },
  })
  .post('/w/:key/folders/files', async ({ params, body, set, request }) => {
    const result = await handleCreateFileInFolder({
      key: params.key,
      folderPathParam: '',
      body,
      idempotencyKey: request.headers.get('Idempotency-Key'),
      request,
    });
    return applyHandlerResponse(result, set);
  }, {
    body: zCreateFileRequest,
    response: {
      201: zCreateFileResponse,
      400: zError,
      404: zError,
      409: zError,
    },
  })
  // Copy file to folder - POST /a/:key/folders/:path/copy
  .post('/a/:key/folders/:path/copy', async ({ params, body, set, request }) => {
    const result = await handleCopyFileToFolder({
      key: params.key,
      folderPathParam: decodeURIComponent(params.path || ''),
      body,
      request,
    });
    return applyHandlerResponse(result, set);
  }, {
    body: zCopyFileToFolderRequest,
    response: {
      201: zCreateFileResponse,
      400: zError,
      404: zError,
      409: zError,
    },
  })
  .post('/a/:key/folders/copy', async ({ params, body, set, request }) => {
    const result = await handleCopyFileToFolder({
      key: params.key,
      folderPathParam: '',
      body,
      request,
    });
    return applyHandlerResponse(result, set);
  }, {
    body: zCopyFileToFolderRequest,
    response: {
      201: zCreateFileResponse,
      400: zError,
      404: zError,
      409: zError,
    },
  })
  // Bulk create files - POST /a/:key/folders/bulk (root folder)
  .post('/a/:key/folders/bulk', async ({ params, body, set, request, query }) => {
    const result = await handleBulkCreateFiles({
      key: params.key,
      folderPathParam: '',
      body,
      asyncMode: query.async === 'true',
      request,
    });
    return applyHandlerResponse(result, set);
  }, {
    query: zBulkCreateFilesQuery,
    body: zFolderBulkCreateRequest,
    response: {
      201: zBulkCreateFilesResponse,
      202: zBulkCreateFilesResponse,
      400: zError,
      404: zError,
      409: zError,
    },
  })
  // Bulk create files - POST /a/:key/folders/:path/bulk (subfolder)
  .post('/a/:key/folders/:path/bulk', async ({ params, body, set, request, query }) => {
    const result = await handleBulkCreateFiles({
      key: params.key,
      folderPathParam: decodeURIComponent(params.path || ''),
      body,
      asyncMode: query.async === 'true',
      request,
    });
    return applyHandlerResponse(result, set);
  }, {
    query: zBulkCreateFilesQuery,
    body: zFolderBulkCreateRequest,
    response: {
      201: zBulkCreateFilesResponse,
      202: zBulkCreateFilesResponse,
      400: zError,
      404: zError,
      409: zError,
    },
  })
  // Create folder - POST /w/:key/folders
  .post('/w/:key/folders', async ({ params, body, set, request }) => {
    const result = await handleCreateFolder({
      key: params.key,
      body,
      request,
      idempotencyKey: request.headers.get('Idempotency-Key'),
    });
    return applyHandlerResponse(result, set);
  }, {
    body: zFolderCreateRequest,
    response: {
      201: zFolderCreateResponse,
      400: zError,
      404: zError,
      409: zError,
    },
  })
  // Rename folder - PATCH /w/:key/folders/*
  .patch('/w/:key/folders/*', async ({ params, body, set, request }) => {
    const result = await handleRenameFolder({
      key: params.key,
      folderPathParam: (params as Record<string, string>)['*'] || '',
      body,
      request,
      idempotencyKey: request.headers.get('Idempotency-Key'),
    });
    return applyHandlerResponse(result, set);
  }, {
    body: zFolderRenameRequest,
    response: {
      200: zFolderMoveResponse,
      400: zError,
      404: zError,
      409: zError,
    },
  })
  .patch('/w/:key/folders', async ({ params, body, set, request }) => {
    const result = await handleRenameFolder({
      key: params.key,
      folderPathParam: '',
      body,
      request,
      idempotencyKey: request.headers.get('Idempotency-Key'),
    });
    return applyHandlerResponse(result, set);
  }, {
    body: zFolderRenameRequest,
    response: {
      200: zFolderMoveResponse,
      400: zError,
      404: zError,
      409: zError,
    },
  })
  // Delete folder - DELETE /w/:key/folders/*
  .delete('/w/:key/folders/*', async ({ params, body, set, request }) => {
    const result = await handleDeleteFolder({
      key: params.key,
      folderPathParam: (params as Record<string, string>)['*'] || '',
      body,
      request,
      idempotencyKey: request.headers.get('Idempotency-Key'),
    });
    return applyHandlerResponse(result, set);
  }, {
    body: zFolderDeleteRequest.optional(),
    response: {
      200: zFolderDeleteResponse,
      400: zError,
      404: zError,
      409: zError,
    },
  })
  .delete('/w/:key/folders', async ({ params, body, set, request }) => {
    const result = await handleDeleteFolder({
      key: params.key,
      folderPathParam: '',
      body,
      request,
      idempotencyKey: request.headers.get('Idempotency-Key'),
    });
    return applyHandlerResponse(result, set);
  }, {
    body: zFolderDeleteRequest.optional(),
    response: {
      200: zFolderDeleteResponse,
      400: zError,
      404: zError,
      409: zError,
    },
  })
  // Move folder - POST /w/:key/folders/move (root folder)
  .post('/w/:key/folders/move', async ({ params, body, set, request }) => {
    const result = await handleMoveFolder({
      key: params.key,
      sourcePathParam: '',
      body,
      request,
      idempotencyKey: request.headers.get('Idempotency-Key'),
    });
    return applyHandlerResponse(result, set);
  }, {
    body: zFolderMoveRequest,
    response: {
      200: zFolderMoveResponse,
      400: zError,
      404: zError,
      409: zError,
    },
  })
  // Move folder - POST /w/:key/folders/:path/move (subfolder)
  .post('/w/:key/folders/:path/move', async ({ params, body, set, request }) => {
    const result = await handleMoveFolder({
      key: params.key,
      sourcePathParam: decodeURIComponent(params.path || ''),
      body,
      request,
      idempotencyKey: request.headers.get('Idempotency-Key'),
    });
    return applyHandlerResponse(result, set);
  }, {
    body: zFolderMoveRequest,
    response: {
      200: zFolderMoveResponse,
      400: zError,
      404: zError,
      409: zError,
    },
  });
}
