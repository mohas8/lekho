import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __TEST__: 'true',
  },
  test: {
    include: ['test/unit/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
  },
});
