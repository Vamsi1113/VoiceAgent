import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    preserveSymlinks: true,
    alias: {
      // pnpm virtual-store: React's scheduler must resolve from the shared store
      scheduler: path.resolve(__dirname, '../../node_modules/.pnpm/scheduler@0.23.2/node_modules/scheduler'),
    },
  },
  optimizeDeps: {
    // TalkingHead is loaded dynamically from /public — exclude it from pre-bundling
    exclude: ['talkinghead', 'headaudio'],
  },
  server: {
    port: 5173,
    proxy: {
      '/v1': 'http://localhost:3001',
      '/healthz': 'http://localhost:3001',
    },
  },
  build: {
    outDir: 'dist',
  },
});
