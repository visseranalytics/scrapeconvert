# ScrapeConvert Overhaul — Implementation Plan Index

Design spec: [`../specs/2026-06-21-scrapeconvert-overhaul-design.md`](../specs/2026-06-21-scrapeconvert-overhaul-design.md)

The overhaul is split into five sequenced plans. Each produces working, testable software on its own. Build in order; Phase 1 must be complete and abuse-tested before any UI consumes the proxy.

| Phase | Plan | Detail | Depends on |
|---|---|---|---|
| 0 | [Scaffold + open-source cleanup](2026-06-21-scrapeconvert-phase0-scaffold-cleanup.md) | Full TDD | — |
| 1 | [The proxy](2026-06-21-scrapeconvert-phase1-proxy.md) | Full TDD | 0 |
| 2 | [The app (Scraper + Workbench)](2026-06-21-scrapeconvert-phase2-app.md) | Outline | 1 |
| 3 | [Chrome extension](2026-06-21-scrapeconvert-phase3-extension.md) | Outline | 0 |
| 4 | [Marketing + cutover](2026-06-21-scrapeconvert-phase4-marketing-cutover.md) | Outline | 2 |

**Phases 2–4 are outlines** (file structure, tasks, interfaces, acceptance criteria). Expand each to full bite-sized TDD steps — per the `superpowers:writing-plans` skill — right before executing it, once its predecessor has shipped and the real interfaces are settled.

## Shared interface contract

All phases use the same HTTP API (`POST /api/turnstile`, `GET /api/fetch?url=&type=`) and module signatures (`isSafePublicUrl`, `signToken`/`verifyToken`, `extractImages`/`parseSitemap`, `convertImage`/`buildZip`/`estimateSize`, `flagDuplicates`, `pictureSnippet`). See each plan's **Interfaces** blocks.

## Known platform caveat (carried from the spec §16/§17)

On Cloudflare Workers, an HTTPS target cannot be both connected to a validated literal IP *and* presented with correct SNI/cert validation (the Sockets API exposes no independent SNI host). So: **HTTP targets are fully IP-pinned; HTTPS targets connect by hostname with TLS**, which re-resolves DNS and leaves a small residual DNS-rebinding window. Mitigated by the pre-connect DoH resolve-and-validate, the complete special-use blocklist, manual per-hop redirect revalidation, and Cloudflare's edge not routing to RFC1918. Documented honestly in the Phase 1 plan.
