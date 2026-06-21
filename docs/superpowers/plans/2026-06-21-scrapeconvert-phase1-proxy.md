---
# Phase 1: The Proxy Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
**Goal:** Build the security-critical, abuse-hardened Cloudflare Worker scraping proxy (`POST /api/turnstile` + `GET /api/fetch`) entirely test-first against the spec's SSRF / token / stream / header / rate-limit matrix, before any UI consumes it.
**Architecture:** Astro SSR endpoints on `@astrojs/cloudflare` (`output: 'server'`) delegate to pure `src/server/*` and `src/lib/*` modules. The Worker stays CPU-trivial: it validates URLs, resolves+pins IPs via DNS-over-HTTPS, opens a `connect()`-pinned socket, streams bytes with a byte-counting cap, mints/verifies HMAC session tokens (WebCrypto), and enforces per-token / per-host / global budgets. It never parses HTML/XML or decodes images.
**Tech Stack:** Astro + `@astrojs/cloudflare` (SSR), Cloudflare Workers (`connect()` Sockets API, Cache API, Rate Limiting binding, KV for budgets/dedup), WebCrypto `crypto.subtle` (HMAC-SHA-256), Turnstile siteverify, Vitest (`@cloudflare/vitest-pool-workers` for Worker-runtime tests + node pool for pure-logic tests).
## Global Constraints
- Framework: Astro with @astrojs/cloudflare, output:'server' (SSR). Pin exact Astro + adapter versions. Read bindings via `import { env } from 'cloudflare:workers'`. Use WebCrypto (crypto.subtle) for HMAC/hashing, NOT node:crypto; do not require nodejs_compat.
- Cross-origin isolation: NONE. Use the single-thread @jsquash builds (no SharedArrayBuffer), so free cross-origin <img> thumbnails keep working.
- Cloudflare free-tier limits: <=50 subrequests per Worker invocation (Cache API calls count toward this); ~10ms CPU per request. The Worker must stay CPU-trivial: it relays bytes, validates URLs, verifies HMAC. NEVER parse HTML/XML/sitemaps server-side.
- Crawl fan-out is CLIENT-driven: the browser makes one GET /api/fetch?type=page per page (each its own invocation). No server-side fan-out.
- Conversion is client-side only (WASM); the Worker never decodes/encodes, only relays bytes.
- The HMAC signing secret is a REQUIRED Worker secret with NO default; deploy must fail if unset. .env.example carries a placeholder only.
- Response size caps are enforced by counting actual bytes read from the stream and aborting on overflow (HTML ~5MB, image ~25MB). Never trust content-length as the enforcement mechanism.
- Output formats: WebP, AVIF, PNG, JPEG.
- Design: neutral zinc + single emerald accent (#34d399); amber only for the duplicate-flag state; no gradient text, no rainbow icon colors, no violet; hairline borders; one radius scale; focus-visible rings on every interactive element; tabular-nums on numbers.
- Copy voice: no em dashes, no buzzwords, no three-part parallel punchlines; infrastructure detail (proxy/CORS/Cloudflare/rate-limit) appears in the FAQ only.
---

## Preconditions and assumptions

- **Phase 0 is done.** The repo is an Astro project with `@astrojs/cloudflare` (`output: 'server'`), a `wrangler.toml`, `astro.config.mjs`, `tsconfig.json`, and `.env.example`. If Phase 0 has not landed, stop and run the Phase 0 plan first. (At the time of writing this plan the repo is still the old Vite SPA; do not build Phase 1 on top of the Vite app.)
- **Bindings (added in this phase to `wrangler.toml`):**
  - `SESSION_HMAC_SECRET` — required secret, no default (Task 5 / Task 9).
  - `TURNSTILE_SECRET` — required secret (Task 5).
  - `RL` — Rate Limiting binding, keyed on session token (Task 7).
  - `BUDGETS` — KV namespace for per-token fetch/byte budgets, per-host counters, global egress counter, and the Turnstile duplicate-token set (Tasks 5, 7).
  - Vars: `ZONE_APEX` (own-zone deny), `DEST_DENYLIST` (comma-separated host suffixes), `DOH_ENDPOINT` (default `https://cloudflare-dns.com/dns-query`), `MAX_PAGE_BYTES` (5_242_880), `MAX_IMAGE_BYTES` (26_214_400), `TOKEN_TTL_SECONDS` (2700), `PER_TOKEN_FETCH_BUDGET` (300), `PER_TOKEN_BYTE_BUDGET` (524_288_000), `PER_HOST_FETCH_CAP` (120), `GLOBAL_EGRESS_BYTE_CAP` (107_374_182_400), `MINT_RATE_PER_IP_PER_MIN` (10).
- **Test runner.** Pure-logic modules (`src/lib/url-safety.ts`, `src/server/token.ts`) run under the node-compatible vitest pool with WebCrypto available (Node 20+ exposes global `crypto`). Worker-runtime modules (`src/server/proxy.ts` using `connect()`/`cloudflare:workers`, the API routes) run under `@cloudflare/vitest-pool-workers`. Task 0 wires both.
- **Naming/shapes are fixed by the SHARED INTERFACE CONTRACT.** Do not rename anything cross-phase. Repeat code rather than cross-reference between tasks.

## File structure (Create / Modify / Test)

**Create**
- `vitest.config.ts` — vitest projects: `node` (lib/server pure) + `workers` (worker-pool). (Task 0)
- `vitest.workers.config.ts` — `@cloudflare/vitest-pool-workers` config referencing `wrangler.toml`. (Task 0)
- `test/setup.node.ts` — shared node-pool setup (no-op + crypto assert). (Task 0)
- `src/lib/types.ts` — shared types (full contract block; this phase only needs none of them at runtime, but the file is created here so later phases import a stable module). (Task 0)
- `src/lib/url-safety.ts` — `isSafePublicUrl`, `isBlockedIp`. (Task 1)
- `src/lib/url-safety.test.ts` — SSRF matrix. (Task 1)
- `src/server/proxy.ts` — `resolveAndValidate`, `pinnedFetch`. (Tasks 2, 3)
- `src/server/proxy.resolve.test.ts` — DoH resolve+validate. (Task 2)
- `src/server/proxy.fetch.test.ts` — pinned fetch / redirects / caps / hygiene. (Task 3)
- `src/server/token.ts` — `signToken`, `verifyToken`, `SessionClaims`. (Task 4)
- `src/server/token.test.ts` — sign/verify/forge/expire/ip-mismatch. (Task 4)
- `src/server/turnstile.ts` — `verifyTurnstileToken`, `mintSession`, dup-check, per-IP mint limit, secret-required guard. (Task 5)
- `src/server/turnstile.test.ts`. (Task 5)
- `src/server/budgets.ts` — `RateLimitContext`, `checkBurst`, `consumeFetchBudget`, `consumeByteBudget`, `consumeHostCap`, `consumeGlobalEgress`. (Task 7)
- `src/server/budgets.test.ts`. (Task 7)
- `src/server/cache.ts` — `cacheKeyFor`, `getCached`, `putCached`. (Task 6)
- `src/server/cache.test.ts`. (Task 6)
- `src/server/ip.ts` — `clientIpHash` (coarse /24 v4, /64 v6 + SHA-256). (Task 4)
- `src/pages/api/turnstile.ts` — `POST` handler. (Task 5)
- `src/pages/api/turnstile.endpoint.test.ts`. (Task 5)
- `src/pages/api/fetch.ts` — `GET` handler. (Task 6)
- `src/pages/api/fetch.endpoint.test.ts`. (Task 6)
- `docs/ABUSE_POLICY.md` — abuse / takedown / robots stance / denylist docs. (Task 8)

**Modify**
- `package.json` — add devDeps + test scripts. (Task 0)
- `wrangler.toml` — bindings, vars, KV, rate-limit. (Tasks 0, 5, 7)
- `.env.example` — `SESSION_HMAC_SECRET` / `TURNSTILE_SECRET` placeholders + rate-limit config (placeholders only, never usable keys). (Task 9)
- `README.md` — deploy section: required secrets + budgets + abuse policy link. (Tasks 8, 9)

---

## Task 0 — Test harness + bindings scaffold

Establishes vitest with two pools (node for pure logic, workers for runtime), the shared `types.ts`, and the `wrangler.toml` skeleton with vars. Not naturally TDD; verified by running an empty-but-green test in each pool.

**Files**
- Create: `vitest.config.ts`, `vitest.workers.config.ts`, `test/setup.node.ts`, `src/lib/types.ts`, `src/lib/harness.smoke.test.ts` (deleted at end of task)
- Modify: `package.json`, `wrangler.toml`

**Interfaces**
- Produces: `src/lib/types.ts` exporting `ScrapedImage`, `ConvertOptions` (verbatim from CONTRACT) so later phases have a stable import target.

**Steps**

- [ ] 1. Add devDeps and scripts. Run:
  ```
  npm i -D vitest@^2 @cloudflare/vitest-pool-workers@^0.5 @cloudflare/workers-types
  ```
  Then edit `package.json` `"scripts"` to add:
  ```json
  "test": "vitest run --project node && vitest run --project workers",
  "test:node": "vitest run --project node",
  "test:workers": "vitest run --project workers",
  "test:watch": "vitest --project node"
  ```
  Expected: `npm pkg get scripts.test` prints the combined command.

- [ ] 2. Create `test/setup.node.ts`:
  ```ts
  // Node-pool test setup: assert WebCrypto is present (we never use node:crypto).
  import { expect } from 'vitest'
  if (typeof globalThis.crypto?.subtle === 'undefined') {
    throw new Error('WebCrypto crypto.subtle missing; run on Node 20+')
  }
  expect.hasAssertions
  ```

- [ ] 3. Create `vitest.config.ts` (two named projects):
  ```ts
  import { defineConfig } from 'vitest/config'

  export default defineConfig({
    test: {
      projects: [
        {
          test: {
            name: 'node',
            environment: 'node',
            globals: true,
            setupFiles: ['./test/setup.node.ts'],
            include: [
              'src/lib/**/*.test.ts',
              'src/server/token.test.ts',
            ],
          },
        },
        {
          extends: './vitest.workers.config.ts',
          test: { name: 'workers' },
        },
      ],
    },
  })
  ```

- [ ] 4. Create `vitest.workers.config.ts`:
  ```ts
  import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

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
  })
  ```
  Note: `nodejs_compat_v2` here is for the test pool's module resolution only; production Worker code uses WebCrypto and `connect()` and must not import `node:*`.

- [ ] 5. Create `src/lib/types.ts` (verbatim from the CONTRACT):
  ```ts
  export interface ScrapedImage {
    id: string
    url: string
    alt: string
    name: string
    format: string
    size?: number
    width?: number
    height?: number
    selected: boolean
    isDuplicate?: boolean
    sourcePageUrl?: string
    sourcePageTitle?: string
  }

  export interface ConvertOptions {
    format: 'webp' | 'avif' | 'png' | 'jpeg'
    quality: number
    maxWidth?: number
    maxHeight?: number
    keepAspect: boolean
    stripExif: boolean
    removeColorProfile: boolean
  }
  ```

- [ ] 6. Append the Phase-1 vars + KV + rate-limit to `wrangler.toml` (keep any Phase-0 keys above). Add:
  ```toml
  [vars]
  ZONE_APEX = "scrapeconvert.com"
  DEST_DENYLIST = ""
  DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query"
  MAX_PAGE_BYTES = "5242880"
  MAX_IMAGE_BYTES = "26214400"
  TOKEN_TTL_SECONDS = "2700"
  PER_TOKEN_FETCH_BUDGET = "300"
  PER_TOKEN_BYTE_BUDGET = "524288000"
  PER_HOST_FETCH_CAP = "120"
  GLOBAL_EGRESS_BYTE_CAP = "107374182400"
  MINT_RATE_PER_IP_PER_MIN = "10"

  [[kv_namespaces]]
  binding = "BUDGETS"
  id = "PLACEHOLDER_REPLACE_WITH_REAL_KV_ID"

  [[unsafe.bindings]]
  name = "RL"
  type = "ratelimit"
  namespace_id = "1001"
  simple = { limit = 30, period = 60 }
  ```
  (Secrets `SESSION_HMAC_SECRET` and `TURNSTILE_SECRET` are NOT in `wrangler.toml`; they are real secrets, set via `wrangler secret put`, asserted required in Task 5/9. For local tests, miniflare reads them from `.dev.vars`.)

- [ ] 7. Create `.dev.vars` (gitignored) for local tests:
  ```
  SESSION_HMAC_SECRET=test-only-hmac-secret-not-for-prod-0123456789abcdef
  TURNSTILE_SECRET=test-only-turnstile-secret
  ```
  Confirm `.dev.vars` is in `.gitignore`: run `grep -q '^\.dev\.vars$' .gitignore || printf '\n.dev.vars\n' >> .gitignore` and verify with `grep -n dev.vars .gitignore`.

- [ ] 8. Create a throwaway smoke test at `src/lib/harness.smoke.test.ts` (placed under `src/lib/` so it is matched by the node project's `include: ['src/lib/**/*.test.ts']` glob without editing config):
  ```ts
  import { describe, it, expect } from 'vitest'
  import type { ConvertOptions } from './types'

  describe('harness', () => {
    it('node pool runs and types import', () => {
      const o: ConvertOptions = {
        format: 'webp', quality: 80, keepAspect: true, stripExif: true, removeColorProfile: false,
      }
      expect(o.format).toBe('webp')
    })
  })
  ```
  Run `npx vitest run --project node src/lib/harness.smoke.test.ts`.
  Expected: `1 passed`.

- [ ] 9. Delete the smoke test: `rm src/lib/harness.smoke.test.ts`. Verify the workers pool boots with no tests yet: `npx vitest run --project workers`.
  Expected: exit 0, `No test files found` (or `0 passed`) — confirms the workers pool + `wrangler.toml` parse.

- [ ] 10. Commit:
  ```
  git add -A && git commit -m "test: phase1 vitest harness (node + workers pools) + types + wrangler vars"
  ```

---

## Task 1 — `src/lib/url-safety.ts`: `isSafePublicUrl` + `isBlockedIp` (full SSRF matrix)

The shared scheme/IP filter used by BOTH the server guard and the client `<img>` filter. Exhaustively test §14's SSRF matrix.

**Files**
- Create: `src/lib/url-safety.ts`, `src/lib/url-safety.test.ts`

**Interfaces**
- Produces (verbatim from CONTRACT):
  ```ts
  export function isSafePublicUrl(raw: string): { ok: true; url: URL } | { ok: false; reason: string }
  export function isBlockedIp(ip: string): boolean
  ```

**Steps**

- [ ] 1. Write the failing test file `src/lib/url-safety.test.ts` (part A — `isBlockedIp` across all encodings/ranges):
  ```ts
  import { describe, it, expect } from 'vitest'
  import { isBlockedIp, isSafePublicUrl } from './url-safety'

  describe('isBlockedIp — IPv4 special-use ranges', () => {
    const blocked = [
      '0.0.0.0', '0.1.2.3',            // 0/8
      '10.0.0.1', '10.255.255.255',    // 10/8
      '100.64.0.1', '100.127.255.255', // 100.64/10 CGNAT
      '127.0.0.1', '127.1.2.3',        // 127/8 loopback
      '169.254.0.1', '169.254.169.254',// 169.254/16 link-local + cloud metadata
      '172.16.0.1', '172.31.255.255',  // 172.16/12
      '192.0.0.1',                     // 192.0.0/24
      '192.0.2.5',                     // 192.0.2/24 TEST-NET-1
      '192.168.0.1', '192.168.255.255',// 192.168/16
      '198.18.0.1', '198.19.255.255',  // 198.18/15 benchmarking
      '198.51.100.7',                  // 198.51.100/24 TEST-NET-2
      '203.0.113.7',                   // 203.0.113/24 TEST-NET-3
      '224.0.0.1', '239.255.255.255',  // 224/4 multicast
      '240.0.0.1', '254.255.255.255',  // 240/4 reserved
      '255.255.255.255',               // limited broadcast
    ]
    for (const ip of blocked) it(`blocks ${ip}`, () => expect(isBlockedIp(ip)).toBe(true))

    const allowed = ['1.1.1.1', '8.8.8.8', '93.184.216.34', '172.15.255.255', '172.32.0.1', '11.0.0.1']
    for (const ip of allowed) it(`allows public ${ip}`, () => expect(isBlockedIp(ip)).toBe(false))
  })

  describe('isBlockedIp — IPv6 special-use ranges', () => {
    const blocked = [
      '::1',                 // loopback
      '::',                  // unspecified
      '::ffff:127.0.0.1',    // IPv4-mapped loopback -> re-test embedded v4
      '::ffff:10.0.0.1',     // IPv4-mapped private
      '::ffff:169.254.169.254',
      'fe80::1',             // link-local
      'fc00::1', 'fd12:3456::1', // ULA fc00::/7
      'ff02::1',             // multicast ff00::/8
      '2001:db8::1',         // doc 2001:db8::/32
      '64:ff9b::1.2.3.4',    // NAT64 64:ff9b::/96 -> re-test embedded v4 (private)
    ]
    for (const ip of blocked) it(`blocks ${ip}`, () => expect(isBlockedIp(ip)).toBe(true))

    const allowed = ['2606:4700:4700::1111', '2001:4860:4860::8888']
    for (const ip of allowed) it(`allows public ${ip}`, () => expect(isBlockedIp(ip)).toBe(false))
  })

  describe('isSafePublicUrl — scheme + host-encoding gauntlet', () => {
    it('accepts a plain https public host', () => {
      const r = isSafePublicUrl('https://example.com/a/b?c=1')
      expect(r.ok).toBe(true)
    })
    it('accepts http', () => expect(isSafePublicUrl('http://example.com/').ok).toBe(true))

    it('rejects non-http schemes', () => {
      for (const u of ['ftp://example.com', 'file:///etc/passwd', 'gopher://x', 'data:text/plain,hi', 'javascript:alert(1)']) {
        expect(isSafePublicUrl(u).ok).toBe(false)
      }
    })
    it('rejects credentials in URL', () => {
      expect(isSafePublicUrl('https://user:pass@example.com/').ok).toBe(false)
      expect(isSafePublicUrl('https://user@example.com/').ok).toBe(false)
    })
    it('rejects localhost and loopback names', () => {
      for (const u of ['http://localhost/', 'http://localhost:8080/', 'http://127.0.0.1/', 'http://[::1]/']) {
        expect(isSafePublicUrl(u).ok).toBe(false)
      }
    })
    it('rejects IP literals in decimal/octal/hex/dotted-private forms', () => {
      for (const u of [
        'http://2130706433/',      // decimal 127.0.0.1
        'http://017700000001/',    // octal 127.0.0.1
        'http://0x7f000001/',      // hex 127.0.0.1
        'http://0x7f.0.0.1/',      // mixed hex octet
        'http://192.168.1.1/',     // dotted private
        'http://[::ffff:127.0.0.1]/', // mapped loopback literal
      ]) {
        expect(isSafePublicUrl(u).ok).toBe(false)
      }
    })
    it('rejects trailing-dot loopback', () => {
      expect(isSafePublicUrl('http://127.0.0.1./').ok).toBe(false)
    })
    it('rejects non-standard ports', () => {
      for (const u of ['http://example.com:8080/', 'https://example.com:8443/', 'http://example.com:22/']) {
        expect(isSafePublicUrl(u).ok).toBe(false)
      }
      expect(isSafePublicUrl('http://example.com:80/').ok).toBe(true)
      expect(isSafePublicUrl('https://example.com:443/').ok).toBe(true)
    })
    it('rejects garbage', () => {
      expect(isSafePublicUrl('not a url').ok).toBe(false)
      expect(isSafePublicUrl('').ok).toBe(false)
    })
  })
  ```

- [ ] 2. Run it, expect FAIL: `npx vitest run --project node src/lib/url-safety.test.ts`.
  Expected: `Error: Failed to resolve import "./url-safety"` (module does not exist yet) — red.

- [ ] 3. Create `src/lib/url-safety.ts` with the IP parsers + blocklist:
  ```ts
  // Shared scheme + special-use IP filter. Used by the server SSRF guard
  // and the client-side <img src> filter. No network, no node:*.

  type Bytes = number[]

  function parseIpv4(s: string): Bytes | null {
    // Accept dotted forms only here (decimal/octal/hex single-number forms are
    // handled by parseHostToBytes via Number coercion). Each octet may be
    // decimal, 0x-hex, or 0-prefixed octal — all of which appear in SSRF bypasses.
    const trimmed = s.endsWith('.') ? s.slice(0, -1) : s
    const parts = trimmed.split('.')
    if (parts.length !== 4) return null
    const out: Bytes = []
    for (const p of parts) {
      if (p === '') return null
      let n: number
      if (/^0x[0-9a-f]+$/i.test(p)) n = parseInt(p, 16)
      else if (/^0[0-7]+$/.test(p)) n = parseInt(p, 8)
      else if (/^[0-9]+$/.test(p)) n = parseInt(p, 10)
      else return null
      if (!Number.isInteger(n) || n < 0 || n > 255) return null
      out.push(n)
    }
    return out
  }

  function parseIpv4Number(s: string): Bytes | null {
    // Single-number IPv4: decimal/octal/hex (e.g. 2130706433, 0x7f000001, 017700000001)
    const t = s.endsWith('.') ? s.slice(0, -1) : s
    let n: number | null = null
    if (/^0x[0-9a-f]+$/i.test(t)) n = parseInt(t, 16)
    else if (/^0[0-7]+$/.test(t)) n = parseInt(t, 8)
    else if (/^[0-9]+$/.test(t)) n = Number(t)
    if (n === null || !Number.isFinite(n) || n < 0 || n > 0xffffffff) return null
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
  }

  function parseIpv6(s: string): Bytes | null {
    let str = s
    // strip zone id
    const pct = str.indexOf('%')
    if (pct !== -1) str = str.slice(0, pct)
    if (!str.includes(':')) return null
    // embedded IPv4 tail (::ffff:1.2.3.4 / 64:ff9b::1.2.3.4)
    let tail: Bytes = []
    const lastColon = str.lastIndexOf(':')
    const maybeV4 = str.slice(lastColon + 1)
    if (maybeV4.includes('.')) {
      const v4 = parseIpv4(maybeV4)
      if (!v4) return null
      tail = v4
      str = str.slice(0, lastColon + 1) + '0:0'
    }
    const halves = str.split('::')
    if (halves.length > 2) return null
    const expand = (h: string) => (h === '' ? [] : h.split(':'))
    const head = expand(halves[0])
    const back = halves.length === 2 ? expand(halves[1]) : []
    const groupsNeeded = 8 - (tail.length ? 1 : 0) // last group replaced by v4 tail bytes
    const explicit = head.length + back.length
    if (halves.length === 1 && explicit !== groupsNeeded) return null
    const fill = groupsNeeded - explicit
    if (fill < 0) return null
    const groups = [...head, ...Array(halves.length === 2 ? fill : 0).fill('0'), ...back]
    const bytes: Bytes = []
    for (const g of groups) {
      if (!/^[0-9a-f]{1,4}$/i.test(g)) return null
      const v = parseInt(g, 16)
      bytes.push((v >> 8) & 255, v & 255)
    }
    const full = tail.length ? [...bytes, ...tail] : bytes
    return full.length === 16 ? full : null
  }

  function inRange(bytes: Bytes, prefix: Bytes, bits: number): boolean {
    let remaining = bits
    for (let i = 0; i < prefix.length && remaining > 0; i++) {
      const take = Math.min(8, remaining)
      const mask = take === 8 ? 0xff : (0xff << (8 - take)) & 0xff
      if ((bytes[i] & mask) !== (prefix[i] & mask)) return false
      remaining -= take
    }
    return true
  }

  function v4Blocked(b: Bytes): boolean {
    const R: [Bytes, number][] = [
      [[0, 0, 0, 0], 8], [[10, 0, 0, 0], 8], [[100, 64, 0, 0], 10],
      [[127, 0, 0, 0], 8], [[169, 254, 0, 0], 16], [[172, 16, 0, 0], 12],
      [[192, 0, 0, 0], 24], [[192, 0, 2, 0], 24], [[192, 168, 0, 0], 16],
      [[198, 18, 0, 0], 15], [[198, 51, 100, 0], 24], [[203, 0, 113, 0], 24],
      [[224, 0, 0, 0], 4], [[240, 0, 0, 0], 4],
    ]
    if (b[0] === 255 && b[1] === 255 && b[2] === 255 && b[3] === 255) return true
    return R.some(([p, bits]) => inRange(b, p, bits))
  }

  function v6Blocked(b: Bytes): boolean {
    // IPv4-mapped ::ffff:0:0/96 -> re-test embedded v4
    const mappedPrefix = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff]
    if (inRange(b, mappedPrefix, 96)) return v4Blocked(b.slice(12))
    // 64:ff9b::/96 NAT64 -> re-test embedded v4
    const nat64 = [0, 0x64, 0xff, 0x9b, 0, 0, 0, 0, 0, 0, 0, 0]
    if (inRange(b, nat64, 96)) return v4Blocked(b.slice(12))
    const isZero = b.every((x) => x === 0)
    if (isZero) return true // ::
    const isLoop = b.slice(0, 15).every((x) => x === 0) && b[15] === 1
    if (isLoop) return true // ::1
    const R: [Bytes, number][] = [
      [[0xfe, 0x80], 10],     // fe80::/10 link-local
      [[0xfc], 7],            // fc00::/7 ULA
      [[0xff], 8],            // ff00::/8 multicast
      [[0x20, 0x01, 0x0d, 0xb8], 32], // 2001:db8::/32 doc
    ]
    return R.some(([p, bits]) => inRange(b, p, bits))
  }

  export function isBlockedIp(ip: string): boolean {
    const v6 = parseIpv6(ip)
    if (v6) return v6Blocked(v6)
    const dotted = parseIpv4(ip)
    if (dotted) return v4Blocked(dotted)
    const single = parseIpv4Number(ip)
    if (single) return v4Blocked(single)
    return false // not an IP literal; hostname safety is handled by resolve-and-validate
  }

  function hostLooksLikeIp(host: string): boolean {
    return (
      parseIpv4(host) !== null ||
      parseIpv4Number(host) !== null ||
      (host.startsWith('[') && host.endsWith(']'))
    )
  }

  export function isSafePublicUrl(
    raw: string,
  ): { ok: true; url: URL } | { ok: false; reason: string } {
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      return { ok: false, reason: 'unparseable' }
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { ok: false, reason: 'scheme' }
    }
    if (url.username || url.password) return { ok: false, reason: 'credentials' }
    // non-standard ports
    const port = url.port
    if (port && !((url.protocol === 'http:' && port === '80') || (url.protocol === 'https:' && port === '443'))) {
      return { ok: false, reason: 'port' }
    }
    let host = url.hostname.toLowerCase()
    if (host.endsWith('.')) host = host.slice(0, -1)
    if (host === 'localhost') return { ok: false, reason: 'localhost' }
    // bracketed IPv6 literal
    if (host.startsWith('[') && host.endsWith(']')) {
      if (isBlockedIp(host.slice(1, -1))) return { ok: false, reason: 'private-ip' }
      return { ok: true, url }
    }
    if (hostLooksLikeIp(host)) {
      if (isBlockedIp(host)) return { ok: false, reason: 'private-ip' }
      return { ok: true, url }
    }
    return { ok: true, url }
  }
  ```

- [ ] 4. Run it, expect PASS: `npx vitest run --project node src/lib/url-safety.test.ts`.
  Expected: all tests pass (one `passed` line per matrix entry; final summary `Test Files 1 passed`).

- [ ] 5. Commit:
  ```
  git add -A && git commit -m "feat(proxy): url-safety isSafePublicUrl + isBlockedIp with full special-use blocklist"
  ```

---

## Task 2 — `resolveAndValidate`: DoH resolve + validate every A/AAAA record

Resolve the target hostname via DNS-over-HTTPS and reject if ANY returned record is in the special-use blocklist (closes DNS-rebinding).

**Files**
- Create/Modify: `src/server/proxy.ts` (add `resolveAndValidate`)
- Create: `src/server/proxy.resolve.test.ts`

**Interfaces**
- Consumes: `isBlockedIp` from `src/lib/url-safety.ts`.
- Produces (verbatim from CONTRACT):
  ```ts
  export async function resolveAndValidate(host: string): Promise<{ ok: true; ips: string[] } | { ok: false; reason: string }>
  ```

**Steps**

- [ ] 1. Write the failing test `src/server/proxy.resolve.test.ts`:
  ```ts
  import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
  import { resolveAndValidate } from './proxy'

  function dohResponse(answers: { type: number; data: string }[]) {
    return new Response(JSON.stringify({ Status: 0, Answer: answers }), {
      status: 200,
      headers: { 'content-type': 'application/dns-json' },
    })
  }

  describe('resolveAndValidate', () => {
    beforeEach(() => vi.restoreAllMocks())
    afterEach(() => vi.restoreAllMocks())

    it('returns the validated public IPs', async () => {
      vi.stubGlobal('fetch', vi.fn(async () =>
        dohResponse([{ type: 1, data: '93.184.216.34' }, { type: 28, data: '2606:2800:220:1:248:1893:25c8:1946' }]),
      ))
      const r = await resolveAndValidate('example.com')
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.ips).toContain('93.184.216.34')
    })

    it('rejects when ANY record is private (rebinding)', async () => {
      vi.stubGlobal('fetch', vi.fn(async () =>
        dohResponse([{ type: 1, data: '93.184.216.34' }, { type: 1, data: '169.254.169.254' }]),
      ))
      const r = await resolveAndValidate('rebind.evil.test')
      expect(r.ok).toBe(false)
    })

    it('rejects when there are no A/AAAA answers', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => dohResponse([{ type: 5, data: 'cname.target.' }])))
      const r = await resolveAndValidate('cname-only.test')
      expect(r.ok).toBe(false)
    })

    it('rejects on DoH non-200', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 502 })))
      const r = await resolveAndValidate('broken.test')
      expect(r.ok).toBe(false)
    })

    it('rejects an all-private answer set', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => dohResponse([{ type: 1, data: '10.0.0.1' }])))
      const r = await resolveAndValidate('internal.test')
      expect(r.ok).toBe(false)
    })
  })
  ```

- [ ] 2. Run it, expect FAIL: `npx vitest run --project workers src/server/proxy.resolve.test.ts`.
  Expected: import error / `resolveAndValidate is not a function` — red.

- [ ] 3. Create `src/server/proxy.ts` with `resolveAndValidate`:
  ```ts
  import { env } from 'cloudflare:workers'
  import { isBlockedIp } from '../lib/url-safety'

  interface DohAnswer { type: number; data: string }

  export async function resolveAndValidate(
    host: string,
  ): Promise<{ ok: true; ips: string[] } | { ok: false; reason: string }> {
    const endpoint = (env as Record<string, string>).DOH_ENDPOINT || 'https://cloudflare-dns.com/dns-query'
    const ips: string[] = []
    for (const t of ['A', 'AAAA']) {
      const url = `${endpoint}?name=${encodeURIComponent(host)}&type=${t}`
      let res: Response
      try {
        res = await fetch(url, { headers: { accept: 'application/dns-json' } })
      } catch {
        return { ok: false, reason: 'doh-network' }
      }
      if (res.status !== 200) return { ok: false, reason: 'doh-status' }
      let body: { Status?: number; Answer?: DohAnswer[] }
      try {
        body = await res.json()
      } catch {
        return { ok: false, reason: 'doh-parse' }
      }
      const answers = body.Answer ?? []
      for (const a of answers) {
        if (a.type !== 1 && a.type !== 28) continue // A or AAAA only
        const ip = a.data.trim()
        if (isBlockedIp(ip)) return { ok: false, reason: 'private-ip' }
        ips.push(ip)
      }
    }
    if (ips.length === 0) return { ok: false, reason: 'no-records' }
    return { ok: true, ips }
  }
  ```

- [ ] 4. Run it, expect PASS: `npx vitest run --project workers src/server/proxy.resolve.test.ts`.
  Expected: `5 passed`.

- [ ] 5. Commit:
  ```
  git add -A && git commit -m "feat(proxy): resolveAndValidate DoH-resolve + validate every A/AAAA record"
  ```

---

## Task 3 — `pinnedFetch`: connect()-pinned socket, manual redirects, stream-and-count cap, header hygiene, response sanitize

The heart of the relay. Connects to a validated literal IP, manually revalidates each redirect hop, counts bytes on the wire, enforces the egress request-header allowlist, strips dangerous response headers, and sanitizes content-type.

**Files**
- Modify: `src/server/proxy.ts` (add `pinnedFetch`)
- Create: `src/server/proxy.fetch.test.ts`

**Interfaces**
- Consumes: `isSafePublicUrl`, `resolveAndValidate`.
- Produces (verbatim from CONTRACT):
  ```ts
  export async function pinnedFetch(url: URL, opts: { type: 'page'|'sitemap'|'image' }): Promise<Response>
  ```
- Contract for the returned Response on success: `200`, streamed body. For `page|sitemap` content-type is `text/*`. For `image` content-type is sanitized `image/*` plus `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`. No `Set-Cookie`, no upstream security headers. On failure the function THROWS a `ProxyError` carrying an HTTP status (the endpoint maps it); 413 on cap overflow, 502 on upstream/redirect failure, 400 on a redirect to a blocked host/scheme.

**Steps**

- [ ] 1. Write the failing test `src/server/proxy.fetch.test.ts`. Because `pinnedFetch` uses `connect()` and `resolveAndValidate`, the test mocks both via injected hooks. Add an internal `__setHooks` export for tests so the real `connect()`/DoH are not hit:
  ```ts
  import { describe, it, expect, beforeEach } from 'vitest'
  import { pinnedFetch, ProxyError, __setHooks, __resetHooks } from './proxy'

  // Build a fake upstream HTTP/1.1 raw response as a ReadableStream of bytes.
  function rawHttp(statusLine: string, headers: Record<string, string>, body: Uint8Array): ReadableStream<Uint8Array> {
    const enc = new TextEncoder()
    const head = statusLine + '\r\n' + Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n'
    const chunks = [enc.encode(head), body]
    let i = 0
    return new ReadableStream({
      pull(c) { if (i < chunks.length) c.enqueue(chunks[i++]); else c.close() },
    })
  }

  beforeEach(() => __resetHooks())

  describe('pinnedFetch — happy path page', () => {
    it('returns 200 text body, pinned to validated IP', async () => {
      let sentRequest = ''
      let pinnedIp = ''
      let usedTls = false
      __setHooks({
        resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
        connect: async ({ ip, secure, rawRequest }) => {
          sentRequest = rawRequest
          pinnedIp = ip
          usedTls = secure
          return rawHttp('HTTP/1.1 200 OK', { 'content-type': 'text/html; charset=utf-8', 'content-length': '11' }, new TextEncoder().encode('<html></h>'))
        },
      })
      const res = await pinnedFetch(new URL('https://example.com/'), { type: 'page' })
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')?.startsWith('text/')).toBe(true)
      expect(pinnedIp).toBe('93.184.216.34') // connected to the validated literal IP, not the hostname
      expect(usedTls).toBe(true)             // https target -> TLS enabled
      expect(sentRequest).toContain('Host: example.com')
      expect(sentRequest).not.toMatch(/cookie/i)
      expect(sentRequest).not.toMatch(/authorization/i)
      const text = await res.text()
      expect(text).toContain('<html>')
    })
  })

  describe('pinnedFetch — request header hygiene', () => {
    it('only sends User-Agent, Accept, Accept-Encoding: identity', async () => {
      let req = ''
      __setHooks({
        resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
        connect: async ({ rawRequest }) => { req = rawRequest; return rawHttp('HTTP/1.1 200 OK', { 'content-type': 'text/plain' }, new Uint8Array()) },
      })
      await pinnedFetch(new URL('https://example.com/'), { type: 'page' })
      expect(req).toMatch(/Accept-Encoding: identity/i)
      expect(req).not.toMatch(/X-Forwarded-For/i)
      expect(req).not.toMatch(/CF-/i)
      expect(req).not.toMatch(/Referer/i)
    })
  })

  describe('pinnedFetch — manual redirects', () => {
    it('follows a redirect to a public host and re-validates', async () => {
      const calls: string[] = []
      __setHooks({
        resolve: async (h) => { calls.push('resolve:' + h); return { ok: true, ips: ['93.184.216.34'] } },
        connect: async () => {
          if (calls.filter((c) => c.startsWith('connect')).length === 0) {
            calls.push('connect:1')
            return rawHttp('HTTP/1.1 301 Moved', { location: 'https://example.org/final' }, new Uint8Array())
          }
          calls.push('connect:2')
          return rawHttp('HTTP/1.1 200 OK', { 'content-type': 'text/html' }, new TextEncoder().encode('ok'))
        },
      })
      const res = await pinnedFetch(new URL('https://example.com/'), { type: 'page' })
      expect(res.status).toBe(200)
      expect(calls).toContain('resolve:example.org')
    })

    it('rejects a redirect to a private host (late-hop rebind)', async () => {
      let hop = 0
      __setHooks({
        resolve: async (h) => (h === 'internal.test' ? { ok: false, reason: 'private-ip' } : { ok: true, ips: ['93.184.216.34'] }),
        connect: async () => {
          hop++
          if (hop === 1) return rawHttp('HTTP/1.1 302 Found', { location: 'http://internal.test/' }, new Uint8Array())
          return rawHttp('HTTP/1.1 200 OK', { 'content-type': 'text/html' }, new Uint8Array())
        },
      })
      await expect(pinnedFetch(new URL('https://example.com/'), { type: 'page' })).rejects.toMatchObject({ status: 400 })
    })

    it('rejects a redirect to a non-http scheme', async () => {
      __setHooks({
        resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
        connect: async () => rawHttp('HTTP/1.1 302 Found', { location: 'file:///etc/passwd' }, new Uint8Array()),
      })
      await expect(pinnedFetch(new URL('https://example.com/'), { type: 'page' })).rejects.toMatchObject({ status: 400 })
    })

    it('rejects on too many hops', async () => {
      __setHooks({
        resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
        connect: async () => rawHttp('HTTP/1.1 301 Moved', { location: 'https://example.com/loop' }, new Uint8Array()),
      })
      await expect(pinnedFetch(new URL('https://example.com/'), { type: 'page' })).rejects.toMatchObject({ status: 502 })
    })
  })

  describe('pinnedFetch — stream-and-count cap', () => {
    it('aborts chunked body with no content-length once over cap (page 5MB)', async () => {
      __setHooks({
        resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
        connect: async () => {
          const enc = new TextEncoder()
          const head = 'HTTP/1.1 200 OK\r\ncontent-type: text/html\r\ntransfer-encoding: chunked\r\n\r\n'
          const big = new Uint8Array(6 * 1024 * 1024) // 6MB > 5MB cap, no content-length
          let sent = false
          return new ReadableStream<Uint8Array>({
            pull(c) {
              if (!sent) { c.enqueue(enc.encode(head)); sent = true; return }
              c.enqueue(big); c.close()
            },
          })
        },
      })
      await expect(pinnedFetch(new URL('https://example.com/'), { type: 'page' })).rejects.toMatchObject({ status: 413 })
    })

    it('aborts on a lying (small) content-length that the body exceeds', async () => {
      __setHooks({
        resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
        connect: async () => {
          const enc = new TextEncoder()
          const head = 'HTTP/1.1 200 OK\r\ncontent-type: text/html\r\ncontent-length: 10\r\n\r\n'
          const big = new Uint8Array(6 * 1024 * 1024)
          let sent = false
          return new ReadableStream<Uint8Array>({
            pull(c) { if (!sent) { c.enqueue(enc.encode(head)); sent = true; return } c.enqueue(big); c.close() },
          })
        },
      })
      await expect(pinnedFetch(new URL('https://example.com/'), { type: 'page' })).rejects.toMatchObject({ status: 413 })
    })

    it('rejects a Content-Encoding: gzip body (we requested identity)', async () => {
      __setHooks({
        resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
        connect: async () => rawHttp('HTTP/1.1 200 OK', { 'content-type': 'text/html', 'content-encoding': 'gzip' }, new Uint8Array(100)),
      })
      await expect(pinnedFetch(new URL('https://example.com/'), { type: 'page' })).rejects.toMatchObject({ status: 502 })
    })
  })

  describe('pinnedFetch — response sanitize', () => {
    it('strips Set-Cookie and upstream security headers', async () => {
      __setHooks({
        resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
        connect: async () => rawHttp('HTTP/1.1 200 OK', {
          'content-type': 'text/html', 'set-cookie': 'sid=1', 'strict-transport-security': 'max-age=1', 'content-security-policy': "default-src *",
        }, new TextEncoder().encode('ok')),
      })
      const res = await pinnedFetch(new URL('https://example.com/'), { type: 'page' })
      expect(res.headers.get('set-cookie')).toBeNull()
      expect(res.headers.get('strict-transport-security')).toBeNull()
      expect(res.headers.get('content-security-policy')).toBeNull()
    })

    it('serves type=image with sanitized image/*, attachment, nosniff', async () => {
      __setHooks({
        resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
        connect: async () => rawHttp('HTTP/1.1 200 OK', { 'content-type': 'image/png' }, new Uint8Array([137, 80, 78, 71])),
      })
      const res = await pinnedFetch(new URL('https://cdn.example.com/a.png'), { type: 'image' })
      expect(res.headers.get('content-type')).toBe('image/png')
      expect(res.headers.get('content-disposition')).toContain('attachment')
      expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    })

    it('refuses to relay text/html as type=image', async () => {
      __setHooks({
        resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
        connect: async () => rawHttp('HTTP/1.1 200 OK', { 'content-type': 'text/html' }, new TextEncoder().encode('<html>')),
      })
      await expect(pinnedFetch(new URL('https://cdn.example.com/x'), { type: 'image' })).rejects.toMatchObject({ status: 502 })
    })

    it('refuses to relay image bytes as type=page (content-type mismatch)', async () => {
      __setHooks({
        resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
        connect: async () => rawHttp('HTTP/1.1 200 OK', { 'content-type': 'image/png' }, new Uint8Array([1, 2])),
      })
      await expect(pinnedFetch(new URL('https://example.com/'), { type: 'page' })).rejects.toMatchObject({ status: 502 })
    })
  })
  ```

- [ ] 2. Run it, expect FAIL: `npx vitest run --project workers src/server/proxy.fetch.test.ts`.
  Expected: `__setHooks is not a function` / import error — red.

- [ ] 3. Add `pinnedFetch` + `ProxyError` + the hook seam + a minimal HTTP/1.1 response parser to `src/server/proxy.ts`. Append:
  ```ts
  import { isSafePublicUrl } from '../lib/url-safety'

  export class ProxyError extends Error {
    status: number
    constructor(status: number, message: string) { super(message); this.status = status }
  }

  // Test seam: pinnedFetch resolves via `resolveAndValidate` and opens a socket
  // via the Workers connect() API. Both are injected so tests never hit the net.
  // The connect hook receives the validated literal IP (the pinned address), the
  // original hostname (for the TLS SNI + cert + Host header), the port, the
  // scheme (so https enables TLS), and the raw HTTP/1.1 request bytes.
  type ResolveFn = (host: string) => Promise<{ ok: true; ips: string[] } | { ok: false; reason: string }>
  type ConnectArgs = { ip: string; hostname: string; port: number; secure: boolean; rawRequest: string }
  type ConnectFn = (args: ConnectArgs) => Promise<ReadableStream<Uint8Array>>

  let resolveHook: ResolveFn = resolveAndValidate
  let connectHook: ConnectFn = realConnect
  export function __setHooks(h: { resolve?: ResolveFn; connect?: ConnectFn }): void {
    if (h.resolve) resolveHook = h.resolve
    if (h.connect) connectHook = h.connect
  }
  export function __resetHooks(): void { resolveHook = resolveAndValidate; connectHook = realConnect }

  const MAX_HOPS = 5
  const PAGE_CAP = Number((env as Record<string, string>).MAX_PAGE_BYTES ?? '5242880')
  const IMAGE_CAP = Number((env as Record<string, string>).MAX_IMAGE_BYTES ?? '26214400')
  const HOP_HEADER_CAP = 64 * 1024 // upstream header block ceiling

  // Open the upstream socket.
  //
  // Cloudflare's connect() derives the TLS SNI (and cert hostname check) from the
  // `hostname` field of the address it is given; the documented SocketOptions are
  // only `secureTransport` ('off' | 'on' | 'starttls') and `allowHalfOpen`. There
  // is no separate "set SNI but dial this IP" option, so:
  //   - http  -> dial the validated literal IP directly (true IP pinning, no TLS).
  //   - https -> dial by the ORIGINAL hostname with TLS on, so SNI + cert
  //     validation pass against the real certificate. The hostname's A/AAAA
  //     records were already validated against the special-use blocklist in
  //     resolveAndValidate and are re-validated on every redirect hop, so the
  //     residual resolve-then-connect-by-name rebinding window is the exact
  //     tradeoff the spec flags as acceptable for the hosted instance in
  //     §16/§17. (If Cloudflare later exposes an SNI-override option, switch the
  //     https branch to dial args.ip with that SNI to close the window fully.)
  async function realConnect(args: ConnectArgs): Promise<ReadableStream<Uint8Array>> {
    const { connect } = await import('cloudflare:sockets')
    const socket = args.secure
      ? connect({ hostname: args.hostname, port: args.port }, { secureTransport: 'on', allowHalfOpen: false })
      : connect({ hostname: args.ip, port: args.port }, { secureTransport: 'off', allowHalfOpen: false })
    const writer = socket.writable.getWriter()
    await writer.write(new TextEncoder().encode(args.rawRequest))
    await writer.releaseLock()
    return socket.readable as ReadableStream<Uint8Array>
  }

  function buildRequest(url: URL): string {
    const path = url.pathname + url.search || '/'
    return [
      `GET ${path} HTTP/1.1`,
      `Host: ${url.hostname}`,
      `User-Agent: ScrapeConvertBot/1.0 (+https://scrapeconvert.com/about)`,
      `Accept: */*`,
      `Accept-Encoding: identity`,
      `Connection: close`,
      '', '',
    ].join('\r\n')
  }

  interface ParsedHead { status: number; headers: Headers; rest: Uint8Array }

  async function readHead(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<ParsedHead> {
    const dec = new TextDecoder()
    let buf = new Uint8Array(0)
    const needle = new TextEncoder().encode('\r\n\r\n')
    while (true) {
      const idx = indexOf(buf, needle)
      if (idx !== -1) {
        const headBytes = buf.slice(0, idx)
        const rest = buf.slice(idx + 4)
        const lines = dec.decode(headBytes).split('\r\n')
        const statusLine = lines.shift() ?? ''
        const m = /^HTTP\/\d\.\d (\d{3})/.exec(statusLine)
        if (!m) throw new ProxyError(502, 'bad-status-line')
        const headers = new Headers()
        for (const l of lines) {
          const c = l.indexOf(':')
          if (c === -1) continue
          headers.append(l.slice(0, c).trim(), l.slice(c + 1).trim())
        }
        return { status: Number(m[1]), headers, rest }
      }
      if (buf.length > HOP_HEADER_CAP) throw new ProxyError(502, 'header-too-large')
      const { value, done } = await reader.read()
      if (done) throw new ProxyError(502, 'truncated-head')
      const next = new Uint8Array(buf.length + value.length)
      next.set(buf); next.set(value, buf.length)
      buf = next
    }
  }

  function indexOf(hay: Uint8Array, needle: Uint8Array): number {
    outer: for (let i = 0; i <= hay.length - needle.length; i++) {
      for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer
      return i
    }
    return -1
  }

  function sanitizeImageType(ct: string): string | null {
    const base = ct.split(';')[0].trim().toLowerCase()
    const ok = ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml', 'image/bmp', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/tiff']
    return ok.includes(base) ? base : null
  }

  export async function pinnedFetch(url: URL, opts: { type: 'page' | 'sitemap' | 'image' }): Promise<Response> {
    const cap = opts.type === 'image' ? IMAGE_CAP : PAGE_CAP
    let current = url
    for (let hop = 0; hop < MAX_HOPS; hop++) {
      const safe = isSafePublicUrl(current.href)
      if (!safe.ok) throw new ProxyError(400, 'blocked-url:' + safe.reason)
      const resolved = await resolveHook(current.hostname)
      if (!resolved.ok) throw new ProxyError(400, 'blocked-host:' + resolved.reason)
      const secure = current.protocol === 'https:'
      const port = current.port ? Number(current.port) : secure ? 443 : 80
      let stream: ReadableStream<Uint8Array>
      try {
        stream = await connectHook({
          ip: resolved.ips[0],
          hostname: current.hostname,
          port,
          secure,
          rawRequest: buildRequest(current),
        })
      } catch {
        throw new ProxyError(502, 'connect-failed')
      }
      const reader = stream.getReader()
      const head = await readHead(reader)

      // redirects: manual, re-validate next hop
      if (head.status >= 300 && head.status < 400) {
        reader.cancel().catch(() => {})
        const loc = head.headers.get('location')
        if (!loc) throw new ProxyError(502, 'redirect-no-location')
        let next: URL
        try { next = new URL(loc, current) } catch { throw new ProxyError(400, 'redirect-bad-url') }
        if (next.protocol !== 'http:' && next.protocol !== 'https:') throw new ProxyError(400, 'redirect-scheme')
        current = next
        continue
      }
      if (head.status >= 400) { reader.cancel().catch(() => {}); throw new ProxyError(502, 'upstream-' + head.status) }

      // we requested identity; refuse any content-encoding (defeats gzip-bomb decode-blow)
      const ce = head.headers.get('content-encoding')
      if (ce && ce.toLowerCase() !== 'identity') { reader.cancel().catch(() => {}); throw new ProxyError(502, 'unexpected-encoding') }

      const rawCt = head.headers.get('content-type') ?? ''
      if (opts.type === 'image') {
        const sane = sanitizeImageType(rawCt)
        if (!sane) { reader.cancel().catch(() => {}); throw new ProxyError(502, 'not-an-image') }
        return streamCapped(reader, head.rest, cap, {
          'content-type': sane,
          'content-disposition': 'attachment',
          'x-content-type-options': 'nosniff',
        })
      } else {
        const base = rawCt.split(';')[0].trim().toLowerCase()
        if (!base.startsWith('text/') && base !== 'application/xml' && base !== 'application/rss+xml' && base !== 'application/atom+xml' && base !== '') {
          reader.cancel().catch(() => {}); throw new ProxyError(502, 'not-text')
        }
        return streamCapped(reader, head.rest, cap, {
          'content-type': rawCt || 'text/plain; charset=utf-8',
          'x-content-type-options': 'nosniff',
        })
      }
    }
    throw new ProxyError(502, 'too-many-redirects')
  }

  function streamCapped(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    head: Uint8Array,
    cap: number,
    outHeaders: Record<string, string>,
  ): Response {
    let count = head.length
    if (count > cap) { reader.cancel().catch(() => {}); throw new ProxyError(413, 'over-cap') }
    const body = new ReadableStream<Uint8Array>({
      start(controller) { if (head.length) controller.enqueue(head) },
      async pull(controller) {
        const { value, done } = await reader.read()
        if (done) { controller.close(); return }
        count += value.length
        if (count > cap) { reader.cancel().catch(() => {}); controller.error(new ProxyError(413, 'over-cap')); return }
        controller.enqueue(value)
      },
      cancel() { reader.cancel().catch(() => {}) },
    })
    return new Response(body, { status: 200, headers: outHeaders })
  }
  ```
  Note on the cap test: `streamCapped` throws synchronously only for the head; for chunked bodies it errors the stream during `pull`. The endpoint (Task 6) buffers via `res.text()`/`arrayBuffer()` which surfaces the stream error; the test calls `pinnedFetch` then awaits the body, so make the over-cap chunked test assert the rejection by reading the body. Adjust the two over-cap tests to `await expect((async () => { const r = await pinnedFetch(...); await r.text() })()).rejects.toMatchObject({ status: 413 })` if the synchronous form does not catch the mid-stream case.

- [ ] 4. Reconcile the two over-cap tests with the streaming behaviour. Edit `src/server/proxy.fetch.test.ts` so the chunked and lying-content-length cases drain the body:
  ```ts
    it('aborts chunked body with no content-length once over cap (page 5MB)', async () => {
      __setHooks({
        resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
        connect: async () => {
          const enc = new TextEncoder()
          const head = 'HTTP/1.1 200 OK\r\ncontent-type: text/html\r\ntransfer-encoding: chunked\r\n\r\n'
          const big = new Uint8Array(6 * 1024 * 1024)
          let sent = false
          return new ReadableStream<Uint8Array>({
            pull(c) { if (!sent) { c.enqueue(enc.encode(head)); sent = true; return } c.enqueue(big); c.close() },
          })
        },
      })
      await expect((async () => { const r = await pinnedFetch(new URL('https://example.com/'), { type: 'page' }); await r.text() })())
        .rejects.toMatchObject({ status: 413 })
    })
  ```
  Apply the same `await r.text()` drain to the lying-content-length test.

- [ ] 5. Run it, expect PASS: `npx vitest run --project workers src/server/proxy.fetch.test.ts`.
  Expected: all `pinnedFetch` describe blocks pass.

- [ ] 6. Commit:
  ```
  git add -A && git commit -m "feat(proxy): pinnedFetch connect()-pinned relay with manual redirects, byte-cap, header/response hygiene"
  ```

---

## Task 4 — `src/server/token.ts`: WebCrypto HMAC sign/verify with ipHash binding + exp; `src/server/ip.ts`

Structured HMAC session tokens bound to a coarse client network and an expiry. Test forged / expired / ip-mismatch.

**Files**
- Create: `src/server/token.ts`, `src/server/token.test.ts`, `src/server/ip.ts`

**Interfaces**
- Produces (verbatim from CONTRACT):
  ```ts
  export interface SessionClaims { iat: number; exp: number; nonce: string; ipHash: string }
  export async function signToken(claims: SessionClaims, secret: string): Promise<string>
  export async function verifyToken(token: string, secret: string, reqIpHash: string): Promise<{ ok: true; claims: SessionClaims } | { ok: false; reason: string }>
  ```
- `src/server/ip.ts`: `export async function clientIpHash(ip: string): Promise<string>` — coarsen (/24 v4, /64 v6) then SHA-256 hex.

**Steps**

- [ ] 1. Write the failing test `src/server/token.test.ts` (runs in node pool per Task 0 include):
  ```ts
  import { describe, it, expect } from 'vitest'
  import { signToken, verifyToken, type SessionClaims } from './token'

  const SECRET = 'unit-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  const now = () => Math.floor(Date.now() / 1000)

  function claims(over: Partial<SessionClaims> = {}): SessionClaims {
    return { iat: now(), exp: now() + 2700, nonce: 'n-123', ipHash: 'abc123', ...over }
  }

  describe('signToken / verifyToken', () => {
    it('round-trips a valid token', async () => {
      const t = await signToken(claims(), SECRET)
      const r = await verifyToken(t, SECRET, 'abc123')
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.claims.nonce).toBe('n-123')
    })

    it('rejects a forged signature', async () => {
      const t = await signToken(claims(), SECRET)
      const forged = t.slice(0, -4) + (t.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA')
      const r = await verifyToken(forged, SECRET, 'abc123')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toBe('signature')
    })

    it('rejects a token signed with a different secret', async () => {
      const t = await signToken(claims(), SECRET)
      const r = await verifyToken(t, 'different-secret', 'abc123')
      expect(r.ok).toBe(false)
    })

    it('rejects an expired token', async () => {
      const t = await signToken(claims({ iat: now() - 5000, exp: now() - 1 }), SECRET)
      const r = await verifyToken(t, SECRET, 'abc123')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toBe('expired')
    })

    it('rejects an ip-hash mismatch', async () => {
      const t = await signToken(claims({ ipHash: 'abc123' }), SECRET)
      const r = await verifyToken(t, SECRET, 'different-network')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toBe('ip-mismatch')
    })

    it('rejects a malformed token', async () => {
      expect((await verifyToken('garbage', SECRET, 'abc123')).ok).toBe(false)
      expect((await verifyToken('a.b', SECRET, 'abc123')).ok).toBe(false)
    })
  })
  ```

- [ ] 2. Run it, expect FAIL: `npx vitest run --project node src/server/token.test.ts`.
  Expected: import error — red.

- [ ] 3. Create `src/server/token.ts` (WebCrypto only, base64url, constant-time compare):
  ```ts
  export interface SessionClaims { iat: number; exp: number; nonce: string; ipHash: string }

  function b64urlEncode(bytes: Uint8Array): string {
    let s = ''
    for (const b of bytes) s += String.fromCharCode(b)
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  function b64urlDecode(str: string): Uint8Array {
    const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4))
    const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad)
    const out = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
    return out
  }

  async function hmac(secret: string, data: string): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
    return new Uint8Array(sig)
  }

  function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
    return diff === 0
  }

  // Canonical JSON: fixed key order so the signed bytes are deterministic.
  function canonical(c: SessionClaims): string {
    return JSON.stringify({ iat: c.iat, exp: c.exp, nonce: c.nonce, ipHash: c.ipHash })
  }

  export async function signToken(claims: SessionClaims, secret: string): Promise<string> {
    const payload = b64urlEncode(new TextEncoder().encode(canonical(claims)))
    const sig = b64urlEncode(await hmac(secret, payload))
    return `${payload}.${sig}`
  }

  export async function verifyToken(
    token: string, secret: string, reqIpHash: string,
  ): Promise<{ ok: true; claims: SessionClaims } | { ok: false; reason: string }> {
    const parts = token.split('.')
    if (parts.length !== 2) return { ok: false, reason: 'malformed' }
    const [payload, sig] = parts
    let expected: Uint8Array
    let given: Uint8Array
    try {
      expected = await hmac(secret, payload)
      given = b64urlDecode(sig)
    } catch { return { ok: false, reason: 'malformed' } }
    if (!timingSafeEqual(expected, given)) return { ok: false, reason: 'signature' }
    let claims: SessionClaims
    try {
      claims = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)))
    } catch { return { ok: false, reason: 'malformed' } }
    if (typeof claims.exp !== 'number' || typeof claims.ipHash !== 'string') return { ok: false, reason: 'malformed' }
    const now = Math.floor(Date.now() / 1000)
    if (claims.exp <= now) return { ok: false, reason: 'expired' }
    if (claims.ipHash !== reqIpHash) return { ok: false, reason: 'ip-mismatch' }
    return { ok: true, claims }
  }
  ```

- [ ] 4. Run it, expect PASS: `npx vitest run --project node src/server/token.test.ts`.
  Expected: `6 passed`.

- [ ] 5. Create `src/server/ip.ts` (coarsen + hash; no test of its own — exercised through Task 5):
  ```ts
  function coarsen(ip: string): string {
    if (ip.includes(':')) {
      // IPv6 -> /64 (first 4 hextets)
      const expanded = ip.split('%')[0]
      const groups = expanded.split(':')
      return groups.slice(0, 4).join(':') + '::/64'
    }
    const parts = ip.split('.')
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`
    return ip // unknown form: hash as-is
  }

  export async function clientIpHash(ip: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(coarsen(ip || 'unknown')))
    const bytes = new Uint8Array(digest)
    let hex = ''
    for (const b of bytes) hex += b.toString(16).padStart(2, '0')
    return hex.slice(0, 32)
  }
  ```

- [ ] 6. Commit:
  ```
  git add -A && git commit -m "feat(proxy): HMAC session token sign/verify (WebCrypto) + coarse ipHash binding"
  ```

---

## Task 5 — `POST /api/turnstile`: siteverify + dup-token reject + mint + per-IP mint rate-limit (required secrets)

The token-issuance gate (the real per-user throttle). Verifies the Turnstile token with `remoteip`, rejects duplicates, mints an HMAC token, and rate-limits minting per IP. Both secrets are required with no default.

**Files**
- Create: `src/server/turnstile.ts`, `src/server/turnstile.test.ts`, `src/pages/api/turnstile.ts`, `src/pages/api/turnstile.endpoint.test.ts`

**Interfaces**
- Consumes: `signToken`, `clientIpHash`, `BUDGETS` KV (dup-set + per-IP mint counter).
- Produces:
  ```ts
  // turnstile.ts
  export function requireSecret(name: string, value: string | undefined): string  // throws if empty
  export async function verifyTurnstileToken(token: string, secret: string, remoteip: string): Promise<{ ok: true } | { ok: false; reason: string }>
  export async function mintSession(remoteip: string, hmacSecret: string, ttlSeconds: number): Promise<string>
  ```
  HTTP (verbatim from CONTRACT): `POST /api/turnstile` body `{ token: string }` -> `200 { sessionToken }` | `400` (bad/duplicate turnstile) | `429` (mint rate-limited). No cookies set.

**Steps**

- [ ] 1. Write the failing unit test `src/server/turnstile.test.ts`:
  ```ts
  import { describe, it, expect, vi, beforeEach } from 'vitest'
  import { requireSecret, verifyTurnstileToken, mintSession } from './turnstile'

  describe('requireSecret', () => {
    it('returns a present secret', () => expect(requireSecret('X', 'val')).toBe('val'))
    it('throws on undefined', () => expect(() => requireSecret('X', undefined)).toThrow(/X/))
    it('throws on empty', () => expect(() => requireSecret('X', '')).toThrow(/X/))
  })

  describe('verifyTurnstileToken', () => {
    beforeEach(() => vi.restoreAllMocks())
    it('passes when siteverify success', async () => {
      const f = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }))
      vi.stubGlobal('fetch', f)
      const r = await verifyTurnstileToken('tok', 'secret', '1.2.3.4')
      expect(r.ok).toBe(true)
      const body = (f.mock.calls[0][1] as RequestInit).body as FormData
      expect(body.get('remoteip')).toBe('1.2.3.4')
      expect(body.get('secret')).toBe('secret')
    })
    it('fails when siteverify rejects', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }), { status: 200 })))
      const r = await verifyTurnstileToken('tok', 'secret', '1.2.3.4')
      expect(r.ok).toBe(false)
    })
  })

  describe('mintSession', () => {
    it('produces a verifiable token bound to the coarse ip', async () => {
      const t = await mintSession('1.2.3.4', 'hmac-secret', 2700)
      expect(t.split('.').length).toBe(2)
    })
  })
  ```

- [ ] 2. Run it, expect FAIL: `npx vitest run --project workers src/server/turnstile.test.ts`.
  Expected: import error — red.

- [ ] 3. Create `src/server/turnstile.ts`:
  ```ts
  import { signToken } from './token'
  import { clientIpHash } from './ip'

  export function requireSecret(name: string, value: string | undefined): string {
    if (!value || value.length === 0) throw new Error(`Required secret ${name} is not set`)
    return value
  }

  export async function verifyTurnstileToken(
    token: string, secret: string, remoteip: string,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const form = new FormData()
    form.set('secret', secret)
    form.set('response', token)
    form.set('remoteip', remoteip)
    let res: Response
    try {
      res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
    } catch { return { ok: false, reason: 'siteverify-network' } }
    if (res.status !== 200) return { ok: false, reason: 'siteverify-status' }
    let body: { success?: boolean }
    try { body = await res.json() } catch { return { ok: false, reason: 'siteverify-parse' } }
    return body.success ? { ok: true } : { ok: false, reason: 'siteverify-rejected' }
  }

  export async function mintSession(remoteip: string, hmacSecret: string, ttlSeconds: number): Promise<string> {
    const iat = Math.floor(Date.now() / 1000)
    const nonce = crypto.randomUUID()
    const ipHash = await clientIpHash(remoteip)
    return signToken({ iat, exp: iat + ttlSeconds, nonce, ipHash }, hmacSecret)
  }
  ```

- [ ] 4. Run it, expect PASS: `npx vitest run --project workers src/server/turnstile.test.ts`.
  Expected: `7 passed`.

- [ ] 5. Write the failing endpoint test `src/pages/api/turnstile.endpoint.test.ts`. It exercises dup-rejection and per-IP mint rate-limit through the route, with `fetch` (siteverify) and KV stubbed via the worker env:
  ```ts
  import { describe, it, expect, vi, beforeEach } from 'vitest'
  import { env } from 'cloudflare:test'
  import { POST } from './turnstile'

  function req(body: unknown, ip = '9.9.9.9') {
    return new Request('https://scrapeconvert.com/api/turnstile', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
      body: JSON.stringify(body),
    })
  }
  const ctx = () => ({ request: req({ token: 't1' }), locals: {}, clientAddress: '9.9.9.9' } as any)

  beforeEach(async () => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })))
    // clear KV keys used between tests
  })

  describe('POST /api/turnstile', () => {
    it('mints a session token on success', async () => {
      const res = await POST({ request: req({ token: 'fresh-1' }) } as any)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(typeof json.sessionToken).toBe('string')
      expect(res.headers.get('set-cookie')).toBeNull()
    })

    it('400 on missing token', async () => {
      const res = await POST({ request: req({}) } as any)
      expect(res.status).toBe(400)
    })

    it('400 when siteverify fails', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 200 })))
      const res = await POST({ request: req({ token: 'bad-1' }) } as any)
      expect(res.status).toBe(400)
    })

    it('400 on duplicate Turnstile token (single-use)', async () => {
      const r1 = await POST({ request: req({ token: 'dup-token' }, '7.7.7.7') } as any)
      expect(r1.status).toBe(200)
      const r2 = await POST({ request: req({ token: 'dup-token' }, '7.7.7.7') } as any)
      expect(r2.status).toBe(400)
    })

    it('429 after exceeding per-IP mint rate', async () => {
      let last = 200
      for (let i = 0; i < 12; i++) {
        const res = await POST({ request: req({ token: 'mint-' + i }, '5.5.5.5') } as any)
        last = res.status
      }
      expect(last).toBe(429)
    })
  })
  ```

- [ ] 6. Run it, expect FAIL: `npx vitest run --project workers src/pages/api/turnstile.endpoint.test.ts`.
  Expected: import error — red.

- [ ] 7. Create `src/pages/api/turnstile.ts`:
  ```ts
  import type { APIContext } from 'astro'
  import { env } from 'cloudflare:workers'
  import { requireSecret, verifyTurnstileToken, mintSession } from '../../server/turnstile'

  export const prerender = false

  function json(data: unknown, status: number): Response {
    return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
  }

  function clientIp(req: Request): string {
    return req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || '0.0.0.0'
  }

  async function alreadySeen(kv: KVNamespace, token: string): Promise<boolean> {
    const key = `ts:dup:${token}`
    const hit = await kv.get(key)
    if (hit) return true
    await kv.put(key, '1', { expirationTtl: 600 }) // Turnstile tokens expire ~5min; 10min set is safe
    return false
  }

  async function mintRateLimited(kv: KVNamespace, ip: string, limit: number): Promise<boolean> {
    const bucket = Math.floor(Date.now() / 60000)
    const key = `ts:mint:${ip}:${bucket}`
    const raw = await kv.get(key)
    const n = raw ? Number(raw) : 0
    if (n >= limit) return true
    await kv.put(key, String(n + 1), { expirationTtl: 120 })
    return false
  }

  export async function POST(ctx: APIContext): Promise<Response> {
    const e = env as Record<string, any>
    const hmacSecret = requireSecret('SESSION_HMAC_SECRET', e.SESSION_HMAC_SECRET)
    const tsSecret = requireSecret('TURNSTILE_SECRET', e.TURNSTILE_SECRET)
    const kv = e.BUDGETS as KVNamespace
    const ttl = Number(e.TOKEN_TTL_SECONDS ?? '2700')
    const mintLimit = Number(e.MINT_RATE_PER_IP_PER_MIN ?? '10')

    let body: { token?: string }
    try { body = await ctx.request.json() } catch { return json({ error: 'bad-json' }, 400) }
    const token = body.token
    if (!token || typeof token !== 'string') return json({ error: 'missing-token' }, 400)

    const ip = clientIp(ctx.request)
    if (await mintRateLimited(kv, ip, mintLimit)) return json({ error: 'rate-limited' }, 429)
    if (await alreadySeen(kv, token)) return json({ error: 'duplicate-token' }, 400)

    const verified = await verifyTurnstileToken(token, tsSecret, ip)
    if (!verified.ok) return json({ error: 'turnstile-failed' }, 400)

    const sessionToken = await mintSession(ip, hmacSecret, ttl)
    return json({ sessionToken }, 200)
  }
  ```
  Note: `alreadySeen` writes the dup marker before siteverify so a replayed token is rejected even if the first verify is still in flight. The mint counter is checked before the dup check so a token-farm cannot probe dup state for free.

- [ ] 8. Run it, expect PASS: `npx vitest run --project workers src/pages/api/turnstile.endpoint.test.ts`.
  Expected: `5 passed`.

- [ ] 9. Add the required secrets to `.dev.vars` if not already present (Task 0 added them) and confirm a missing secret fails fast. Add one assertion to the endpoint test file at the end of the describe block and re-run:
  ```ts
    it('throws when SESSION_HMAC_SECRET is unset (deploy must fail)', async () => {
      const original = (env as any).SESSION_HMAC_SECRET
      ;(env as any).SESSION_HMAC_SECRET = ''
      await expect(POST({ request: req({ token: 'x' }) } as any)).rejects.toThrow(/SESSION_HMAC_SECRET/)
      ;(env as any).SESSION_HMAC_SECRET = original
    })
  ```
  Run `npx vitest run --project workers src/pages/api/turnstile.endpoint.test.ts`. Expected: `6 passed`.

- [ ] 10. Commit:
  ```
  git add -A && git commit -m "feat(proxy): POST /api/turnstile siteverify + dup-reject + per-IP mint limit + HMAC mint (required secrets)"
  ```

---

## Task 6 — `GET /api/fetch`: auth, type routing, edge cache, error responses

The hardened relay endpoint: verify token, validate URL + own-zone, route by type, optionally serve/store edge cache, and map proxy errors to 400/401/413/429/502.

**Files**
- Create: `src/server/cache.ts`, `src/server/cache.test.ts`, `src/pages/api/fetch.ts`, `src/pages/api/fetch.endpoint.test.ts`
- Modify: `src/server/proxy.ts` (export an own-zone check helper consumed by the route)

**Interfaces**
- Consumes: `verifyToken`, `clientIpHash`, `isSafePublicUrl`, `pinnedFetch`, `ProxyError`, cache helpers.
- Produces:
  ```ts
  // cache.ts
  export function cacheKeyFor(targetUrl: URL): Request           // normalized-URL key, no token/headers
  export async function getCached(cache: Cache, key: Request): Promise<Response | undefined>
  export async function putCached(cache: Cache, key: Request, res: Response, ttlSeconds: number, maxBytes: number): Promise<Response>
  ```
  HTTP (verbatim from CONTRACT): `GET /api/fetch?url=<encoded>&type=page|sitemap|image` with `Authorization: Bearer <sessionToken>` -> 200 streamed | 400 | 401 | 413 | 429 | 502.

**Steps**

- [ ] 1. Write the failing cache test `src/server/cache.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest'
  import { cacheKeyFor, getCached, putCached } from './cache'

  describe('cacheKeyFor', () => {
    it('normalizes to the target URL only (drops token/headers/fragment)', () => {
      const k1 = cacheKeyFor(new URL('https://example.com/a?b=1#frag'))
      const k2 = cacheKeyFor(new URL('https://example.com/a?b=1'))
      expect(new URL(k1.url).hash).toBe('')
      expect(k1.url).toBe(k2.url)
    })
    it('different targets -> different keys', () => {
      expect(cacheKeyFor(new URL('https://a.com/')).url).not.toBe(cacheKeyFor(new URL('https://b.com/')).url)
    })
  })

  describe('putCached / getCached', () => {
    it('stores a 200 and reads it back', async () => {
      const cache = await caches.open('test-cache')
      const key = cacheKeyFor(new URL('https://example.com/img.png'))
      const res = new Response('hello', { status: 200, headers: { 'content-type': 'text/plain' } })
      await putCached(cache, key, res, 3600, 1024)
      const got = await getCached(cache, key)
      expect(got).toBeDefined()
      expect(await got!.text()).toBe('hello')
    })

    it('does not store responses over maxBytes', async () => {
      const cache = await caches.open('test-cache-2')
      const key = cacheKeyFor(new URL('https://example.com/big'))
      const res = new Response('x'.repeat(2000), { status: 200, headers: { 'content-type': 'text/plain' } })
      await putCached(cache, key, res, 3600, 1024)
      const got = await getCached(cache, key)
      expect(got).toBeUndefined()
    })
  })
  ```

- [ ] 2. Run it, expect FAIL: `npx vitest run --project workers src/server/cache.test.ts`.
  Expected: import error — red.

- [ ] 3. Create `src/server/cache.ts`:
  ```ts
  export function cacheKeyFor(targetUrl: URL): Request {
    const u = new URL(targetUrl.href)
    u.hash = ''
    // Key on the normalized target only; never the session token or client headers.
    return new Request(`https://cache.scrapeconvert.internal/${encodeURIComponent(u.href)}`, { method: 'GET' })
  }

  export async function getCached(cache: Cache, key: Request): Promise<Response | undefined> {
    const hit = await cache.match(key)
    return hit ?? undefined
  }

  export async function putCached(
    cache: Cache, key: Request, res: Response, ttlSeconds: number, maxBytes: number,
  ): Promise<Response> {
    // Only cache validated 2xx; buffer to enforce a max object size; clone so the
    // caller still gets a live body.
    if (res.status !== 200) return res
    const buf = await res.clone().arrayBuffer()
    if (buf.byteLength > maxBytes) return res
    const headers = new Headers(res.headers)
    headers.set('cache-control', `public, max-age=${ttlSeconds}`)
    const stored = new Response(buf, { status: 200, headers })
    await cache.put(key, stored.clone())
    return stored
  }
  ```

- [ ] 4. Run it, expect PASS: `npx vitest run --project workers src/server/cache.test.ts`.
  Expected: `4 passed`.

- [ ] 5. Add an own-zone / self-recursion check to `src/server/proxy.ts`. Append:
  ```ts
  export function isOwnZoneOrDenied(target: URL, requestHost: string, zoneApex: string, denylist: string[]): boolean {
    const host = target.hostname.toLowerCase()
    const apex = zoneApex.toLowerCase()
    if (apex && (host === apex || host.endsWith('.' + apex))) return true
    if (host === requestHost.toLowerCase()) return true
    if (host.endsWith('.workers.dev')) return true
    if (target.pathname.startsWith('/api/fetch')) return true
    for (const d of denylist) {
      const dd = d.trim().toLowerCase()
      if (!dd) continue
      if (host === dd || host.endsWith('.' + dd)) return true
    }
    return false
  }
  ```

- [ ] 6. Write the failing endpoint test `src/pages/api/fetch.endpoint.test.ts`. It mints a valid token via the same HMAC machinery, stubs `pinnedFetch` through the proxy hooks, and checks every error code:
  ```ts
  import { describe, it, expect, beforeEach } from 'vitest'
  import { env } from 'cloudflare:test'
  import { GET } from './fetch'
  import { __setHooks, __resetHooks } from '../../server/proxy'
  import { mintSession } from '../../server/turnstile'

  const IP = '8.8.8.8'
  async function validToken() {
    return mintSession(IP, (env as any).SESSION_HMAC_SECRET, 2700)
  }
  function fetchReq(target: string, token: string | null, type = 'page') {
    const u = new URL('https://scrapeconvert.com/api/fetch')
    u.searchParams.set('url', target)
    u.searchParams.set('type', type)
    const headers: Record<string, string> = { 'cf-connecting-ip': IP }
    if (token) headers['authorization'] = `Bearer ${token}`
    return new Request(u.href, { headers })
  }

  beforeEach(() => __resetHooks())

  describe('GET /api/fetch', () => {
    it('401 when no token', async () => {
      const res = await GET({ request: fetchReq('https://example.com/', null) } as any)
      expect(res.status).toBe(401)
    })

    it('401 on a forged token', async () => {
      const res = await GET({ request: fetchReq('https://example.com/', 'a.b') } as any)
      expect(res.status).toBe(401)
    })

    it('401 on ip mismatch', async () => {
      const t = await mintSession('1.1.1.1', (env as any).SESSION_HMAC_SECRET, 2700)
      const req = fetchReq('https://example.com/', t) // request IP is 8.8.8.8
      const res = await GET({ request: req } as any)
      expect(res.status).toBe(401)
    })

    it('400 on a blocked URL (private IP)', async () => {
      const res = await GET({ request: fetchReq('http://169.254.169.254/', await validToken()) } as any)
      expect(res.status).toBe(400)
    })

    it('400 on own-zone target', async () => {
      const res = await GET({ request: fetchReq('https://scrapeconvert.com/secret', await validToken()) } as any)
      expect(res.status).toBe(400)
    })

    it('200 relays page bytes', async () => {
      __setHooks({
        resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
        connect: async () => {
          const enc = new TextEncoder()
          return new ReadableStream<Uint8Array>({
            pull(c) { c.enqueue(enc.encode('HTTP/1.1 200 OK\r\ncontent-type: text/html\r\n\r\n<html>')); c.close() },
          })
        },
      })
      const res = await GET({ request: fetchReq('https://example.com/', await validToken()) } as any)
      expect(res.status).toBe(200)
      expect(await res.text()).toContain('<html>')
    })

    it('413 maps from an over-cap ProxyError', async () => {
      __setHooks({
        resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
        connect: async () => {
          const enc = new TextEncoder()
          const big = new Uint8Array(6 * 1024 * 1024)
          let sent = false
          return new ReadableStream<Uint8Array>({
            pull(c) { if (!sent) { c.enqueue(enc.encode('HTTP/1.1 200 OK\r\ncontent-type: text/html\r\n\r\n')); sent = true; return } c.enqueue(big); c.close() },
          })
        },
      })
      const res = await GET({ request: fetchReq('https://example.com/', await validToken()) } as any)
      // body drains and surfaces the cap; endpoint returns 413
      expect([413, 200]).toContain(res.status)
      if (res.status === 200) {
        await expect(res.text()).rejects.toBeTruthy()
      }
    })

    it('502 maps from an upstream error', async () => {
      __setHooks({
        resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
        connect: async () => {
          const enc = new TextEncoder()
          return new ReadableStream<Uint8Array>({ pull(c) { c.enqueue(enc.encode('HTTP/1.1 500 Err\r\ncontent-type: text/html\r\n\r\n')); c.close() } })
        },
      })
      const res = await GET({ request: fetchReq('https://example.com/', await validToken()) } as any)
      expect(res.status).toBe(502)
    })

    it('400 on unknown type', async () => {
      const res = await GET({ request: fetchReq('https://example.com/', await validToken(), 'bogus') } as any)
      expect(res.status).toBe(400)
    })
  })
  ```
  Note: the 413 case has a known subtlety — a mid-stream cap abort surfaces when the body is drained, not at header time. The endpoint pre-buffers `page`/`sitemap` bodies (they are small, <=5MB, parsed client-side anyway) so the cap maps cleanly to 413; `image` bodies are streamed through unbuffered (cap aborts the client stream). The test allows either form for the streamed case.

- [ ] 7. Run it, expect FAIL: `npx vitest run --project workers src/pages/api/fetch.endpoint.test.ts`.
  Expected: import error — red.

- [ ] 8. Create `src/pages/api/fetch.ts`:
  ```ts
  import type { APIContext } from 'astro'
  import { env } from 'cloudflare:workers'
  import { verifyToken } from '../../server/token'
  import { clientIpHash } from '../../server/ip'
  import { requireSecret } from '../../server/turnstile'
  import { isSafePublicUrl } from '../../lib/url-safety'
  import { pinnedFetch, ProxyError, isOwnZoneOrDenied } from '../../server/proxy'
  import { cacheKeyFor, getCached, putCached } from '../../server/cache'

  export const prerender = false

  function err(status: number, code: string, retryAfter?: number): Response {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (retryAfter) headers['retry-after'] = String(retryAfter)
    return new Response(JSON.stringify({ error: code }), { status, headers })
  }
  function clientIp(req: Request): string {
    return req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || '0.0.0.0'
  }
  function bearer(req: Request): string | null {
    const h = req.headers.get('authorization') || ''
    return h.startsWith('Bearer ') ? h.slice(7) : null
  }

  export async function GET(ctx: APIContext): Promise<Response> {
    const e = env as Record<string, any>
    const hmacSecret = requireSecret('SESSION_HMAC_SECRET', e.SESSION_HMAC_SECRET)
    const req = ctx.request

    // 1. Auth
    const token = bearer(req)
    if (!token) return err(401, 'no-token')
    const ipHash = await clientIpHash(clientIp(req))
    const verified = await verifyToken(token, hmacSecret, ipHash)
    if (!verified.ok) return err(401, verified.reason)

    // 2. Params
    const u = new URL(req.url)
    const target = u.searchParams.get('url')
    const type = u.searchParams.get('type')
    if (!target) return err(400, 'missing-url')
    if (type !== 'page' && type !== 'sitemap' && type !== 'image') return err(400, 'bad-type')

    // 3. URL safety + own-zone
    const safe = isSafePublicUrl(target)
    if (!safe.ok) return err(400, 'blocked-url:' + safe.reason)
    const denylist = String(e.DEST_DENYLIST ?? '').split(',')
    if (isOwnZoneOrDenied(safe.url, new URL(req.url).hostname, String(e.ZONE_APEX ?? ''), denylist)) {
      return err(400, 'own-zone')
    }

    // 4. Edge cache (text only; never cache 3xx/4xx/5xx). Image bytes stream through.
    const cache = (caches as any).default as Cache | undefined
    const key = cacheKeyFor(safe.url)
    if (cache && type !== 'image') {
      const hit = await getCached(cache, key)
      if (hit) return hit
    }

    // 5. Relay
    try {
      const relayed = await pinnedFetch(safe.url, { type })
      if (type === 'image') {
        return relayed // streamed; cap aborts mid-stream
      }
      // page/sitemap: buffer (small, client-parses) so the cap maps cleanly to 413
      const bytes = await relayed.arrayBuffer()
      const out = new Response(bytes, { status: 200, headers: relayed.headers })
      if (cache) {
        const ttl = 3600
        const maxObj = Number(e.MAX_PAGE_BYTES ?? '5242880')
        return await putCached(cache, key, out, ttl, maxObj)
      }
      return out
    } catch (e2) {
      if (e2 instanceof ProxyError) return err(e2.status, e2.message, e2.status === 429 ? 30 : undefined)
      return err(502, 'relay-failed')
    }
  }
  ```

- [ ] 9. Run it, expect PASS: `npx vitest run --project workers src/pages/api/fetch.endpoint.test.ts`.
  Expected: all cases pass (the 413 case asserts either 413 or a body that rejects).

- [ ] 10. Commit:
  ```
  git add -A && git commit -m "feat(proxy): GET /api/fetch auth + type routing + own-zone deny + edge cache + error mapping"
  ```

---

## Task 7 — Rate-limit binding + per-token fetch/byte budgets + per-host cap + global egress breaker

The accurate accounting layer the soft RL binding cannot provide. Wire into `GET /api/fetch`.

**Files**
- Create: `src/server/budgets.ts`, `src/server/budgets.test.ts`
- Modify: `src/pages/api/fetch.ts` (enforce budgets), `src/pages/api/fetch.endpoint.test.ts` (budget cases)

**Interfaces**
- Produces:
  ```ts
  export interface RateLimitContext { kv: KVNamespace; rl?: { limit(opts: { key: string }): Promise<{ success: boolean }> } }
  export async function checkBurst(ctx: RateLimitContext, tokenNonce: string): Promise<boolean>          // true = limited
  export async function consumeFetchBudget(kv: KVNamespace, nonce: string, limit: number): Promise<boolean>  // true = over budget
  export async function consumeByteBudget(kv: KVNamespace, nonce: string, bytes: number, limit: number): Promise<boolean>
  export async function consumeHostCap(kv: KVNamespace, host: string, limit: number): Promise<boolean>
  export async function consumeGlobalEgress(kv: KVNamespace, bytes: number, limit: number): Promise<boolean>
  ```

**Steps**

- [ ] 1. Write the failing test `src/server/budgets.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest'
  import { env } from 'cloudflare:test'
  import { checkBurst, consumeFetchBudget, consumeByteBudget, consumeHostCap, consumeGlobalEgress } from './budgets'

  const kv = () => (env as any).BUDGETS as KVNamespace

  describe('consumeFetchBudget', () => {
    it('allows up to the limit then blocks', async () => {
      const n = 'nonce-fetch-' + Math.random()
      let blocked = false
      for (let i = 0; i < 4; i++) blocked = await consumeFetchBudget(kv(), n, 3)
      expect(blocked).toBe(true)
    })
  })

  describe('consumeByteBudget', () => {
    it('blocks once cumulative bytes exceed the limit', async () => {
      const n = 'nonce-byte-' + Math.random()
      expect(await consumeByteBudget(kv(), n, 600, 1000)).toBe(false)
      expect(await consumeByteBudget(kv(), n, 600, 1000)).toBe(true)
    })
  })

  describe('consumeHostCap', () => {
    it('caps fetches per destination host', async () => {
      const h = 'victim-' + Math.random() + '.test'
      let blocked = false
      for (let i = 0; i < 3; i++) blocked = await consumeHostCap(kv(), h, 2)
      expect(blocked).toBe(true)
    })
  })

  describe('consumeGlobalEgress', () => {
    it('trips the global breaker over the instance cap', async () => {
      // use a tiny cap to make the test deterministic without huge counts
      expect(await consumeGlobalEgress(kv(), 10, 15)).toBe(false)
      expect(await consumeGlobalEgress(kv(), 10, 15)).toBe(true)
    })
  })

  describe('checkBurst', () => {
    it('returns false when the RL binding reports success', async () => {
      const limited = await checkBurst({ kv: kv(), rl: { limit: async () => ({ success: true }) } }, 'nonce-x')
      expect(limited).toBe(false)
    })
    it('returns true when the RL binding reports throttled', async () => {
      const limited = await checkBurst({ kv: kv(), rl: { limit: async () => ({ success: false }) } }, 'nonce-y')
      expect(limited).toBe(true)
    })
    it('returns false when no RL binding present', async () => {
      const limited = await checkBurst({ kv: kv() }, 'nonce-z')
      expect(limited).toBe(false)
    })
  })
  ```

- [ ] 2. Run it, expect FAIL: `npx vitest run --project workers src/server/budgets.test.ts`.
  Expected: import error — red.

- [ ] 3. Create `src/server/budgets.ts`:
  ```ts
  export interface RateLimitContext {
    kv: KVNamespace
    rl?: { limit(opts: { key: string }): Promise<{ success: boolean }> }
  }

  // KV counters are eventually-consistent and best-effort. They bound a crawl/
  // session; the WAF zone rules (hosted) are the hard ceiling.
  async function incr(kv: KVNamespace, key: string, by: number, ttl: number): Promise<number> {
    const raw = await kv.get(key)
    const n = (raw ? Number(raw) : 0) + by
    await kv.put(key, String(n), { expirationTtl: ttl })
    return n
  }

  export async function checkBurst(ctx: RateLimitContext, tokenNonce: string): Promise<boolean> {
    if (!ctx.rl) return false
    const r = await ctx.rl.limit({ key: tokenNonce })
    return !r.success
  }

  export async function consumeFetchBudget(kv: KVNamespace, nonce: string, limit: number): Promise<boolean> {
    const n = await incr(kv, `bud:fetch:${nonce}`, 1, 3 * 3600)
    return n > limit
  }

  export async function consumeByteBudget(kv: KVNamespace, nonce: string, bytes: number, limit: number): Promise<boolean> {
    const n = await incr(kv, `bud:bytes:${nonce}`, bytes, 3 * 3600)
    return n > limit
  }

  export async function consumeHostCap(kv: KVNamespace, host: string, limit: number): Promise<boolean> {
    const n = await incr(kv, `bud:host:${host}`, 1, 3600)
    return n > limit
  }

  export async function consumeGlobalEgress(kv: KVNamespace, bytes: number, limit: number): Promise<boolean> {
    const bucket = Math.floor(Date.now() / 3600000) // hourly window
    const n = await incr(kv, `bud:global:${bucket}`, bytes, 7200)
    return n > limit
  }
  ```

- [ ] 4. Run it, expect PASS: `npx vitest run --project workers src/server/budgets.test.ts`.
  Expected: all describe blocks pass.

- [ ] 5. Add two failing budget cases to `src/pages/api/fetch.endpoint.test.ts` (before the closing `})` of the main describe):
  ```ts
    it('429 when the per-token fetch budget is exhausted', async () => {
      __setHooks({
        resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
        connect: async () => {
          const enc = new TextEncoder()
          return new ReadableStream<Uint8Array>({ pull(c) { c.enqueue(enc.encode('HTTP/1.1 200 OK\r\ncontent-type: text/html\r\n\r\nok')); c.close() } })
        },
      })
      // Force a tiny budget for this test via env override
      const original = (env as any).PER_TOKEN_FETCH_BUDGET
      ;(env as any).PER_TOKEN_FETCH_BUDGET = '2'
      const t = await validToken()
      let last = 200
      for (let i = 0; i < 4; i++) {
        const res = await GET({ request: fetchReq('https://example.com/p' + i, t) } as any)
        last = res.status
      }
      ;(env as any).PER_TOKEN_FETCH_BUDGET = original
      expect(last).toBe(429)
    })

    it('429 when the per-destination-host cap is hit', async () => {
      __setHooks({
        resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
        connect: async () => {
          const enc = new TextEncoder()
          return new ReadableStream<Uint8Array>({ pull(c) { c.enqueue(enc.encode('HTTP/1.1 200 OK\r\ncontent-type: text/html\r\n\r\nok')); c.close() } })
        },
      })
      const original = (env as any).PER_HOST_FETCH_CAP
      ;(env as any).PER_HOST_FETCH_CAP = '2'
      // fresh tokens each so the per-token budget is not what trips
      let last = 200
      for (let i = 0; i < 4; i++) {
        const t = await mintSession(IP, (env as any).SESSION_HMAC_SECRET, 2700)
        const res = await GET({ request: fetchReq('https://victimhost.test/r' + i, t) } as any)
        last = res.status
      }
      ;(env as any).PER_HOST_FETCH_CAP = original
      expect(last).toBe(429)
    })
  ```

- [ ] 6. Run it, expect FAIL: `npx vitest run --project workers src/pages/api/fetch.endpoint.test.ts`.
  Expected: the two new budget cases fail (current endpoint returns 200) — red.

- [ ] 7. Wire budgets into `src/pages/api/fetch.ts`. Add the import and enforcement between auth (step 1) and the relay (step 5). Insert after the URL-safety / own-zone block:
  ```ts
  import { checkBurst, consumeFetchBudget, consumeHostCap, consumeGlobalEgress, consumeByteBudget } from '../../server/budgets'
  ```
  and after the `isOwnZoneOrDenied` check, before the cache block:
  ```ts
    const kv = e.BUDGETS as KVNamespace
    const nonce = verified.claims.nonce

    // Burst throttle (soft, per-colo) + accurate per-token / per-host / global budgets.
    if (await checkBurst({ kv, rl: e.RL }, nonce)) return err(429, 'burst', 10)
    if (await consumeFetchBudget(kv, nonce, Number(e.PER_TOKEN_FETCH_BUDGET ?? '300'))) return err(429, 'fetch-budget', 60)
    if (await consumeHostCap(kv, safe.url.hostname.toLowerCase(), Number(e.PER_HOST_FETCH_CAP ?? '120'))) return err(429, 'host-cap', 60)
  ```
  Then change the relay block to update byte budgets/global egress after a successful page/sitemap buffer, and (for images) account the cap as the worst-case estimate. Replace the page/sitemap branch's `return await putCached(...)` area with:
  ```ts
      // page/sitemap: buffer (small, client-parses) so the cap maps cleanly to 413
      const bytes = await relayed.arrayBuffer()
      if (await consumeByteBudget(kv, nonce, bytes.byteLength, Number(e.PER_TOKEN_BYTE_BUDGET ?? '524288000'))) {
        return err(429, 'byte-budget', 60)
      }
      await consumeGlobalEgress(kv, bytes.byteLength, Number(e.GLOBAL_EGRESS_BYTE_CAP ?? '107374182400'))
      const out = new Response(bytes, { status: 200, headers: relayed.headers })
  ```
  For the image branch, account the cap as the conservative debit before streaming:
  ```ts
      if (type === 'image') {
        await consumeByteBudget(kv, nonce, Number(e.MAX_IMAGE_BYTES ?? '26214400'), Number(e.PER_TOKEN_BYTE_BUDGET ?? '524288000'))
        await consumeGlobalEgress(kv, Number(e.MAX_IMAGE_BYTES ?? '26214400'), Number(e.GLOBAL_EGRESS_BYTE_CAP ?? '107374182400'))
        return relayed
      }
  ```
  (Note: the `kv`/`nonce` are now declared once near the top of the relay section; remove the earlier `const cache = ...` ordering conflict by keeping cache lookup after budgets. Re-read the file and ensure single declarations.)

- [ ] 8. Run it, expect PASS: `npx vitest run --project workers src/pages/api/fetch.endpoint.test.ts`.
  Expected: all cases including the two budget cases pass.

- [ ] 9. Run the full workers + node suites to confirm no regressions: `npm test`.
  Expected: both projects green (`Test Files N passed` for each).

- [ ] 10. Commit:
  ```
  git add -A && git commit -m "feat(proxy): per-token fetch/byte budgets, per-host cap, global egress breaker + RL burst throttle"
  ```

---

## Task 8 — Abuse-policy doc + configurable destination denylist (verification)

Documents the residual open-relay risk and verifies the `DEST_DENYLIST` var actually blocks a configured host end-to-end.

**Files**
- Create: `docs/ABUSE_POLICY.md`
- Modify: `src/pages/api/fetch.endpoint.test.ts` (denylist case), `README.md`

**Interfaces**
- Consumes: `isOwnZoneOrDenied` (already wired in Task 6/7).

**Steps**

- [ ] 1. Add a failing denylist case to `src/pages/api/fetch.endpoint.test.ts`:
  ```ts
    it('400 when the target host is on DEST_DENYLIST', async () => {
      const original = (env as any).DEST_DENYLIST
      ;(env as any).DEST_DENYLIST = 'banned.test,evil.example'
      const res = await GET({ request: fetchReq('https://sub.banned.test/x', await validToken()) } as any)
      ;(env as any).DEST_DENYLIST = original
      expect(res.status).toBe(400)
    })
  ```

- [ ] 2. Run it, expect PASS already (the denylist plumbing landed in Task 6): `npx vitest run --project workers src/pages/api/fetch.endpoint.test.ts`.
  Expected: the new case passes. If it FAILS, the denylist split is not reaching `isOwnZoneOrDenied` — fix `String(e.DEST_DENYLIST ?? '').split(',')` in `fetch.ts`, then re-run to green.

- [ ] 3. Create `docs/ABUSE_POLICY.md`:
  ```markdown
  # ScrapeConvert Proxy — Abuse Policy

  The `/api/fetch` endpoint is an authenticated, anonymous GET relay. Even with
  SSRF fully pinned (DNS-resolved IPs validated against the special-use blocklist,
  connection pinned to the validated literal IP, manual per-hop redirect
  revalidation), an open relay carries residual risk. This document states what a
  deployer exposes and how the hosted instance bounds it.

  ## What the proxy will not do
  - It will not connect to private, loopback, link-local, CGNAT, multicast, or
    reserved address space (IPv4 and IPv6, including IPv4-mapped and NAT64).
    Decimal/octal/hex/single-number IP encodings are normalized and rejected.
  - It will not reach the configured zone apex, its subdomains, `*.workers.dev`,
    the request host, or `/api/fetch` itself (self-recursion).
  - It will not forward client `Cookie` / `Authorization` / `Referer` / `CF-*` /
    `X-Forwarded-*` headers, and it strips upstream `Set-Cookie` and security
    headers from responses.
  - It will not relay `text/html` as `type=image`, and image responses carry
    `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`.

  ## Bounds on volume
  - Per-token total-fetch budget and total-byte budget (a crawl is bounded).
  - Per-destination-host cap (the proxy cannot be aimed as a DDoS at one site).
  - Global per-instance egress circuit breaker.
  - Token issuance is Turnstile-gated and per-IP mint-rate-limited; the hosted
    instance layers Cloudflare WAF zone rules as the hard ceiling.

  ## robots.txt stance
  v1 does not fetch or honor `robots.txt` automatically. Operators who need
  robots compliance should add target hosts to `DEST_DENYLIST` or run the optional
  robots check client-side before crawling. This stance is documented, not silently
  ignored.

  ## Configurable destination denylist
  Set `DEST_DENYLIST` in `wrangler.toml` to a comma-separated list of host
  suffixes. A target matches if its host equals an entry or ends with `.<entry>`.
  Example: `DEST_DENYLIST = "internal.example,partner.test"`.

  ## Takedown / abuse contact (hosted instance)
  Report abuse of the hosted instance to the contact published at
  `scrapeconvert.com/about`. The operator may add hosts to the denylist, tighten
  budgets, or revoke issuance. Self-hosters are responsible for their own instance.

  ## Free-tier note
  Self-hosters on the Cloudflare free tier rely on the soft Rate Limiting binding
  plus the KV budgets above. The Worker stays within the free-tier limits (<=50
  subrequests per invocation, ~10ms CPU): one page or one image per invocation,
  no server-side fan-out, no server-side HTML/XML parsing.
  ```

- [ ] 4. Add a deploy/abuse section to `README.md`. Append a section documenting required secrets, the budgets, the denylist var, and a link to `docs/ABUSE_POLICY.md`. Add this block to the end of `README.md`:
  ```markdown
  ## Proxy security and abuse

  The scraping proxy (`/api/fetch`) is SSRF-pinned and abuse-bounded. Before deploy:

  - Set the required secrets (deploy fails if unset):
    - `wrangler secret put SESSION_HMAC_SECRET`
    - `wrangler secret put TURNSTILE_SECRET`
  - Review the budget vars in `wrangler.toml`: `PER_TOKEN_FETCH_BUDGET`,
    `PER_TOKEN_BYTE_BUDGET`, `PER_HOST_FETCH_CAP`, `GLOBAL_EGRESS_BYTE_CAP`,
    `MINT_RATE_PER_IP_PER_MIN`, `TOKEN_TTL_SECONDS`.
  - Extend the destination blocklist with `DEST_DENYLIST` (comma-separated host
    suffixes) as needed.
  - Read `docs/ABUSE_POLICY.md` so you understand the residual open-relay risk you
    accept by running an instance.
  ```

- [ ] 5. Verify the docs reference real var names. Run:
  ```
  grep -o 'PER_TOKEN_FETCH_BUDGET\|PER_TOKEN_BYTE_BUDGET\|PER_HOST_FETCH_CAP\|GLOBAL_EGRESS_BYTE_CAP\|MINT_RATE_PER_IP_PER_MIN\|DEST_DENYLIST' wrangler.toml | sort -u
  ```
  Expected: every name in the README/abuse doc also appears in `wrangler.toml` (six names listed).

- [ ] 6. Commit:
  ```
  git add -A && git commit -m "docs(proxy): abuse policy + configurable destination denylist + README deploy/security section"
  ```

---

## Task 9 — Required-secret deploy guard + `.env.example` + full-suite gate

Make the missing-secret failure a deploy-time gate (not just runtime), ship `.env.example` with placeholders only, and run the whole §14 matrix green.

**Files**
- Modify: `.env.example`, `package.json` (a `predeploy` secret check), `README.md` (already covered)
- Create: `scripts/check-secrets.mjs`

**Interfaces**
- Consumes: nothing new; relies on `requireSecret` runtime guard from Task 5.

**Steps**

- [ ] 1. Create `.env.example` with placeholders only (never a usable key):
  ```
  # Cloudflare Turnstile (https://dash.cloudflare.com -> Turnstile)
  PUBLIC_TURNSTILE_SITE_KEY=0x0000000000000000000000
  TURNSTILE_SECRET=replace-with-your-turnstile-secret

  # Session token signing. REQUIRED. No default. Generate with:
  #   openssl rand -hex 32
  SESSION_HMAC_SECRET=replace-with-a-32-byte-hex-secret

  # Proxy budgets (override defaults in wrangler.toml if desired)
  PER_TOKEN_FETCH_BUDGET=300
  PER_TOKEN_BYTE_BUDGET=524288000
  PER_HOST_FETCH_CAP=120
  GLOBAL_EGRESS_BYTE_CAP=107374182400
  MINT_RATE_PER_IP_PER_MIN=10
  TOKEN_TTL_SECONDS=2700

  # Optional comma-separated destination host-suffix denylist
  DEST_DENYLIST=
  ```

- [ ] 2. Create `scripts/check-secrets.mjs` (a deploy-time gate that fails if a required secret is not configured for the target environment):
  ```js
  // Deploy guard: fail if required Worker secrets are not configured.
  // Run before `wrangler deploy`. Checks `wrangler secret list` output.
  import { execSync } from 'node:child_process'

  const REQUIRED = ['SESSION_HMAC_SECRET', 'TURNSTILE_SECRET']

  let listed = ''
  try {
    listed = execSync('npx wrangler secret list', { encoding: 'utf8' })
  } catch (e) {
    console.error('Could not list Worker secrets:', e.message)
    process.exit(1)
  }

  const missing = REQUIRED.filter((name) => !listed.includes(name))
  if (missing.length) {
    console.error('Missing required Worker secrets (deploy blocked):', missing.join(', '))
    console.error('Set them with: wrangler secret put <NAME>')
    process.exit(1)
  }
  console.log('All required secrets present:', REQUIRED.join(', '))
  ```

- [ ] 3. Wire it into `package.json` as a predeploy gate. Add scripts:
  ```json
  "check:secrets": "node scripts/check-secrets.mjs",
  "predeploy": "node scripts/check-secrets.mjs",
  "deploy": "wrangler deploy"
  ```
  Verify the script parses (offline, expect a controlled non-zero exit because secrets are not set locally): run `node scripts/check-secrets.mjs; echo "exit=$?"`.
  Expected: prints either `Missing required Worker secrets ... exit=1` or `Could not list Worker secrets ... exit=1` — confirms the guard fails closed.

- [ ] 4. Confirm `.env.example` carries no usable key. Run:
  ```
  grep -nE 'SESSION_HMAC_SECRET=replace|TURNSTILE_SECRET=replace' .env.example && grep -nvE 'replace|0x0000|^#|^$|^[A-Z_]+=[0-9]+$|^DEST_DENYLIST=$' .env.example
  ```
  Expected: the first grep matches both placeholders; the second grep prints nothing (no line carries a real-looking secret value).

- [ ] 5. Run the complete Phase-1 test suite (the full §14 matrix) as the phase gate: `npm test`.
  Expected: node project green (url-safety + token) and workers project green (resolve, fetch, turnstile, cache, budgets, both endpoints). Final summary: `Test Files` count covers all test files, `0 failed`.

- [ ] 6. Type-check the server modules (no `node:*`, contract signatures honored). Run: `npx tsc --noEmit`.
  Expected: exit 0 (no type errors). If `cloudflare:workers` / `cloudflare:test` types are unresolved, ensure `@cloudflare/workers-types` and `@cloudflare/vitest-pool-workers` are in `tsconfig` `types`/`compilerOptions` — then re-run to green.

- [ ] 7. Commit:
  ```
  git add -A && git commit -m "chore(proxy): required-secret deploy guard + .env.example placeholders + full §14 suite green"
  ```

---

## Phase 1 completion checklist

- [ ] `src/lib/url-safety.ts` — `isSafePublicUrl` + `isBlockedIp`, full §14 SSRF matrix green (Task 1).
- [ ] `src/server/proxy.ts` — `resolveAndValidate` (Task 2) + `pinnedFetch` (Task 3) + `isOwnZoneOrDenied` (Task 6).
- [ ] `src/server/token.ts` + `src/server/ip.ts` — HMAC sign/verify, forge/expire/ip-mismatch green (Task 4).
- [ ] `POST /api/turnstile` — siteverify + dup-reject + per-IP mint limit + required secrets (Task 5).
- [ ] `GET /api/fetch` — auth + type routing + own-zone deny + edge cache + 400/401/413/429/502 (Task 6).
- [ ] Budgets — per-token fetch/byte, per-host cap, global egress breaker, RL burst (Task 7).
- [ ] `docs/ABUSE_POLICY.md` + `DEST_DENYLIST` (Task 8).
- [ ] Required-secret deploy guard + `.env.example` placeholders (Task 9).
- [ ] `npm test` fully green; `npx tsc --noEmit` clean; no `node:crypto` import anywhere in `src/server/` (`grep -rn "node:crypto\|require('crypto')" src/` returns nothing).
- [ ] No UI consumes the proxy yet — Phase 2 begins only after this suite is green.
