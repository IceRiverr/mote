import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import fs from 'fs';
import path from 'path';

function sharedAssetsPlugin(sharedAssetsDir: string) {
  return {
    name: 'shared-assets',
    configureServer(server: any) {
      server.middlewares.use('/assets', (req: any, res: any, next: any) => {
        const filePath = path.join(sharedAssetsDir, req.url);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          res.end(fs.readFileSync(filePath));
        } else {
          next();
        }
      });
    },
    closeBundle() {
      fs.cpSync(sharedAssetsDir, resolve(__dirname, 'dist/assets'), { recursive: true });
    },
  };
}

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
      ],
    }),
    sharedAssetsPlugin(resolve(__dirname, 'shared/assets')),
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
