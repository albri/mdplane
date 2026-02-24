import { describe, expect, test, beforeAll, beforeEach, afterAll } from 'bun:test';
import type { Elysia } from 'elysia';
import {
  setupWebhookTests,
  teardownWebhookTests,
  resetMockServer,
  ssrfConfig,
  type WebhookTestContext,
} from './test-setup';

describe('SSRF Protection', () => {
  let ctx: WebhookTestContext;
  let app: Elysia;
  let VALID_ADMIN_KEY: string;

  beforeAll(async () => {
    ctx = await setupWebhookTests();
    app = ctx.app;
    VALID_ADMIN_KEY = ctx.adminKey;
  });

  afterAll(() => {
    teardownWebhookTests();
  });

  beforeEach(() => {
    resetMockServer();
  });

  describe('Localhost Prevention', () => {
    test('should reject localhost URL', async () => {
      const originalAllowList = [...ssrfConfig.allowList];
      ssrfConfig.allowList.length = 0;
      try {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'https://localhost/webhook', events: ['file.created'] }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
      } finally {
        ssrfConfig.allowList.push(...originalAllowList);
      }
    });

    test('should reject localhost with port', async () => {
      const originalAllowList = [...ssrfConfig.allowList];
      ssrfConfig.allowList.length = 0;
      try {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'https://localhost:8080/webhook', events: ['file.created'] }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
      } finally {
        ssrfConfig.allowList.push(...originalAllowList);
      }
    });

    test('should reject 127.0.0.1', async () => {
      const originalAllowList = [...ssrfConfig.allowList];
      ssrfConfig.allowList.length = 0;
      try {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'https://127.0.0.1/webhook', events: ['file.created'] }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
      } finally {
        ssrfConfig.allowList.push(...originalAllowList);
      }
    });

    test('should reject 127.0.0.1 with any port', async () => {
      const originalAllowList = [...ssrfConfig.allowList];
      ssrfConfig.allowList.length = 0;
      try {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'https://127.0.0.1:3000/webhook', events: ['file.created'] }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
      } finally {
        ssrfConfig.allowList.push(...originalAllowList);
      }
    });
  });

  describe('Private IP Range Prevention', () => {
    test('should reject 10.x.x.x range (Class A private)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://10.0.0.1/webhook', events: ['file.created'] }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });

    test('should reject 10.255.255.255 (end of range)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://10.255.255.255/webhook', events: ['file.created'] }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });

    test('should reject 172.16.x.x range (Class B private)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://172.16.0.1/webhook', events: ['file.created'] }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });

    test('should reject 172.31.255.255 (end of 172.16-31 range)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://172.31.255.255/webhook', events: ['file.created'] }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });

    test('should reject 192.168.x.x range (Class C private)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://192.168.1.1/webhook', events: ['file.created'] }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });

    test('should reject 192.168.255.255 (end of range)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://192.168.255.255/webhook', events: ['file.created'] }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });
  });

  describe('Non-HTTP Scheme Prevention', () => {
    test('should reject file:// URLs', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'file:///etc/passwd', events: ['file.created'] }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });

    test('should reject ftp:// URLs', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'ftp://example.com/webhook', events: ['file.created'] }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });

    test('should reject javascript: URLs', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'javascript:alert(1)', events: ['file.created'] }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });

    test('should reject data: URLs', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'data:text/html,<script>alert(1)</script>', events: ['file.created'] }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_WEBHOOK_URL');
    });
  });

  describe('Valid Public URLs', () => {
    test('should allow public HTTPS URLs', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://api.example.com/webhook', events: ['file.created'] }),
        })
      );
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test('should allow HTTPS URLs with paths', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://api.example.com/v1/webhooks/mdplane', events: ['file.created'] }),
        })
      );
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test('should allow HTTPS URLs with query parameters', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://api.example.com/webhook?token=abc123', events: ['file.created'] }),
        })
      );
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test('should allow HTTP URLs for non-production (warn only)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_ADMIN_KEY}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'http://api.example.com/webhook', events: ['file.created'] }),
        })
      );
      expect(response.status).toBe(201);
    });
  });
});

