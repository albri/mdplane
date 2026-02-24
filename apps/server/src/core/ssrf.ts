import { dns } from 'bun';
import { readServerEnv } from '../config/env';

export type ValidationResult = { safe: true } | { safe: false; reason: string };

function normalizeHostToken(value: string): string {
  let normalized = value.trim().toLowerCase();
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    normalized = normalized.slice(1, -1);
  }
  normalized = normalized.replace(/\.+$/, '');
  const zoneSeparator = normalized.indexOf('%');
  if (zoneSeparator !== -1) {
    normalized = normalized.slice(0, zoneSeparator);
  }
  return normalized;
}

/**
 * Check if an IP address is private/internal.
 *
 * Rejects:
 * - loopback (127.0.0.0/8)
 * - RFC1918 private IPv4 (10/8, 172.16/12, 192.168/16)
 * - link-local IPv4 (169.254/16)
 * - IPv6 loopback (::1)
 * - IPv6 unique local (fc00::/7)
 * - IPv6 link-local (fe80::/10)
 * - 0.0.0.0 (any address)
 *
 * @param ip - IP address string (IPv4 or IPv6)
 * @returns true if the IP is private/internal, false if public
 */
export function isPrivateIP(ip: string): boolean {
  const normalizedIP = normalizeHostToken(ip);

  // IPv4 checks
  if (normalizedIP.includes('.')) {
    return isPrivateIPv4(normalizedIP);
  }

  // IPv6 checks
  return isPrivateIPv6(normalizedIP);
}

/**
 * Check if an IPv4 address is private.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return true; // Invalid IPv4 should be treated as unsafe
  }

  const octets = parts.map((p) => parseInt(p, 10));
  if (octets.some((o) => isNaN(o) || o < 0 || o > 255)) {
    return true; // Invalid octets should be treated as unsafe
  }

  const [a, b, c, d] = octets;

  // 0.0.0.0/8 - Current network (usually invalid)
  if (a === 0) return true;

  // 10.0.0.0/8 - Private (RFC1918)
  if (a === 10) return true;

  // 127.0.0.0/8 - Loopback
  if (a === 127) return true;

  // 169.254.0.0/16 - Link-local
  if (a === 169 && b === 254) return true;

  // 172.16.0.0/12 - Private (RFC1918)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 - Private (RFC1918)
  if (a === 192 && b === 168) return true;

  // 224.0.0.0/4 - Multicast
  if (a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 - Reserved for future use
  if (a >= 240) return true;

  return false;
}

/**
 * Check if an IPv6 address is private.
 */
function isPrivateIPv6(ip: string): boolean {
  const normalized = normalizeHostToken(ip);

  // Loopback (::1)
  if (normalized === '::1') return true;

  // Unspecified address (::)
  if (normalized === '::') return true;

  // fc00::/7 - Unique local addresses (fc00:: to fdff::)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  // fe80::/10 - Link-local addresses (fe8x-febx)
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;

  // IPv4-mapped IPv6 addresses (::ffff:x.x.x.x)
  if (normalized.startsWith('::ffff:')) {
    const ipv4Part = normalized.slice(7);
    if (ipv4Part.includes('.')) {
      return isPrivateIPv4(ipv4Part);
    }
    const mappedHexMatch = ipv4Part.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (mappedHexMatch) {
      const high = parseInt(mappedHexMatch[1], 16);
      const low = parseInt(mappedHexMatch[2], 16);
      const a = (high >> 8) & 0xff;
      const b = high & 0xff;
      const c = (low >> 8) & 0xff;
      const d = low & 0xff;
      return isPrivateIPv4(`${a}.${b}.${c}.${d}`);
    }
    return true;
  }

  return false;
}

/**
 * Validate a URL for SSRF safety.
 *
 * Must:
 * - Parse the URL
 * - Reject non-https URLs (unless ALLOW_HTTP_WEBHOOKS env var is set)
 * - Reject URLs with embedded credentials (user:pass@host)
 * - Resolve hostname to IP(s) using DNS
 * - Reject if ANY resolved IP is private
 *
 * @param url - The webhook URL to validate
 * @returns Validation result indicating if URL is safe or the reason it's blocked
 */
export async function validateWebhookUrl(url: string): Promise<ValidationResult> {
  const env = readServerEnv();
  const isIntegrationTestEnv = env.integrationTestMode;

  // Parse the URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }

  // Check protocol (must be HTTPS unless explicitly allowed)
  const allowHttp = isIntegrationTestEnv || env.allowHttpWebhooks;
  if (parsedUrl.protocol !== 'https:' && !(allowHttp && parsedUrl.protocol === 'http:')) {
    return { safe: false, reason: 'URL must use HTTPS protocol' };
  }

  // Check for embedded credentials
  if (parsedUrl.username || parsedUrl.password) {
    return { safe: false, reason: 'URL must not contain embedded credentials' };
  }

  // Get the hostname
  const hostname = normalizeHostToken(parsedUrl.hostname);
  if (!hostname) {
    return { safe: false, reason: 'Invalid hostname' };
  }

  // In integration tests, allow loopback webhook targets (mock receivers on 127.0.0.1)
  if (
    isIntegrationTestEnv &&
    (hostname === 'localhost' || hostname === 'localhost.localdomain' || hostname === '127.0.0.1' || hostname === '::1')
  ) {
    return { safe: true };
  }

  // Check for localhost variants
  if (hostname === 'localhost' || hostname === 'localhost.localdomain') {
    return { safe: false, reason: 'Localhost URLs are not allowed' };
  }

  if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.localhost')) {
    return { safe: false, reason: 'Local network hostnames are not allowed' };
  }

  // Check if hostname is a raw IP address
  if (isIPAddress(hostname)) {
    if (isPrivateIP(hostname)) {
      return { safe: false, reason: 'Private IP addresses are not allowed' };
    }
    return { safe: true };
  }

  // Resolve hostname via DNS and check all IPs
  try {
    // Check IPv4 addresses
    const ipv4Records = await dns.lookup(hostname, { family: 4 }).catch(() => []);
    for (const record of ipv4Records) {
      if (isIntegrationTestEnv && record.address === '127.0.0.1') {
        continue;
      }
      if (isPrivateIP(record.address)) {
        return { safe: false, reason: `Hostname resolves to private IP: ${record.address}` };
      }
    }

    // Check IPv6 addresses
    const ipv6Records = await dns.lookup(hostname, { family: 6 }).catch(() => []);
    for (const record of ipv6Records) {
      if (isIntegrationTestEnv && record.address === '::1') {
        continue;
      }
      if (isPrivateIP(record.address)) {
        return { safe: false, reason: `Hostname resolves to private IP: ${record.address}` };
      }
    }

    // If no records found at all, might be a problem
    if (ipv4Records.length === 0 && ipv6Records.length === 0) {
      return { safe: false, reason: 'Hostname could not be resolved' };
    }

    return { safe: true };
  } catch (error) {
    return {
      safe: false,
      reason: `DNS resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Check if a string is an IP address (IPv4 or IPv6).
 */
function isIPAddress(str: string): boolean {
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Pattern.test(str)) {
    return true;
  }

  // IPv6 pattern (simplified - contains colons)
  if (str.includes(':')) {
    return true;
  }

  return false;
}

/**
 * Allowlist for test mock servers.
 * SECURITY: This should always be empty in production.
 */
export const ssrfConfig = {
  allowList: [] as string[],
};

/**
 * Synchronous check if a URL should be blocked (SSRF protection).
 * Used at webhook creation time for immediate validation.
 *
 * This function does NOT do DNS resolution - it only checks:
 * - URL parsing
 * - Protocol (http/https only)
 * - Hostname patterns (localhost, .local, .internal)
 * - Direct IP addresses (private ranges)
 * - IPv4-mapped IPv6 addresses
 *
 * For full protection including DNS resolution, use validateWebhookUrl().
 */
export function isUrlBlocked(urlString: string): boolean {
  const isIntegrationTestEnv = readServerEnv().integrationTestMode;

  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return true;
  }

  // Only allow http and https schemes
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return true;
  }

  if (url.username || url.password) {
    return true;
  }

  const hostname = normalizeHostToken(url.hostname);
  if (!hostname) {
    return true;
  }

  // In integration tests, allow loopback webhook targets (mock receivers on 127.0.0.1)
  if (
    isIntegrationTestEnv &&
    (hostname === 'localhost' || hostname === 'localhost.localdomain' || hostname === '127.0.0.1' || hostname === '::1')
  ) {
    return false;
  }

  // Check allowList for test mock servers
  if (ssrfConfig.allowList.some((allowedHost) => normalizeHostToken(allowedHost) === hostname)) {
    return false;
  }

  // Block localhost
  if (hostname === 'localhost' || hostname === 'localhost.localdomain') {
    return true;
  }

  // Block *.local, *.internal, *.localhost hostnames
  if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.localhost')) {
    return true;
  }

  if (isIPAddress(hostname) && isPrivateIP(hostname)) {
    return true;
  }

  return false;
}
