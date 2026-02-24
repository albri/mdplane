import { beforeAll, beforeEach, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { resetApiKeysTestData } from '../fixtures/api-keys-fixtures';

export const activeOAuthSessions = new Map<string, { id: string; email: string; name: string; sessionToken: string }>();

export const VALID_SESSION_TOKEN = '__test_valid_session_token';
export const OTHER_SESSION_TOKEN = '__test_other_session_token';

export const API_KEY_PATTERN = /^sk_(live|test)_[A-Za-z0-9]{20,}$/;
export const API_KEY_PREFIX_PATTERN = /^sk_(live|test)_[A-Za-z0-9]{4}\.\.\.$/;
export const KEY_ID_PATTERN = /^key_[A-Za-z0-9]+$/;
export const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

export const VALID_WORKSPACE_ID = 'ws_test123456789';
export const NON_EXISTENT_WORKSPACE_ID = 'ws_nonexistent99';
export const OTHER_USER_WORKSPACE_ID = 'ws_otheruser123';
export const VALID_SESSION_COOKIE = `better-auth.session_token=${VALID_SESSION_TOKEN}`;
export const OTHER_USER_SESSION_COOKIE = `better-auth.session_token=${OTHER_SESSION_TOKEN}`;

export const VALID_PERMISSIONS = ['read', 'append', 'write', 'export'];

export type TestApp = {
  handle: (request: Request) => Response | Promise<Response>;
};

export interface ApiKeysTestContext {
  app: TestApp;
}

export function setupAuthMock(): void {
  mock.module('../../../core/auth', () => {
    return {
      auth: {
        api: {
          getSession: async ({ headers }: { headers: Headers }) => {
            const cookieHeader = headers.get('Cookie');
            if (!cookieHeader) return null;

            const cookies = cookieHeader.split(';').map((c: string) => c.trim());
            for (const cookie of cookies) {
              const [name, ...valueParts] = cookie.split('=');
              if (name === 'better-auth.session_token') {
                const token = valueParts.join('=');
                const user = activeOAuthSessions.get(token);
                if (!user) return null;

                const now = Date.now();
                const expiresAt = now + 7 * 24 * 60 * 60 * 1000;

                return {
                  user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    createdAt: new Date('2024-01-01T00:00:00Z'),
                    emailVerified: true,
                    image: null,
                    updatedAt: new Date('2024-01-01T00:00:00Z'),
                  },
                  session: {
                    id: 'mock_session_id',
                    userId: user.id,
                    expiresAt: new Date(expiresAt),
                    token: token,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                };
              }
            }
            return null;
          },
          signOut: async () => {},
        },
        handler: () => new Response('mock auth handler'),
      },
    };
  });
}

export async function setupApiKeysTests(): Promise<ApiKeysTestContext> {
  setupAuthMock();

  const mod = await import('../../../routes/api-keys');
  const app = new Elysia().use(mod.apiKeysRoute);

  activeOAuthSessions.set(VALID_SESSION_TOKEN, {
    id: 'usr_test_user',
    email: 'test@example.com',
    name: 'Test User',
    sessionToken: VALID_SESSION_TOKEN,
  });
  activeOAuthSessions.set(OTHER_SESSION_TOKEN, {
    id: 'usr_other_user',
    email: 'other@example.com',
    name: 'Other User',
    sessionToken: OTHER_SESSION_TOKEN,
  });

  return { app };
}

export function resetTestData(): void {
  resetApiKeysTestData();
}

export { assertValidResponse } from '../../../../tests/helpers/schema-validator';

