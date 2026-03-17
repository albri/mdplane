import { db } from '../../db';
import type {
  CapabilityKeyRecord,
  KeyValidationResult,
} from '../../shared';
import {
  validateCapabilityKeyForCapabilityRoute,
} from '../../shared';
import type { ErrorCode } from '../../core/errors';

const VALID_API_SEARCH_SCOPES = ['read', 'append', 'write', 'export', 'search', '*'] as const;

export async function validateAndGetKey(keyString: string): Promise<KeyValidationResult> {
  return validateCapabilityKeyForCapabilityRoute({
    keyString,
    lookupByHash: async (keyHash) => {
      const keyRecord = await db.query.capabilityKeys.findFirst({
        where: (fields, { eq }) => eq(fields.keyHash, keyHash),
      });
      return keyRecord as CapabilityKeyRecord | null;
    },
  });
}

export function validateSearchPattern(pattern: string): { code: ErrorCode; message: string } | null {
  if (pattern.length > 500) {
    return { code: 'INVALID_PATTERN', message: 'Search pattern too long (max 500 characters)' };
  }

  if (/\(\?[=!<]/.test(pattern)) {
    return { code: 'INVALID_PATTERN', message: 'Lookahead/lookbehind patterns not allowed' };
  }

  if (/\\[1-9]/.test(pattern)) {
    return { code: 'INVALID_PATTERN', message: 'Backreferences not allowed' };
  }

  if (/\([^)]*[+*][^)]*\)[+*]/.test(pattern)) {
    return { code: 'INVALID_PATTERN', message: 'Nested quantifiers not allowed' };
  }

  return null;
}

export function parseTimeout(timeout: string): number | null {
  const match = timeout.match(/^(\d+)(ms|s)$/);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  if (unit === 's') return value * 1000;
  if (unit === 'ms') return value;
  return null;
}

export function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const yamlContent = match[1];
  const frontmatter: Record<string, unknown> = {};

  const lines = yamlContent.split('\n');
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of lines) {
    if (line.match(/^\s+-\s+/)) {
      const value = line.replace(/^\s+-\s+/, '').trim();
      if (currentKey && currentArray) {
        currentArray.push(value);
      }
      continue;
    }

    if (currentKey && currentArray && currentArray.length > 0) {
      frontmatter[currentKey] = currentArray;
      currentArray = null;
      currentKey = null;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();

      if (value === '' || value === '|' || value === '>') {
        currentKey = key;
        currentArray = [];
      } else {
        frontmatter[key] = value;
      }
    }
  }

  if (currentKey && currentArray && currentArray.length > 0) {
    frontmatter[currentKey] = currentArray;
  }

  return frontmatter;
}

export function parseCommaSeparated(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map(v => v.trim()).filter(v => v.length > 0);
}

export function parseLabels(labelsJson: string | null): string[] {
  if (!labelsJson) return [];
  try {
    return JSON.parse(labelsJson);
  } catch {
    return [];
  }
}

export function hasCommonElements(arr1: string[], arr2: string[]): boolean {
  return arr1.some(item => arr2.includes(item));
}

export { VALID_API_SEARCH_SCOPES };

