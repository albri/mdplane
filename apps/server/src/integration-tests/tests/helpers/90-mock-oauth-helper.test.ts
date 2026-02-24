import { describe, it, expect, beforeAll } from 'bun:test';
import { db } from '../../../db';
import { authUser, authSession } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import {
  createMockUser,
  createMockSession,
  createUserWithSession,
  getAuthCookie,
  getAuthHeaders,
} from '../../helpers/mock-oauth';
import { apiRequest } from '../../helpers/api-client';

describe('90 - Mock OAuth Helper', () => {
  describe('createMockUser', () => {
    it('should create a user with __int_ prefix', async () => {
      const email = 'test-user-1@example.com';
      const userId = await createMockUser(email);

      expect(userId).toMatch(/^__int_/);

      const users = await db.select().from(authUser).where(eq(authUser.id, userId));
      expect(users).toHaveLength(1);
      expect(users[0].email).toBe(email);
      expect(users[0].name).toBe('Test User');
      expect(users[0].emailVerified).toBe(true);
    });

    it('should validate user exists in DB before returning', async () => {
      const email = 'test-user-2@example.com';
      const userId = await createMockUser(email);

      const users = await db.select().from(authUser).where(eq(authUser.id, userId));
      expect(users).toHaveLength(1);
    });
  });

  describe('createMockSession', () => {
    it('should create a session with __int_ prefix', async () => {
      const email = 'test-user-session@example.com';
      const userId = await createMockUser(email);
      const sessionToken = await createMockSession(userId);

      expect(sessionToken).toMatch(/^__int_/);

      const sessions = await db.select().from(authSession).where(eq(authSession.id, sessionToken));
      expect(sessions).toHaveLength(1);
      expect(sessions[0].userId).toBe(userId);
      expect(sessions[0].token).toBe(sessionToken);
    });

    it('should set expiration to 7 days from now', async () => {
      const email = 'test-user-expiry@example.com';
      const userId = await createMockUser(email);
      const sessionToken = await createMockSession(userId);

      const sessions = await db.select().from(authSession).where(eq(authSession.id, sessionToken));
      expect(sessions).toHaveLength(1);

      const now = Date.now();
      const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
      const expectedExpiresAt = now + sevenDaysInMs;

      const expiresAtMs = sessions[0].expiresAt instanceof Date ? sessions[0].expiresAt.getTime() : sessions[0].expiresAt;

      expect(expiresAtMs).toBeGreaterThan(expectedExpiresAt - 1000);
      expect(expiresAtMs).toBeLessThan(expectedExpiresAt + 1000);
    });

    it('should validate session exists in DB before returning', async () => {
      const email = 'test-user-validate@example.com';
      const userId = await createMockUser(email);
      const sessionToken = await createMockSession(userId);

      const sessions = await db.select().from(authSession).where(eq(authSession.id, sessionToken));
      expect(sessions).toHaveLength(1);
    });

    it('should set token equal to session id', async () => {
      const email = 'test-user-token@example.com';
      const userId = await createMockUser(email);
      const sessionToken = await createMockSession(userId);

      const sessions = await db.select().from(authSession).where(eq(authSession.id, sessionToken));
      expect(sessions).toHaveLength(1);
      expect(sessions[0].token).toBe(sessionToken);
    });
  });

  describe('createUserWithSession', () => {
    it('should create both user and session', async () => {
      const email = 'test-user-with-session@example.com';
      const result = await createUserWithSession(email);

      expect(typeof result.userId).toBe('string');
      expect(result.userId.length).toBeGreaterThan(10);
      expect(typeof result.sessionToken).toBe('string');
      expect(result.sessionToken.length).toBeGreaterThan(10);
      expect(result.email).toBe(email);

      const me = await apiRequest('GET', '/auth/me', { headers: getAuthHeaders(result.sessionToken) });
      expect(me.status).toBe(200);
    });

    it('should use default email if not provided', async () => {
      const result = await createUserWithSession();

      expect(result.email).toMatch(/@integration\.test$/);
    });

    it('should associate session with correct user', async () => {
      const email = 'test-user-association@example.com';
      const result = await createUserWithSession(email);

      const me = await apiRequest('GET', '/auth/me', { headers: getAuthHeaders(result.sessionToken) });
      expect(me.status).toBe(200);
      const data = await me.json();
      expect(data.ok).toBe(true);
      expect(data.data.id).toBe(result.userId);
    });
  });

  describe('getAuthCookie', () => {
    it('should return properly formatted cookie string', () => {
      const sessionToken = '__int_test_session_token';
      const cookie = getAuthCookie(sessionToken);

      expect(cookie).toBe('better-auth.session_token=__int_test_session_token');
    });
  });

  describe('getAuthHeaders', () => {
    it('should return headers object with Cookie', () => {
      const sessionToken = '__int_test_session_token';
      const headers = getAuthHeaders(sessionToken);

      expect(headers).toEqual({
        Cookie: 'better-auth.session_token=__int_test_session_token',
      });
    });
  });
});
