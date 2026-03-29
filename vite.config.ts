import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
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

function copyGameAssetsPlugin() {
  return {
    name: 'copy-game-assets',
    closeBundle() {
      // 复制 dungeon assets
      const dungeonSrc = resolve(__dirname, 'games/dungeon/assets');
      const dungeonDest = resolve(__dirname, 'dist/games/dungeon/assets');
      if (fs.existsSync(dungeonSrc)) {
        fs.mkdirSync(dirname(dungeonDest), { recursive: true });
        fs.cpSync(dungeonSrc, dungeonDest, { recursive: true });
      }
      
      // 复制 tiny-town assets
      const tinyTownSrc = resolve(__dirname, 'games/tiny-town/assets');
      const tinyTownDest = resolve(__dirname, 'dist/games/tiny-town/assets');
      if (fs.existsSync(tinyTownSrc)) {
        fs.mkdirSync(dirname(tinyTownDest), { recursive: true });
        fs.cpSync(tinyTownSrc, tinyTownDest, { recursive: true });
      }
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
    copyGameAssetsPlugin(),
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
