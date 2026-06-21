// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// ScrapeConvert runs as a Cloudflare Worker in SSR mode.
// Bindings are read at runtime via `import { env } from 'cloudflare:workers'`
// (see src/server/* in later phases). WebCrypto only; nodejs_compat is NOT enabled.
// Tailwind v4 is wired through Vite (@tailwindcss/vite); design tokens live in
// src/styles/global.css (emerald accent + zinc neutral, matching design-mocks/).
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    imageService: 'passthrough',
  }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
  site: 'https://scrapeconvert.com',
});
