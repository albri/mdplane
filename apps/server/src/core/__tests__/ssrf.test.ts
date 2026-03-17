import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { isPrivateIP, isUrlBlocked, validateWebhookUrl } from '../ssrf';

describe('SSRF Protection', () => {
  describe('isPrivateIP()', () => {
    describe('IPv4 Loopback (127.0.0.0/8)', () => {
      test('should detect 127.0.0.1 as private', () => {
        expect(isPrivateIP('127.0.0.1')).toBe(true);
      });

      test('should detect 127.0.0.0 as private', () => {
        expect(isPrivateIP('127.0.0.0')).toBe(true);
      });

      test('should detect 127.255.255.255 as private', () => {
        expect(isPrivateIP('127.255.255.255')).toBe(true);
      });
    });

    describe('RFC1918 Private IPv4 (10/8, 172.16/12, 192.168/16)', () => {
      test('should detect 10.0.0.1 as private', () => {
        expect(isPrivateIP('10.0.0.1')).toBe(true);
      });

      test('should detect 10.255.255.255 as private', () => {
        expect(isPrivateIP('10.255.255.255')).toBe(true);
      });

      test('should detect 172.16.0.1 as private', () => {
        expect(isPrivateIP('172.16.0.1')).toBe(true);
      });

      test('should detect 172.31.255.255 as private', () => {
        expect(isPrivateIP('172.31.255.255')).toBe(true);
      });

      test('should NOT detect 172.15.0.1 as private', () => {
        expect(isPrivateIP('172.15.0.1')).toBe(false);
      });

      test('should NOT detect 172.32.0.1 as private', () => {
        expect(isPrivateIP('172.32.0.1')).toBe(false);
      });

      test('should detect 192.168.0.1 as private', () => {
        expect(isPrivateIP('192.168.0.1')).toBe(true);
      });

      test('should detect 192.168.255.255 as private', () => {
        expect(isPrivateIP('192.168.255.255')).toBe(true);
      });
    });

    describe('Link-local IPv4 (169.254/16)', () => {
      test('should detect 169.254.0.1 as private', () => {
        expect(isPrivateIP('169.254.0.1')).toBe(true);
      });

      test('should detect 169.254.255.255 as private', () => {
        expect(isPrivateIP('169.254.255.255')).toBe(true);
      });
    });

    describe('Special IPv4 addresses', () => {
      test('should detect 0.0.0.0 as private', () => {
        expect(isPrivateIP('0.0.0.0')).toBe(true);
      });
    });

    describe('Public IPv4 addresses', () => {
      test('should NOT detect 8.8.8.8 as private', () => {
        expect(isPrivateIP('8.8.8.8')).toBe(false);
      });

      test('should NOT detect 1.1.1.1 as private', () => {
        expect(isPrivateIP('1.1.1.1')).toBe(false);
      });

      test('should NOT detect 93.184.216.34 as private (example.com)', () => {
        expect(isPrivateIP('93.184.216.34')).toBe(false);
      });
    });

    describe('IPv6 Loopback', () => {
      test('should detect ::1 as private', () => {
        expect(isPrivateIP('::1')).toBe(true);
      });

      test('should detect [::1] as private', () => {
        expect(isPrivateIP('[::1]')).toBe(true);
      });
    });

    describe('IPv6 Unique Local (fc00::/7)', () => {
      test('should detect fc00::1 as private', () => {
        expect(isPrivateIP('fc00::1')).toBe(true);
      });

      test('should detect fd00::1 as private', () => {
        expect(isPrivateIP('fd00::1')).toBe(true);
      });

      test('should detect [fd00::1] as private', () => {
        expect(isPrivateIP('[fd00::1]')).toBe(true);
      });
    });

    describe('IPv6 Link-Local (fe80::/10)', () => {
      test('should detect fe80::1 as private', () => {
        expect(isPrivateIP('fe80::1')).toBe(true);
      });

      test('should detect [fe80::1] as private', () => {
        expect(isPrivateIP('[fe80::1]')).toBe(true);
      });
    });

    describe('Public IPv6 addresses', () => {
      test('should NOT detect 2001:4860:4860::8888 as private (Google DNS)', () => {
        expect(isPrivateIP('2001:4860:4860::8888')).toBe(false);
      });
    });
  });

  describe('validateWebhookUrl()', () => {
    describe('Direct private IP URLs', () => {
      test('should block http://192.168.1.1/webhook', async () => {
        const result = await validateWebhookUrl('http://192.168.1.1/webhook');
        expect(result.safe).toBe(false);
        if (!result.safe) {
          expect(result.reason).toContain('HTTPS');
        }
      });

      test('should block https://192.168.1.1/webhook', async () => {
        const result = await validateWebhookUrl('https://192.168.1.1/webhook');
        expect(result.safe).toBe(false);
        if (!result.safe) {
          expect(result.reason.toLowerCase()).toContain('private');
        }
      });

      test('should block https://10.0.0.1/webhook', async () => {
        const result = await validateWebhookUrl('https://10.0.0.1/webhook');
        expect(result.safe).toBe(false);
      });
    });

    describe('Localhost variants', () => {
      test('should block http://localhost/', async () => {
        const result = await validateWebhookUrl('http://localhost/');
        expect(result.safe).toBe(false);
      });

      test('should block https://localhost/webhook', async () => {
        const result = await validateWebhookUrl('https://localhost/webhook');
        expect(result.safe).toBe(false);
        if (!result.safe) {
          expect(result.reason).toContain('Localhost');
        }
      });

      test('should block http://127.0.0.1/', async () => {
        const result = await validateWebhookUrl('http://127.0.0.1/');
        expect(result.safe).toBe(false);
      });

      test('should block https://127.0.0.1/webhook', async () => {
        const result = await validateWebhookUrl('https://127.0.0.1/webhook');
        expect(result.safe).toBe(false);
      });

      test('should block https://[::1]/webhook', async () => {
        const result = await validateWebhookUrl('https://[::1]/webhook');
        expect(result.safe).toBe(false);
      });
    });

    describe('Bracketed private IPv6 host literals', () => {
      test('should block https://[fd00::1]/webhook', async () => {
        const result = await validateWebhookUrl('https://[fd00::1]/webhook');
        expect(result.safe).toBe(false);
      });

      test('should block https://[fe80::1]/webhook', async () => {
        const result = await validateWebhookUrl('https://[fe80::1]/webhook');
        expect(result.safe).toBe(false);
      });

      test('should block https://[::]/webhook', async () => {
        const result = await validateWebhookUrl('https://[::]/webhook');
        expect(result.safe).toBe(false);
      });

      test('should block https://[::ffff:127.0.0.1]/webhook', async () => {
        const result = await validateWebhookUrl('https://[::ffff:127.0.0.1]/webhook');
        expect(result.safe).toBe(false);
      });

      test('should block https://[::ffff:7f00:1]/webhook', async () => {
        const result = await validateWebhookUrl('https://[::ffff:7f00:1]/webhook');
        expect(result.safe).toBe(false);
      });
    });

    describe('URLs with credentials', () => {
      test('should block https://user:pass@example.com/', async () => {
        const result = await validateWebhookUrl('https://user:pass@example.com/');
        expect(result.safe).toBe(false);
        if (!result.safe) {
          expect(result.reason).toContain('credentials');
        }
      });

      test('should block https://admin:secret@webhook.example.com/hook', async () => {
        const result = await validateWebhookUrl('https://admin:secret@webhook.example.com/hook');
        expect(result.safe).toBe(false);
        if (!result.safe) {
          expect(result.reason).toContain('credentials');
        }
      });
    });

    describe('Non-HTTPS URLs', () => {
      test('should block http://example.com/webhook when ALLOW_HTTP_WEBHOOKS is not set', async () => {
        // Ensure env var is not set
        const originalValue = process.env.ALLOW_HTTP_WEBHOOKS;
        delete process.env.ALLOW_HTTP_WEBHOOKS;

        const result = await validateWebhookUrl('http://example.com/webhook');
        expect(result.safe).toBe(false);
        if (!result.safe) {
          expect(result.reason).toContain('HTTPS');
        }

        // Restore original value
        if (originalValue !== undefined) {
          process.env.ALLOW_HTTP_WEBHOOKS = originalValue;
        }
      });

      test('should block ftp://example.com/file', async () => {
        const result = await validateWebhookUrl('ftp://example.com/file');
        expect(result.safe).toBe(false);
        if (!result.safe) {
          expect(result.reason).toContain('HTTPS');
        }
      });
    });

    describe('Known public hosts', () => {
      test('should allow https://example.com/webhook', async () => {
        const result = await validateWebhookUrl('https://example.com/webhook');
        expect(result.safe).toBe(true);
      });

      test('should allow https://webhook.site/test', async () => {
        const result = await validateWebhookUrl('https://webhook.site/test');
        expect(result.safe).toBe(true);
      });

      test('should allow https://api.github.com/webhooks', async () => {
        const result = await validateWebhookUrl('https://api.github.com/webhooks');
        expect(result.safe).toBe(true);
      });
    });

    describe('Invalid URLs', () => {
      test('should block invalid URL format', async () => {
        const result = await validateWebhookUrl('not-a-url');
        expect(result.safe).toBe(false);
        if (!result.safe) {
          expect(result.reason).toContain('Invalid URL');
        }
      });

      test('should block empty string', async () => {
        const result = await validateWebhookUrl('');
        expect(result.safe).toBe(false);
      });
    });

    describe('ALLOW_HTTP_WEBHOOKS environment variable', () => {
      const originalValue = process.env.ALLOW_HTTP_WEBHOOKS;

      afterAll(() => {
        // Restore original value after all tests
        if (originalValue !== undefined) {
          process.env.ALLOW_HTTP_WEBHOOKS = originalValue;
        } else {
          delete process.env.ALLOW_HTTP_WEBHOOKS;
        }
      });

      test('should allow http://example.com when ALLOW_HTTP_WEBHOOKS=true', async () => {
        process.env.ALLOW_HTTP_WEBHOOKS = 'true';
        const result = await validateWebhookUrl('http://example.com/webhook');
        expect(result.safe).toBe(true);
      });

      test('should still block private IPs even when ALLOW_HTTP_WEBHOOKS=true', async () => {
        process.env.ALLOW_HTTP_WEBHOOKS = 'true';
        const result = await validateWebhookUrl('http://192.168.1.1/webhook');
        expect(result.safe).toBe(false);
        if (!result.safe) {
          expect(result.reason.toLowerCase()).toContain('private');
        }
      });
    });
  });

  describe('isUrlBlocked()', () => {
    test('should block bracketed IPv6 loopback host', () => {
      expect(isUrlBlocked('https://[::1]/webhook')).toBe(true);
    });

    test('should block bracketed IPv6 unique-local host', () => {
      expect(isUrlBlocked('https://[fd00::1]/webhook')).toBe(true);
    });

    test('should block bracketed IPv6 link-local host', () => {
      expect(isUrlBlocked('https://[fe80::1]/webhook')).toBe(true);
    });

    test('should block URLs with embedded credentials', () => {
      expect(isUrlBlocked('https://user:pass@example.com/webhook')).toBe(true);
    });

    test('should block localhost with trailing dot', () => {
      expect(isUrlBlocked('https://localhost./webhook')).toBe(true);
    });
  });
});

