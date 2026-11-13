import { defineConfig } from 'vite';

// base './' = caminhos relativos: funciona em qualquer subpasta do GitHub Pages.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', assetsInlineLimit: 0, sourcemap: false },
  test: { include: ['testes/**/*.test.js'], environment: 'node' },
});
