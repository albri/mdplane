import { Elysia } from 'elysia';
import { zGetServiceStatusResponse } from '@mdplane/shared';
import { buildStatusResponse } from './handlers';
import type { ComponentStatus, RegionStatus, StatusData, SystemStatus, WebSocketStatus } from './types';

export type { SystemStatus, ComponentStatus, RegionStatus, WebSocketStatus, StatusData };

export const statusRoute = new Elysia({ name: 'status' })
  .get('/api/v1/status', () => buildStatusResponse(), {
    response: {
      200: zGetServiceStatusResponse,
    },
  });
