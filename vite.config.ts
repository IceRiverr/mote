import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    target: 'esnext',
    rollupOptions: {
      input: {
        main:     resolve(__dirname, 'index.html'),
        tinyTown: resolve(__dirname, 'games/tiny-town/index.html'),
      },
    },
  },
});
