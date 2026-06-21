---
# Phase 3: Chrome Extension (rebrand / repackage) Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
**Goal:** Ship a clean, ScrapeConvert-branded Manifest V3 extension whose content script extracts `<img>` / CSS `background-image` / `<picture>` images from the user's current tab and lets the user either hand the selection to the web Workbench or download it locally, with no proxy and no Turnstile (the page is already loaded).
**Architecture:** A content script runs in the active tab and extracts images directly from the live DOM (no network egress, no CORS proxy, no SSRF surface). A popup lists the found images, supports select/filter, and offers two exits: "Open in Workbench" (hands the selected `ScrapedImage[]` to `scrapeconvert.com` via a configurable handoff URL) and "Download" (local download via the background service worker). Same-tab extraction needs no proxy and no Turnstile; the proxy/Turnstile path (Phase 1) is only relevant IF cross-page or sitemap crawl is added to the extension later, which is out of scope for v1.
**Tech Stack:** Manifest V3, vanilla JS content/popup/background scripts (no bundler in the extension), Chrome extension APIs (`activeTab`, `scripting`, `downloads`, `storage`; `chrome.tabs.query`/`sendMessage` are used but ride on `activeTab`, no `tabs` permission needed), `crypto.randomUUID()` for ids. Shares no runtime code with the Astro app but mirrors the `ScrapedImage` shape from `src/lib/types.ts`.

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

This plan is intentionally an outline. Before execution, each task below must be expanded into bite-sized, test-first steps following `superpowers:writing-plans`. Expansion should happen after Phase 1 (proxy) ships, and ideally alongside or after Phase 2 begins, because the "Open in Workbench" handoff (Task 4) consumes the live web Workbench route and the `ScrapedImage` shape that Phase 2 finalizes.

## Dependencies on earlier phases

- **Phase 1 (proxy):** No runtime dependency. The content script extracts from the already-loaded page, so it needs no `/api/fetch` and no `/api/turnstile`. The proxy/Turnstile path becomes relevant only if a future version adds cross-page or sitemap crawl to the extension (explicitly out of scope for v1). Tasks must NOT introduce any extension call to the proxy.
- **Phase 2 (app):** Hard dependency for Task 4 only. The "Open in Workbench" handoff targets the web Workbench route and must produce a payload the Workbench can ingest. The handoff CONTRACT (route path, ingest mechanism, payload key) must be agreed with Phase 2; the `ScrapedImage` shape the extension emits must match `src/lib/types.ts`. Tasks 1, 2, 3, 5, 6 have no Phase 2 dependency and can be expanded/executed first. If Phase 2 has not finalized the Workbench ingest, Task 4 ships behind the documented handoff contract and is verified against a Phase 2 stub.
- **Phase 0 (cleanup):** The repo-wide `Morphix`/`GEMINI`/`aistudiocdn`/`@google/genai` grep gate (spec §10) covers `extension/README` and any extension docs. Task 1 removes the violet-gradient `icon.svg` and any residual non-ScrapeConvert branding so the extension subtree passes that gate; the extension `README` must not reference Morphix.

## File structure

All paths are absolute under `/Users/tjvisser/dev/websites/scrapeconvert/`.

**Create**
- `extension/src/handoff.js` — builds the `ScrapedImage[]` payload and opens the Workbench handoff URL (or copies a fallback link).
- `extension/README.md` — ScrapeConvert extension readme (install, what it does, same-tab/no-proxy note, build/zip step).
- `docs/superpowers/specs/2026-06-21-extension-handoff-contract.md` — the popup↔Workbench handoff contract (route, mechanism, payload key, size ceiling), referenced by Phase 2. (Small spec doc, written during Task 4 expansion; alternatively fold into the Phase 2 plan if it lands first.)

**Modify**
- `extension/manifest.json` — name/description final copy, `host_permissions`, permissions, version bump, MV3 hygiene; remove `web_accessible_resources` entry for the non-existent `src/imageUtils.js`.
- `extension/src/content.js` — narrow extraction to `<img>` + CSS `background-image` + `<picture>`; drop deferred `srcset` and out-of-scope `<svg image>` paths; emit the `ScrapedImage`-shaped objects.
- `extension/src/popup.js` — add "Open in Workbench" action and its enable/disable state; keep download; align option labels (WebP/AVIF/PNG/JPEG ordering and copy).
- `extension/popup.html` — add the Workbench button, fix header/title copy, remove the gradient header treatment.
- `extension/popup.css` — replace violet/gradient styling with neutral zinc + emerald accent, hairline borders, one radius scale, focus-visible rings, tabular-nums.
- `extension/src/background.js` — keep local download; align format extension map + download folder naming; remove dead branches.
- `extension/icons/icon.svg` (+ regenerated `icon16/32/48/128.png`) — replace the violet gradient mark with a flat zinc + emerald ScrapeConvert mark.
- `extension/generate-icons.html` — update to emit the new flat mark (or delete if icons are produced another way).

**Test**
- `extension/test/extract.test.mjs` — node test harness over the pure extraction logic (DOM injected via a fixture / jsdom-style shim) for `<img>`, `background-image`, `<picture>`.
- `extension/test/handoff.test.mjs` — payload-shape and URL-build tests for `handoff.js`.
- `extension/test/manifest.test.mjs` — manifest hygiene assertions (no Morphix, no stray `web_accessible_resources`, expected permissions/host_permissions, valid MV3).
- (Extraction logic must be factored into a pure, importable function so it is unit-testable outside a real browser; see Task 2.)

## Tasks

### Task 1 — Rebrand manifest, icons, and metadata to ScrapeConvert
- [ ] Implement
**Files:** `extension/manifest.json`, `extension/icons/icon.svg`, `extension/icons/icon16.png`, `extension/icons/icon32.png`, `extension/icons/icon48.png`, `extension/icons/icon128.png`, `extension/generate-icons.html`, `extension/README.md`, `extension/test/manifest.test.mjs`.
**Interfaces:** Consumes nothing. Produces a clean MV3 `manifest.json` and a design-system-compliant icon set. No CONTRACT type involved.
**Description:** Finalize the manifest name/description copy (voice rules: no em dashes, no buzzwords); bump `version`; remove the `web_accessible_resources` entry pointing at the non-existent `src/imageUtils.js`; reconcile `permissions` to the minimal set actually used by the scripts. The current manifest declares only `activeTab`, `downloads`, `storage` but `popup.js` calls `chrome.scripting.executeScript`, so `scripting` MUST be added (it is currently missing and would fail at runtime). `chrome.tabs.query({active,currentWindow})` and `chrome.tabs.sendMessage` work under `activeTab` and do NOT require the broad `tabs` permission, so do NOT add `tabs` unless a sensitive cross-tab property (url/title across all tabs) is actually read. Target minimal set: `activeTab`, `scripting`, `downloads`, `storage`; `host_permissions` per the v1 scope decision (see Task 6). Replace the violet gradient `icon.svg` (`#667eea`→`#764ba2`) with a flat zinc mark + single emerald (`#34d399`) accent, no gradient, regenerate the PNG sizes, and rewrite `extension/README.md` so it never says Morphix and states the same-tab/no-proxy behavior.
**Key tests:**
- `manifest has no legacy branding` — asserts the manifest + extension README contain no `Morphix`/`GEMINI`/`aistudiocdn`/`@google/genai`.
- `manifest declares only used permissions` — permissions/host_permissions match the agreed v1 set; no `web_accessible_resources` referencing a missing file.
- `manifest is valid MV3` — `manifest_version === 3`, required action/icons keys present and point at existing files.
**Acceptance criteria:**
- `grep -riE "morphix|aistudio|@google/genai|gemini|api_key|#667eea|#764ba2|linear-gradient" extension/` returns nothing (icon gradient gone, branding clean).
- `icon.svg` uses flat zinc + a single `#34d399` accent and no `<linearGradient>`; all four PNG sizes regenerated and referenced.
- Manifest loads as an unpacked extension in Chrome with no console warnings about missing resources.
- Extension subtree passes the spec §10 cleanup grep gate.

### Task 2 — Port and narrow the content-script extraction to a pure, testable function
- [ ] Implement
**Files:** `extension/src/content.js`, `extension/test/extract.test.mjs`.
**Interfaces:** Produces objects matching CONTRACT `ScrapedImage` from `src/lib/types.ts` (`{ id, url, alt, name, format, size?, width?, height?, selected, isDuplicate?, sourcePageUrl?, sourcePageTitle? }`). Does NOT consume the proxy or any server interface. Mirrors the field semantics of `extractImages(html, baseUrl, sourcePageUrl?)` from `src/lib/scrape/parse.ts` but operates on the live DOM rather than an HTML string.
**Description:** Refactor `extractImages()` into a pure function that takes a document-like root (so it can run under a DOM shim in tests) and returns `ScrapedImage[]`. Scope extraction to exactly three sources per spec §7: visible `<img>` (`src`/`data-src`/`data-lazy-src`), CSS `background-image` (inline `style` and computed style), and `<picture>` (the `<img>` fallback inside `<picture>`, plus `<source>` `srcset` candidates ONLY to the extent the existing `<picture>` semantics require). Remove the deferred bare-`srcset`-on-`img` path and the out-of-scope `<svg image>` path. Generate `id` via `crypto.randomUUID()`, derive `name` from the URL filename, derive `format` from extension/data-URI, set `selected:false`, leave `isDuplicate`/`size` unset (resolved later), set `sourcePageUrl = location.href` and `sourcePageTitle = document.title`.
**Key tests:**
- `extracts img src and data-src` — picks up `<img src>` and lazy `data-src`, skips tracking-pixel/too-small entries.
- `extracts inline and computed background-image` — pulls `url(...)` from `style` and computed `backgroundImage`, resolves relative URLs against the page base.
- `extracts picture fallback img` — returns the `<img>` inside `<picture>`; does not emit the deferred bare-`img[srcset]` path or `<svg image>`.
- `emits ScrapedImage shape` — every returned object has the required CONTRACT fields with correct types; `sourcePageUrl`/`sourcePageTitle` populated.
- `dedupes by resolved URL within a page` — same resolved URL is not emitted twice (in-page URL Map dedupe; content-based dedupe is the Workbench's job).
**Acceptance criteria:**
- Extraction is a pure, importable function with the DOM injected (no reliance on a real browser to unit-test).
- Output objects validate against the `ScrapedImage` field set and types.
- No `srcset`-on-`img` and no `<svg image>` extraction remains (matches spec §7 scope).
- Manual check on three real pages (one heavy `<picture>` site, one `background-image` hero site, one lazy-load gallery) returns the expected images.

### Task 3 — Popup list, selection, filter (reuse existing UI, restyle to Direction A)
- [ ] Implement
**Files:** `extension/popup.html`, `extension/popup.css`, `extension/src/popup.js`.
**Interfaces:** Consumes `ScrapedImage[]` from the content script (Task 2) via `chrome.tabs.sendMessage`. Produces an in-popup selection set. No server interface.
**Description:** Keep the existing scan/list/select-all/deselect/min-size flow, but restyle to the design system: neutral zinc surfaces, a single emerald accent for the selected state, amber reserved only for a duplicate flag if shown, hairline borders, one radius scale, focus-visible rings on every interactive control, tabular-nums on counts and dimensions. Align the format select to the v1 formats and ordering (WebP, AVIF, PNG, JPEG) and patch any copy to the voice rules. The popup renders thumbnails directly from source `<img src>` (already loaded in the tab, free, no proxy).
**Key tests:**
- `renders found images and count` — given a `ScrapedImage[]`, the grid renders N items and the count reads N with tabular-nums.
- `select-all / deselect-all toggles selection set` — selection state and the selected-count update correctly.
- `min-size filter excludes small images` — filtering by min dimension hides sub-threshold images and keeps unknown-size ones (documented behavior).
- (UI-string assertions: format options are exactly WebP/AVIF/PNG/JPEG; no gradient/violet classes remain.)
**Acceptance criteria:**
- Popup uses zinc + emerald only (no violet, no gradients); `grep` for `linear-gradient`/`#667eea`/`#764ba2` in `popup.css` returns nothing.
- Every interactive element has a visible focus-visible ring; numbers use tabular-nums.
- Format dropdown lists WebP, AVIF, PNG, JPEG in that order.
- Manual: open popup on a real page, see images, select a subset, see the count update.

### Task 4 — "Open in Workbench" handoff (depends on Phase 2)
- [ ] Implement
**Files:** `extension/src/handoff.js`, `extension/src/popup.js`, `extension/popup.html`, `extension/test/handoff.test.mjs`, `docs/superpowers/specs/2026-06-21-extension-handoff-contract.md`.
**Interfaces:** Consumes the in-popup selection (`ScrapedImage[]`). Produces a Workbench-ingestible payload of CONTRACT `ScrapedImage[]` (from `src/lib/types.ts`). Targets the Phase 2 Workbench route. NO proxy, NO Turnstile (extension-sourced images are already-resolved URLs; the Workbench fetches their bytes via its own proxy path only at convert time, which is Phase 2 behavior, not the extension's concern).
**Description:** Add an "Open in Workbench" action that serializes the selected `ScrapedImage[]` and hands them to `scrapeconvert.com`'s Workbench. Decision to confirm during expansion (present as a small decisions table): handoff mechanism = open a new tab to a configurable Workbench URL and pass the payload via (a) a short-lived `chrome.storage.local` key the Workbench reads, (b) URL fragment/query for small payloads with a size ceiling, or (c) `postMessage` after the tab loads. The Workbench base URL must be configurable (default `https://scrapeconvert.com`, overridable in `storage` for self-hosters / staging). Write the handoff contract doc so Phase 2 implements the matching ingest. Provide a copy-link fallback when the payload exceeds the chosen transport's ceiling.
**Key tests:**
- `builds ScrapedImage payload from selection` — only selected images are serialized; each carries the required CONTRACT fields incl. `sourcePageUrl`.
- `targets configurable Workbench base URL` — default points at `scrapeconvert.com`; an overridden base in storage is respected.
- `handles oversized payload` — above the transport ceiling, falls back to the documented mechanism (e.g. storage key / copy link), never silently truncates.
- `payload round-trips the ScrapedImage shape` — serialize then parse yields objects matching `src/lib/types.ts`.
**Acceptance criteria:**
- Selecting images and clicking "Open in Workbench" opens the Workbench with those images present (verified against the Phase 2 Workbench or a documented stub).
- The handoff makes NO call to `/api/fetch` or `/api/turnstile`.
- Workbench base URL is overridable for self-host/staging.
- `docs/superpowers/specs/2026-06-21-extension-handoff-contract.md` exists and matches the Phase 2 ingest, or is referenced by the Phase 2 plan.

### Task 5 — Local download path cleanup (background service worker)
- [ ] Implement
**Files:** `extension/src/background.js`, `extension/popup.html`, `extension/src/popup.js`.
**Interfaces:** Consumes the selected `ScrapedImage[]` (download branch). Produces files on disk via `chrome.downloads`. No server interface.
**Description:** Keep the local "Download" exit as the no-conversion / simple path. Align the format extension map and the download subfolder name to `scrapeconvert/`, ensure the format options offered for in-place Canvas conversion are consistent with the v1 format set where Canvas can produce them (note AVIF Canvas-encode support is browser-dependent; document the limitation and steer heavier conversion toward the Workbench, which uses WASM). Remove dead branches and tighten progress/cancel handling. Reaffirm in copy/UI that "Open in Workbench" is the recommended path for AVIF and for batch optimization.
**Key tests:**
- `download maps format to correct extension` — JPEG/PNG/WebP map to expected file extensions; subfolder is `scrapeconvert/`.
- `batch download reports progress and honors cancel` — progress increments per file; cancel stops the loop.
- `unsupported-format download falls back cleanly` — a format the Canvas path cannot encode (e.g. AVIF in some browsers) is handled with a clear message, not a silent corrupt file.
**Acceptance criteria:**
- Selecting images and clicking Download saves them under a `scrapeconvert/` folder with correct extensions.
- Cancel mid-batch halts further downloads.
- UI clearly positions Workbench as the path for AVIF / batch optimization; no dead message handlers remain in `background.js`.

### Task 6 — host_permissions, packaging, and final verification
- [ ] Implement
**Files:** `extension/manifest.json`, `extension/README.md`, (build/zip script or documented steps).
**Interfaces:** None (packaging). 
**Description:** Finalize `host_permissions` to the minimum needed: same-tab extraction works under `activeTab` + on-demand `chrome.scripting.executeScript`, so decide (present as a decisions table) whether to keep broad `<all_urls>` content-script registration or move to `activeTab`-only injection to reduce the permission ask for store review. Add the Workbench origin (`https://scrapeconvert.com/*`, plus a configurable staging origin) to host_permissions only if the chosen handoff mechanism (Task 4) requires it. Document the load-unpacked and zip-for-store steps in `extension/README.md`. Produce a reproducible packaged zip.
**Key tests:**
- `manifest host_permissions match v1 scope` — asserts the final host_permissions set (e.g. `activeTab` model vs `<all_urls>`) per the locked decision.
- (Packaging is verified manually; assert no missing-file references in the zip via the manifest test from Task 1.)
**Acceptance criteria:**
- host_permissions are the minimal set for v1 (decision recorded); no broader grant than the chosen handoff + extraction model needs.
- `extension/README.md` documents load-unpacked, the same-tab/no-proxy behavior, and the zip step.
- A packaged zip loads cleanly in Chrome with no warnings and passes a manual smoke of: scan a page, select, Open in Workbench, and Download.
- Whole `extension/` subtree passes the spec §10 cleanup grep gate one final time.

## Notes for the expansion pass
- Present a decisions table (per the project's "architectural decisions before code" rule) for: the Workbench handoff transport (Task 4), and the host_permissions model `<all_urls>` vs `activeTab`-only injection (Task 6). Both are user/preference calls, not lookups.
- Keep the proxy/Turnstile path entirely out of v1. If a reviewer asks for cross-page or sitemap crawl in the extension, that is a NEW phase that would consume Phase 1's `/api/turnstile` + `/api/fetch` and the shared `src/lib/url-safety.ts` client filter; do not add it here.
- The `ScrapedImage` shape the content script emits is the single coupling point to the web app; re-verify it against `src/lib/types.ts` at expansion time in case Phase 2 adjusts the contract.
