import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
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

// 生成目录索引 HTML
function generateDirectoryListing(dirPath: string, reqPath: string): string {
  const files = fs.readdirSync(dirPath);
  const items = files.map(file => {
    const fullPath = path.join(dirPath, file);
    const isDir = fs.statSync(fullPath).isDirectory();
    const href = `${reqPath}${reqPath.endsWith('/') ? '' : '/'}${file}${isDir ? '/' : ''}`;
    const icon = isDir ? '📁' : getFileIcon(file);
    return `<li><a href="${href}">${icon} ${file}${isDir ? '/' : ''}</a></li>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html>
<head><title>Index of ${reqPath}</title>
<style>
  body { font-family: system-ui; padding: 20px; background: #0a0a0f; color: #e0e0e0; }
  h1 { font-size: 1.2em; border-bottom: 1px solid #333; padding-bottom: 10px; }
  ul { list-style: none; padding: 0; }
  li { padding: 4px 0; }
  a { color: #6bb8ff; text-decoration: none; }
  a:hover { text-decoration: underline; }
</style>
</head>
<body>
  <h1>Index of ${reqPath}</h1>
  <ul>${reqPath !== '/' ? '<li><a href="../">📁 ../</a></li>' : ''}
${items}</ul>
</body>
</html>`;
}

function getFileIcon(filename: string): string {
  if (filename.endsWith('.png') || filename.endsWith('.jpg')) return '🖼️';
  if (filename.endsWith('.json')) return '📋';
  if (filename.endsWith('.ts')) return '📜';
  if (filename.endsWith('.html')) return '🌐';
  return '📄';
}

function copyGameAssetsPlugin() {
  return {
    name: 'copy-game-assets',
    configureServer(server: any) {
      // 为游戏资源提供目录索引
      server.middlewares.use('/games', (req: any, res: any, next: any) => {
        const gamesDir = resolve(__dirname, 'games');
        const fullPath = path.join(gamesDir, req.url);

        // 安全检查：确保路径在游戏目录内
        if (!fullPath.startsWith(gamesDir)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }

        if (!fs.existsSync(fullPath)) {
          next();
          return;
        }

        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          // 返回目录索引，使用完整路径 /games/...
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(generateDirectoryListing(fullPath, '/games' + req.url));
        } else {
          // 所有文件（包括 .html、.ts、.png 等）都交给 Vite 默认管道处理
          next();
        }
      });
    },
    closeBundle() {
      // 复制 dungeon assets + config
      const dungeonSrc = resolve(__dirname, 'games/dungeon/assets');
      const dungeonDest = resolve(__dirname, 'dist/games/dungeon/assets');
      if (fs.existsSync(dungeonSrc)) {
        fs.mkdirSync(dirname(dungeonDest), { recursive: true });
        fs.cpSync(dungeonSrc, dungeonDest, { recursive: true });
      }
      const dungeonConfig = resolve(__dirname, 'games/dungeon/map-editor.config.json');
      if (fs.existsSync(dungeonConfig)) {
        fs.copyFileSync(dungeonConfig, resolve(__dirname, 'dist/games/dungeon/map-editor.config.json'));
      }

      // 复制 tiny-dungeon assets
      const tinyDungeonSrc = resolve(__dirname, 'games/tiny-dungeon/assets');
      const tinyDungeonDest = resolve(__dirname, 'dist/games/tiny-dungeon/assets');
      if (fs.existsSync(tinyDungeonSrc)) {
        fs.mkdirSync(dirname(tinyDungeonDest), { recursive: true });
        fs.cpSync(tinyDungeonSrc, tinyDungeonDest, { recursive: true });
      }

      // 复制 tiny-town assets + maps + config
      const tinyTownSrc = resolve(__dirname, 'games/tiny-town/assets');
      const tinyTownDest = resolve(__dirname, 'dist/games/tiny-town/assets');
      if (fs.existsSync(tinyTownSrc)) {
        fs.mkdirSync(dirname(tinyTownDest), { recursive: true });
        fs.cpSync(tinyTownSrc, tinyTownDest, { recursive: true });
      }
      const tinyTownMapsSrc = resolve(__dirname, 'games/tiny-town/maps');
      const tinyTownMapsDest = resolve(__dirname, 'dist/games/tiny-town/maps');
      if (fs.existsSync(tinyTownMapsSrc)) {
        fs.mkdirSync(dirname(tinyTownMapsDest), { recursive: true });
        fs.cpSync(tinyTownMapsSrc, tinyTownMapsDest, { recursive: true });
      }
      const tinyTownConfig = resolve(__dirname, 'games/tiny-town/map-editor.config.json');
      if (fs.existsSync(tinyTownConfig)) {
        fs.copyFileSync(tinyTownConfig, resolve(__dirname, 'dist/games/tiny-town/map-editor.config.json'));
      }
    },
  };
}

export default defineConfig({
  root: '.',
  appType: 'mpa',
  resolve: {
    alias: [
      { find: /^@mote\/engine$/, replacement: resolve(__dirname, 'packages/engine/src/index.ts') },
      { find: /^@mote\/engine\/(.+)$/, replacement: resolve(__dirname, 'packages/engine/src/$1.ts') },
    ],
  },
  plugins: [
    preact(),
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
        tinyDungeon: resolve(__dirname, 'games/tiny-dungeon/index.html'),
        breakout:   resolve(__dirname, 'games/breakout/index.html'),
        editor:     resolve(__dirname, 'editor/index.html'),
      },
    },
  },
});
