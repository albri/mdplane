import type { ExtractData, StatusResponse } from '@mdplane/shared';

export type StatusData = ExtractData<StatusResponse>;
export type SystemStatus = StatusData['status'];
export type ComponentStatus = StatusData['database']['status'];
export type RegionStatus = StatusData['regions'][number];
export type WebSocketStatus = StatusData['websocket'];
export type StatusResponseBody = StatusResponse;
