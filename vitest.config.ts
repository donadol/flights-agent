import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
      thresholds: {
        'src/services/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
        'src/agent/tools/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  },
});
