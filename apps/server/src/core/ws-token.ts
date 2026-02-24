import * as crypto from 'crypto';
import { serverEnv } from '../config/env';

export interface WsTokenPayload {
  workspaceId: string;
  keyTier: 'read' | 'append' | 'write';
  keyHash: string;
  exp: number; // Unix timestamp (seconds)
  scope?: string;
  nonce: string;
}

export type WsTokenValidationResult =
  | { ok: true; payload: WsTokenPayload }
  | { ok: false; error: { code: string }; status: number };

let jwtSecret: Buffer | null = null;

function getJwtSecret(): Buffer {
  if (jwtSecret) return jwtSecret;

  const envSecret = serverEnv.mpJwtSecret;
  const isProduction = serverEnv.mpEnv === 'production' || serverEnv.isProduction;

  if (envSecret) {
    jwtSecret = Buffer.from(envSecret, 'base64');
    return jwtSecret;
  }

  if (isProduction) {
    // Hard fail in production - no silent fallback
    throw new Error('FATAL: MP_JWT_SECRET is required in production');
  }

  // Development: generate ephemeral secret (tokens won't survive restart)
  jwtSecret = crypto.randomBytes(32);
  return jwtSecret;
}

export function signWsToken(payload: Omit<WsTokenPayload, 'nonce'>): string {
  const secret = getJwtSecret();

  const fullPayload: WsTokenPayload = {
    ...payload,
    nonce: crypto.randomBytes(8).toString('hex'),
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));

  const signatureInput = `${headerB64}.${payloadB64}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signatureInput)
    .digest();
  const signatureB64 = base64UrlEncode(signature);

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

export function verifyWsToken(token: string): WsTokenValidationResult {
  const secret = getJwtSecret();

  // Parse JWT structure
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { ok: false, error: { code: 'TOKEN_INVALID' }, status: 401 };
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // Verify signature
  const signatureInput = `${headerB64}.${payloadB64}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signatureInput)
    .digest();
  const expectedSignatureB64 = base64UrlEncode(expectedSignature);

  if (signatureB64 !== expectedSignatureB64) {
    return { ok: false, error: { code: 'TOKEN_INVALID' }, status: 401 };
  }

  // Decode payload
  let payload: WsTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    return { ok: false, error: { code: 'TOKEN_INVALID' }, status: 401 };
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    return { ok: false, error: { code: 'TOKEN_EXPIRED' }, status: 401 };
  }

  return { ok: true, payload };
}

function base64UrlEncode(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf-8');
}

export function tokenHashPrefix(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex').substring(0, 6);
}

export function resetJwtSecret(): void {
  jwtSecret = null;
}

