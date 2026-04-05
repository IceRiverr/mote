import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@mote/engine': path.resolve(__dirname, '../packages/engine/src'),
    },
  },
  server: { port: 3001 },
  assetsInclude: ['**/*.wgsl'],
});
