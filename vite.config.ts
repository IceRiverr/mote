import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  root: '.',
  resolve: {
    alias: {
      '@mote/engine': resolve(__dirname, 'packages/engine/src/index.ts'),
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'games/dungeon/assets', dest: 'games/dungeon' },
        { src: 'games/tiny-town/assets', dest: 'games/tiny-town' },
        { src: 'shared/assets', dest: '.' },
      ],
    }),
  ],
  build: {
    outDir: 'dist',
    target: 'esnext',
    rollupOptions: {
      input: {
        main:       resolve(__dirname, 'index.html'),
        snake:      resolve(__dirname, 'games/snake/index.html'),
        tinyTown:   resolve(__dirname, 'games/tiny-town/index.html'),
        dungeon:    resolve(__dirname, 'games/dungeon/index.html'),
        mapEditor:  resolve(__dirname, 'packages/map-editor/index.html'),
      },
    },
  },
});
