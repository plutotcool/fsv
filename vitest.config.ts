import { defineConfig } from 'vitest/config'

const root = new URL('.', import.meta.url).pathname.slice(0, -1)

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/setup.ts']
  },
  resolve: {
    alias: {
      '~': `${root}/src`,
      '~~': root
    }
  }
})
