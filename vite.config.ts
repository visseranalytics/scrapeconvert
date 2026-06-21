import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import Sitemap from 'vite-plugin-sitemap';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), tailwindcss(), Sitemap({
      hostname: 'https://scrapeconvert.com',
      dynamicRoutes: ['/', '/converter', '/scraper', '/terms', '/privacy', '/acceptable-use'],
      generateRobotsTxt: false,
    }), cloudflare()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      }
    },
    optimizeDeps: {
      exclude: ['@jsquash/jpeg', '@jsquash/png', '@jsquash/webp', '@jsquash/oxipng']
    }
  };
});