/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

// Cloudflare runtime bindings declared in wrangler.toml are read via
// `import { env } from 'cloudflare:workers'` in src/server/* (Phase 1).
// This file only needs the Astro client + generated types references.
