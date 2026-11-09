import { defineConfig } from 'vite';

// GitHub Pages serves the build from https://dmartinsid.github.io/MetroRig/; the dev server stays at the root
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/MetroRig/' : '/',
  server: {
    port: 3000,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  build: {
    assetsInlineLimit: 0
  }
}));
