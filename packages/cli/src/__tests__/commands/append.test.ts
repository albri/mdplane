import { describe, test, expect, vi } from 'bun:test';
import { ApiClient } from '../../api.js';

describe('append command', () => {
  describe('ApiClient.append', () => {
    test('should send correct request for comment append', async () => {
      let capturedUrl = '';
      let capturedOptions: RequestInit | undefined;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        capturedUrl = _url;
        capturedOptions = options;
        return Response.json({
          ok: true,
          data: {
            id: 'a1',
            author: 'test-agent',
            ts: '2024-01-15T10:00:00Z',
            type: 'comment',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.append('appendKey123', {
        content: 'Test comment',
        type: 'comment',
        author: 'test-agent',
      });

      expect(capturedUrl).toBe('https://api.mdplane.dev/a/appendKey123/append');
      expect(capturedOptions?.method).toBe('POST');
      const body = JSON.parse(capturedOptions?.body as string) as { content: string; type: string; author: string };
      expect(body.content).toBe('Test comment');
      expect(body.type).toBe('comment');
      expect(body.author).toBe('test-agent');
      expect(result.id).toBe('a1');
      expect(result.type).toBe('comment');
    });

    test('should send correct request for task append', async () => {
      let capturedBody: Record<string, unknown> | undefined;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        capturedBody = JSON.parse(options.body as string) as Record<string, unknown>;
        return Response.json({
          ok: true,
          data: {
            id: 'a2',
            author: 'agent',
            ts: '2024-01-15T10:00:00Z',
            type: 'task',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      await client.append('appendKey123', {
        content: 'Implement feature X',
        type: 'task',
        author: 'agent',
      });

      expect(capturedBody?.type).toBe('task');
      expect(capturedBody?.content).toBe('Implement feature X');
    });

    test('should send scoped append request when path is provided', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: {
            id: 'a-path',
            author: 'agent',
            ts: '2024-01-15T10:00:00Z',
            type: 'task',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      await client.append('appendKey123', {
        path: '/tasks.md',
        content: 'Scoped task',
        type: 'task',
        author: 'agent',
      });

      expect(capturedUrl).toBe('https://api.mdplane.dev/a/appendKey123/tasks.md');
    });

    test('should include ref when provided', async () => {
      let capturedBody: Record<string, unknown> | undefined;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        capturedBody = JSON.parse(options.body as string) as Record<string, unknown>;
        return Response.json({
          ok: true,
          data: {
            id: 'a3',
            author: 'agent',
            ts: '2024-01-15T10:00:00Z',
            type: 'response',
            ref: 'a1',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.append('appendKey123', {
        content: 'Done!',
        type: 'response',
        author: 'agent',
        ref: 'a1',
      });

      expect(capturedBody?.ref).toBe('a1');
      expect(capturedBody?.type).toBe('response');
      expect(result.ref).toBe('a1');
    });

    test('should default to comment type when not specified', async () => {
      let capturedBody: Record<string, unknown> | undefined;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        capturedBody = JSON.parse(options.body as string) as Record<string, unknown>;
        return Response.json({
          ok: true,
          data: {
            id: 'a4',
            author: 'cli',
            ts: '2024-01-15T10:00:00Z',
            type: 'comment',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      await client.append('appendKey123', {
        content: 'Just a note',
      });

      expect(capturedBody?.type).toBe('comment');
      expect(capturedBody?.author).toBe('cli');
    });

    test('should handle claim type with expiresAt in response', async () => {
      global.fetch = vi.fn(() => {
        return Response.json({
          ok: true,
          data: {
            id: 'a5',
            author: 'agent',
            ts: '2024-01-15T10:00:00Z',
            type: 'claim',
            ref: 'a1',
            expiresAt: '2024-01-15T10:30:00Z',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
      const result = await client.append('appendKey123', {
        content: 'Working on this',
        type: 'claim',
        author: 'agent',
        ref: 'a1',
      });

      expect(result.type).toBe('claim');
    });

    test('should handle all append types', async () => {
      const { USER_APPEND_TYPES } = await import('@mdplane/shared');

      for (const type of USER_APPEND_TYPES) {
        global.fetch = vi.fn((_url: string, options: RequestInit) => {
          const body = JSON.parse(options.body as string) as { type: string };
          expect(body.type).toBe(type);
          return Response.json({
            ok: true,
            data: {
              id: `a${String(USER_APPEND_TYPES.indexOf(type))}`,
              author: 'agent',
              ts: '2024-01-15T10:00:00Z',
              type,
            },
          });
        }) as unknown as typeof fetch;

        const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });
        const result = await client.append('appendKey123', {
          content: `Test ${type}`,
          type,
          author: 'agent',
        });

        expect(result.type).toBe(type);
      }
    });

    test('should throw error on API failure', async () => {
      global.fetch = vi.fn(() => {
        return Response.json(
          {
            ok: false,
            error: {
              code: 'INVALID_APPEND_TYPE',
              message: 'Invalid append type',
            },
          },
          { status: 400 }
        );
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });

      let threw = false;
      try {
        await client.append('appendKey123', {
          content: 'Test',
          type: 'comment',
          author: 'agent',
        });
      } catch (err) {
        threw = true;
        expect((err as Error).message).toContain('Invalid append type');
      }
      expect(threw).toBe(true);
    });

    test('should throw error on 404 (file not found)', async () => {
      global.fetch = vi.fn(() => {
        return Response.json(
          {
            ok: false,
            error: {
              code: 'FILE_NOT_FOUND',
              message: 'File not found',
            },
          },
          { status: 404 }
        );
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });

      let threw = false;
      try {
        await client.append('invalidKey', {
          content: 'Test',
          type: 'comment',
          author: 'agent',
        });
      } catch (err) {
        threw = true;
        expect((err as Error).message).toContain('File not found');
      }
      expect(threw).toBe(true);
    });

    test('should throw error on 409 (already claimed)', async () => {
      global.fetch = vi.fn(() => {
        return Response.json(
          {
            ok: false,
            error: {
              code: 'ALREADY_CLAIMED',
              message: 'Task already has active claim',
            },
          },
          { status: 409 }
        );
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });

      let threw = false;
      try {
        await client.append('appendKey123', {
          content: 'Claiming',
          type: 'claim',
          author: 'agent',
          ref: 'a1',
        });
      } catch (err) {
        threw = true;
        expect((err as Error).message).toContain('already has active claim');
      }
      expect(threw).toBe(true);
    });

    test('should throw error on 429 (rate limited)', async () => {
      global.fetch = vi.fn(() => {
        return Response.json(
          {
            ok: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many requests',
            },
          },
          { status: 429 }
        );
      }) as unknown as typeof fetch;

      const client = new ApiClient({ baseUrl: 'https://api.mdplane.dev' });

      let threw = false;
      try {
        await client.append('appendKey123', {
          content: 'Test',
          type: 'comment',
          author: 'agent',
        });
      } catch (err) {
        threw = true;
        expect((err as Error).message).toContain('Too many requests');
      }
      expect(threw).toBe(true);
    });
  });

  describe('ApiClient.appendToFileByPath', () => {
    test('should send correct request with API key auth', async () => {
      let capturedUrl = '';
      let capturedHeaders: Record<string, string> | undefined;

      global.fetch = vi.fn((_url: string, options: RequestInit) => {
        capturedUrl = _url;
        capturedHeaders = options.headers as Record<string, string>;
        return Response.json({
          ok: true,
          data: {
            id: 'a1',
            author: 'agent',
            ts: '2024-01-15T10:00:00Z',
            type: 'task',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({
        baseUrl: 'https://api.mdplane.dev',
        apiKey: 'sk_test_key',
      });

      await client.appendToFileByPath('tasks.md', {
        content: 'New task',
        type: 'task',
        author: 'agent',
      });

      expect(capturedUrl).toBe('https://api.mdplane.dev/api/v1/files/tasks.md/append');
      expect(capturedHeaders?.Authorization).toBe('Bearer sk_test_key');
    });

    test('should encode path correctly', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn((_url: string) => {
        capturedUrl = _url;
        return Response.json({
          ok: true,
          data: {
            id: 'a1',
            author: 'agent',
            ts: '2024-01-15T10:00:00Z',
            type: 'comment',
          },
        });
      }) as unknown as typeof fetch;

      const client = new ApiClient({
        baseUrl: 'https://api.mdplane.dev',
        apiKey: 'sk_test_key',
      });

      await client.appendToFileByPath('folder/sub folder/file.md', {
        content: 'Test',
        type: 'comment',
        author: 'agent',
      });

      expect(capturedUrl).toContain('folder%2Fsub%20folder%2Ffile.md');
    });
  });
});
