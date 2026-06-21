import { defineConfig } from 'vitest/config';

// Node pool: pure-logic modules + React island components (jsdom per-file via the
// `// @vitest-environment jsdom` docblock). No cloudflare:workers, no connect().
// WebCrypto is available on Node 20+ as the global `crypto`.
export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    name: 'node',
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup.node.ts'],
    include: [
      'src/lib/**/*.test.ts',
      'src/server/token.test.ts',
      'src/server/turnstile.test.ts',
      'src/components/**/*.test.tsx',
    ],
  },
});
