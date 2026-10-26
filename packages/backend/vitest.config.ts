import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
