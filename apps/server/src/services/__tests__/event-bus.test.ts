import { describe, test, expect, beforeEach } from 'bun:test';
import {
  emit,
  subscribe,
  subscribeAll,
  getListenerCounts,
  clearAllListeners,
  type BusEvent,
} from '../event-bus';

describe('EventBus', () => {
  beforeEach(() => {
    clearAllListeners();
  });

  describe('emit', () => {
    test('delivers event to workspace subscriber', () => {
      const received: BusEvent[] = [];
      subscribe('ws_123', (event) => received.push(event));

      emit({
        type: 'file.created',
        workspaceId: 'ws_123',
        filePath: '/test.md',
        data: { content: 'hello' },
        timestamp: new Date().toISOString(),
      });

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe('file.created');
      expect(received[0].filePath).toBe('/test.md');
    });

    test('does not deliver event to different workspace subscriber', () => {
      const received: BusEvent[] = [];
      subscribe('ws_other', (event) => received.push(event));

      emit({
        type: 'file.created',
        workspaceId: 'ws_123',
        filePath: '/test.md',
        data: {},
        timestamp: new Date().toISOString(),
      });

      expect(received).toHaveLength(0);
    });

    test('delivers event to global subscriber', () => {
      const received: BusEvent[] = [];
      subscribeAll((event) => received.push(event));

      emit({
        type: 'file.created',
        workspaceId: 'ws_123',
        filePath: '/test.md',
        data: {},
        timestamp: new Date().toISOString(),
      });

      expect(received).toHaveLength(1);
    });

    test('delivers to both workspace and global subscribers', () => {
      const wsReceived: BusEvent[] = [];
      const globalReceived: BusEvent[] = [];

      subscribe('ws_123', (event) => wsReceived.push(event));
      subscribeAll((event) => globalReceived.push(event));

      emit({
        type: 'file.created',
        workspaceId: 'ws_123',
        filePath: '/test.md',
        data: {},
        timestamp: new Date().toISOString(),
      });

      expect(wsReceived).toHaveLength(1);
      expect(globalReceived).toHaveLength(1);
    });

    test('handles listener errors gracefully', () => {
      const received: BusEvent[] = [];

      subscribe('ws_123', () => {
        throw new Error('Listener error');
      });
      subscribe('ws_123', (event) => received.push(event));

      // Should not throw, second listener should still receive
      emit({
        type: 'file.created',
        workspaceId: 'ws_123',
        filePath: '/test.md',
        data: {},
        timestamp: new Date().toISOString(),
      });

      expect(received).toHaveLength(1);
    });
  });

  describe('subscribe', () => {
    test('returns unsubscribe function', () => {
      const received: BusEvent[] = [];
      const unsubscribe = subscribe('ws_123', (event) => received.push(event));

      emit({
        type: 'file.created',
        workspaceId: 'ws_123',
        filePath: '/test1.md',
        data: {},
        timestamp: new Date().toISOString(),
      });

      unsubscribe();

      emit({
        type: 'file.created',
        workspaceId: 'ws_123',
        filePath: '/test2.md',
        data: {},
        timestamp: new Date().toISOString(),
      });

      expect(received).toHaveLength(1);
      expect(received[0].filePath).toBe('/test1.md');
    });
  });

  describe('subscribeAll', () => {
    test('receives events from all workspaces', () => {
      const received: BusEvent[] = [];
      subscribeAll((event) => received.push(event));

      emit({
        type: 'file.created',
        workspaceId: 'ws_1',
        filePath: '/a.md',
        data: {},
        timestamp: new Date().toISOString(),
      });

      emit({
        type: 'file.created',
        workspaceId: 'ws_2',
        filePath: '/b.md',
        data: {},
        timestamp: new Date().toISOString(),
      });

      expect(received).toHaveLength(2);
    });

    test('returns unsubscribe function', () => {
      const received: BusEvent[] = [];
      const unsubscribe = subscribeAll((event) => received.push(event));

      emit({ type: 'file.created', workspaceId: 'ws_1', filePath: '/a.md', data: {}, timestamp: '' });
      unsubscribe();
      emit({ type: 'file.created', workspaceId: 'ws_1', filePath: '/b.md', data: {}, timestamp: '' });

      expect(received).toHaveLength(1);
    });
  });

  describe('getListenerCounts', () => {
    test('returns correct counts', () => {
      expect(getListenerCounts()).toEqual({ workspaces: 0, global: 0 });

      subscribe('ws_1', () => {});
      subscribe('ws_1', () => {});
      subscribe('ws_2', () => {});
      subscribeAll(() => {});

      expect(getListenerCounts()).toEqual({ workspaces: 2, global: 1 });
    });
  });
});

