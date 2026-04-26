import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      '@mote/engine': path.resolve(__dirname, '../packages/engine/src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
