import { generateFiles } from 'fumadocs-openapi';
import { createOpenAPI } from 'fumadocs-openapi/server';
import path from 'node:path';

const OPENAPI_RELATIVE_PATH = '../../packages/shared/openapi.bundled.yaml';
const openapiPath = path.resolve(process.cwd(), OPENAPI_RELATIVE_PATH);
const openapi = createOpenAPI({
  input: [openapiPath, OPENAPI_RELATIVE_PATH],
});

function escapePathParameters(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    return escapeBody(content);
  }

  const [, frontmatter, body] = frontmatterMatch;
  const escapedBody = escapeBody(body);

  return `---\n${frontmatter}\n---\n${escapedBody}`;
}

function escapeBody(body) {
  const withOperations = body.replace(
    /operations=\{(\[.*?\])\}/g,
    (_match, jsonContent) => {
      const escaped = jsonContent.replace(/'/g, "\\'");
      return `operations={JSON.parse('${escaped}')}`;
    }
  );

  const lines = withOperations.split('\n');
  const processedLines = lines.map((line) => {
    if (line.includes('operations={JSON.parse')) {
      return line;
    }

    const parts = line.split('`');
    const escapedParts = parts.map((part, index) => {
      if (index % 2 === 0) {
        return part.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, "{'{'}$1{'}'}");
      }
      return part;
    });

    return escapedParts.join('`');
  });

  return processedLines.join('\n');
}

function fixDocumentPath(content) {
  return content.replace(
    /document=\{"[^"]*openapi\.bundled\.yaml"\}/g,
    `document={"${OPENAPI_RELATIVE_PATH}"}`
  );
}

await generateFiles({
  input: openapi,
  output: './content/docs/api-reference',
  includeDescription: true,
  groupBy: 'tag',
  beforeWrite(files) {
    for (const file of files) {
      file.content = fixDocumentPath(file.content);
      file.content = escapePathParameters(file.content);
    }
  },
});
