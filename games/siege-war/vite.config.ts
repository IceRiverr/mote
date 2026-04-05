import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync } from 'fs';

// Discover script entry points dynamically
const scriptDir = resolve(__dirname, 'scripts');
const scriptEntries: Record<string, string> = {};
try {
  for (const file of readdirSync(scriptDir)) {
    if (file.endsWith('.ts')) {
      const name = file.replace('.ts', '');
      scriptEntries[`scripts/${name}`] = resolve(scriptDir, file);
    }
  }
} catch {}

export default defineConfig({
  resolve: {
    alias: {
      '@mote/engine': resolve(__dirname, '../packages/engine/src'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ...scriptEntries,
      },
      output: {
        preserveEntrySignatures: 'exports-only',
      },
    },
  },
});
