import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    // The phone layout runs in Chrome under vitest.mobile.config.ts
    exclude: [...configDefaults.exclude, 'tests/mobile/**']
  }
});
