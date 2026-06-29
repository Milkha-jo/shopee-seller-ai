import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('../calc-core/src', import.meta.url)),
      '@repo': fileURLToPath(new URL('../repositories/src', import.meta.url)),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    fileParallelism: false, // integration suites share one Postgres instance
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
      reporter: ['text', 'json'],
    },
  },
});
