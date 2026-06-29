import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('../calc-core/src', import.meta.url)),
      '@repo': fileURLToPath(new URL('../repositories/src', import.meta.url)),
      '@svc': fileURLToPath(new URL('../services/src', import.meta.url)),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    fileParallelism: false, // integration suites share one Postgres instance
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // server.ts is the process bootstrap (binds a port / reads process.env);
      // index.ts is a re-export barrel. Both are exercised only outside tests.
      exclude: ['src/index.ts', 'src/server.ts'],
      reporter: ['text', 'json'],
    },
  },
});
