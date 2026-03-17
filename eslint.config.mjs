import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  prettierConfig,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './apps/*/tsconfig.json', './packages/*/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  // Routes MUST use generated schemas from @mdplane/shared.
  // Manual z.object(), z.string(), z.enum() etc. are forbidden.
  // Exceptions:
  //   - z.infer<typeof ...> for type inference (allowed)
  //   - z.union([generatedSchema1, generatedSchema2]) for composing generated schemas (allowed)
  //   - generatedSchema.extend({...}) for extending generated schemas (allowed)
  // To add a new schema: define in OpenAPI, run `pnpm generate`, import from @mdplane/shared
  {
    files: ['apps/server/src/routes/**/*.ts'],
    ignores: ['apps/server/src/routes/**/__tests__/**'],
    rules: {
      'max-params': ['error', 2],
      'no-restricted-syntax': [
        'error',
        {
          // Ban z.object() - must use generated schemas
          selector: 'CallExpression[callee.object.name="z"][callee.property.name="object"]',
          message:
            'Do not create manual Zod schemas in routes. Import generated schemas from @mdplane/shared instead.',
        },
        {
          // Ban z.string() as standalone schema definition
          selector:
            'VariableDeclarator > CallExpression[callee.object.name="z"][callee.property.name="string"]',
          message:
            'Do not create manual Zod schemas in routes. Import generated schemas from @mdplane/shared instead.',
        },
        {
          // Ban z.number() as standalone schema definition
          selector:
            'VariableDeclarator > CallExpression[callee.object.name="z"][callee.property.name="number"]',
          message:
            'Do not create manual Zod schemas in routes. Import generated schemas from @mdplane/shared instead.',
        },
        {
          // Ban z.enum() - must use generated enums
          selector: 'CallExpression[callee.object.name="z"][callee.property.name="enum"]',
          message:
            'Do not create manual Zod enums in routes. Import generated schemas from @mdplane/shared instead.',
        },
        {
          // Ban z.array() as standalone schema definition (but allow in z.infer)
          selector:
            'VariableDeclarator > CallExpression[callee.object.name="z"][callee.property.name="array"]',
          message:
            'Do not create manual Zod schemas in routes. Import generated schemas from @mdplane/shared instead.',
        },
        {
          // Ban z.boolean() as standalone schema definition
          selector:
            'VariableDeclarator > CallExpression[callee.object.name="z"][callee.property.name="boolean"]',
          message:
            'Do not create manual Zod schemas in routes. Import generated schemas from @mdplane/shared instead.',
        },
        {
          // Ban z.literal() as standalone schema definition
          selector:
            'VariableDeclarator > CallExpression[callee.object.name="z"][callee.property.name="literal"]',
          message:
            'Do not create manual Zod schemas in routes. Import generated schemas from @mdplane/shared instead.',
        },
      ],
    },
  },
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/generated/**',
    ],
  }
);

