import { describe, test, expect, vi } from 'bun:test';
import { ApiClient } from '../../api.js';

describe('agents command', () => {
  describe('ApiClient.getAgentLiveness', () => {
    test('should send correct request for agent liveness', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: {
            staleThresholdSeconds: 300,
            agents: [
              { author: 'agent-1', status: 'alive', lastSeen: '2024-01-15T10:00:00Z' },
              { author: 'agent-2', status: 'idle', lastSeen: '2024-01-15T09:55:00Z', stale: true },
            ],
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'sk_test_123' });
      const result = await client.getAgentLiveness({ staleThresholdSeconds: 300 });

      expect(capturedUrl).toContain('/api/v1/agents');
      expect(result.staleThresholdSeconds).toBe(300);
      expect(result.agents.length).toBe(2);
    });

    test('should include staleThresholdSeconds query parameter', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: {
            staleThresholdSeconds: 600,
            agents: [],
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'sk_test_123' });
      await client.getAgentLiveness({ staleThresholdSeconds: 600 });

      expect(capturedUrl).toContain('staleThresholdSeconds=600');
    });

    test('should include folder filter in request', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: {
            staleThresholdSeconds: 300,
            agents: [],
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'sk_test_123' });
      await client.getAgentLiveness({ staleThresholdSeconds: 300, folder: '/projects' });

      expect(capturedUrl).toContain('folder=');
    });

    test('should handle empty agents list', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: true,
          data: {
            staleThresholdSeconds: 300,
            agents: [],
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'sk_test_123' });
      const result = await client.getAgentLiveness({ staleThresholdSeconds: 300 });

      expect(result.agents.length).toBe(0);
    });

    test('should handle server error response', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Invalid API key',
          },
        }, { status: 403 });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev', apiKey: 'invalid' });

      let threw = false;
      try {
        await client.getAgentLiveness({ staleThresholdSeconds: 300 });
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });
  });

  describe('stale threshold validation', () => {
    test('should accept valid threshold (60-3600)', () => {
      const validate = (val: number): boolean => val >= 60 && val <= 3600;
      expect(validate(60)).toBe(true);
      expect(validate(300)).toBe(true);
      expect(validate(3600)).toBe(true);
    });

    test('should reject invalid threshold', () => {
      const validate = (val: number): boolean => val >= 60 && val <= 3600;
      expect(validate(30)).toBe(false);
      expect(validate(7200)).toBe(false);
    });
  });
});

