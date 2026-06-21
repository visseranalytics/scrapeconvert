# ScrapeConvert: Open-Source Overhaul — Design Spec

Date: 2026-06-21
Status: Draft for review (v2, hardened after adversarial security + feasibility + consistency review)

## 1. Summary

ScrapeConvert is a free, open-source web tool that does two things, both centered on the browser:

1. **Extracts images from any website** (one page, several pages, or a whole site).
2. **Converts and optimizes** those images to web-ready formats (WebP, AVIF, PNG, JPEG).

This overhaul prepares the project to be open-sourced and to run on its own infrastructure. It:

- Replaces the brittle, abusable public-CORS-proxy scraping with a first-party, abuse-hardened Cloudflare Worker.
- Migrates from a Vite SPA on Vercel to **Astro SSR on Cloudflare Workers**.
- Redesigns the marketing site and the app around a clear value proposition (extract + convert in one place; the combination is the differentiator).
- Removes the Google AI Studio scaffolding so the codebase is clean to publish.

Conversion has always run client-side and stays that way. The scraper is the only part that needs server egress, so the proxy is the main trust surface and gets the bulk of the hardening below.

## 2. Goals and non-goals

**Goals**
- A visitor understands what the tool does, and why it is different, within five seconds.
- Scraping works through our own infrastructure, with no dependence on free third-party CORS proxies.
- The scraping proxy is genuinely safe to expose publicly (SSRF-pinned, rate-limited, bot-gated, abuse-bounded).
- Runs on Cloudflare's free tier, with a clean self-host path.
- A clean, MIT-licensed repository with no leftover scaffolding or secrets.

**Non-goals (deferred, see §16)**
- Animated GIF to animated WebP conversion.
- A hosted paid ("Pro") tier.
- Accounts, history sync, or any server-side persistence of user data.

## 3. Current state (what we are replacing)

- **Framework / host:** Vite SPA + React Router 7, deployed on Vercel with a catch-all SPA rewrite (`vercel.json`).
- **Scraping:** `src/features/scraper/services/scraperService.ts` tries a direct `fetch()`, then falls back through three public CORS proxies (`corsproxy.io`, `allorigins.win`, `codetabs.com`). Brittle, throttled by strangers, abusable. Dedupe today is **URL-based only** (`seenUrls.has(img.url)`, ~line 700).
- **AI Studio scaffolding:** `index.html` importmap → `aistudiocdn.com`; `@google/genai` dependency; `vite.config.ts` wires `process.env.API_KEY` from `GEMINI_API_KEY`, unused in `src/`; a stray `metadata.json` in the repo root.
- **Branding split:** README says "Morphix"; site/sitemap/OG/`schema.org` say "ScrapeConvert" (domain `scrapeconvert.com`).
- **Conversion:** already 100% client-side via `@jsquash/*` WASM. Keep.
- **Chrome extension:** under `extension/`, a content script that reads `img` / `background-image` / `<picture>` from the user's current tab (host permissions `<all_urls>`).

## 4. Scope decisions (locked)

| Axis | Decision | Reason |
|---|---|---|
| Name | **ScrapeConvert** | Keep the live domain and all existing SEO; no migration. |
| Redesign | **Full rebuild** | New design language everywhere; components rewritten as needed. |
| Extension | **Update it (rebrand + repackage)** | Same-tab extraction stays a content script (no proxy needed); see §10. |
| Positioning | **Free, open source** | Donations only. No pricing section. |
| Formats | **WebP, AVIF, PNG, JPEG ship in v1** | AVIF via `@jsquash/avif`; copy must be patched to match (§9). |

## 5. Architecture

### 5.1 Topology and the cross-origin-isolation decision

One Astro project, one Cloudflare Worker, using `@astrojs/cloudflare` with `output: 'server'` (SSR). Pin the Astro + adapter versions in `package.json`/README; read bindings with the version-correct accessor (`import { env } from 'cloudflare:workers'` on current versions) and prefer **WebCrypto (`crypto.subtle`)** over `node:crypto` so `nodejs_compat` is not required.

- **Marketing pages** (`/`, legal): prerendered `.astro`. Minimal client JS (just the load simulator).
- **App screens** (Scraper input, Workbench): React **islands** (`client:only="react"`). Conversion runs in the browser via `@jsquash/*` WASM, plus `@jsquash/avif`.
- **API**: Astro endpoints under `src/pages/api/` executing on the Worker.

**Cross-origin isolation: NO (v1).** Threaded `@jsquash` builds need `SharedArrayBuffer`, which requires the page to be cross-origin isolated (`COOP: same-origin` + `COEP: require-corp`). But `require-corp` blocks plain cross-origin `<img>` loads, which is exactly how the bandwidth strategy renders free third-party thumbnails (§5.3). These conflict. v1 uses the **single-thread `@jsquash` builds** (no `SharedArrayBuffer`), keeping free thumbnails. Tradeoff: AVIF/codec encode is slower (noted in §16). A future move to `COEP: credentialless` could restore threading while allowing credential-less cross-origin images, but Safari/Firefox support must be verified first.

### 5.2 Scraping backend (replaces the public proxies)

Two endpoints, both on the Worker.

**`POST /api/turnstile` — mint a session token.**
- Verify the Turnstile token with siteverify, sending `remoteip` and the secret. Reject **duplicate** Turnstile tokens (track recently-seen) since siteverify tokens are single-use.
- On success, return a **structured, HMAC-signed session token**: `{ iat, exp, nonce, ip_hash }`, HMAC over canonical JSON. `ip_hash` binds to a coarse client network (`/24` v4, `/64` v6) to tolerate NAT while preventing free public sharing of a bearer string.
- The HMAC secret is a **required Worker secret with no default**; deploy fails if unset. `.env.example` carries a placeholder only, never a usable key.
- Rate-limit this mint endpoint per IP to slow token-farm rotation.

**`GET /api/fetch?url=<target>&type=page|sitemap|image` — the hardened relay.** Requires a valid session token (verify HMAC, `exp`, and that the request IP matches `ip_hash`). Relays bytes only; never parses HTML/XML/sitemaps server-side (parsing is client-side, keeps Worker CPU within the free-tier 10ms budget).

**SSRF defense (the part that makes a public fetch proxy safe).** A plain `fetch(hostname)` on Workers resolves DNS itself, hides the resolved IP, and follows redirects opaquely, so pre-fetch string checks are defeated by DNS rebinding. The spec therefore requires:
- **Resolve and pin the IP.** Resolve the target hostname yourself via DNS-over-HTTPS (e.g. `cloudflare-dns.com/dns-query`), validate **every** returned A/AAAA record against the special-use blocklist below, and connect to the **validated literal IP** using the Workers `connect()` Sockets API (sending the correct Host header + SNI). This pins the connection to the address you validated and closes the resolve/connect TOCTOU gap. (Decision flag in §16: the simpler "DoH-resolve + validate + then `fetch(hostname)`" leaves a residual rebinding window and is acceptable only for private/self-host, not the public instance.)
- **Manual redirects.** Set `redirect: 'manual'`; for each hop, re-run the full URL + IP validation on the `Location`, enforce `http`/`https` only, cap the hop count, and never auto-follow meta-refresh/JS redirects.
- **Complete special-use blocklist, applied to resolved IPs (primary) and any IP-literal host (defense in depth).** Normalize to packed bytes (handle decimal/octal/hex/IPv6-bracketed/IPv4-mapped encodings), then reject — IPv4: `0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.0.0/24, 192.0.2/24, 192.168/16, 198.18/15, 198.51.100/24, 203.0.113/24, 224/4, 240/4, 255.255.255.255`; IPv6: `::1, ::, ::ffff:0:0/96` (re-test the embedded v4), `fe80::/10, fc00::/7, ff00::/8, 2001:db8::/32, 64:ff9b::/96`.
- **Own-zone and self-recursion.** Deny the configured zone apex + all subdomains, `*.workers.dev`, the account's Worker routes, and any `url` whose host equals the request host or points back at `/api/fetch`. A configurable host denylist in `wrangler.toml` lets self-hosters extend it.

**Caps and stream hygiene.**
- Enforce size by **counting actual bytes read from the response stream and aborting on overflow** (HTML ~5 MB, image ~25 MB). `content-length` is attacker-controlled, often absent on chunked responses, and reflects compressed bytes — use it only as an early-reject hint, never as the enforcement mechanism. Request identity encoding (or bound decompressed output) so a gzip/brotli bomb cannot blow the cap during decode.
- Request-header allowlist on egress: only a generic User-Agent, `Accept`, and a fixed `Accept-Encoding`. Drop everything else, especially `Cookie`/`Authorization`/`Referer`/`CF-*`/`X-Forwarded-*` (no credential laundering, no edge-internal leakage).
- Response hygiene: strip `Set-Cookie` and upstream security headers; serve relayed image bytes with a **sanitized `image/*` content-type**, `Content-Disposition: attachment`, and `X-Content-Type-Options: nosniff`; refuse to relay `text/html` as `type=image`; `/api/fetch` responses carry no cookies.

**Rate limiting and egress budgets.** The Cloudflare Workers Rate Limiting binding is a **per-colo, eventually-consistent, 10s/60s soft throttle** — Cloudflare explicitly says not to treat it as accurate accounting or to key it on IP. So:
- Key the binding on the **session token** (unique per session), as a burst throttle.
- Treat **token issuance** (Turnstile + short-TTL HMAC) as the real per-user gate.
- Add a **per-token total-fetch budget and total-byte budget** (a crawl is bounded regardless of TTL), a **per-destination-host cap** (neutralizes using the proxy to DDoS a third party), and a **global per-instance egress circuit-breaker**.
- The hosted instance layers Cloudflare WAF rate rules (zone-level) as the harder ceiling; self-hosters on free tier get the soft binding + budgets.

**Abuse policy (residual risk of an open relay).** Even with SSRF fully pinned, the proxy is an anonymous GET relay. Document: the per-destination-host ceiling, an abuse-contact/takedown path for the hosted instance, a stance on `robots.txt` (at minimum documented; optionally honored), and a configurable destination denylist. Acknowledge the residual risk so deployers understand what they expose.

### 5.3 Bandwidth strategy

- **Browsing is free.** The results grid renders thumbnails **directly from the source site** via `<img src>` (browsers do not enforce CORS on `<img>` rendering). The proxy is only hit for the small HTML/sitemap text that discovers image URLs, and later for the bytes of images the user actually converts.
- **Client-driven crawl fan-out.** The browser island makes **one `GET /api/fetch?type=page` call per page** (each its own Worker invocation, well under the free-tier 50-subrequest cap). There is **no server-side fan-out** — a single Worker invocation must never crawl many pages or it will hit the 50-subrequest / Cache-call free-tier ceiling. Server-side sitemap-index expansion, if ever added, must be chunked across invocations.
- **Pay only on convert.** Image bytes are relayed through the proxy only at convert/download time, only for selected images, with a **client-side concurrency limiter (4–6 in flight)** — one image per Worker invocation, which also smooths the rate limiter and is gentle on the source.
- **Edge cache (optimization, not a dependency).** Cache fully-validated `2xx` responses in the Cloudflare Cache API, keyed on the **normalized target URL only** (never the session token or client headers); validate-then-cache; bounded TTL; max cacheable object size; do not cache `3xx/4xx/5xx`. Note: Cache API is per-colo and its calls count against the free-tier 50-call budget; reliable behavior needs a custom domain (not `*.workers.dev`).
- **Conversion stays client-side.** The Worker never decodes/encodes; zero server compute.
- **Large-batch guardrail.** Warn when the selected set exceeds a byte threshold (initial ~100 MB, computed from **measured** bytes, not advertised sizes), suggesting a smaller selection.
- **Client-side image-URL safety.** Discovered image URLs are rendered in the user's own browser, a second egress the server guard never sees. Before rendering as `<img src>`, filter them with the same scheme + special-use/private-IP rules (drop RFC1918/link-local/localhost/non-http(s) and credentials-in-URL), set `referrerpolicy="no-referrer"`, and apply a restrictive CSP `img-src` so the app cannot be turned into a request-forgery cannon via the victim's browser.

### 5.4 Dedupe and metadata acquisition

Content-based dedupe is a headline differentiator and a **behavioral rebuild** (today's code is URL-only).
- **Dimensions** come from the thumbnail `<img>` `onload` (`naturalWidth`/`naturalHeight`) as the grid renders — no proxy.
- **File size** comes from the same thumbnail GET the browser already makes, read via the Performance Resource Timing `transferSize` where available; fall back to an explicit `HEAD` (which, being cross-origin, **routes through the proxy** and counts as egress) only when needed.
- **Dedupe key** = `(byte size + intrinsic dimensions)`, catching the same picture at different URLs/`@2x`/CDN variants. Flagged, not auto-removed.
- **Progressive UI.** Images start un-flagged; dedupe flags and sizes resolve as metadata arrives.
- **Failure fallback.** If a thumbnail fails to load (hotlink/CORP/Referrer policy) or size is unavailable, the image shows a placeholder and is **excluded from dedupe** (documented), or optionally fetched once via the proxy to obtain bytes→dimensions→size (egress cost accepted for that minority). Pick one and state it in the build.

## 6. App structure and flows

Two screens (mocks are the visual reference: `design-mocks/app-scraper.html`, `design-mocks/app-workbench.html`).

**Screen 1 — Scraper input.** Choose a source mode (single page / multiple URLs / sitemap crawl), pass the one-time Turnstile check, and watch the crawl: a sitemap-discovery checklist and a per-page crawl log with running image counts. The user can open the Workbench while the crawl continues in the background.

**Screen 2 — Workbench (unified convert).** Source is either the scraped URL or the user's own uploaded files (drag-drop). One screen for both.
- **Left rail:** Source (with "or drop your own files"), Convert settings (format WebP/AVIF/PNG/JPEG, quality, proportional max-W/max-H resize), Advanced options (keep aspect ratio, strip EXIF metadata, remove color profile), Download (summary + a **single** "Convert & download ZIP" button + the bandwidth warning).
- **Main area:** toolbar (filter, sort, search, select-all, hide-duplicates, grid/list), a selectable image grid (format + size labels, duplicate flags), and a sticky totals bar (original → estimated-after).
- **Per image:** a "Get `<picture>` code" action that copies a production-ready snippet (AVIF + WebP sources + `<img>` fallback).

**Primary flow:** Scraper input → crawl → Workbench (populated) → select → convert (client WASM; selected-image bytes via the proxy) → download ZIP.
**Local-files flow:** open the Workbench with the upload source → convert → download. No scraping, no proxy.

## 7. Image features

- **Extraction:** every visible `<img>` plus images set via CSS `background-image` (inline `style` and `<style>` blocks). Sitemap crawling handles sitemap indexes and image sitemaps. Direct image URLs accepted as-is. (`srcset` and external-stylesheet backgrounds are deferred, §16.)
- **Duplicate detection:** content-based per §5.4.
- **Conversion:** single-thread `@jsquash` codecs (jpeg/png/webp/oxipng) plus `@jsquash/avif`. Quality 10–100. Resize as a proportional max width/height, never upscale. Advanced: strip EXIF (privacy win), remove embedded ICC color profile, keep aspect ratio.
- **Memory discipline (browser):** process images sequentially (or small concurrency), releasing each source/encoded `ArrayBuffer` before the next; reuse a single codec module instance; build the ZIP with `jszip` `generateAsync` streaming and free buffers as they are added. A 100–250 MB batch can otherwise OOM a mobile tab (§13).
- **`<picture>` snippet generator:** AVIF + WebP `<source>`s with an `<img>` fallback, copyable.
- **Savings tally:** the totals bar's "estimated after" is a **heuristic ratio per format/quality** (output size is unknowable without encoding); state it as an estimate (it already reads "estimated").

## 8. Design system

**Direction A, "quiet and precise."** Neutral zinc + a single emerald accent (`#34d399`); amber reserved only for the duplicate-flag state. Hairline `white/10` borders, one radius scale (lg / 2xl / full), Inter + JetBrains Mono, tabular-nums on numbers, focus-visible rings on every interactive element. No gradient text, no rainbow icon colors, no violet, no decorative blobs. Canonical mocks: `design-mocks/direction-a-developer-dark.html` (home), `design-mocks/app-scraper.html`, `design-mocks/app-workbench.html`.

## 9. Copy

Source of truth: `design-mocks/COPY-REVISION.md`. Hero = Option A. Marketing communicates value (the extract+convert combination, scraper reach, in-browser privacy); all infrastructure detail (proxy, CORS, Cloudflare, rate limiting) lives in the FAQ only. Honesty rules: conversion is local (no server copies); scraping fetches transit the proxy (disclosed in the FAQ); "most public sites," not "any site." Voice: no em dashes, no buzzwords, no three-part punchlines.

**Copy patch required before build:** `COPY-REVISION.md` predates the AVIF lock and lists only "WebP, PNG, JPEG" (and "AVIF on the list" in the FAQ). Update the FAQ "Which formats" answer, the meta description, the hero subhead, the converter card, and how-it-works to include AVIF as shipped.

## 10. Open-source preparation

- **Remove:** the `index.html` importmap (`aistudiocdn.com`), the `@google/genai` dependency, the `GEMINI_API_KEY` / `process.env.API_KEY` wiring, `vercel.json`, and the stray `metadata.json`.
- **Cleanup acceptance check:** grep the repo for `Morphix`, `GEMINI`, `aistudiocdn`, `@google/genai`, `process.env.API_KEY`, `metadata.json`; must come back clean.
- **Add:** `LICENSE` (MIT), a real `README` (features, deploy-to-Cloudflare, env vars, self-host), and `.env.example` (Turnstile site + secret keys, HMAC secret placeholder, rate-limit config).
- **Chrome extension:** same-tab extraction stays in the **content script** (the user's page is already loaded; no proxy and no Turnstile needed, and forcing a bot check there is worse UX). Only rebrand/repackage for v1. The proxy/Turnstile path is only relevant if the extension later adds cross-page or sitemap crawl.
- **Deploy/cutover:** Wrangler / Cloudflare. Stand up a **staging Worker**, verify, then switch `scrapeconvert.com` DNS from Vercel to the Worker. Document a one-line rollback (revert DNS).

## 11. Module breakdown (units, each independently testable)

- **`src/pages/`** — marketing `.astro`, the two app routes, and `src/pages/api/{turnstile,fetch}.ts`.
- **`src/components/app/`** — React islands: `ScraperInput`, `Workbench`, and Workbench subcomponents (rail, grid, totals bar, settings panels).
- **`src/lib/scrape/parse.ts`** — pure HTML/sitemap parsing + image extraction (network injected, unit-testable).
- **`src/lib/scrape/crawl.ts`** — crawl-orchestration state machine (sitemap-discovery checklist + per-page crawl log + running counts + token-lifecycle handling), separate from the pure parser.
- **`src/lib/convert/`** — `@jsquash` wrappers, resize, EXIF/profile stripping, ZIP builder, and the **size-estimation** helper (heuristic per format/quality for the totals bar).
- **`src/lib/dedupe.ts`**, **`src/lib/picture-snippet.ts`**, **`src/lib/url-safety.ts`** (shared special-use/scheme filter used by both the server guard and the client `<img>` filter), **`src/lib/types.ts`**.
- **`src/server/`** — proxy internals: DNS-resolve+validate, `connect()`-pinned fetch with manual redirects, stream-and-count caps, header hygiene, edge cache, Turnstile verify, token sign/verify, rate-limit + budget enforcement.
- **`extension/`** — rebranded content-script extension.

## 12. Data flow

1. App island calls `POST /api/turnstile` with the Turnstile token → Worker verifies (with `remoteip`, dup-check) → returns the signed `{iat,exp,nonce,ip_hash}` token, stored in `sessionStorage` (survives reload within the tab).
2. Scraper island makes one `GET /api/fetch?type=page|sitemap` per page (client-driven fan-out) with the token. Parsing is client-side.
3. The grid renders thumbnails straight from source (filtered by `url-safety`); dimensions/size captured client-side (§5.4).
4. On convert, the Workbench fetches the selected images via `GET /api/fetch?type=image` (concurrency-limited), decodes/encodes in-browser via WASM, and zips for download.
5. Local-files flow skips steps 1–4's network entirely.

## 13. Error handling

- **Proxy:** `400` invalid/blocked URL (SSRF/own-zone), `401` missing/expired/IP-mismatched token, `413` over-size (stream aborted), `429` rate-limited / budget-exhausted (with `Retry-After`), `502` upstream failure.
- **Token lifecycle mid-flow:** a background crawl that outlives the ~45 min token **pauses and surfaces a single non-blocking "verify to continue" prompt** (does not abort/restart); the convert step checks token validity up front and re-verifies before the batch. Decide whether a near-expiry **silent refresh** (re-issue without a new challenge within a grace window) is allowed; default to a human check.
- **Crawl:** per-page failures are logged and skipped; the crawl does not abort.
- **Browse grid:** per-thumbnail load failure → placeholder + excluded from dedupe (§5.4).
- **Conversion:** per-file failures reported, batch continues; guard against tab OOM on large batches (§7).

## 14. Testing

- **SSRF matrix:** IP literals across ranges and encodings (decimal/octal/hex/IPv4-mapped IPv6/trailing-dot); hostnames resolving to private/reserved (rebinding); redirect to a private host; redirect chain that rebinds on a late hop; redirect to a different scheme; own-zone / self-recursion.
- **Token:** forged rejected, expired rejected, IP-mismatch rejected, replayed Turnstile rejected, token-without-solve rejected; per-token fetch/byte budget enforced.
- **Stream caps:** chunked response with no `content-length` exceeding the cap; lying `content-length`; gzip bomb.
- **Header hygiene:** client `Cookie`/`Authorization` not forwarded; `Set-Cookie` stripped; `type=image` refuses `text/html`.
- **Pure logic:** parser (`<img>`, CSS backgrounds, sitemap index + image sitemap), dedupe keying, `<picture>` snippet, size-estimation, `url-safety` filter.
- **Integration/E2E (light):** scrape a local fixture site → Workbench → convert → ZIP.
- **Manual:** both app screens; a 200 MB+ batch on a mid-tier phone (OOM check); the marketing simulator.

## 15. Phasing

The overhaul is too large and too sequenced to plan as one effort; the security-critical proxy must not be rushed at the end.

- **Phase 0 — Scaffold + cleanup.** Astro on Cloudflare; remove AI Studio cruft (§10); add LICENSE/README/.env.example; marketing pages build and deploy. Repo is publishable.
- **Phase 1 — Proxy (security-critical, isolated).** `/api/turnstile` + `/api/fetch` with DNS-pinned SSRF guard, manual redirects, token model, rate-limit + budgets, stream caps, header hygiene, cache. Built TDD against the §14 matrix and abuse-tested before any UI consumes it.
- **Phase 2 — App.** Scraper island + Workbench unification + dedupe rebuild + AVIF + `<picture>` snippet, consuming the Phase-1 proxy.
- **Phase 3 — Extension.** Rebrand/repackage (content-script only).
- **Phase 4 — Marketing polish + cutover.** Final copy/mocks (incl. AVIF patch), staging Worker verify, DNS switch, rollback documented.

## 16. Deferred / out of scope

Animated GIF→WebP; hosted Pro tier; external-stylesheet `background-image`; `srcset` parsing; accounts or server-side persistence; cross-origin isolation + threaded codecs (revisit via `COEP: credentialless`).

## 17. Open questions / decisions to confirm

- **SSRF mechanism:** ship the `connect()`-pinned implementation (secure, more work) for the public instance, or accept the simpler DoH-resolve-then-`fetch(hostname)` with a documented residual rebinding window (acceptable only for private/self-host)? Spec assumes `connect()`-pinned for the hosted instance.
- **Turnstile session-token TTL** (default 45 min) and whether silent refresh is allowed (§13).
- **Large-batch warning threshold** (initial ~100 MB, measured bytes).
- **Thumbnail-failure fallback** (§5.4): placeholder-and-exclude vs proxy-once-for-metadata.
- **Trust-strip before/after figure** (currently illustrative 4.2 MB → 0.9 MB) — set a real, defensible number.
