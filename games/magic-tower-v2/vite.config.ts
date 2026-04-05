import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

// Collect all game scripts as separate entry points for production build.
const scriptsDir = path.resolve(__dirname, 'scripts');
const scriptEntries: Record<string, string> = {};
if (fs.existsSync(scriptsDir)) {
  for (const file of fs.readdirSync(scriptsDir)) {
    if (file.endsWith('.ts')) {
      const name = file.replace('.ts', '');
      scriptEntries[`scripts/${name}`] = path.resolve(scriptsDir, file);
    }
  }
}

export default defineConfig({
  resolve: {
    alias: {
      '@mote/engine': path.resolve(__dirname, '../packages/engine/src'),
    },
  },
  server: { port: 3002 },
  assetsInclude: ['**/*.wgsl'],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        ...scriptEntries,
      },
      output: {
        // Keep script chunk names predictable so ScriptRuntime can find them
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name.startsWith('scripts/')) {
            return '[name].js';
          }
          return 'assets/[name]-[hash].js';
        },
      },
      // Prevent Rollup from tree-shaking script entry points
      // Scripts export default classes consumed by ScriptRuntime at runtime
      preserveEntrySignatures: 'exports-only',
    },
  },
});
