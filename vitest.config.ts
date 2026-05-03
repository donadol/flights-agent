import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
      thresholds: {
        // Global floor — protege contra regresiones en archivos sin gate específico
        // (model.ts, prompt.ts, createAgent.ts, runAgent.ts). El smoke vivo es
        // quien valida la composición LLM; este número solo evita drift silencioso.
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        // Per-glob: el contrato del DoD para boundaries y tools.
        'src/services/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
        'src/agent/tools/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  },
});
