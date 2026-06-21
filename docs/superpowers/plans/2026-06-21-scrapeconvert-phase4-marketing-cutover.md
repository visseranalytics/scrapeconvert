---
# Phase 4: Marketing build + cutover Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
**Goal:** Patch the copy doc for AVIF, build the production marketing and legal `.astro` pages from the approved Direction A mock plus the patched copy, wire SEO/meta/OG/sitemap/schema and the WebP-vs-PNG load simulator, then cut `scrapeconvert.com` over from Vercel to the Cloudflare Worker with a documented rollback.
**Architecture:** Prerendered `.astro` marketing + legal pages served by the existing Astro-on-Cloudflare SSR Worker (Phase 0 scaffold); a tiny vanilla/island script for the load simulator; static OG image + JSON-LD + sitemap; cutover is DNS-only (Vercel -> Worker) staged behind a staging domain first.
**Tech Stack:** Astro (`output: 'server'`) + `@astrojs/cloudflare`, Tailwind (matching the mock's tokens), vanilla JS or a minimal Astro island for the simulator, Wrangler/Cloudflare for deploy + DNS.
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

**OUTLINE ONLY: expand to bite-sized TDD steps (per the writing-plans skill) before executing, after Phase 1 ships.** This plan is intentionally at the outline level. Each task below names files, the contract interfaces it consumes/produces, the behavior, the key tests, and acceptance criteria, but does not yet contain line-by-line test code or step-by-step edits. Re-open this file once Phase 1 (proxy) and ideally Phase 2 (app) have landed, then expand every task into bite-sized red/green/refactor steps before executing.

---

## Dependencies on earlier phases

- **Phase 0 (scaffold) is a hard prerequisite.** This plan assumes the Astro-on-Cloudflare project already exists, the AI Studio cruft is removed, and a basic deploy pipeline (Wrangler) works. If any marketing page already exists from Phase 0 as a placeholder, this phase replaces it with the final build. Phase 0 also owns the `LICENSE`, base `README`, and `.env.example`; this phase only references them and does not recreate them.
- **Phase 2 (app) is a soft prerequisite for the cutover gate only.** The marketing pages can be built and shipped to the staging domain before the app exists. But every "Open the app, free" button and the nav/footer app links point at the app routes (`/scraper`, `/workbench` per the Phase 2 plan). The production DNS cutover (Task 12) must NOT land until those routes resolve, or the primary CTA dead-ends. The marketing build itself does not import any Phase 2 React island; it only links to the app routes by path.
- **Phase 1 (proxy) is not consumed by marketing pages directly.** Marketing has no server egress. The only cross-reference is that the staging-Worker verification (Task 11) confirms the marketing pages and the `/api/*` endpoints coexist on one Worker before DNS flips.
- **Shared interface contract:** marketing pages consume only the app-route paths and the static brand assets. They produce no new entries in the shared contract. The "View the source on GitHub" link is a text link to the public repo URL (set once in a shared config/constant, not hardcoded per page).

---

## File structure

**Modify**
- `design-mocks/COPY-REVISION.md` — patch to list AVIF as a shipped format (Task 1). This is the source of truth the build reads from; it must be patched before any page is built.
- `README.md` — add the deploy/cutover + rollback runbook section (Task 12) if Phase 0 did not already include it; otherwise extend it.
- `astro.config.*` — confirm prerender/SSR split and add the sitemap integration if not present (Task 9).
- `wrangler.toml` — confirm the marketing routes + static asset handling for the new pages and OG asset; confirm custom domain binding for the staging + prod hostnames (Task 11, Task 12). No secrets added here.

**Create — pages**
- `src/pages/index.astro` — the home page (all marketing sections, Task 2 + Tasks 3–8).
- `src/pages/privacy.astro` — privacy policy legal page (Task 10).
- `src/pages/terms.astro` — terms of service legal page (Task 10).
- `src/pages/acceptable-use.astro` — acceptable-use policy legal page (Task 10).

**Create — layout + shared marketing components**
- `src/layouts/MarketingLayout.astro` — shared `<head>` (meta/OG/canonical/favicon/fonts), skip link, nav, footer, JSON-LD slot (Task 2, Task 9).
- `src/components/marketing/Nav.astro` — sticky header nav with the GitHub text link + "Open the app" CTA (Task 2).
- `src/components/marketing/Footer.astro` — footer with tagline, legal links, GitHub text link (Task 2).
- `src/components/marketing/Hero.astro` — hero (Option A copy) + faux-app preview (Task 3).
- `src/components/marketing/WhoItsFor.astro` — one-line band (Task 3).
- `src/components/marketing/TrustStrip.astro` — before/after number + three honest claims (Task 3, real number set in Task 8).
- `src/components/marketing/ComparisonTable.astro` — "What makes it different" table (Task 4).
- `src/components/marketing/ScraperStory.astro` — scraper-led body section + mini-mock (Task 5).
- `src/components/marketing/ConverterStory.astro` — converter section + four-format mini-mock (Task 5).
- `src/components/marketing/WhyOptimize.astro` — why-optimize copy + the load simulator (Task 6).
- `src/components/marketing/LoadSimulator.astro` (+ `loadSimulator.ts` script) — WebP-vs-PNG load simulation island/script (Task 7).
- `src/components/marketing/HowItWorks.astro` — three steps (Task 4).
- `src/components/marketing/Privacy.astro` — privacy explainer cards (Task 4).
- `src/components/marketing/Faq.astro` — FAQ accordion/list, includes the patched AVIF answer (Task 4, depends on Task 1).
- `src/components/marketing/ClosingCta.astro` — closing CTA (Task 4).

**Create — assets + config**
- `public/og/scrapeconvert-og.png` (or `.astro`-generated static) — 1200x630 OG/Twitter card image (Task 9).
- `public/favicon.svg` / `public/favicon.ico` — brand glyph (bracket + arrow) (Task 9).
- `public/robots.txt` — allow crawl + sitemap reference (Task 9).
- `src/lib/site-config.ts` (or `src/consts.ts`) — `SITE_URL`, `GITHUB_URL`, `APP_URL`, social handles, single source for links/SEO constants (Task 2).
- `src/styles/marketing.css` or Tailwind config tokens — the zinc + emerald `#34d399` + amber tokens, JetBrains Mono / Inter, `tnum` utility, mirroring the mock's `tailwind.config` (Task 2).

**Create — tests**
- `tests/marketing/copy-avif.test.ts` — asserts COPY-REVISION.md patch is complete and consistent (Task 1).
- `tests/marketing/pages-build.test.ts` — build/render smoke for each page (Task 2, Task 10).
- `tests/marketing/seo-meta.test.ts` — meta/OG/canonical/JSON-LD/sitemap assertions (Task 9).
- `tests/marketing/load-simulator.test.ts` — simulator logic + reduced-motion behavior (Task 7).
- `tests/marketing/links-and-a11y.test.ts` — internal link targets resolve, GitHub is a text link not a button, focus-visible present, no banned design tokens (Task 4, Task 8).
- `docs/runbooks/cutover.md` — DNS cutover + rollback runbook (Task 12) (a runbook doc, not a report).

---

## Task list

### Task 1 — Patch COPY-REVISION.md to list AVIF as shipped
**Files:** `design-mocks/COPY-REVISION.md`; `tests/marketing/copy-avif.test.ts`
**Interfaces:** Consumes: none (the spec §9 AVIF patch directive; spec §4 formats lock "WebP, AVIF, PNG, JPEG ship in v1"). Produces: the corrected copy source of truth that all later marketing tasks read from. No shared-contract entries.
**Description:** Update every place the copy doc still says "WebP, PNG, or JPEG" (or treats AVIF as merely under consideration) so AVIF reads as a shipped v1 format, matching the spec lock and the already-AVIF-aware mock. The five spec-named surfaces: the FAQ "Which formats" answer (line ~275, change "WebP, PNG, and JPEG today ... AVIF is on the list we are looking at; if you need it, open an issue" to list WebP, AVIF, PNG, JPEG as shipped); the meta description (line ~17, add AVIF, matching the mock which already says "WebP, AVIF, PNG, or JPEG"); the hero subhead (line ~35, Option A); the converter card "Feature: WebP, PNG, or JPEG" heading + body (lines ~171–172); and how-it-works / the 5-second summary (line ~5) plus any list-of-formats body lines (lines ~35, ~198 keep the WebP-vs-JPEG-vs-PNG explanatory percentages as-is since they are a comparison, not a format menu). Keep the copy voice rules: no em dashes, no buzzwords, no three-part punchlines. Do not introduce a triad like "WebP, AVIF, PNG, JPEG" if it reads as a punchline; phrase as a normal list ("WebP, AVIF, PNG, and JPEG"). Leave the "Read the guide: WebP vs PNG vs JPEG" link text (line ~200) unless a separate decision adds AVIF to that guide.
**Key tests:**
- `copy-avif: no shipped-format menu omits AVIF` — grep the doc for shipped-format menus and assert each that lists WebP also lists AVIF (allowlist the WebP-vs-PNG-vs-JPEG comparison percentage line as an explicit exception).
- `copy-avif: no "AVIF is on the list we are looking at" framing remains` — assert the under-consideration phrasing is gone.
- `copy-avif: voice rules still hold` — assert no em dash characters introduced and no new three-part punchline in the edited lines.
**Acceptance criteria:**
- The FAQ "Which formats" answer states WebP, AVIF, PNG, JPEG are all available today.
- The meta description, hero subhead, and converter card all name AVIF as a shipped format.
- No remaining sentence implies AVIF is deferred or "open an issue if you need it."
- The doc still contains zero em dashes in visitor-facing copy and no new buzzword/triad lines.
- `tests/marketing/copy-avif.test.ts` passes.

### Task 2 — Marketing layout, design tokens, nav, footer, site config
**Files:** `src/layouts/MarketingLayout.astro`; `src/components/marketing/Nav.astro`; `src/components/marketing/Footer.astro`; `src/lib/site-config.ts`; `src/styles/marketing.css` (or Tailwind config); `tests/marketing/pages-build.test.ts`
**Interfaces:** Consumes: app-route paths (`APP_URL` -> `/scraper`), `GITHUB_URL`, `SITE_URL` from `site-config.ts` (Phase 2 owns the actual app routes; this only links by path). Produces: the shared shell every marketing + legal page extends. No shared-contract entries.
**Description:** Build the design-system shell from `design-mocks/direction-a-developer-dark.html`: the Tailwind token set (zinc neutrals, accent `#34d399`, amber only for the duplicate flag, Inter + JetBrains Mono, `tnum`, font-feature-settings, hairline `white/10` borders, one radius scale, focus-visible rings), the sticky backdrop-blur header nav, the skip-to-content link, and the footer with the tagline (COPY-REVISION footer tagline) and legal links. "View the source on GitHub" is a quiet text link, never a button, in both nav and footer. All link/SEO constants live in `site-config.ts` so the GitHub URL, app URL, and canonical host are set once.
**Key tests:**
- `pages-build: MarketingLayout renders head + skip link + nav + footer` — render the layout with a stub slot, assert the skip link, primary nav landmark, and footer landmark exist.
- `pages-build: GitHub is a text link not a button` — assert the GitHub element is an `<a>` styled as a link (no button classes) in nav and footer.
- `pages-build: design tokens` — assert the accent color resolves to `#34d399` and no violet/gradient-text classes appear.
**Acceptance criteria:**
- Layout matches the mock's nav/footer structure and tokens (zinc + single emerald accent, amber unused except reserved).
- Skip link, semantic `<header>/<main>/<footer>` landmarks, and focus-visible rings on every interactive element are present.
- GitHub appears as a text link (not a button) in both nav and footer.
- All external/app links resolve from `site-config.ts`; no hardcoded GitHub/app URLs in components.
- Pages extending the layout build with `astro build` with zero errors.

### Task 3 — Home: Hero (Option A), Who-it's-for band, Trust strip
**Files:** `src/pages/index.astro`; `src/components/marketing/Hero.astro`; `src/components/marketing/WhoItsFor.astro`; `src/components/marketing/TrustStrip.astro`; `tests/marketing/pages-build.test.ts`
**Interfaces:** Consumes: COPY-REVISION Hero Option A, Who-it's-for band, Trust strip copy; `APP_URL`/`GITHUB_URL` from `site-config.ts`. Produces: the top of the home page. No shared-contract entries.
**Description:** Build the hero with Option A copy (eyebrow "Free and open source", headline, AVIF-patched subhead, reassurance line under the buttons, primary button "Open the app, free" -> app route, secondary quiet GitHub text link) plus the faux-app preview window from the mock (static, decorative; tabular-nums on the size labels). Below it, the one-line who-it's-for band, then the trust strip with the before/after number and the three honest claims. The before/after figure is a placeholder string here and gets its real, defensible value in Task 8.
**Key tests:**
- `pages-build: hero copy matches Option A` — assert headline + subhead text (subhead includes AVIF) and the two CTAs (primary button label, secondary GitHub text link).
- `pages-build: trust strip has four items` — assert the before/after line + three claim lines render.
- `pages-build: hero numbers use tabular-nums` — assert the `tnum`/tabular-nums class on the faux-preview size labels.
**Acceptance criteria:**
- Hero renders Option A copy verbatim from the patched doc, subhead names AVIF.
- Primary CTA links to the app route; secondary GitHub is a text link.
- Who-it's-for band and trust strip render with the COPY-REVISION text.
- Trust-strip before/after number is wired through a single constant (set in Task 8), not hardcoded inline per render.

### Task 4 — Home: Comparison table, How-it-works, Privacy, FAQ, Closing CTA
**Files:** `src/components/marketing/ComparisonTable.astro`; `src/components/marketing/HowItWorks.astro`; `src/components/marketing/Privacy.astro`; `src/components/marketing/Faq.astro`; `src/components/marketing/ClosingCta.astro`; `src/pages/index.astro`; `tests/marketing/links-and-a11y.test.ts`
**Interfaces:** Consumes: COPY-REVISION comparison table, how-it-works, privacy, FAQ (AVIF-patched per Task 1), closing CTA. Depends on Task 1 for the FAQ "Which formats" answer. Produces: the lower body of the home page. No shared-contract entries.
**Description:** Build the comparison table ("Other tools do a slice ... ScrapeConvert does the whole job", 5 rows, horizontal-scroll on mobile per the mock, no competitor named), the three-step how-it-works, the two privacy cards (benefit-level, no proxy/CORS detail leaks into these), the FAQ (accordion or disclosure list; the proxy/CORS/Cloudflare/rate-limit/AVIF nuance lives here per spec §9; the "Which formats" answer must reflect the Task-1 AVIF patch), and the closing CTA (heading, subhead, primary "Open the app, free" button + quiet GitHub text link). FAQ disclosure widgets must be keyboard-operable with focus-visible rings.
**Key tests:**
- `links-and-a11y: FAQ formats answer names AVIF as shipped` — assert the rendered "Which formats" answer lists AVIF and contains no "open an issue if you need it" framing.
- `links-and-a11y: comparison table names no competitor` — assert column headers are the generic "typical grabber/converter" labels, not a brand.
- `links-and-a11y: FAQ items are keyboard-operable` — assert disclosure buttons have accessible names and focus-visible styling.
- `links-and-a11y: privacy cards stay benefit-level` — assert the privacy section does not contain the words proxy/CORS/Cloudflare (those belong only in FAQ).
**Acceptance criteria:**
- Comparison table renders all 5 rows, names no competitor, scrolls horizontally on mobile.
- How-it-works renders the three steps in order.
- Privacy section is benefit-level only; infrastructure terms appear only in the FAQ.
- FAQ renders all questions including the AVIF-corrected formats answer; disclosures are keyboard-accessible.
- Closing CTA primary button links to the app; GitHub is a text link.

### Task 5 — Home: Scraper-led body + Converter story (four-format mini-mock)
**Files:** `src/components/marketing/ScraperStory.astro`; `src/components/marketing/ConverterStory.astro`; `src/pages/index.astro`; `tests/marketing/pages-build.test.ts`
**Interfaces:** Consumes: COPY-REVISION "Product story 1: The scraper" and "Product story 2: The converter" (converter card AVIF-patched per Task 1). Produces: the two product-story sections. No shared-contract entries.
**Description:** Build the scraper section first in DOM order (it leads the body per spec §9), with the explicit-reach features (one page / many pages / whole-site sitemap crawl, `<img>` + CSS `background-image`, content-based dedupe, batch handoff) and the benefit-level reassurance card (no proxy/CORS detail). Then the converter section with its own story and the mini-mock format toggle showing all four formats WebP / AVIF / PNG / JPEG (the mock already shows four), the quality slider, the proportional resize copy, and the one strong privacy statement. Output-format labels in the mini-mock use tabular-nums for any size figures.
**Key tests:**
- `pages-build: scraper section precedes converter section in DOM` — assert `#scraper` appears before `#converter` in the rendered home page.
- `pages-build: converter format toggle shows four formats` — assert the four format labels (WebP, AVIF, PNG, JPEG) render in the converter mini-mock.
- `pages-build: scraper reassurance is benefit-level` — assert the scraper reassurance card does not mention proxy/CORS.
**Acceptance criteria:**
- Scraper section leads the body (before converter) and names multi-page, sitemap crawl, CSS backgrounds, content-based dedupe, and batch handoff.
- Converter mini-mock shows all four output formats.
- Neither product section leaks proxy/CORS/Cloudflare detail (FAQ-only).
- Converter privacy claim appears once, stated strongly.

### Task 6 — Home: Why-optimize section
**Files:** `src/components/marketing/WhyOptimize.astro`; `src/pages/index.astro`; `tests/marketing/pages-build.test.ts`
**Interfaces:** Consumes: COPY-REVISION "Why optimized images" copy (eyebrow, heading, body with the 25–35% / 60–80% ranges, three supporting cards with CWV/LCP/CDN in parentheses, the demo caption). Produces: the why-optimize section; hosts the load simulator from Task 7. No shared-contract entries.
**Description:** Build the why-optimize section with the trimmed copy, the real percentage ranges kept, jargon (LCP, Core Web Vitals, CDN) in parentheses, the "Read the guide: WebP vs PNG vs JPEG" link, the three supporting cards, and the honest demo caption ("This is an illustration ... not a live benchmark"). This section embeds the simulator built in Task 7.
**Key tests:**
- `pages-build: why-optimize keeps percentage ranges` — assert the 25–35% and 60–80% figures render.
- `pages-build: jargon is parenthesized` — assert LCP / Core Web Vitals appear inside parentheses, not as bare headings.
- `pages-build: demo caption present` — assert the "illustration ... not a live benchmark" caption renders near the simulator.
**Acceptance criteria:**
- Section renders the trimmed why-optimize copy with real ranges and parenthesized jargon.
- The honest demo caption is present and adjacent to the simulator.
- The "Read the guide" link renders (target per site-config / placeholder if the guide page is deferred).

### Task 7 — Load simulator (WebP vs PNG) island/script
**Files:** `src/components/marketing/LoadSimulator.astro` + `src/components/marketing/loadSimulator.ts`; `tests/marketing/load-simulator.test.ts`
**Interfaces:** Consumes: nothing from the shared contract; it is self-contained marketing JS. Produces: the animated PNG-vs-WebP load race + a replay button. No shared-contract entries.
**Description:** Port the mock's simulator (two columns PNG ~1400ms, WebP ~280ms; progress bar + mask reveal + status text + tabular-nums time readout; replay button `#sim-replay`) into a small vanilla script loaded with Astro's no-hydration script or a `client:visible` island. It is an illustration, not a benchmark (per the caption in Task 6). It must respect `prefers-reduced-motion` (jump to finished state instead of animating) and the replay button must have a focus-visible ring and an accessible name. Keep it CPU-trivial and dependency-free.
**Key tests:**
- `load-simulator: WebP finishes before PNG` — drive the timer logic and assert the WebP column reaches done at a smaller elapsed time than PNG.
- `load-simulator: replay resets both columns` — assert clicking replay restarts both from zero.
- `load-simulator: reduced-motion jumps to finished` — with `prefers-reduced-motion` mocked, assert no animation loop runs and both columns render the finished state.
- `load-simulator: time readout uses tabular-nums` — assert the time element carries the tabular-nums class.
**Acceptance criteria:**
- Simulator animates the PNG-vs-WebP race and matches the mock's durations and visual structure.
- Replay button works, has an accessible name, and a focus-visible ring.
- Honors `prefers-reduced-motion` by skipping animation.
- No SharedArrayBuffer, no heavy dependency; ships as a tiny script/island.

### Task 8 — Set the real trust-strip before/after number
**Files:** `src/lib/site-config.ts` (or a `stats` constant); `src/components/marketing/TrustStrip.astro`; `docs/` note on derivation (inline comment, not a report file); `tests/marketing/links-and-a11y.test.ts`
**Interfaces:** Consumes: a defensible, real measured before/after figure (spec §17 open item: replace the illustrative "4.2 MB -> 0.9 MB"). Produces: the single source-of-truth constant the trust strip and hero reassurance read. No shared-contract entries.
**Description:** Replace the illustrative trust-strip number with a real, defensible figure. Derive it from an actual measurement (convert a representative real page's images at the default settings and record original-total -> converted-total), document the derivation in a code comment next to the constant so it can be re-justified, and keep it conservative. If a real measurement is not yet available at execution time, this task is BLOCKED pending the measurement and the page ships with a clearly conservative placeholder flagged as TODO (the cutover gate in Task 12 should not flip prod with an unverified marketing number if the spec owner wants it real first).
**Key tests:**
- `links-and-a11y: trust number sourced from constant` — assert the rendered before/after string equals the `site-config` constant (no inline literal in the component).
- `links-and-a11y: trust number is plausible` — assert before > after and both are positive MB values (sanity guard).
**Acceptance criteria:**
- The trust-strip number is a real measured figure with its derivation documented in a code comment.
- The figure is wired through one constant consumed by the trust strip (and any hero reassurance that references it).
- The number is conservative and defensible (a developer opening devtools would not catch an exaggeration).

### Task 9 — SEO: meta, OG/Twitter, canonical, favicon, robots, sitemap, JSON-LD schema
**Files:** `src/layouts/MarketingLayout.astro`; `astro.config.*` (sitemap integration); `public/og/scrapeconvert-og.png`; `public/favicon.svg`/`public/favicon.ico`; `public/robots.txt`; `src/lib/site-config.ts`; `tests/marketing/seo-meta.test.ts`
**Interfaces:** Consumes: the patched meta title + description from COPY-REVISION (AVIF-inclusive description per Task 1), `SITE_URL` from site-config. Produces: full SEO surface for all pages + a generated `sitemap.xml`. No shared-contract entries.
**Description:** Wire per-page `<title>` + meta description (home uses the COPY-REVISION title/description; legal pages get their own), Open Graph + Twitter card tags pointing at a static 1200x630 OG image, a canonical URL per page, favicon/apple-touch-icon (brand glyph), `robots.txt` allowing crawl and referencing the sitemap, the Astro sitemap integration emitting `sitemap.xml`, and JSON-LD structured data (`SoftwareApplication` or `WebApplication` for the home, `Organization`/`WebSite`, and a `FAQPage` built from the FAQ Q&A). Use the existing ScrapeConvert brand name everywhere (no "Morphix" leakage; that grep is Phase 0's check but re-run it here as a guard).
**Key tests:**
- `seo-meta: home has title + AVIF-inclusive description` — assert `<title>` and meta description match the patched copy and the description mentions AVIF.
- `seo-meta: OG + Twitter tags present and reference the OG image` — assert `og:title/description/image/url` and `twitter:card` exist and point at the static OG asset.
- `seo-meta: each page has a canonical` — assert a `<link rel="canonical">` per page with the correct absolute URL.
- `seo-meta: JSON-LD validates shape` — parse the JSON-LD blocks and assert valid `@context/@type` for the app schema and the FAQPage built from the FAQ.
- `seo-meta: sitemap lists all marketing + legal routes` — assert `sitemap.xml` includes `/`, `/privacy`, `/terms`, `/acceptable-use`.
- `seo-meta: no Morphix leakage` — grep rendered output + repo for `Morphix`, assert clean.
**Acceptance criteria:**
- Every page emits title, meta description, canonical, OG + Twitter tags, and favicon.
- A static 1200x630 OG image exists and is referenced.
- `robots.txt` allows crawl and points to the sitemap; `sitemap.xml` lists all marketing + legal routes.
- JSON-LD includes the app schema and a FAQPage derived from the FAQ; it parses as valid JSON-LD.
- Repo and rendered output contain zero "Morphix" references.

### Task 10 — Legal pages: privacy, terms, acceptable-use
**Files:** `src/pages/privacy.astro`; `src/pages/terms.astro`; `src/pages/acceptable-use.astro`; `tests/marketing/pages-build.test.ts`
**Interfaces:** Consumes: `MarketingLayout`, site-config; the spec's honesty + abuse-policy stance (§5.2 abuse policy: per-destination-host ceiling, abuse-contact/takedown path, robots.txt stance, no server-side persistence; §9 honesty: conversion is local, scraping transits a proxy, "most public sites"). Produces: three legal pages linked from the footer. No shared-contract entries.
**Description:** Write the three legal pages in the marketing layout. Privacy: restate that conversion is in-browser (no server copies), scraping fetches transit a proxy but are not stored, no accounts, no third-party trackers, only privacy-friendly analytics, no server-side persistence of user data. Terms: free/open-source MIT, no warranty, as-is, user responsibility for what they scrape. Acceptable-use: the residual-risk abuse policy from spec §5.2 (public images only, skips paid stock sites, refuses private/internal addresses, rate limits, per-destination-host ceiling, abuse-contact/takedown path, robots.txt stance). Keep copy voice rules. These can ship without the app.
**Key tests:**
- `pages-build: legal pages render in marketing layout` — assert each of the three pages renders with nav + footer.
- `pages-build: privacy states no server-side persistence` — assert the privacy page states conversion is local and nothing is stored server-side.
- `pages-build: acceptable-use lists the abuse-policy points` — assert it names the per-destination-host ceiling and an abuse-contact/takedown path.
**Acceptance criteria:**
- All three legal pages exist, extend the marketing layout, and are linked from the footer.
- Privacy is consistent with spec honesty rules (conversion local, scraping via proxy, no persistence).
- Acceptable-use documents the abuse policy from spec §5.2.
- Copy follows the voice rules (no em dashes/buzzwords/triads).

### Task 11 — Staging Worker deploy + verification
**Files:** `wrangler.toml` (staging route/domain binding); `docs/runbooks/cutover.md` (staging verification checklist section); deploy commands documented, not executed by tests
**Interfaces:** Consumes: the built marketing + legal pages, the static SEO assets, and the existing `/api/*` endpoints (Phase 1) on the same Worker. Produces: a verified staging deployment of the full Worker (marketing + API coexisting) on a staging hostname before any prod DNS change. No shared-contract entries.
**Description:** Deploy the Worker to a staging hostname (a custom subdomain or `*.workers.dev` for marketing-only verification; note the Cache API/custom-domain caveat from spec §5.3 if `/api/fetch` is exercised). Verify: all marketing + legal pages render, all internal links resolve, the simulator runs, SEO tags + sitemap + robots are served, the OG image loads, and the `/api/*` endpoints respond (or, if Phase 1 not yet merged into this Worker, that the marketing routes serve cleanly and do not collide with the reserved `/api/*` paths). Capture the checklist in the cutover runbook. Do NOT touch prod DNS in this task.
**Key tests:** (verification is operational; the "tests" here are runbook checklist items, not unit tests)
- Staging checklist: every page (`/`, `/privacy`, `/terms`, `/acceptable-use`) returns 200 and renders.
- Staging checklist: `sitemap.xml`, `robots.txt`, OG image, favicon all return 200.
- Staging checklist: the load simulator animates and the replay button works in a real browser.
- Staging checklist: app-route links (`/scraper` etc.) resolve IF Phase 2 is merged; otherwise explicitly note the gate (see Task 12).
**Acceptance criteria:**
- The full Worker is deployed to a staging hostname and every marketing + legal page renders there.
- SEO assets (sitemap, robots, OG, favicon) are served on staging.
- The simulator works in a real browser on staging.
- The staging verification checklist is recorded in `docs/runbooks/cutover.md`.
- Prod DNS is untouched.

### Task 12 — Production cutover: DNS switch Vercel -> Worker + documented rollback
**Files:** `docs/runbooks/cutover.md` (DNS switch + rollback steps); `README.md` (deploy/cutover/rollback runbook reference); `wrangler.toml` (prod custom-domain binding for `scrapeconvert.com`)
**Interfaces:** Consumes: the verified staging Worker (Task 11), a green app (Phase 2 routes live) so "Open the app, free" resolves in prod. Produces: `scrapeconvert.com` pointing at the Cloudflare Worker, with a one-line revert path. No shared-contract entries.
**Description:** Bind `scrapeconvert.com` (apex + `www` as configured) to the Worker as a custom domain (needed for reliable Cache API behavior per spec §5.3), then switch the DNS from Vercel to Cloudflare so production serves from the Worker. GATE: do not flip prod until Phase 2 app routes are live (otherwise the primary CTA dead-ends) and the trust-strip number is final (Task 8) if the owner requires a real figure first. Document a one-line rollback: revert the DNS record(s) back to Vercel (capture the exact prior record values BEFORE the switch). Verify post-cutover: home + legal pages, app routes, `/api/*`, sitemap/robots/OG all serve from the Worker on the real domain. Remove `vercel.json` only if Phase 0 has not already (grep guard).
**Key tests:** (operational verification + runbook completeness)
- Cutover checklist: prior Vercel DNS record values are captured before any change.
- Cutover checklist: post-switch, `scrapeconvert.com/` and the three legal pages serve from the Worker (verify via response headers / known-good content).
- Cutover checklist: post-switch, app routes and `/api/*` respond from the Worker.
- Cutover checklist: the one-line rollback (revert DNS to the captured Vercel values) is written down and tested as a documented procedure.
**Acceptance criteria:**
- `scrapeconvert.com` is bound to the Worker as a custom domain and DNS points at Cloudflare.
- Gate honored: cutover happened only after Phase 2 app routes resolve (so the primary CTA works) and the trust number is finalized if required.
- Post-cutover, all marketing, legal, app, and `/api/*` routes serve from the Worker on the production domain.
- A one-line DNS rollback (with the captured prior Vercel record values) is documented in `docs/runbooks/cutover.md` and referenced from the README.
- No leftover Vercel artifacts (`vercel.json`) remain (grep clean).

---

## Execution notes (for the expansion pass)

- Expand each task into red/green/refactor steps when this plan is reactivated. Most marketing tasks are render/snapshot-style: the "red" is a failing assertion on rendered HTML/text from the patched copy.
- Tasks 1 -> 2 -> (3,4,5,6) -> 7 -> 8 -> 9 -> 10 is the natural build order; Task 1 (copy patch) MUST precede every page task because the pages read from the patched copy. Tasks 3–6 are independent of each other once Task 2 (layout) exists and could be parallelized.
- Tasks 11 (staging) and 12 (cutover) are operational and run last; Task 12 is gated on Phase 2 being live. Marketing can ship to staging (Task 11) before the app exists.
- Re-run the Phase 0 cleanup greps (`Morphix`, `GEMINI`, `aistudiocdn`, `@google/genai`, `process.env.API_KEY`, `metadata.json`, `vercel.json`) as a guard during Tasks 9 and 12 so nothing publishable regresses.
