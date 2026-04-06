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
    // Disable tree-shaking minification so all exports survive
    minify: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ...scriptEntries,
      },
      output: {
        // Keep script entry exports intact for ScriptRuntime dynamic loading
        manualChunks: undefined,
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name.startsWith('scripts/')) {
            return 'assets/[name]-[hash].js';
          }
          return 'assets/[name]-[hash].js';
        },
      },
      // Keep all exports from entry points — critical for ScriptRuntime
      preserveEntrySignatures: 'exports-only',
    },
  },
});
