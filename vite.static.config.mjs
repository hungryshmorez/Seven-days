// Plain static build: no RUN.world host needed. Output: dist-static/  (upload the folder anywhere).
import path from 'path';
import { fileURLToPath } from 'url';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
export default {
  root: ROOT, base: './', plugins: [react(), tailwind()],
  resolve: { alias: { '@series-inc/rundot-game-sdk/api': path.join(ROOT, 'src/static/sdkShim.ts') } },
  build: { outDir: path.join(ROOT, 'dist-static'), emptyOutDir: true, target: 'esnext' },
  optimizeDeps: { esbuildOptions: { target: 'esnext' } },
};
