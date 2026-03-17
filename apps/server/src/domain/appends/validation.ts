import { zAppendType } from '@mdplane/shared';
import type { AppendType } from './types';

export function isValidAppendType(type: unknown): type is AppendType {
  return zAppendType.safeParse(type).success;
}
