import type { AdminMetricsResponse } from '@mdplane/shared';

export type AdminMetricsErrorBody = {
  ok: false;
  error: {
    code: 'UNAUTHORIZED' | 'FORBIDDEN';
    message: string;
  };
};

export type AdminMetricsSuccessBody = AdminMetricsResponse;
