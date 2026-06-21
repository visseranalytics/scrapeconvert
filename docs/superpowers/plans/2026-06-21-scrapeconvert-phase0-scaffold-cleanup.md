---
# Phase 0: Scaffold + Open-Source Cleanup Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
**Goal:** Convert the existing Vite/AI-Studio SPA into an Astro SSR app on the Cloudflare adapter that builds, renders a minimal marketing index, deploys to a staging Worker, and is clean enough to open-source (no Gemini/AI-Studio scaffolding, MIT licensed, documented).
**Architecture:** One Astro project pinned to `astro@6.4.8` + `@astrojs/cloudflare@13.7.0` with `output: 'server'` (SSR) running on a single Cloudflare Worker. `wrangler.toml` declares the Worker name, `compatibility_date`, a rate-limit binding placeholder, and `vars`. The legacy Vite/React-Router SPA entry, Gemini wiring, Vercel rewrite, and AI-Studio importmap are removed; a single `.astro` marketing route is the only rendered page Phase 0 ships (the React app islands arrive in Phase 2).
**Tech Stack:** Astro 6.4.8 (SSR), `@astrojs/cloudflare` 13.7.0, Wrangler 4.103.0, TypeScript 5.8, Node 22+, npm. Bindings read via `import { env } from 'cloudflare:workers'`. WebCrypto only (no `node:crypto`, no `nodejs_compat`).

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

## Scope notes (read before starting)

This is Phase 0 of a five-phase overhaul (spec §15). Phase 0 produces a deployable, publishable scaffold; it does **not** build the proxy (Phase 1), app islands (Phase 2), extension (Phase 3), or final marketing (Phase 4). The SHARED INTERFACE CONTRACT modules (`src/lib/*`, `src/server/*`, `src/pages/api/*`) are **not** created here; they are referenced so later phases compose.

What Phase 0 deletes (spec §10): the AI-Studio `index.html` importmap (`aistudiocdn.com`), the `@google/genai` dependency, the `GEMINI_API_KEY` / `process.env.API_KEY` wiring (in `vite.config.ts`), `vercel.json`, and the stray `metadata.json`. The cleanup acceptance check greps for `Morphix`, `GEMINI`, `aistudiocdn`, `@google/genai`, `process.env.API_KEY`, `metadata.json` and must come back clean.

The existing `src/` (Vite SPA: `main.tsx`, `router.tsx`, `features/`, `shared/`) and `index.html` / `vite.config.ts` are legacy. The Astro rebuild lives under a fresh `src/pages/` + `src/layouts/`. Phase 0 **removes** the legacy Vite SPA entry points so the repo builds clean as an Astro app; the React feature components are rewritten in Phase 2 and are not carried forward verbatim, so they are deleted in Phase 0 to keep the published repo honest about what works. The `extension/` directory is left untouched (Phase 3 owns it). The `design-mocks/` and `docs/` directories are left untouched.

Verified facts at plan-write time:
- `astro@6.4.8` is the `latest` dist-tag. `@astrojs/cloudflare@13.7.0` is `latest`; its peer deps are `astro@^6.3.0` and `wrangler@^4.83.0`. `wrangler@4.103.0` is `latest`. `@jsquash/avif@2.1.1` is `latest`.
- Node 25.2.1 / npm 11.6.2 are installed locally; CI/runtime target is Node 22+.
- Current branch is `main`. Per CLAUDE workflow rules, do NOT create a feature branch; commit directly to the working branch (or a worktree if the executor prefers isolation).
- Existing files to act on: `package.json`, `package-lock.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `vercel.json`, `metadata.json`, `README.md`, `.gitignore`, `public/` (images, manifest.json, robots.txt), `src/main.tsx`, `src/router.tsx`, `src/index.css`, `src/features/`, `src/shared/`.

---

## File structure (Create / Modify / Delete)

**Delete (legacy Vite/AI-Studio):**
- `index.html` (AI-Studio importmap entry)
- `vite.config.ts` (Gemini `process.env.API_KEY` wiring)
- `vercel.json`
- `metadata.json`
- `src/main.tsx`, `src/router.tsx` (Vite/React-Router SPA bootstrap)
- `src/features/` (legacy React features; rewritten in Phase 2)
- `src/shared/` (legacy shared components; rewritten in Phase 2)

**Create:**
- `astro.config.mjs` — Astro config: cloudflare adapter, `output: 'server'`.
- `wrangler.toml` — Worker name, `compatibility_date`, rate-limit binding placeholder, `vars`.
- `src/pages/index.astro` — minimal marketing index route.
- `src/layouts/Base.astro` — shared HTML shell (head/meta moved off the deleted `index.html`).
- `src/env.d.ts` — Astro + Cloudflare runtime type references.
- `LICENSE` — MIT.
- `.env.example` — `PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `SESSION_HMAC_SECRET` (placeholder), rate-limit config.
- `scripts/cleanup-check.sh` — grep-based open-source cleanup acceptance check.

**Modify:**
- `package.json` — remove `@google/genai`, `react-router-dom`, `@vercel/analytics`, Vite plugins, `vite-plugin-sitemap`; add `astro` + `@astrojs/cloudflare` + `wrangler` + `@astrojs/react` + jsquash deps; new scripts (`dev`/`build`/`preview`/`deploy`/`cleanup-check`).
- `tsconfig.json` — extend `astro/tsconfigs/strict`.
- `.gitignore` — add Astro / Wrangler ignores (`.astro/`, `.wrangler/`, `dist/` already present).
- `README.md` — rewrite (features, deploy-to-Cloudflare, env vars, self-host); strip Morphix.

**No test framework is added in Phase 0.** Phase 0 deliverables are config/scaffold/deploy artifacts, verified with explicit commands + expected output, plus one executable shell acceptance check (`scripts/cleanup-check.sh`) that doubles as the test for the cleanup task. Vitest is introduced in Phase 1 where the proxy logic demands unit tests.

---

## Task 1: Remove AI-Studio / Vercel scaffolding and add the cleanup acceptance check

Deletes the leftover scaffolding files (spec §10) and lands an executable grep-based acceptance check. The check is written first and must FAIL against the dirty repo, then PASS after the deletions and dependency edits land. This is the closest thing Phase 0 has to a TDD red/green cycle, so it leads.

**Files:**
- Create: `scripts/cleanup-check.sh`
- Delete: `vercel.json`, `metadata.json`, `index.html`, `vite.config.ts`, `src/main.tsx`, `src/router.tsx`, `src/features/`, `src/shared/`
- Modify: `package.json` (drop `@google/genai`)

**Interfaces:** None cross-phase. This task produces the cleanup gate the rest of Phase 0 (and CI) reruns.

Steps:

- [ ] **1.1 Write the failing acceptance check.** Create `scripts/cleanup-check.sh` with the exact content below. It greps tracked files for the six forbidden markers and fails if any match. It excludes `docs/`, `design-mocks/`, and the script itself (those legitimately mention the cleanup terms).

```sh
#!/usr/bin/env bash
# Open-source cleanup acceptance check (spec ##10).
# Fails if any AI-Studio / Morphix / Gemini / Vercel scaffolding remains.
set -euo pipefail

PATTERNS=(
  'Morphix'
  'GEMINI'
  'aistudiocdn'
  '@google/genai'
  'process\.env\.API_KEY'
  'metadata\.json'
)

# Search tracked files only; exclude docs, design mocks, and this script
# (they reference the forbidden terms on purpose).
fail=0
for pat in "${PATTERNS[@]}"; do
  matches=$(git ls-files \
    | grep -vE '^(docs/|design-mocks/|scripts/cleanup-check\.sh$)' \
    | xargs grep -nIE "$pat" 2>/dev/null || true)
  if [ -n "$matches" ]; then
    echo "CLEANUP FAIL: pattern '$pat' still present:"
    echo "$matches"
    fail=1
  fi
done

# The stray scaffolding file must not exist at the repo root.
if [ -f metadata.json ]; then
  echo "CLEANUP FAIL: metadata.json still exists at repo root"
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo "---"
  echo "Cleanup check FAILED."
  exit 1
fi

echo "Cleanup check PASSED: no AI-Studio / Morphix / Gemini / Vercel scaffolding found."
```

- [ ] **1.2 Make it executable and run it, expect FAIL.** Run:

```
chmod +x scripts/cleanup-check.sh && ./scripts/cleanup-check.sh; echo "exit=$?"
```

Expected output: multiple `CLEANUP FAIL:` lines (at least `Morphix` in `README.md`, `aistudiocdn` / `@google/genai` in `index.html`, `process.env.API_KEY` in `vite.config.ts`, `metadata.json` at root), ending with `Cleanup check FAILED.` and `exit=1`.

- [ ] **1.3 Delete the scaffolding files.** Run:

```
git rm -q vercel.json metadata.json index.html vite.config.ts src/main.tsx src/router.tsx && git rm -rqf src/features src/shared && echo "removed"
```

Expected output: `removed`. (Legacy React features/shared are rewritten in Phase 2; deleting now keeps the published repo honest. `src/index.css` is kept for now and is replaced/relocated under the Astro layout in Task 3.)

- [ ] **1.4 Drop the `@google/genai` dependency from `package.json`.** Edit `package.json`, removing the line `"@google/genai": "^1.30.0",` from `dependencies`. (Other dependency churn happens in Task 2; this single removal is what the cleanup check needs.)

- [ ] **1.5 Re-run the cleanup check, expect remaining failures narrowed to README.** Run:

```
./scripts/cleanup-check.sh; echo "exit=$?"
```

Expected output: the `Morphix` failure in `README.md` remains (README is rewritten in Task 6), `Cleanup check FAILED.`, `exit=1`. All other patterns (`GEMINI`, `aistudiocdn`, `@google/genai`, `process.env.API_KEY`, `metadata.json`) are now gone. (The check returns fully green only after Task 6 rewrites the README; that is the task that owns the final PASS.)

- [ ] **1.6 Commit.** Run:

```
git add -A && git commit -m "Phase 0: remove AI-Studio/Vercel scaffolding, add cleanup acceptance check"
```

Expected output: a commit summary listing the deletions, the new `scripts/cleanup-check.sh`, and the `package.json` edit.

---

## Task 2: Pin Astro + Cloudflare adapter dependencies and scripts

Replaces the Vite/React-Router/Vercel dependency set with the pinned Astro + Cloudflare adapter stack and rewrites the npm scripts. Versions are pinned to exact values (no `^`) per the Global Constraint to keep the build reproducible for open-source contributors.

**Files:**
- Modify: `package.json`
- Create/regenerate: `package-lock.json` (via `npm install`)

**Interfaces:** None cross-phase. Produces the toolchain every later phase builds on.

Steps:

- [ ] **2.1 Rewrite `package.json` to the Astro stack.** Replace the entire file with:

```json
{
  "name": "scrapeconvert",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "wrangler dev",
    "deploy": "astro build && wrangler deploy",
    "deploy:staging": "astro build && wrangler deploy --env staging",
    "cleanup-check": "./scripts/cleanup-check.sh",
    "astro": "astro"
  },
  "dependencies": {
    "@astrojs/cloudflare": "13.7.0",
    "@astrojs/react": "4.4.0",
    "@jsquash/avif": "2.1.1",
    "@jsquash/jpeg": "1.6.0",
    "@jsquash/oxipng": "2.3.0",
    "@jsquash/png": "3.1.1",
    "@jsquash/webp": "1.5.0",
    "astro": "6.4.8",
    "jszip": "3.10.1",
    "react": "19.2.0",
    "react-dom": "19.2.0",
    "uuid": "13.0.0"
  },
  "devDependencies": {
    "@types/node": "22.14.0",
    "@types/react": "19.2.7",
    "@types/react-dom": "19.2.3",
    "typescript": "5.8.2",
    "wrangler": "4.103.0"
  }
}
```

Notes: `@astrojs/react` is the Astro React island integration (replaces `@vitejs/plugin-react`); the `@jsquash/*` + `jszip` + `uuid` + React deps are kept for Phase 2 conversion code; Tailwind/PostCSS/autoprefixer/`vite-plugin-sitemap`/`@vercel/analytics`/`react-router-dom` are dropped (styling and sitemap are revisited in Phase 4). `@astrojs/react@4.4.0` is the current stable adapter-compatible release; if `npm install` reports a peer conflict, run `npm view @astrojs/react peerDependencies` and pin the version whose `astro` peer satisfies `^6.3.0`.

- [ ] **2.2 Install and regenerate the lockfile.** Run:

```
rm -f package-lock.json && npm install
```

Expected output: npm resolves and writes a fresh `package-lock.json` with `astro@6.4.8` and `@astrojs/cloudflare@13.7.0`, exit 0, no peer-dependency `ERESOLVE` errors. (If `ERESOLVE` appears on `@astrojs/react`, adjust its pin per 2.1's note and reinstall.)

- [ ] **2.3 Verify the pinned versions installed.** Run:

```
node -e "const p=require('./node_modules/astro/package.json');console.log('astro',p.version)" && node -e "const p=require('./node_modules/@astrojs/cloudflare/package.json');console.log('adapter',p.version)" && node -e "const p=require('./node_modules/wrangler/package.json');console.log('wrangler',p.version)"
```

Expected output:
```
astro 6.4.8
adapter 13.7.0
wrangler 4.103.0
```

- [ ] **2.4 Confirm `@google/genai` and `react-router-dom` are gone from the tree.** Run:

```
test ! -d node_modules/@google/genai && test ! -d node_modules/react-router-dom && echo "legacy deps absent"
```

Expected output: `legacy deps absent`.

- [ ] **2.5 Commit.** Run:

```
git add package.json package-lock.json && git commit -m "Phase 0: pin Astro 6.4.8 + Cloudflare adapter 13.7.0 deps and scripts"
```

Expected output: commit summary showing `package.json` and `package-lock.json` changed.

---

## Task 3: Astro config, base layout, minimal index route, and TypeScript wiring

Creates the Astro app: cloudflare adapter with `output: 'server'`, the React integration, a base layout carrying the SEO head that previously lived in `index.html`, a minimal but real marketing index route, and the env/tsconfig wiring. The verification is `astro build` producing a Worker bundle.

**Files:**
- Create: `astro.config.mjs`, `src/layouts/Base.astro`, `src/pages/index.astro`, `src/env.d.ts`
- Modify: `tsconfig.json`, `src/index.css`
- Delete (if still present from Task 1): nothing additional

**Interfaces:** None cross-phase yet. Produces the `src/pages/` tree (spec §11) that Phase 2 extends with `src/pages/api/{turnstile,fetch}.ts` and the app routes.

Steps:

- [ ] **3.1 Create `astro.config.mjs`.** Write:

```js
// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';

// ScrapeConvert runs as a Cloudflare Worker in SSR mode.
// Bindings are read at runtime via `import { env } from 'cloudflare:workers'`
// (see src/server/* in later phases). WebCrypto only; nodejs_compat is NOT enabled.
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    imageService: 'passthrough',
  }),
  integrations: [react()],
  site: 'https://scrapeconvert.com',
});
```

- [ ] **3.2 Create `src/env.d.ts`.** Write:

```ts
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

// Cloudflare runtime bindings declared in wrangler.toml are read via
// `import { env } from 'cloudflare:workers'` in src/server/* (Phase 1).
// This file only needs the Astro client + generated types references.
```

- [ ] **3.3 Update `tsconfig.json` to Astro strict.** Replace the file with:

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist", ".wrangler"]
}
```

- [ ] **3.4 Create `src/layouts/Base.astro`.** This carries the head/meta that lived in the deleted `index.html` (canonical, OG, Twitter, JSON-LD, favicon, manifest), with `Morphix`-free copy. The body styling is a plain dark neutral shell (Tailwind is removed; Phase 4 owns the design pass). Write:

```astro
---
interface Props {
  title?: string;
  description?: string;
}
const {
  title = 'ScrapeConvert - Scrape and convert images in your browser',
  description = 'Extract images from most public websites and convert them to modern formats. Conversion runs in your browser, so your files are never uploaded.',
} = Astro.props;
const canonical = new URL(Astro.url.pathname, Astro.site).href;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical} />
    <meta name="theme-color" content="#09090b" />
    <meta name="robots" content="index, follow" />
    <meta property="og:site_name" content="ScrapeConvert" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content="website" />
    <meta property="og:url" content={canonical} />
    <meta property="og:image" content="https://scrapeconvert.com/images/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image" content="https://scrapeconvert.com/images/og-image.png" />
    <link rel="icon" type="image/png" href="/images/favicon.png" />
    <link rel="apple-touch-icon" href="/images/favicon.png" />
    <link rel="manifest" href="/manifest.json" />
    <script type="application/ld+json" set:html={JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'ScrapeConvert',
      description: 'Extract images from most public websites and convert them to modern formats. Conversion runs in your browser.',
      url: 'https://scrapeconvert.com',
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      featureList: [
        'Web image scraping',
        'Image format conversion',
        'Client-side processing',
        'Batch image download',
        'WebP, AVIF, PNG, JPEG conversion',
      ],
    })} />
  </head>
  <body>
    <slot />
    <style is:global>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        background: #09090b;
        color: #e4e4e7;
        font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
        -webkit-font-smoothing: antialiased;
        min-height: 100vh;
      }
      a { color: #34d399; }
      :where(a, button):focus-visible {
        outline: 2px solid #34d399;
        outline-offset: 2px;
      }
    </style>
  </body>
</html>
```

- [ ] **3.5 Create `src/pages/index.astro`.** A minimal but real marketing landing that renders the value proposition (spec §9: lead with the extract+convert combination; no infrastructure detail outside an FAQ; no em dashes; no three-part punchlines). It uses `Base.astro`. This is placeholder marketing that Phase 4 replaces with the approved Direction A mock. Write:

```astro
---
import Base from '../layouts/Base.astro';
---
<Base>
  <main style="max-width: 56rem; margin: 0 auto; padding: 6rem 1.5rem;">
    <p style="color:#34d399; font-size:0.875rem; letter-spacing:0.04em; text-transform:uppercase; margin:0 0 1rem;">
      Free and open source
    </p>
    <h1 style="font-size:2.75rem; line-height:1.1; font-weight:700; margin:0 0 1.25rem;">
      Pull images off a site and convert them in one place
    </h1>
    <p style="font-size:1.125rem; color:#a1a1aa; max-width:42rem; margin:0 0 2.5rem;">
      Point ScrapeConvert at a page, a list of URLs, or a whole sitemap. Review what it
      finds, then convert the images you want to WebP, AVIF, PNG, or JPEG. The conversion
      runs in your browser, so your files are never uploaded.
    </p>
    <div style="display:flex; gap:1rem; flex-wrap:wrap;">
      <a href="/app" style="background:#34d399; color:#09090b; padding:0.75rem 1.5rem; border-radius:0.5rem; font-weight:600; text-decoration:none;">
        Open the app
      </a>
      <a href="https://github.com/scrapeconvert/scrapeconvert" style="border:1px solid rgba(255,255,255,0.1); color:#e4e4e7; padding:0.75rem 1.5rem; border-radius:0.5rem; text-decoration:none;">
        View the source
      </a>
    </div>
  </main>
</Base>
```

Note: `/app` and `/github` are placeholders Phase 2 / Phase 4 fill in; this index only needs to render and prove the toolchain.

- [ ] **3.6 Relocate or remove the legacy `src/index.css`.** The old `src/index.css` was the Vite/Tailwind entry and is no longer imported (Tailwind is removed; the layout carries its own global style). Run:

```
git rm -q src/index.css && echo "removed legacy css"
```

Expected output: `removed legacy css`.

- [ ] **3.7 Run `astro build`, expect a successful Worker bundle.** Run:

```
npx astro build
```

Expected output: Astro completes with `[build] Complete!` (or equivalent success line), no errors, exit 0. A `dist/` directory is produced containing the Cloudflare Worker entry (e.g. `dist/_worker.js/` and `dist/_routes.json`). (The first run triggers `astro sync`, generating `.astro/types.d.ts`; if a type-reference error appears, run `npx astro sync` then rebuild.)

- [ ] **3.8 Confirm the Worker artifacts exist.** Run:

```
test -d dist/_worker.js && test -f dist/_routes.json && echo "worker bundle present"
```

Expected output: `worker bundle present`.

- [ ] **3.9 Commit.** Run:

```
git add -A && git commit -m "Phase 0: scaffold Astro SSR app on Cloudflare adapter with marketing index"
```

Expected output: commit summary including `astro.config.mjs`, `src/layouts/Base.astro`, `src/pages/index.astro`, `src/env.d.ts`, `tsconfig.json`, and the `src/index.css` removal.

---

## Task 4: `wrangler.toml` with name, compatibility_date, rate-limit binding placeholder, and vars

Adds the Worker config. The rate-limit binding is declared as a placeholder so Phase 1 can wire it without restructuring; `vars` carries the non-secret Turnstile site key; secrets (`SESSION_HMAC_SECRET`, `TURNSTILE_SECRET_KEY`) are intentionally NOT in `wrangler.toml` (they are Worker secrets, set via `wrangler secret put`, per the Global Constraint that the HMAC secret has no default and deploy must fail if unset).

**Files:**
- Create: `wrangler.toml`
- Modify: `.gitignore`

**Interfaces:** Declares the bindings Phase 1's `src/server/*` reads via `import { env } from 'cloudflare:workers'`. The rate-limit binding name `RATE_LIMITER` and the `vars` keys are the contract Phase 1 consumes.

Steps:

- [ ] **4.1 Create `wrangler.toml`.** Write (compatibility_date set to today; `main`/`assets` point at the adapter's build output; a `staging` environment mirrors production with a distinct name):

```toml
name = "scrapeconvert"
compatibility_date = "2026-06-21"
# WebCrypto only; nodejs_compat is intentionally NOT enabled (see Global Constraints).
compatibility_flags = []

main = "./dist/_worker.js/index.js"
assets = { directory = "./dist", binding = "ASSETS" }

# Non-secret config. The Turnstile SITE key is public (rendered in the page).
# SECRETS (SESSION_HMAC_SECRET, TURNSTILE_SECRET_KEY) are NOT here; set them with
# `wrangler secret put <NAME>`. Deploy must fail if SESSION_HMAC_SECRET is unset.
[vars]
PUBLIC_TURNSTILE_SITE_KEY = "1x00000000000000000000AA"   # Cloudflare test site key; PUBLIC_ prefix exposes it to the client island; override per env
SESSION_TOKEN_TTL_SECONDS = "2700"                 # 45 min session token TTL (spec ##17)
MAX_HTML_BYTES = "5242880"                          # 5 MB HTML/sitemap cap
MAX_IMAGE_BYTES = "26214400"                        # 25 MB image cap
PER_TOKEN_FETCH_BUDGET = "300"                      # total fetches per session token
PER_TOKEN_BYTE_BUDGET = "1073741824"                # 1 GB total bytes per session token
PER_HOST_FETCH_CAP = "120"                          # per-destination-host cap per session
HOST_DENYLIST = ""                                  # comma-separated extra denied hosts

# Rate-limit binding PLACEHOLDER. Phase 1 keys this on the session token (NOT IP);
# it is a per-colo, eventually-consistent 10s/60s soft throttle.
[[unsafe.bindings]]
name = "RATE_LIMITER"
type = "ratelimit"
namespace_id = "1001"
simple = { limit = 60, period = 60 }

[env.staging]
name = "scrapeconvert-staging"

[env.staging.vars]
PUBLIC_TURNSTILE_SITE_KEY = "1x00000000000000000000AA"
SESSION_TOKEN_TTL_SECONDS = "2700"
MAX_HTML_BYTES = "5242880"
MAX_IMAGE_BYTES = "26214400"
PER_TOKEN_FETCH_BUDGET = "300"
PER_TOKEN_BYTE_BUDGET = "1073741824"
PER_HOST_FETCH_CAP = "120"
HOST_DENYLIST = ""

[[env.staging.unsafe.bindings]]
name = "RATE_LIMITER"
type = "ratelimit"
namespace_id = "1001"
simple = { limit = 60, period = 60 }
```

Note: `1x00000000000000000000AA` is Cloudflare's documented Turnstile *always-passes test* site key, safe to commit. The rate-limit binding uses the `unsafe.bindings` shape Wrangler currently requires for the rate-limiting binding; if `wrangler deploy` rejects the namespace_id, replace with the account's real ratelimit namespace id. Phase 1 owns the actual rate-limit logic and any binding-shape correction.

- [ ] **4.2 Add Astro/Wrangler ignores to `.gitignore`.** Append these lines to `.gitignore` (it already ignores `node_modules`, `dist`, `.DS_Store`):

```
# Astro
.astro/

# Wrangler / Cloudflare
.wrangler/
.dev.vars
wrangler.toml.bak
```

`.dev.vars` is ignored because it holds local secret overrides for `wrangler dev` and must never be committed.

- [ ] **4.3 Validate the config parses with a Wrangler dry-run.** Run (the build must run first so the `main`/`assets` paths exist):

```
npx astro build && npx wrangler deploy --dry-run --outdir=.wrangler-dry 2>&1 | tail -30
```

Expected output: Wrangler parses `wrangler.toml`, reports the binding (`RATE_LIMITER`) and the `vars`, performs a dry-run bundle, and exits 0 with a "Dry run" / "no deploy" style message and no parse errors. (A warning about the `unsafe` binding being experimental is acceptable. If Wrangler errors that it cannot find the entry, confirm `astro build` produced `dist/_worker.js/index.js`; the adapter's exact entry filename can differ between adapter minor versions, in which case set `main` to the path the build actually emitted.)

- [ ] **4.4 Confirm secrets are NOT in the committed config.** Run:

```
grep -nE 'SESSION_HMAC_SECRET|TURNSTILE_SECRET_KEY' wrangler.toml; echo "exit=$?"
```

Expected output: no matching lines, `exit=1` (grep finds nothing). This proves secrets are not baked into committed config.

- [ ] **4.5 Commit.** Run:

```
git add wrangler.toml .gitignore && git commit -m "Phase 0: add wrangler.toml (name, compat date, rate-limit binding placeholder, vars)"
```

Expected output: commit summary including `wrangler.toml` and `.gitignore`.

---

## Task 5: LICENSE and `.env.example`

Adds the MIT license and the example environment file. `.env.example` documents the Turnstile site + secret keys, the HMAC secret as a *placeholder only* (never a usable key), and the rate-limit config knobs, satisfying the Global Constraint that `.env.example` carries a placeholder only.

**Files:**
- Create: `LICENSE`, `.env.example`

**Interfaces:** None cross-phase. `.env.example` documents the secret/var names Phase 1 reads from the Worker runtime.

Steps:

- [ ] **5.1 Create `LICENSE` (MIT).** Write:

```
MIT License

Copyright (c) 2026 ScrapeConvert contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **5.2 Create `.env.example`.** Write (placeholders only; the HMAC line is explicitly a non-key placeholder and the file notes secrets are set via `wrangler secret put` in production):

```sh
# ScrapeConvert environment configuration.
#
# Local dev: copy to `.dev.vars` (gitignored) for `wrangler dev`, and/or `.env`
# for `astro dev`. Production: set the SECRET values with `wrangler secret put`,
# and the non-secret VARS in wrangler.toml. Never commit real secret values.

# --- Turnstile (bot gate for token minting) ---
# Site key is PUBLIC (rendered in the page). The PUBLIC_ prefix is required so
# Astro/Vite exposes it to the client island. The test key below always passes.
PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
# Secret key is a SECRET. The test value below always passes verification.
# In production set the real value with: wrangler secret put TURNSTILE_SECRET_KEY
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA

# --- Session token signing (REQUIRED secret, NO default) ---
# Deploy MUST fail if this is unset. This is a PLACEHOLDER, not a usable key.
# Generate a real one with: openssl rand -hex 32
# In production set it with: wrangler secret put SESSION_HMAC_SECRET
SESSION_HMAC_SECRET=replace-me-with-a-32-byte-random-hex-secret

# --- Session token lifetime ---
SESSION_TOKEN_TTL_SECONDS=2700

# --- Response size caps (bytes) ---
MAX_HTML_BYTES=5242880
MAX_IMAGE_BYTES=26214400

# --- Per-session abuse budgets ---
PER_TOKEN_FETCH_BUDGET=300
PER_TOKEN_BYTE_BUDGET=1073741824
PER_HOST_FETCH_CAP=120

# --- Destination host denylist (comma-separated, extends the built-in blocklist) ---
HOST_DENYLIST=
```

- [ ] **5.3 Verify `.env.example` holds no real secret-looking value.** Run:

```
grep -nE 'SESSION_HMAC_SECRET=' .env.example
```

Expected output: exactly one line: `SESSION_HMAC_SECRET=replace-me-with-a-32-byte-random-hex-secret` (a placeholder, not a 64-hex-char key).

- [ ] **5.4 Commit.** Run:

```
git add LICENSE .env.example && git commit -m "Phase 0: add MIT LICENSE and .env.example (placeholders only)"
```

Expected output: commit summary including `LICENSE` and `.env.example`.

---

## Task 6: README rewrite and final cleanup-check pass

Rewrites the README (features, deploy-to-Cloudflare, env vars, self-host) with no `Morphix` references, and turns the Task 1 cleanup check fully green. The README rewrite is the last thing the cleanup check needs to PASS, so this task closes the open-source-cleanup gate.

**Files:**
- Modify: `README.md`

**Interfaces:** None cross-phase.

Steps:

- [ ] **6.1 Confirm the cleanup check is still red on `Morphix` only.** Run:

```
./scripts/cleanup-check.sh; echo "exit=$?"
```

Expected output: a single `CLEANUP FAIL: pattern 'Morphix'` block pointing at `README.md`, `Cleanup check FAILED.`, `exit=1`. (This is the red state Task 6 turns green.)

- [ ] **6.2 Rewrite `README.md`.** Replace the entire file with:

```markdown
# ScrapeConvert

Free, open-source tool that extracts images from most public websites and converts
them to modern formats. Conversion runs in your browser, so your files are never
uploaded.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## What it does

- **Extract images from a site.** Point it at a single page, a list of URLs, or a
  whole sitemap. It finds `<img>` images and CSS `background-image` images and lists
  what it finds.
- **Convert and optimize.** Convert selected images to WebP, AVIF, PNG, or JPEG, with
  quality control and proportional resizing. Conversion runs client-side via WebAssembly.
- **Flag duplicates.** Content-based duplicate detection catches the same picture at
  different URLs, so you can skip the copies.
- **Copy a `<picture>` snippet.** Generate a production-ready `<picture>` element with
  AVIF and WebP sources and an `<img>` fallback.
- **Bring your own files.** Drag and drop local files to convert them without scraping.

## Architecture

ScrapeConvert is an [Astro](https://astro.build) app that runs server-side on a single
[Cloudflare Worker](https://workers.cloudflare.com) using `@astrojs/cloudflare`. Image
conversion runs entirely in the browser with WebAssembly codecs. The only server-side
work is a hardened fetch relay that retrieves page HTML, sitemaps, and the bytes of the
images you choose to convert. See the FAQ on the site for how the relay handles CORS,
rate limits, and abuse.

Pinned versions: `astro@6.4.8`, `@astrojs/cloudflare@13.7.0`, `wrangler@4.103.0`.
Requires Node 22 or newer.

## Run it locally

    npm install
    npm run dev        # Astro dev server
    npm run preview    # build, then run on the Worker runtime via wrangler dev

Copy `.env.example` to `.dev.vars` and fill in local values for `wrangler dev`.

## Deploy to Cloudflare

1. Install dependencies: `npm install`.
2. Set the required secrets on your Worker (these are never committed):

        wrangler secret put SESSION_HMAC_SECRET     # generate with: openssl rand -hex 32
        wrangler secret put TURNSTILE_SECRET_KEY

3. Set your real Turnstile site key and any config overrides in `wrangler.toml`
   under `[vars]`.
4. Deploy:

        npm run deploy             # production
        npm run deploy:staging     # staging Worker (scrapeconvert-staging)

The deploy fails if `SESSION_HMAC_SECRET` is unset. There is no default.

## Environment variables

| Name | Where | Required | Notes |
|---|---|---|---|
| `PUBLIC_TURNSTILE_SITE_KEY` | `wrangler.toml` var | yes | Public Turnstile site key. The `PUBLIC_` prefix exposes it to the client island. |
| `TURNSTILE_SECRET_KEY` | secret | yes | Turnstile secret, set with `wrangler secret put`. |
| `SESSION_HMAC_SECRET` | secret | yes | Session-token signing key. No default; deploy fails if unset. |
| `SESSION_TOKEN_TTL_SECONDS` | var | no | Session token lifetime. Defaults to 2700 (45 min). |
| `MAX_HTML_BYTES` / `MAX_IMAGE_BYTES` | var | no | Response size caps. |
| `PER_TOKEN_FETCH_BUDGET` / `PER_TOKEN_BYTE_BUDGET` | var | no | Per-session abuse budgets. |
| `PER_HOST_FETCH_CAP` | var | no | Per-destination-host cap. |
| `HOST_DENYLIST` | var | no | Comma-separated extra denied hosts. |

See `.env.example` for the full list with example values.

## Self-host

ScrapeConvert runs on Cloudflare's free tier. To self-host, fork the repo, set the
secrets above on your own Worker, adjust `[vars]` in `wrangler.toml`, and run
`npm run deploy`. You own the fetch relay you expose, so review the abuse budgets and
the host denylist before running a public instance.

## License

MIT. See [LICENSE](LICENSE).
```

- [ ] **6.3 Run the cleanup check, expect PASS.** Run:

```
./scripts/cleanup-check.sh; echo "exit=$?"
```

Expected output: `Cleanup check PASSED: no AI-Studio / Morphix / Gemini / Vercel scaffolding found.` and `exit=0`.

- [ ] **6.4 Re-run the build to confirm nothing broke.** Run:

```
npx astro build
```

Expected output: `[build] Complete!` (or equivalent), exit 0.

- [ ] **6.5 Commit.** Run:

```
git add README.md && git commit -m "Phase 0: rewrite README (features, deploy, env vars, self-host); cleanup check green"
```

Expected output: commit summary showing `README.md` changed.

---

## Task 7: Staging deploy verification

Proves the deliverable: the Astro app builds and deploys to a staging Worker that serves the marketing index. This task requires Cloudflare credentials. If credentials are unavailable in the execution environment, the dry-run in step 7.2 is the gating verification and the live deploy (7.3–7.4) is performed by a human operator with `wrangler login` done; document that handoff rather than skipping the dry-run.

**Files:** None created/modified (deploy + smoke test only).

**Interfaces:** None. Validates the HTTP surface (`GET /`) that Phase 2 builds on.

Steps:

- [ ] **7.1 Build the production bundle.** Run:

```
npx astro build
```

Expected output: `[build] Complete!`, exit 0, `dist/_worker.js/` present.

- [ ] **7.2 Dry-run the staging deploy (no credentials needed).** Run:

```
npx wrangler deploy --env staging --dry-run --outdir=.wrangler-dry 2>&1 | tail -30
```

Expected output: Wrangler resolves the `staging` environment, reports the Worker name `scrapeconvert-staging`, lists the `RATE_LIMITER` binding and the staging `vars`, completes the dry-run bundle, exit 0, no errors. (This validates the full staging config path without contacting Cloudflare.)

- [ ] **7.3 Live deploy to staging (requires `wrangler login` / `CLOUDFLARE_API_TOKEN`).** Run:

```
npx wrangler deploy --env staging
```

Expected output: Wrangler uploads the Worker and prints the deployed URL, e.g. `https://scrapeconvert-staging.<account>.workers.dev`, plus the bound `vars` and `RATE_LIMITER` binding, exit 0. (If it errors on the `unsafe` ratelimit `namespace_id`, substitute the account's real ratelimit namespace id in `wrangler.toml` under both the top-level and `[env.staging]` binding, then redeploy. Note from spec §5.3 that Cache API reliability needs a custom domain, not `*.workers.dev`; that is a Phase 1/Phase 4 concern, not Phase 0.)

- [ ] **7.4 Smoke-test the deployed marketing index.** Run (substitute the URL printed in 7.3):

```
curl -s -o /dev/null -w "%{http_code}\n" https://scrapeconvert-staging.<account>.workers.dev/ && curl -s https://scrapeconvert-staging.<account>.workers.dev/ | grep -c "Pull images off a site and convert them in one place"
```

Expected output: `200` on the first line, `1` on the second (the marketing hero headline renders). This confirms the SSR Worker serves the index.

- [ ] **7.5 Record the staging URL and rollback note.** The DNS cutover (`scrapeconvert.com` Vercel to Worker) and one-line rollback (revert DNS) are Phase 4 (spec §10, §15). Phase 0 only needs the staging Worker live and verified. No commit; this step is operational verification. If 7.3–7.4 were handed to a human operator, capture the staging URL and the `200`/`1` smoke result in the Phase 0 completion note.

---

## Done criteria for Phase 0

- `npm run build` (`astro build`) succeeds and emits a Cloudflare Worker bundle (`dist/_worker.js/`).
- `./scripts/cleanup-check.sh` exits 0 (no `Morphix`, `GEMINI`, `aistudiocdn`, `@google/genai`, `process.env.API_KEY`, `metadata.json` in tracked non-doc files; `metadata.json` deleted).
- `wrangler deploy --env staging --dry-run` parses the config and lists the `RATE_LIMITER` binding and `vars`; a live staging Worker serves `GET /` with `200` and the marketing headline.
- Repo contains `LICENSE` (MIT), a Morphix-free `README.md`, `.env.example` (placeholders only, no usable HMAC key), `astro.config.mjs`, `wrangler.toml`, `src/layouts/Base.astro`, `src/pages/index.astro`.
- Astro + adapter pinned to exact versions (`astro@6.4.8`, `@astrojs/cloudflare@13.7.0`); bindings read via `cloudflare:workers`; no `nodejs_compat`; no `node:crypto`.
- Secrets (`SESSION_HMAC_SECRET`, `TURNSTILE_SECRET_KEY`) are NOT in committed config; deploy fails if `SESSION_HMAC_SECRET` is unset.
