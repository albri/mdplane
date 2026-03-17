import { describe, test, expect } from 'bun:test';
import { ASCII_WORDMARK } from '@mdplane/shared';
import { formatBytes, formatTimestamp, renderAsciiWordmark } from '../../utils.js';

function stripAnsi(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] === '\u001B' && value[i + 1] === '[') {
      i += 2;
      while (i < value.length) {
        const ch = value[i] ?? '';
        if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')) {
          break;
        }
        i += 1;
      }
      continue;
    }
    out += value[i] ?? '';
  }
  return out;
}

describe('utils', () => {
  describe('formatBytes', () => {
    test('should format bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1023)).toBe('1023 B');
    });

    test('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(10240)).toBe('10.0 KB');
    });

    test('should format megabytes', () => {
      expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
      expect(formatBytes(1024 * 1024 * 5.5)).toBe('5.5 MB');
    });

    test('should format gigabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
      expect(formatBytes(1024 * 1024 * 1024 * 2.5)).toBe('2.5 GB');
    });
  });

  describe('formatTimestamp', () => {
    test('should format ISO timestamp', () => {
      const result = formatTimestamp('2024-01-15T10:30:00Z');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('renderAsciiWordmark', () => {
    test('renders the shared ascii wordmark content', () => {
      expect(stripAnsi(renderAsciiWordmark())).toBe(ASCII_WORDMARK);
    });
  });
});
