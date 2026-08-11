import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { designHarnessApiPlugin } from './server/vite-project-api.mjs';

export default defineConfig({
  plugins: [designHarnessApiPlugin(), react()],
  server: { port: 4173 },
  preview: { port: 4173 },
});
