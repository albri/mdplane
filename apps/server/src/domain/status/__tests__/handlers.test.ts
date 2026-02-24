import { describe, expect, test } from 'bun:test';
import {
  buildDatabaseHealthCheck,
  buildStorageHealthCheck,
  buildWebSocketHealthCheck,
  deriveOverallSystemStatus,
} from '../handlers';

describe('status handlers', () => {
  describe('deriveOverallSystemStatus', () => {
    test('returns major_outage when any component is down', () => {
      expect(deriveOverallSystemStatus(['operational', 'down'])).toBe('major_outage');
    });

    test('returns partial_outage when multiple components are degraded', () => {
      expect(deriveOverallSystemStatus(['degraded', 'degraded'])).toBe('partial_outage');
    });

    test('returns degraded when one component is degraded', () => {
      expect(deriveOverallSystemStatus(['operational', 'degraded'])).toBe('degraded');
    });

    test('returns operational when all components are operational', () => {
      expect(deriveOverallSystemStatus(['operational', 'operational'])).toBe('operational');
    });
  });

  describe('buildDatabaseHealthCheck', () => {
    test('returns down when probe throws', () => {
      const result = buildDatabaseHealthCheck(() => {
        throw new Error('db down');
      });
      expect(result).toEqual({ status: 'down' });
    });

    test('returns operational/degraded with latency when probe succeeds', () => {
      const result = buildDatabaseHealthCheck(() => {});
      expect(['operational', 'degraded']).toContain(result.status);
      expect(typeof result.latencyMs).toBe('number');
    });
  });

  describe('buildStorageHealthCheck', () => {
    test('returns operational for in-memory database', () => {
      const result = buildStorageHealthCheck(':memory:', 1000);
      expect(result).toEqual({ status: 'operational', latencyMs: 0 });
    });

    test('returns degraded when storage usage crosses threshold', () => {
      const result = buildStorageHealthCheck(
        '/tmp/test.sqlite',
        100,
        () => ({ size: 95 })
      );
      expect(result.status).toBe('degraded');
      expect(typeof result.latencyMs).toBe('number');
    });

    test('returns down when storage stats cannot be read', () => {
      const result = buildStorageHealthCheck('/tmp/missing.sqlite', 100, () => {
        throw new Error('missing');
      });
      expect(result).toEqual({ status: 'down' });
    });
  });

  describe('buildWebSocketHealthCheck', () => {
    test('returns down when websocket module is not initialized', () => {
      const result = buildWebSocketHealthCheck(() => false, () => 0);
      expect(result).toEqual({ status: 'down' });
    });

    test('returns down when active connection probe throws', () => {
      const result = buildWebSocketHealthCheck(
        () => true,
        () => {
          throw new Error('probe failed');
        }
      );
      expect(result).toEqual({ status: 'down' });
    });

    test('returns operational/degraded with latency and connection count when initialized', () => {
      const result = buildWebSocketHealthCheck(() => true, () => 3);
      expect(['operational', 'degraded']).toContain(result.status);
      expect(result.activeConnections).toBe(3);
      expect(typeof result.latencyMs).toBe('number');
    });
  });
});
