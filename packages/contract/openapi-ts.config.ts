import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: './openapi.yaml',
  output: { path: './src/generated' },
  plugins: [
    '@hey-api/typescript',
    {
      name: 'zod',
      // The spec closes its objects with `additionalProperties: false`. Strict objects refuse an
      // unknown field to match, where plain ones would quietly drop it.
      '~resolvers': {
        object: (ctx) => {
          const extra = ctx.schema.additionalProperties
          const closed = extra === false || extra?.type === 'never'
          return closed
            ? ctx.$(ctx.symbols.z).attr('strictObject').call(ctx.nodes.shape(ctx))
            : undefined
        },
      },
    },
  ],
})
