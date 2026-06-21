import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

// Workers pool: modules that use cloudflare:workers (env), connect() Sockets,
// KV, and the Astro API routes. Runs under workerd via miniflare.
export default defineWorkersConfig({
  test: {
    globals: true,
    include: [
      'src/server/proxy.resolve.test.ts',
      'src/server/proxy.fetch.test.ts',
      'src/server/turnstile.test.ts',
      'src/server/budgets.test.ts',
      'src/server/cache.test.ts',
      'src/pages/api/**/*.endpoint.test.ts',
    ],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          compatibilityFlags: ['nodejs_compat_v2'],
        },
      },
    },
  },
});
