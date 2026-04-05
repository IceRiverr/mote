import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

export default defineConfig({
  resolve: {
    alias: {
      '@mote/engine': path.resolve(__dirname, '../packages/engine/src'),
    },
  },
  server: { port: 3001 },
  assetsInclude: ['**/*.wgsl'],
  publicDir: false,
  plugins: [
    {
      name: 'serve-mote-project',
      configureServer(server) {
        // Serve static files from root directories
        const serveDir = (urlPrefix: string, dirPath: string) => {
          server.middlewares.use(urlPrefix, (req, res, next) => {
            const filePath = path.join(dirPath, req.url || '');
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              res.setHeader('Content-Type', getContentType(filePath));
              fs.createReadStream(filePath).pipe(res);
            } else {
              next();
            }
          });
        };

        const getContentType = (file: string): string => {
          if (file.endsWith('.json')) return 'application/json';
          if (file.endsWith('.png')) return 'image/png';
          if (file.endsWith('.jpg') || file.endsWith('.jpeg')) return 'image/jpeg';
          return 'application/octet-stream';
        };

        serveDir('/sheets', path.resolve(__dirname, 'sheets'));
        serveDir('/entities', path.resolve(__dirname, 'entities'));
        serveDir('/scenes', path.resolve(__dirname, 'scenes'));
        serveDir('/images', path.resolve(__dirname, 'images'));

        // Serve project.mote.json from root
        server.middlewares.use('/project.mote.json', (req, res, next) => {
          const filePath = path.resolve(__dirname, 'project.mote.json');
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/json');
            fs.createReadStream(filePath).pipe(res);
          } else {
            next();
          }
        });
      }
    }
  ]
});
