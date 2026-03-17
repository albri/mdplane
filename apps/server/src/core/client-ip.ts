import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { serverEnv } from '../config/env';

function normalizeIp(candidate: string): string | null {
  const trimmed = candidate.trim();
  if (!trimmed) return null;

  if (isIP(trimmed)) {
    return trimmed;
  }

  const bracketedWithPort = /^\[([^\]]+)\](?::\d+)?$/u.exec(trimmed);
  if (bracketedWithPort && isIP(bracketedWithPort[1])) {
    return bracketedWithPort[1];
  }

  const ipv4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/u.exec(trimmed);
  if (ipv4WithPort && isIP(ipv4WithPort[1])) {
    return ipv4WithPort[1];
  }

  return null;
}

function parseForwardedForHeader(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => normalizeIp(part))
    .filter((ip): ip is string => ip != null);
}

type ClientIpOptions = {
  trustProxyHeaders: boolean;
  trustSingleXForwardedFor: boolean;
  trustedProxySharedSecret?: string;
  trustedProxySharedSecretHeader: string;
};

function hasTrustedProxySecret(headers: Headers, options: ClientIpOptions): boolean {
  if (!options.trustedProxySharedSecret) {
    return true;
  }

  const provided = headers.get(options.trustedProxySharedSecretHeader);
  if (!provided) {
    return false;
  }

  const expectedBuf = Buffer.from(options.trustedProxySharedSecret);
  const providedBuf = Buffer.from(provided.trim());

  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }

  return timingSafeEqual(expectedBuf, providedBuf);
}

export function getClientIpFromHeaders(headers: Headers, options: ClientIpOptions): string {
  if (!hasTrustedProxySecret(headers, options)) {
    return 'unknown';
  }

  const cloudflareIp = normalizeIp(headers.get('CF-Connecting-IP') ?? '');
  if (cloudflareIp) {
    return cloudflareIp;
  }

  if (!options.trustProxyHeaders) {
    return 'unknown';
  }

  const realIp = normalizeIp(headers.get('X-Real-IP') ?? '');
  if (realIp) {
    return realIp;
  }

  const forwardedIps = parseForwardedForHeader(headers.get('X-Forwarded-For'));
  if (forwardedIps.length > 1) {
    // Prefer the last hop so a spoofed first value cannot bypass the limiter.
    return forwardedIps[forwardedIps.length - 1];
  }

  if (forwardedIps.length === 1 && options.trustSingleXForwardedFor) {
    return forwardedIps[0];
  }

  return 'unknown';
}

export function getClientIp(request: Request): string {
  return getClientIpFromHeaders(request.headers, {
    trustProxyHeaders: serverEnv.trustProxyHeaders,
    trustSingleXForwardedFor: serverEnv.trustSingleXForwardedFor,
    trustedProxySharedSecret: serverEnv.trustedProxySharedSecret,
    trustedProxySharedSecretHeader: serverEnv.trustedProxySharedSecretHeader,
  });
}
