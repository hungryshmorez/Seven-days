// Builds the capture harness: npx vite build --config tests/capture/vite.config.mjs
import path from 'path';
import { fileURLToPath } from 'url';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../..');
export default {
  root: ROOT, base: '/', plugins: [react(), tailwind()],
  build: { outDir: process.env.OUT || path.join(ROOT, 'node_modules/.cache/dist-capture'), emptyOutDir: true, target: 'esnext',
    rollupOptions: { input: path.join(HERE, 'index.html') } },
};
