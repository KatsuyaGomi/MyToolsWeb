import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare({ viteEnvironment: { name: 'worker' } })],
  server: { host: '127.0.0.1' },
});
