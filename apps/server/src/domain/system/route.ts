import { Elysia } from 'elysia';
import { zGetChangelogResponse, zGetApiDocsResponse } from '@mdplane/shared';
import { CHANGELOG, getOpenApiSpec, SWAGGER_UI_HTML } from './handlers';

export const systemRoute = new Elysia({ name: 'system' })
  .get('/api/v1/changelog', () => ({
    ok: true as const,
    data: CHANGELOG,
  }), {
    response: {
      200: zGetChangelogResponse,
    },
  })
  .get('/openapi.json', () => {
    const spec = getOpenApiSpec();
    if (!spec) {
      return { error: 'OpenAPI spec not found' };
    }
    return spec;
  })
  .get('/docs', ({ set }) => {
    set.headers['content-type'] = 'text/html; charset=utf-8';
    return SWAGGER_UI_HTML;
  }, {
    response: {
      200: zGetApiDocsResponse,
    },
  });
