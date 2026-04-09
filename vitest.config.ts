import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    watch: false,
    testTimeout: 10000,
    fileParallelism: false,
    include: ['vitest/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@lib': resolve('src/lib'),
      '@node': resolve('src/node'),
      '@ai': resolve('src/ai'),
      '@state': resolve('src/state'),
    },
  },
})
