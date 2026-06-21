---
# Phase 2: The App Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
**Goal:** Build the client-side ScrapeConvert app (Scraper input island + unified Workbench island) that consumes the Phase 1 proxy to extract, dedupe, convert, and download web images entirely in the browser.
**Architecture:** Astro SSR on Cloudflare with two React islands (`client:only="react"`). The browser drives all crawl fan-out (one `GET /api/fetch` per page), parses HTML/sitemaps client-side, renders thumbnails straight from source, captures dimensions/size from the thumbnail load, and converts with single-thread `@jsquash` WASM. The Worker only relays bytes; it never parses or encodes.
**Tech Stack:** Astro + `@astrojs/cloudflare` (`output: 'server'`), React 19, single-thread `@jsquash/{jpeg,png,webp,oxipng,avif}`, `jszip`, Tailwind, Vitest + Testing Library.
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

## OUTLINE ONLY

**OUTLINE ONLY: expand to bite-sized TDD steps (per the writing-plans skill) before executing, after Phase 1 ships.**

This plan is intentionally at outline detail. Each task below gives Files, Interfaces (Consumes/Produces against the shared CONTRACT), a short behavior description, key test names, and acceptance criteria — but NOT line-by-line test code or full implementations. Before execution, re-open this file and expand every task into bite-sized red/green/refactor TDD steps once Phase 1 is merged and the proxy endpoints + `src/server/token.ts` are real, because the integration tasks (crawl orchestration, convert-time image fetch) call live endpoints whose exact error/response behavior must be confirmed against the shipped code, not assumed from the contract.

## Dependency on earlier phases (HARD GATES)

- **Requires Phase 1 shipped and deployed (staging Worker reachable):**
  - `POST /api/turnstile` and `GET /api/fetch?url=&type=page|sitemap|image` behaving exactly per the SHARED INTERFACE CONTRACT (status codes 200/400/401/413/429/502, streamed bodies, image `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`).
  - `sessionToken` semantics: opaque signed string, stored in `sessionStorage`, re-mint on 401, ~45 min TTL (confirm the final value at expansion time, spec §17).
- **Requires Phase 0 scaffold:** Astro project on `@astrojs/cloudflare` (`output: 'server'`), Tailwind with the emerald accent token, AI-Studio cruft removed, marketing pages building. Phase 2 adds the two app routes and islands into that scaffold.
- **Shared modules co-owned with Phase 1** (`src/lib/url-safety.ts`, `src/lib/types.ts`): Phase 1 authors `isSafePublicUrl` / `isBlockedIp` / `SessionClaims`. Phase 2 CONSUMES `url-safety` for the client `<img>` filter and MUST NOT fork it. If Phase 1 has not exported the exact signatures, stop and reconcile before writing client code that imports them.
- **Existing code to migrate, not preserve:** the current `src/features/scraper/services/scraperService.ts` (public-CORS-proxy fetch, URL-only dedupe at ~line 700) and `src/shared/services/imageUtils.ts` (`convertImage` taking a source URL, no AVIF, no EXIF/profile strip). Both are replaced by the new `src/lib/` modules below. Salvage the parsing/sitemap logic (DOMParser walk, namespaced sitemap-index + image-sitemap handling, background-image regex) and the BLOCKED stock-photo domain list; drop the proxy and URL-only dedupe.

---

## File structure

**Create — pure libs (network-injected, unit-testable):**
- `src/lib/types.ts` (CONTRACT shapes; co-owned, create if Phase 1 left it to this phase)
- `src/lib/scrape/parse.ts` (`extractImages`, `parseSitemap`)
- `src/lib/scrape/crawl.ts` (crawl-orchestration state machine + token lifecycle)
- `src/lib/dedupe.ts` (`flagDuplicates`)
- `src/lib/picture-snippet.ts` (`pictureSnippet`)
- `src/lib/convert/codecs.ts` (single-thread `@jsquash` module loading + encode dispatch incl. AVIF)
- `src/lib/convert/resize.ts` (proportional resize, EXIF strip, color-profile removal via canvas)
- `src/lib/convert/zip.ts` (`buildZip` streaming)
- `src/lib/convert/estimate.ts` (`estimateSize` heuristic)
- `src/lib/convert/index.ts` (`convertImage`, re-exports `buildZip`, `estimateSize`)

**Create — client-side network + metadata helpers:**
- `src/lib/session.ts` (sessionStorage token get/set/clear, Turnstile mint call, 401 re-mint coordination)
- `src/lib/proxy-client.ts` (`fetchViaProxy(url, type)` wrapper over `GET /api/fetch` with the Bearer token, maps status codes to typed errors)
- `src/lib/metadata.ts` (thumbnail onload dimension capture, `transferSize` size read, HEAD-via-proxy fallback)
- `src/lib/concurrency.ts` (client-side concurrency limiter, 4-6 in flight)
- `src/lib/bytes.ts` (formatBytes etc., salvaged from `imageUtils.ts`)

**Create — Astro routes + islands:**
- `src/pages/scraper.astro` (mounts `ScraperInput` island)
- `src/pages/workbench.astro` (mounts `Workbench` island)
- `src/components/app/ScraperInput.tsx`
- `src/components/app/scraper/ModeTabs.tsx`, `UrlInput.tsx`, `TurnstileGate.tsx`, `CrawlPanel.tsx`, `SitemapDiscoveryList.tsx`, `CrawlLog.tsx`
- `src/components/app/Workbench.tsx`
- `src/components/app/workbench/SourcePanel.tsx`, `SettingsPanel.tsx`, `AdvancedPanel.tsx`, `DownloadPanel.tsx`, `Rail.tsx` (mobile collapsible wrapper)
- `src/components/app/workbench/Toolbar.tsx`, `ImageGrid.tsx`, `ImageTile.tsx`, `PictureSnippetPopover.tsx`, `TotalsBar.tsx`, `LocalFilesDrop.tsx`
- `src/components/app/shared/AppTopBar.tsx` (wordmark, Scraper/Workbench tabs, session chip)
- `src/lib/workbench-store.ts` (shared image/selection/settings state passed between islands via sessionStorage or a small store)

**Modify:**
- `astro.config.*` (register the two app routes if not glob-routed; ensure islands hydrate `client:only="react"`)
- `tailwind.config.*` (confirm `accent` emerald scale + `tnum` utilities exist, from Phase 0)
- `.env.example` (add `PUBLIC_TURNSTILE_SITE_KEY` placeholder; the secret keys belong to Phase 1)

**Delete (after migration verified):**
- `src/features/scraper/services/scraperService.ts`, `src/features/scraper/*`, `src/features/converter/*`, `src/shared/services/imageUtils.ts`, `src/router.tsx`, `src/main.tsx` (React-Router SPA shell superseded by Astro islands). Confirm no marketing page still imports them before deleting.

**Test (co-located `*.test.ts(x)`):**
- `src/lib/scrape/parse.test.ts`, `src/lib/scrape/crawl.test.ts`, `src/lib/dedupe.test.ts`, `src/lib/picture-snippet.test.ts`
- `src/lib/convert/resize.test.ts`, `src/lib/convert/estimate.test.ts`, `src/lib/convert/zip.test.ts`, `src/lib/convert/codecs.test.ts`
- `src/lib/session.test.ts`, `src/lib/metadata.test.ts`, `src/lib/concurrency.test.ts`, `src/lib/proxy-client.test.ts`
- `src/components/app/**/_.test.tsx` for islands (RTL)
- `tests/fixtures/` (local HTML page, sitemap-index XML, image-sitemap XML, a few small images) for parser + light E2E

---

## Tasks (ordered)

Pure libs first (no Phase 1 runtime needed beyond shared signatures), then network glue, then islands, then integration.

### Task 1 — `src/lib/types.ts`: shared client types

**Files:** `src/lib/types.ts` (+ confirm not already created by Phase 1).
**Interfaces:**
- Produces: `ScrapedImage`, `ConvertOptions` (CONTRACT, verbatim shapes).
- Consumes: nothing.
**Behavior:** Define the two CONTRACT interfaces exactly as written in the shared contract. If Phase 1 already created this file, verify field-for-field and reconcile rather than duplicate. These are the single source of truth for every other Phase 2 module.
**Key tests:** none (type-only); a `tsc` typecheck gate is the verification.
**Acceptance criteria:**
- [ ] `ScrapedImage` and `ConvertOptions` match the CONTRACT field names, optionality, and the `format` union `'webp'|'avif'|'png'|'jpeg'` exactly.
- [ ] No other module redeclares these shapes; all import from here.
- [ ] `tsc --noEmit` passes.

### Task 2 — `src/lib/scrape/parse.ts`: HTML + sitemap parsing

**Files:** `src/lib/scrape/parse.ts`, `src/lib/scrape/parse.test.ts`.
**Interfaces:**
- Produces: `extractImages(html: string, baseUrl: string, sourcePageUrl?: string): ScrapedImage[]`; `parseSitemap(xml: string, baseUrl: string): { urls: string[]; imageUrls: string[]; isIndex: boolean }`.
- Consumes: `ScrapedImage` from `src/lib/types.ts`.
**Behavior:** Pure functions over strings (no network). `extractImages` walks `<img src>` plus CSS `background-image` from inline `style` attributes and `<style>` blocks (salvage the `url(...)` regex and the DOMParser walk from the old `extractImagesFromHtml`), resolves relative URLs against `baseUrl`, drops `data:` URIs, retains the blocked stock-photo-domain skip, derives `name`/`format`/`alt`, sets `selected: false`. `parseSitemap` handles sitemap-index (returns child sitemap URLs, `isIndex: true`), regular urlset, and image-sitemap `image:loc` entries, namespace-aware with non-namespaced fallback (salvage from old `parseSitemap`). `srcset` and external-stylesheet backgrounds are explicitly deferred (spec §16).
**Key tests:**
- `extractImages finds <img src> and resolves relative URLs against base` — relative + absolute mix.
- `extractImages finds inline style background-image and <style> block backgrounds`.
- `extractImages skips data: URIs and blocked stock-photo domains`.
- `extractImages does NOT pull srcset (deferred)`.
- `parseSitemap detects a sitemap index and returns child URLs with isIndex true`.
- `parseSitemap returns page urls from a urlset`.
- `parseSitemap extracts image:loc from an image sitemap`.
- `parseSitemap survives missing namespace via fallback selectors`.
**Acceptance criteria:**
- [ ] Both functions are pure (no `fetch`, no globals beyond `DOMParser`).
- [ ] `<img>` + both background-image sources extracted; `data:` and blocked domains excluded.
- [ ] Sitemap index vs urlset vs image-sitemap distinguished correctly, with namespaced and non-namespaced inputs.
- [ ] Every returned `ScrapedImage` has stable `id`, resolved absolute `url`, `format`, `selected: false`.

### Task 3 — `src/lib/dedupe.ts`: content-based duplicate flagging

**Files:** `src/lib/dedupe.ts`, `src/lib/dedupe.test.ts`.
**Interfaces:**
- Produces: `flagDuplicates(images: ScrapedImage[]): void` (mutates `isDuplicate` in place).
- Consumes: `ScrapedImage`.
**Behavior:** Behavioral rebuild from today's URL-only dedupe. Key = `(size + width + height)`; the FIRST occurrence of a key stays un-flagged, later matches get `isDuplicate = true`. Images missing `size` OR `width`/`height` are EXCLUDED from dedupe (left `isDuplicate` unchanged / false) per the failure-fallback decision (spec §5.4) — pick placeholder-and-exclude and document it. Must be idempotent and re-runnable as metadata arrives progressively (re-flag from scratch each call so a late-arriving size can newly flag an image).
**Key tests:**
- `flagDuplicates flags second+ image sharing size and dimensions`.
- `flagDuplicates leaves the first occurrence unflagged`.
- `flagDuplicates excludes images missing size or dimensions`.
- `flagDuplicates is idempotent and re-derives on each call (progressive metadata)`.
- `flagDuplicates does not treat different dimensions same size as duplicate`.
**Acceptance criteria:**
- [ ] Key is `size + width + height`, not URL.
- [ ] First-seen unflagged, rest flagged.
- [ ] Incomplete-metadata images never flagged.
- [ ] Re-running after a size fills in newly flags the right image (no stale flags).

### Task 4 — `src/lib/picture-snippet.ts`: `<picture>` code generator

**Files:** `src/lib/picture-snippet.ts`, `src/lib/picture-snippet.test.ts`.
**Interfaces:**
- Produces: `pictureSnippet(img: ScrapedImage, formats: ConvertOptions['format'][]): string`.
- Consumes: `ScrapedImage`, `ConvertOptions`.
**Behavior:** Build a production-ready `<picture>` string: AVIF `<source>` then WebP `<source>` (when present in `formats`), then an `<img>` fallback (PNG/JPEG), using the image base name with swapped extensions and `alt` from the image (escaped). Order AVIF before WebP before fallback per HTML semantics.
**Key tests:**
- `pictureSnippet emits AVIF and WebP sources plus an img fallback`.
- `pictureSnippet orders avif before webp before img`.
- `pictureSnippet uses the image base name with the right extension per source`.
- `pictureSnippet escapes alt text`.
- `pictureSnippet omits a source when its format is not requested`.
**Acceptance criteria:**
- [ ] Output is valid `<picture>` markup with correct `type="image/avif"` / `type="image/webp"`.
- [ ] Fallback `<img>` always present with `alt`.
- [ ] Extensions derived from the chosen formats, not the source format.

### Task 5 — `src/lib/convert/estimate.ts`: size estimation heuristic

**Files:** `src/lib/convert/estimate.ts`, `src/lib/convert/estimate.test.ts`.
**Interfaces:**
- Produces: `estimateSize(originalBytes: number, opts: ConvertOptions): number`.
- Consumes: `ConvertOptions`.
**Behavior:** Pure heuristic ratio per format + quality (output size is unknowable without encoding; the totals bar already says "estimated"). Apply a format/quality compression ratio table, then scale by the resize factor if `maxWidth`/`maxHeight` would shrink dimensions. Never return a negative or zero for a positive input. Document that this is an estimate, not a measurement.
**Key tests:**
- `estimateSize returns a smaller number for lower quality`.
- `estimateSize returns smaller for avif than webp at equal quality`.
- `estimateSize scales down when resize dimensions shrink the image`.
- `estimateSize never exceeds original by an unreasonable factor`.
**Acceptance criteria:**
- [ ] Monotonic in quality (lower quality -> smaller estimate).
- [ ] Format ordering roughly avif < webp < jpeg < png at equal quality.
- [ ] Resize factor applied when max dims are set.
- [ ] Pure; no canvas/WASM.

### Task 6 — `src/lib/convert/resize.ts`: canvas resize + EXIF/profile strip

**Files:** `src/lib/convert/resize.ts`, `src/lib/convert/resize.test.ts`.
**Interfaces:**
- Produces: `decodeToImageData(blob: Blob, opts: ConvertOptions): Promise<ImageData>` (or similar internal name); used by `convertImage`.
- Consumes: `ConvertOptions`.
**Behavior:** Decode a `Blob` to a canvas, compute proportional max-width/max-height target (never upscale; respect `keepAspect`), draw, and return `ImageData`. Drawing to a canvas inherently drops EXIF; `stripExif` is satisfied by the canvas path (document this). `removeColorProfile` controls whether the canvas is treated as untagged sRGB vs preserving the source profile (best-effort given browser canvas limits; document the behavior). Fill white background for JPEG (no alpha) as the old code did.
**Key tests:**
- `resize scales down proportionally and never upscales`.
- `resize respects keepAspect=false by clamping each axis independently`.
- `resize fills white for jpeg target (no transparent->black)`.
- `resize produces ImageData at the computed dimensions`.
(These run under jsdom/canvas mock or a headless-canvas shim; gate any that need a real canvas behind the manual checklist.)
**Acceptance criteria:**
- [ ] Output dimensions match the proportional-max math; never larger than source.
- [ ] `keepAspect` honored both ways.
- [ ] EXIF-strip behavior documented as canvas-inherent; color-profile behavior documented.

### Task 7 — `src/lib/convert/codecs.ts`: single-thread `@jsquash` encode dispatch

**Files:** `src/lib/convert/codecs.ts`, `src/lib/convert/codecs.test.ts`.
**Interfaces:**
- Produces: `encode(imageData: ImageData, opts: ConvertOptions): Promise<ArrayBuffer>` dispatching to jpeg/png(+oxipng)/webp/avif.
- Consumes: `ConvertOptions`.
**Behavior:** Import the SINGLE-THREAD `@jsquash` builds (no SharedArrayBuffer) — `@jsquash/jpeg`, `@jsquash/png` + `@jsquash/oxipng`, `@jsquash/webp`, and the NEW `@jsquash/avif`. Lazy-load each codec module once and reuse the instance (sequential memory discipline). Dispatch on `opts.format`; PNG path encodes then optimizes via oxipng; AVIF uses `@jsquash/avif` encode with the quality. Note AVIF encode is slower (single-thread tradeoff, spec §5.1).
**Key tests:**
- `encode dispatches webp/png/jpeg/avif by format` (mock the jsquash modules).
- `encode runs oxipng after png encode`.
- `encode loads each codec module once and reuses it`.
- `encode rejects an unknown format`.
**Acceptance criteria:**
- [ ] All four formats supported, AVIF via `@jsquash/avif`.
- [ ] Single-thread builds imported (no SharedArrayBuffer requirement).
- [ ] Codec modules memoized, not re-instantiated per image.
- [ ] `package.json` adds `@jsquash/avif` at a pinned version.

### Task 8 — `src/lib/convert/zip.ts`: streaming ZIP builder

**Files:** `src/lib/convert/zip.ts`, `src/lib/convert/zip.test.ts`.
**Interfaces:**
- Produces: `buildZip(files: { name: string; blob: Blob }[]): Promise<Blob>`.
- Consumes: nothing app-specific.
**Behavior:** Build the ZIP with `jszip` `generateAsync` in a streaming/low-memory mode, freeing each input buffer as it is added. De-duplicate output file names (append `-1`, `-2`) so same-named scraped images do not collide. Return a single `application/zip` Blob.
**Key tests:**
- `buildZip produces a zip blob containing all files`.
- `buildZip de-duplicates colliding file names`.
- `buildZip handles an empty list (returns empty zip or rejects clearly)`.
**Acceptance criteria:**
- [ ] Output is a valid zip Blob readable back by jszip in the test.
- [ ] Name collisions resolved deterministically.
- [ ] Buffers not retained after add (verified by structure, not literal memory measurement).

### Task 9 — `src/lib/convert/index.ts`: `convertImage` orchestrator

**Files:** `src/lib/convert/index.ts`, `src/lib/convert/index.test.ts`.
**Interfaces:**
- Produces: `convertImage(input: Blob, opts: ConvertOptions): Promise<Blob>`; re-export `buildZip`, `estimateSize`.
- Consumes: `resize.ts`, `codecs.ts`, `ConvertOptions`.
**Behavior:** CONTRACT signature change from the old URL-taking `convertImage`: now takes a `Blob` (bytes already fetched via the proxy), runs decode+resize -> encode -> wrap in a Blob with the right MIME. Apply the "keep original if converted is larger" guard if desired (carry forward old behavior, but only when an original is meaningfully comparable). Release intermediate buffers between steps (sequential discipline).
**Key tests:**
- `convertImage takes a Blob and returns a converted Blob of the target MIME` (mock resize+codecs).
- `convertImage applies resize then encode in order`.
- `convertImage propagates a per-image failure as a rejection (caller continues batch)`.
**Acceptance criteria:**
- [ ] Signature is `(input: Blob, opts: ConvertOptions) => Promise<Blob>` exactly per CONTRACT.
- [ ] Decode/resize/encode pipeline wired through Tasks 6+7.
- [ ] Output Blob MIME matches `opts.format`.

### Task 10 — `src/lib/session.ts` + `src/lib/proxy-client.ts`: token lifecycle + proxy wrapper

**Files:** `src/lib/session.ts`, `src/lib/session.test.ts`, `src/lib/proxy-client.ts`, `src/lib/proxy-client.test.ts`.
**Interfaces:**
- Consumes (Phase 1 HTTP): `POST /api/turnstile { token } -> { sessionToken }`; `GET /api/fetch?url=&type=page|sitemap|image` with `Authorization: Bearer <sessionToken>`.
- Produces: `mintSession(turnstileToken): Promise<string>`, `getSessionToken()`, `setSessionToken()`, `clearSessionToken()`; `fetchViaProxy(url, type): Promise<Response>` (or a typed `{ ok, body | error }`).
**Behavior:** `session.ts` stores `sessionToken` in `sessionStorage` (survives reload within tab), calls `POST /api/turnstile`, exposes a single in-flight re-mint promise so concurrent 401s do not trigger multiple mints. `proxy-client.ts` builds `GET /api/fetch` with the Bearer header, maps status codes to typed errors: 400 -> blocked/invalid URL, 401 -> expired/missing token (signal caller to re-mint), 413 -> over cap, 429 -> rate/budget (surface `Retry-After`), 502 -> upstream. On 401 it does NOT silently re-mint by itself (re-mint needs a Turnstile token / human check per spec §13 default); it raises a typed "needs verification" error the islands handle.
**Key tests:**
- `mintSession posts the turnstile token and stores the returned sessionToken`.
- `getSessionToken reads from sessionStorage; clear removes it`.
- `concurrent re-mint requests share one in-flight promise`.
- `fetchViaProxy attaches the Bearer token`.
- `fetchViaProxy maps 401 to a needs-verification error`.
- `fetchViaProxy maps 413/429/502 to distinct typed errors and surfaces Retry-After on 429`.
**Acceptance criteria:**
- [ ] Token persisted in `sessionStorage`, single re-mint coordinator.
- [ ] All five proxy status codes mapped to distinct typed errors.
- [ ] 401 raises needs-verification (no silent re-challenge), matching spec §13 default.
- [ ] No cookies relied on; bearer header only.

### Task 11 — `src/lib/metadata.ts` + `src/lib/concurrency.ts`: thumbnail metadata + limiter

**Files:** `src/lib/metadata.ts`, `src/lib/metadata.test.ts`, `src/lib/concurrency.ts`, `src/lib/concurrency.test.ts`.
**Interfaces:**
- Produces: `captureDimensions(img: HTMLImageElement): { width; height }`; `readTransferSize(url: string): number | undefined` (Performance Resource Timing); `headSizeViaProxy(url: string): Promise<number | undefined>` (uses `fetchViaProxy`); `createLimiter(max: number)` (4-6 in flight).
- Consumes: `proxy-client.ts`.
**Behavior:** `metadata.ts` reads `naturalWidth`/`naturalHeight` from a loaded thumbnail (no proxy), reads byte size from `PerformanceResourceTiming.transferSize` where available, and falls back to a proxy HEAD only when needed (egress cost, documented). On thumbnail load failure (hotlink/CORP/referrer) it returns undefined size+dims so dedupe excludes the image (spec §5.4 placeholder-and-exclude). `concurrency.ts` is a generic promise-pool limiter used for convert-time image fetches.
**Key tests:**
- `captureDimensions returns naturalWidth/naturalHeight`.
- `readTransferSize returns the transferSize entry when present, undefined otherwise`.
- `headSizeViaProxy only called as fallback and routes through the proxy`.
- `createLimiter never exceeds max concurrent and runs all tasks`.
- `metadata returns undefined on a failed thumbnail (excluded from dedupe)`.
**Acceptance criteria:**
- [ ] Dimensions from thumbnail onload, no proxy.
- [ ] Size from `transferSize` first, proxy HEAD only as fallback.
- [ ] Failure path yields undefined metadata (feeds dedupe exclusion).
- [ ] Limiter caps concurrency at the configured 4-6.

### Task 12 — `src/lib/url-safety.ts` client `<img>` filter integration

**Files:** consume `src/lib/url-safety.ts` (authored in Phase 1); add `src/lib/url-safety.client.test.ts` for the client-filter usage if not covered.
**Interfaces:**
- Consumes: `isSafePublicUrl(raw): { ok; url } | { ok: false; reason }`, `isBlockedIp(ip)`.
- Produces: a thin client helper `safeThumbnailUrls(images): ScrapedImage[]` that filters out images whose `url` fails `isSafePublicUrl` before they are rendered as `<img src>`.
**Behavior:** Before rendering any discovered image URL as a thumbnail in the user's browser (a second egress the server never sees), filter with the SAME `isSafePublicUrl` (scheme http/https only, reject special-use IP literals in all encodings, localhost, credentials-in-url, non-standard ports). The grid sets `referrerpolicy="no-referrer"` on every `<img>` and the app applies a restrictive CSP `img-src`. Do NOT fork the rule set; import from the shared module.
**Key tests:**
- `safeThumbnailUrls drops localhost / private-IP / credentialed / non-http(s) image URLs`.
- `rendered thumbnails carry referrerpolicy=no-referrer` (RTL on the grid).
**Acceptance criteria:**
- [ ] Client filter imports `isSafePublicUrl` from the shared module (no duplicate logic).
- [ ] Unsafe image URLs never reach an `<img src>`.
- [ ] Thumbnails set `referrerpolicy="no-referrer"`.
- [ ] App route sets a CSP with a restrictive `img-src` (documented; verify the meta/header is emitted).

### Task 13 — `src/lib/scrape/crawl.ts`: crawl-orchestration state machine

**Files:** `src/lib/scrape/crawl.ts`, `src/lib/scrape/crawl.test.ts`.
**Interfaces:**
- Consumes: `parse.ts` (`extractImages`, `parseSitemap`), `proxy-client.ts` (`fetchViaProxy`), `session.ts` (token lifecycle), `ScrapedImage`.
- Produces: a `createCrawl(opts)` state machine emitting events/state: sitemap-discovery checklist entries, per-page crawl-log entries (`pending|crawling|done|error`), running image count + page count, plus a terminal status. Network is INJECTED (pass a `fetchPage`/`fetchSitemap` fn) so tests run without the real proxy.
**Behavior:** Rebuild of `processSitemapInput` / `processUrlInput` as a CLIENT-driven state machine. For sitemap mode: discover sitemap (checklist), parse index/urlset client-side, then crawl up to `maxPages` pages, making ONE `GET /api/fetch?type=page` per page (no server fan-out), extracting images per page, accumulating, and flagging duplicates progressively. Per-page failures are logged and skipped (crawl does not abort). Token lifecycle: if a fetch returns the needs-verification error mid-crawl, the machine PAUSES and surfaces a single non-blocking "verify to continue" state (does not abort/restart), resuming after a fresh token. Multiple-URLs and single-page modes are simpler paths through the same machine. Emits progressive updates so the UI and dedupe can react as metadata arrives.
**Key tests:**
- `crawl single page fetches once and extracts images`.
- `crawl multiple urls fetches each and accumulates`.
- `crawl sitemap discovers, parses index, expands child sitemaps, crawls pages up to maxPages`.
- `crawl emits one page-fetch per page (no fan-out within a fetch)`.
- `crawl logs per-page error and continues (does not abort)`.
- `crawl pauses on needs-verification and resumes after a new token without restarting`.
- `crawl updates running image and page counts progressively`.
- `crawl can be opened-in-background (state observable while still running)`.
**Acceptance criteria:**
- [ ] All three modes drive the same machine; sitemap index expansion handled client-side.
- [ ] Exactly one `fetchPage` call per crawled page; `maxPages` respected.
- [ ] Per-page errors logged + skipped, no abort.
- [ ] Mid-crawl token expiry -> pause + verify prompt -> resume without losing progress.
- [ ] Network fully injected; tests need no live proxy.
- [ ] State observable for the "open Workbench while crawling" flow.

### Task 14 — Workbench shared state (`src/lib/workbench-store.ts`)

**Files:** `src/lib/workbench-store.ts`, `src/lib/workbench-store.test.ts`.
**Interfaces:**
- Produces: a small store/handoff for `images: ScrapedImage[]`, `selection`, `ConvertOptions`, source info; readable by the Workbench island and writable by the Scraper island (handoff via `sessionStorage` since they are separate Astro routes/islands).
- Consumes: `ScrapedImage`, `ConvertOptions`.
**Behavior:** Because Scraper and Workbench are separate routes/islands, the scrape result + settings must survive navigation. Persist a compact representation (image metadata, not blobs) to `sessionStorage` and rehydrate in the Workbench. Provide selection helpers (select all, toggle, hide-duplicates filter). Keep blobs out of storage (memory/quota); re-fetch bytes at convert time.
**Key tests:**
- `store persists images and rehydrates on the workbench route`.
- `selection helpers: select all / toggle / count selected`.
- `hide-duplicates filter excludes flagged images from the visible set`.
- `blobs are never written to sessionStorage`.
**Acceptance criteria:**
- [ ] Scrape -> Workbench handoff survives route navigation.
- [ ] Selection + filter helpers correct.
- [ ] No binary data in `sessionStorage`.

### Task 15 — `AppTopBar` + Astro routes for the two app screens

**Files:** `src/pages/scraper.astro`, `src/pages/workbench.astro`, `src/components/app/shared/AppTopBar.tsx`, `src/components/app/shared/AppTopBar.test.tsx`.
**Interfaces:** Consumes session state (verified chip). Produces the two routes mounting their islands `client:only="react"`.
**Behavior:** Match the mock top bar: wordmark, centered Scraper/Workbench tabs with `aria-current`, GitHub link, and a session "verified" chip when a token exists. Astro pages are thin SSR shells that hydrate the islands; set the restrictive CSP header here (Task 12). Carry the Direction A styling (zinc + emerald, hairline borders, focus rings, tabular-nums).
**Key tests:**
- `AppTopBar marks the active tab with aria-current`.
- `AppTopBar shows verified chip only when a session token exists`.
**Acceptance criteria:**
- [ ] Two routes render and hydrate their islands.
- [ ] Top bar matches `app-scraper.html` / `app-workbench.html` structure + a11y.
- [ ] CSP with restrictive `img-src` emitted on app routes.

### Task 16 — `ScraperInput` island (3 modes + Turnstile mint + crawl UI)

**Files:** `src/components/app/ScraperInput.tsx` + `scraper/ModeTabs.tsx`, `UrlInput.tsx`, `TurnstileGate.tsx`, `CrawlPanel.tsx`, `SitemapDiscoveryList.tsx`, `CrawlLog.tsx`, with `_.test.tsx`.
**Interfaces:** Consumes `crawl.ts`, `session.ts` (mint), `workbench-store.ts` (write results). Produces the Scraper screen.
**Behavior:** Implements `app-scraper.html`: three-mode segmented control (single page / multiple URLs / sitemap crawl) with the URL line vs textarea vs sitemap-with-max-pages variants; the one-time Turnstile check minting a session token (`TurnstileGate` + `POST /api/turnstile`); the live crawl panel with the sitemap-discovery checklist (`found`/`checking`/`not found`) and the per-page crawl log (`done`/`crawling`/`error`/`queued`) with running counts and the progress bar; an "Open Workbench" affordance that lets the crawl continue in the background; and the needs-verification pause prompt surfaced inline. Honors `prefers-reduced-motion`.
**Key tests:**
- `ScraperInput switches input variant per mode`.
- `Find images is gated on a verified session (mints via Turnstile first)`.
- `crawl panel renders discovery checklist + per-page log from crawl state`.
- `running image/page counts update as the crawl emits`.
- `Open Workbench navigates while the crawl keeps running`.
- `mid-crawl token expiry surfaces the verify-to-continue prompt`.
**Acceptance criteria:**
- [ ] Three modes wired with correct inputs + max-pages stepper (sitemap mode).
- [ ] Turnstile mint precedes the first fetch; verified chip reflects it.
- [ ] Discovery checklist + crawl log + counts + progress bar match the mock.
- [ ] Background-crawl-while-on-Workbench works; pause/verify prompt appears on expiry.
- [ ] Results written to `workbench-store` for the Workbench to consume.

### Task 17 — `Workbench` island: rail (Source/Settings/Advanced/Download) + grid + totals + convert

**Files:** `src/components/app/Workbench.tsx` + `workbench/SourcePanel.tsx`, `SettingsPanel.tsx`, `AdvancedPanel.tsx`, `DownloadPanel.tsx`, `Rail.tsx`, `Toolbar.tsx`, `ImageGrid.tsx`, `ImageTile.tsx`, `PictureSnippetPopover.tsx`, `TotalsBar.tsx`, `LocalFilesDrop.tsx`, with `_.test.tsx`.
**Interfaces:** Consumes `workbench-store.ts`, `convert/index.ts` (`convertImage`, `buildZip`, `estimateSize`), `proxy-client.ts` + `concurrency.ts` (convert-time image fetch), `metadata.ts` (progressive dims/size), `dedupe.ts` (`flagDuplicates`), `picture-snippet.ts`, `url-safety` client filter (Task 12), `ConvertOptions`/`ScrapedImage`.
**Behavior:** Implements `app-workbench.html`. Left rail: Source card (connected/scraped summary + "or drop your own files" -> `LocalFilesDrop`), Convert settings (format WebP/AVIF/PNG/JPEG, quality slider, proportional max-W/max-H), Advanced (keep aspect, strip EXIF, remove color profile), Download (summary dl + the SINGLE "Convert & download ZIP" button + the amber bandwidth warning). Main: toolbar (filter, sort, search, select-all, hide-duplicates, grid/list), the selectable image grid (thumbnails from source via the safe-URL filter, `referrerpolicy=no-referrer`, format + size labels, amber dupe flag, per-tile "Get `<picture>` code" -> `PictureSnippetPopover` with copy), and the sticky totals bar (original -> estimated-after). Convert flow: on the single button, re-verify token up front, fetch SELECTED image bytes via `fetchViaProxy(type=image)` through the `concurrency` limiter (4-6 in flight), `convertImage` each sequentially (memory discipline), `buildZip` streaming, trigger download. Progressive metadata: as thumbnails load, capture dims/size, re-run `flagDuplicates`, refresh totals via `estimateSize`. Bandwidth warning fires when selected MEASURED bytes exceed ~100 MB (spec §5.3; confirm threshold at expansion). Per-file convert failures reported, batch continues. Mobile rail collapses (matching the mock's collapsible summary).
**Key tests:**
- `Workbench rehydrates images from the store and renders the grid`.
- `format/quality/resize/advanced controls update ConvertOptions`.
- `selecting images updates the totals bar and download summary`.
- `thumbnails are filtered by url-safety and carry referrerpolicy=no-referrer`.
- `amber dupe flag shown for isDuplicate tiles; hide-duplicates filters them out`.
- `Get <picture> code copies the snippet from picture-snippet.ts`.
- `Convert & download fetches selected bytes via proxy (concurrency-limited), converts, and builds a zip` (mock proxy + convert).
- `convert re-verifies the token up front and surfaces verify prompt if expired`.
- `bandwidth warning appears when selected measured bytes exceed the threshold`.
- `a per-image convert failure is reported and the batch continues`.
- `LocalFilesDrop populates the grid with no network (local-files flow)`.
**Acceptance criteria:**
- [ ] Rail + grid + totals + single convert button match the mock and the §6 spec.
- [ ] Convert fetches only SELECTED images, concurrency-limited, sequential encode, streaming zip, downloads.
- [ ] Token re-verified before the batch; expiry surfaces the verify prompt.
- [ ] Progressive dims/size -> dedupe re-flag -> totals refresh.
- [ ] Bandwidth warning keyed on measured bytes (~100 MB).
- [ ] Local-files flow skips all network (no proxy, no Turnstile).
- [ ] AVIF selectable and produced.

### Task 18 — Light integration / E2E + manual checklist

**Files:** `tests/integration/scrape-to-zip.test.ts`, `tests/fixtures/*`.
**Interfaces:** Consumes the full client pipeline with the proxy mocked by a fixture server (or MSW): parse -> crawl -> Workbench -> convert -> zip.
**Behavior:** Scrape a LOCAL fixture site (served or mocked), reach the Workbench, convert a small selection, and assert a downloadable zip with the expected files. Keep it light (one happy path + one failure path). Add a manual checklist for the items unit tests cannot cover: both app screens against the mocks, a 200 MB+ batch on a mid-tier phone (OOM check, spec §7/§13), real AVIF encode timing, and real cross-origin thumbnail rendering with isolation OFF.
**Key tests:**
- `fixture scrape -> workbench -> convert -> zip produces the expected files`.
- `a blocked/over-cap proxy response surfaces the right error without crashing the flow`.
**Acceptance criteria:**
- [ ] One green E2E happy path through the whole client pipeline (proxy mocked).
- [ ] One error path (413/429/blocked) handled gracefully.
- [ ] Manual checklist written for OOM, AVIF timing, cross-origin thumbnails, and visual parity with the mocks.

### Task 19 — Delete legacy SPA + final cleanup

**Files:** delete `src/features/scraper/*`, `src/features/converter/*`, `src/shared/services/imageUtils.ts`, `src/router.tsx`, `src/main.tsx` (confirm no live import remains).
**Interfaces:**
- Consumes: nothing new (this task is removal-only). The CONTRACT modules that supersede the deleted code are already in place: `convertImage`/`buildZip`/`estimateSize` (`src/lib/convert/index.ts`, Task 9), `extractImages`/`parseSitemap` (`src/lib/scrape/parse.ts`, Task 2), and `fetchViaProxy` (`src/lib/proxy-client.ts`, Task 10) replace the old URL-taking `convertImage` and the public-CORS-proxy `scraperService`.
- Produces: no contract surface; only removes the legacy SPA modules so nothing imports the pre-CONTRACT shapes.
**Behavior:** After Tasks 1-18 land and the islands fully cover the old behavior, remove the superseded React-Router SPA scraper/converter and the old `convertImage(url,...)` / public-proxy service. Re-run the §10 cleanup grep (no `Morphix`, `GEMINI`, `aistudiocdn`, `@google/genai`, `process.env.API_KEY`, `metadata.json`, no `corsproxy.io`/`allorigins`/`codetabs`).
**Key tests:** full `tsc --noEmit`, `vitest run`, and an import-graph check that nothing references the deleted files.
**Acceptance criteria:**
- [ ] Old scraper/converter SPA and `imageUtils.ts` removed.
- [ ] No references to public CORS proxies anywhere.
- [ ] Cleanup grep clean; typecheck + tests green.

---

## Notes for the expansion pass (do before executing)
- Re-confirm the live proxy error/response shapes (status codes, `Retry-After`, image headers) against the shipped Phase 1 code; adjust `proxy-client.ts` typed errors and the crawl pause/verify logic accordingly.
- Lock the open decisions (spec §17): session-token TTL + whether silent refresh is allowed (default: human check), the ~100 MB measured-bytes warning threshold, and the thumbnail-failure fallback (default: placeholder-and-exclude). Bake the chosen values into Tasks 10, 11, 13, 16, 17.
- Verify single-thread `@jsquash/avif` is importable without `nodejs_compat` / SharedArrayBuffer and pin its version alongside the other codecs.
- Apply the copy patch (spec §9): AVIF appears as a shipped format in the Workbench format control and any app-level copy; infra detail stays in the marketing FAQ only.
