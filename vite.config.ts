import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  resolve: {
    alias: {
      '@mote/engine': resolve(__dirname, 'packages/engine/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    target: 'esnext',
    rollupOptions: {
      input: {
        main:       resolve(__dirname, 'index.html'),
        tinyTown:   resolve(__dirname, 'games/tiny-town/index.html'),
        dungeon:    resolve(__dirname, 'games/dungeon/index.html'),
        mapEditor:  resolve(__dirname, 'packages/map-editor/index.html'),
      },
    },
  },
});
