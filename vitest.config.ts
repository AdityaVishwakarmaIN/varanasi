import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Whole-city simulation tests run several seconds each when the suite runs in parallel.
    testTimeout: 30000,
    // Long synchronous sim loops starve the worker-thread RPC ("Timeout calling onTaskUpdate"); processes don't.
    pool: 'forks',
  },
});
