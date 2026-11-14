import { defineConfig } from 'vitest/config';

// The phone layout is measured in a real Chrome, driven by playwright-core against the Vite dev server
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/mobile/**/*.test.ts'],
    globalSetup: ['tests/mobile/setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  }
});
