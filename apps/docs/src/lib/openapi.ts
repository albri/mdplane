import { createOpenAPI } from 'fumadocs-openapi/server';
import path from 'node:path';

const OPENAPI_RELATIVE_PATH = '../../packages/shared/openapi.bundled.yaml';
const openapiPath = path.resolve(process.cwd(), OPENAPI_RELATIVE_PATH);

export const openapi = createOpenAPI({
  input: [openapiPath, OPENAPI_RELATIVE_PATH],
});

