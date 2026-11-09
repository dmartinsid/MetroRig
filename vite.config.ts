import { defineConfig } from 'vite';

// GitHub Pages serves the build from https://dmartinsid.github.io/MetroRig/; the dev server stays at the root
// vite preview serves that build, so it takes the same base
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/MetroRig/' : '/',
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
