import { defineConfig } from 'tsdown'

export default defineConfig({
  unbundle: true,
  format: ['esm', 'cjs'],
  entry: ['src/**/*.ts'],

  dts: {
    entry: [
      'src/**/*.ts',
      '!src/cli/**'
    ]
  },

  exports: {
    bin: true,
    exclude: ['cli', 'cli/**']
  },

  loader: {
    '.vert': 'text',
    '.frag': 'text'
  }
})
