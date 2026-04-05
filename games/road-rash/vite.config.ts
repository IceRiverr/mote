import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

const scriptsDir = path.resolve(__dirname, 'scripts');
const scriptEntries: Record<string, string> = {};
if (fs.existsSync(scriptsDir)) {
  for (const file of fs.readdirSync(scriptsDir)) {
    if (file.endsWith('.ts')) {
      scriptEntries[`scripts/${file.replace('.ts', '')}`] = path.resolve(scriptsDir, file);
    }
  }
}

export default defineConfig({
  resolve: {
    alias: { '@mote/engine': path.resolve(__dirname, '../packages/engine/src') },
  },
  server: { port: 3003 },
  assetsInclude: ['**/*.wgsl'],
  build: {
    rollupOptions: {
      input: { main: path.resolve(__dirname, 'index.html'), ...scriptEntries },
      output: {
        entryFileNames: (c) => c.name.startsWith('scripts/') ? '[name].js' : 'assets/[name]-[hash].js',
      },
      preserveEntrySignatures: 'exports-only',
    },
  },
});
