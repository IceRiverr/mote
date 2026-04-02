import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  server: {
    port: 5174,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
