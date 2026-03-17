import { Elysia } from 'elysia';
import {
  zError,
  zFileMetaResponse,
  zFileSectionResponse,
  zFileStructureResponse,
  zFileTailResponse,
  zReadFileTailQuery,
} from '@mdplane/shared';
import { hasRawPathTraversal, pathTraversalErrorResponse } from '../../shared';
import type { ElysiaContextSet } from '../../shared/types';
import {
  handleReadMeta,
  handleReadRaw,
  handleReadSection,
  handleReadStructure,
  handleReadTail,
} from './handlers';
import type {
  ReadMetaResult,
  ReadRawResult,
  ReadSectionResult,
  ReadStructureResult,
  ReadTailResult,
} from './types';

function applyHeaders(set: ElysiaContextSet, headers?: Record<string, string>) {
  if (!headers) {
    return;
  }
  for (const [name, value] of Object.entries(headers)) {
    set.headers[name] = value;
  }
}

function applyJsonResult<T>(
  set: ElysiaContextSet,
  result: { status: number; headers?: Record<string, string>; body: unknown },
  parseSuccess: (value: unknown) => T
): T {
  set.status = result.status;
  applyHeaders(set, result.headers);
  if (result.status === 200) {
    return parseSuccess(result.body);
  }
  return zError.parse(result.body) as T;
}

function applyRawResult(set: ElysiaContextSet, result: ReadRawResult) {
  set.status = result.status;
  applyHeaders(set, result.headers);
  if (result.status === 200) {
    return result.body;
  }
  return zError.parse(result.body);
}

export const filesReadRoute = new Elysia()
  .get('/r/:key/section/:heading', async ({ params, set }) => {
    const result: ReadSectionResult = await handleReadSection({
      key: params.key,
      encodedHeading: params.heading,
    });
    return applyJsonResult(set, result, (value) => zFileSectionResponse.parse(value));
  }, {
    response: {
      200: zFileSectionResponse,
      400: zError,
      404: zError,
      410: zError,
    },
  })
  .get('/r/:key/meta', async ({ params, set, request }) => {
    if (hasRawPathTraversal(request.url)) {
      set.status = 400;
      return pathTraversalErrorResponse();
    }

    const result: ReadMetaResult = await handleReadMeta({ key: params.key });
    return applyJsonResult(set, result, (value) => zFileMetaResponse.parse(value));
  }, {
    response: {
      200: zFileMetaResponse,
      400: zError,
      404: zError,
      410: zError,
    },
  })
  .get('/r/:key/raw', async ({ params, set, request }) => {
    if (hasRawPathTraversal(request.url)) {
      set.status = 400;
      return pathTraversalErrorResponse();
    }

    const result: ReadRawResult = await handleReadRaw({ key: params.key });
    return applyRawResult(set, result);
  }, {
    response: {
      400: zError,
      404: zError,
      410: zError,
    },
  })
  .get('/r/:key/structure', async ({ params, set, request }) => {
    if (hasRawPathTraversal(request.url)) {
      set.status = 400;
      return pathTraversalErrorResponse();
    }

    const result: ReadStructureResult = await handleReadStructure({ key: params.key });
    return applyJsonResult(set, result, (value) => zFileStructureResponse.parse(value));
  }, {
    response: {
      200: zFileStructureResponse,
      400: zError,
      404: zError,
      410: zError,
    },
  })
  .get('/r/:key/tail', async ({ params, query, set, request }) => {
    if (hasRawPathTraversal(request.url)) {
      set.status = 400;
      return pathTraversalErrorResponse();
    }

    const result: ReadTailResult = await handleReadTail({
      key: params.key,
      bytes: query.bytes,
      lines: query.lines,
    });
    return applyJsonResult(set, result, (value) => zFileTailResponse.parse(value));
  }, {
    query: zReadFileTailQuery,
    response: {
      200: zFileTailResponse,
      400: zError,
      404: zError,
      410: zError,
    },
  });
