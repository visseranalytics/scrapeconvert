import { defineConfig } from 'vitest/config';

// Workers pool: modules that use cloudflare:workers (env), connect() Sockets, KV,
// and the Astro API routes. Runs under workerd via miniflare.
//
// NOTE: @cloudflare/vitest-pool-workers 0.16 + Vitest 4 changed the integration
// (the old `defineWorkersConfig` helper and `test.poolOptions` are gone; the
// `pool` wiring differs). These tests must be run in a workerd-capable
// environment (local dev / CI), not the build sandbox. `npm test` runs the node
// pool only; `npm run test:workers` runs this once the integration is finalized
// against a real workerd. See docs/superpowers/plans for the Phase 1 task list.
export default defineConfig({
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
  },
});
