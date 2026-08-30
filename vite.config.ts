import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import aitDevtools from '@apps-in-toss/devtools/unplugin';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [aitDevtools.vite(), react()],
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  }
});
