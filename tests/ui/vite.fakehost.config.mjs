// Builds the app against a fake RUN host (host-present UI) into $OUT. Used by tests/ui/ui.cjs.
import path from 'path';
import { fileURLToPath } from 'url';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../..');
export default {
  root: ROOT, base: './', plugins: [react(), tailwind()],
  resolve: { alias: { '@series-inc/rundot-game-sdk/api': path.join(HERE, 'fakehost.ts') } },
  build: { outDir: process.env.OUT || path.join(ROOT, 'node_modules/.cache/dist-fakehost'), emptyOutDir: true, target: 'esnext' },
  optimizeDeps: { esbuildOptions: { target: 'esnext' } },
};
