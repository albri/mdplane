import type { InferInsertModel } from 'drizzle-orm';
import * as schema from '../schema';

export type DemoFileSeed = Pick<InferInsertModel<typeof schema.files>, 'path' | 'content'>;

export type DemoAppendSeed = Pick<
  InferInsertModel<typeof schema.appends>,
  'appendId' | 'author' | 'type' | 'status' | 'priority' | 'contentPreview' | 'createdAt' | 'ref' | 'expiresAt'
> & { filePath: string };

