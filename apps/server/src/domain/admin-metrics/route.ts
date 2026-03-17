import { Elysia } from 'elysia';
import { zAdminMetricsResponse, zError } from '@mdplane/shared';
import { handleGetAdminMetrics } from './handlers';

export const adminMetricsRoute = new Elysia({ name: 'admin-metrics' }).get(
  '/api/v1/admin/metrics',
  async ({ request, set }) => {
    const result = await handleGetAdminMetrics(request);
    set.status = result.status;
    if (result.status === 200) {
      return zAdminMetricsResponse.parse(result.body);
    }
    return zError.parse(result.body);
  },
  {
    response: {
      200: zAdminMetricsResponse,
      401: zError,
      403: zError,
      500: zError,
    },
  }
);
