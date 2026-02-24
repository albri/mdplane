import type { Permission } from './types';

// Permission hierarchy: higher number = higher permission
const PERMISSION_LEVELS: Record<string, number> = {
  read: 1,
  append: 2,
  write: 3,
};

export function mapPermission(permission: string): Permission {
  return permission === 'admin' ? 'write' : permission as Permission;
}

export function mapPermissionForDisplay(permission: string): string {
  return permission === 'write' ? 'admin' : permission;
}

export function getKeyPrefix(permission: Permission): 'r' | 'a' | 'w' {
  switch (permission) {
    case 'read': return 'r';
    case 'append': return 'a';
    case 'write': return 'w';
  }
}

export function isPermissionEscalation(parentPermission: Permission, requestedPermission: Permission): boolean {
  const parentLevel = PERMISSION_LEVELS[parentPermission];
  const requestedLevel = PERMISSION_LEVELS[requestedPermission];
  return requestedLevel > parentLevel;
}

export function truncateKey(prefix: string): string {
  if (prefix.length >= 4) {
    return `${prefix}...`;
  }
  return `${prefix}...`;
}

export function truncateKeyForSecurity(key: string): string {
  if (key.length <= 8) {
    return key + '...';
  }
  return key.substring(0, 8) + '...';
}

