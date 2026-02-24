import { generateKey } from '../../core/capability-keys';
import type { GenerateSignatureInput, DeliverWebhookInput, DeliverWebhookResult } from './types';

export function generateWebhookId(): string {
  return `wh_${generateKey(12)}`;
}

export function generateWebhookSecret(): string {
  return `whsec_${generateKey(24)}`;
}

export async function generateSignature({
  payload,
  secret,
  timestamp,
}: GenerateSignatureInput): Promise<string> {
  const signaturePayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signaturePayload));
  const hexSignature = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256=${hexSignature}`;
}

export async function deliverWebhook({
  url,
  payload,
  webhookId,
  secret,
}: DeliverWebhookInput): Promise<DeliverWebhookResult> {
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadJson = JSON.stringify(payload);

  try {
    const signature = await generateSignature({ payload: payloadJson, secret, timestamp });

    const startTime = performance.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Id': webhookId,
        'X-MP-Timestamp': timestamp.toString(),
        'X-MP-Signature': signature,
      },
      body: payloadJson,
    });
    const durationMs = Math.round(performance.now() - startTime);

    const delivered = response.status >= 200 && response.status < 300;
    return {
      delivered,
      responseCode: response.status,
      durationMs,
    };
  } catch (error) {
    return {
      delivered: false,
      durationMs: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

