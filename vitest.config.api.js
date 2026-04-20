import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // No setupFiles — avoids jsdom-only setup.js that uses window
    include: ['api/__tests__/**/*.test.js'],
  },
})
