import { defineConfig } from 'vitest/config';

// Node pool: pure-logic modules (no cloudflare:workers, no connect()).
// WebCrypto is available on Node 20+ as the global `crypto`.
export default defineConfig({
  test: {
    name: 'node',
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup.node.ts'],
    include: ['src/lib/**/*.test.ts', 'src/server/token.test.ts', 'src/server/turnstile.test.ts'],
  },
});
