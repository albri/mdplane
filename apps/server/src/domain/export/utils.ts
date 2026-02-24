import { generateKey } from '../../core/capability-keys';

export function generateJobId(): string {
  return `exp_${generateKey(16)}`;
}

export function computeChecksum(content: Buffer): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(content);
  return `sha256:${hasher.digest('hex')}`;
}

export function formatExportDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function formatEstimatedSize(bytes: number): string {
  if (bytes > 1073741824) {
    return `${(bytes / 1073741824).toFixed(1)}GB`;
  }
  if (bytes > 1048576) {
    return `${(bytes / 1048576).toFixed(1)}MB`;
  }
  return `${(bytes / 1024).toFixed(1)}KB`;
}

export const RETENTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

