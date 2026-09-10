import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  // Kept on the same version line as the mobile app so "Current Version" means
  // the same thing to a clinic on either surface.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none'
    }
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    // Without this, Vite targets whatever supports native ES modules and emits
    // `?.` and `??` untouched — 9,000 of them. Both are SYNTAX errors before
    // Safari 13.1, so the bundle does not merely misbehave on an older iPad,
    // it fails to parse and the screen stays white.
    //
    // esbuild lowers syntax only. Runtime APIs it cannot invent are polyfilled
    // in src/legacy-polyfills.js, imported first in main.jsx.
    target: ['es2019', 'safari13', 'chrome80', 'firefox78', 'edge88'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
