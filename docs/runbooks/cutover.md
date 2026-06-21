# ScrapeConvert — Cutover Runbook (Vercel → Cloudflare Worker)

This runbook covers deploying the Astro-on-Cloudflare Worker to staging, verifying
it, and switching `scrapeconvert.com` production DNS from Vercel to the Worker,
with a one-line rollback.

## Prerequisites / gates (do not flip prod until all true)

- [ ] **Cloudflare auth:** `wrangler login` (or `CLOUDFLARE_API_TOKEN` set).
- [ ] **Secrets set on the Worker** (deploy fails without `SESSION_HMAC_SECRET`):
  - `wrangler secret put SESSION_HMAC_SECRET`   (generate: `openssl rand -hex 32`)
  - `wrangler secret put TURNSTILE_SECRET_KEY`
  - Run `npm run check:secrets` to confirm.
- [ ] **KV namespaces created and bound** in `wrangler.toml`:
  - `BUDGETS` (per-token/per-host budgets + Turnstile dup set) — replace the
    placeholder id: `wrangler kv namespace create BUDGETS`.
  - The adapter also binds an Astro `SESSION` KV (sessions). Create it or remove
    Astro sessions before deploy.
- [ ] **Real Turnstile keys** in `wrangler.toml` `[vars] PUBLIC_TURNSTILE_SITE_KEY`
  and the `TURNSTILE_SECRET_KEY` secret (the committed values are Cloudflare test
  keys that always pass).
- [ ] **Phase 1 workers-pool tests pass** in a workerd env (`npm run test:workers`).
- [ ] **Phase 2 app routes resolve** (`/scraper`, `/workbench`) so the primary
  "Open the app, free" CTA does not dead-end.
- [ ] **Trust-strip number** is a real, defensible figure (or accepted as a
  conservative placeholder by the owner).

## 1. Build + staging deploy

    npm install
    npm run deploy:staging      # astro build && wrangler deploy -c dist/server/wrangler.json --name scrapeconvert-staging

Staging serves at `https://scrapeconvert-staging.<account>.workers.dev`.
(Note: reliable Cache API behavior for `/api/fetch` needs a custom domain, not
`*.workers.dev` — fine for marketing verification; exercise the proxy on a custom
staging domain if needed, spec §5.3.)

## 2. Staging verification checklist

- [ ] `GET /` returns 200 and renders the marketing home (hero, comparison table,
  scraper + converter sections, why-optimize + simulator, FAQ, footer).
- [ ] `/privacy`, `/terms`, `/acceptable-use` return 200 and render.
- [ ] `/sitemap.xml`, `/robots.txt`, `/images/og-image.png`, `/images/favicon.png`
  all return 200.
- [ ] The WebP-vs-PNG load simulator animates and the Replay button works in a real
  browser; `prefers-reduced-motion` jumps to the finished state.
- [ ] `/scraper` and `/workbench` hydrate (Phase 2 islands).
- [ ] `POST /api/turnstile` and `GET /api/fetch` respond (proxy on the Worker).
- [ ] No `Morphix` / `aistudiocdn` / gradient leakage (`npm run cleanup-check`).

## 3. Production cutover (DNS, Vercel → Cloudflare)

1. **Capture the current Vercel DNS records BEFORE changing anything** (for
   rollback). Record the exact type/name/value/TTL:

       # Example — fill in the real current values:
       # A     scrapeconvert.com      76.76.21.21    (Vercel)
       # CNAME www.scrapeconvert.com  cname.vercel-dns.com

   Save them in this file under "Captured prior DNS" below before proceeding.

2. **Bind the custom domain** to the Worker (needed for reliable Cache API):
   in the Cloudflare dashboard (Workers → scrapeconvert → Triggers → Custom
   Domains) add `scrapeconvert.com` (and `www` per preference), or via
   `wrangler deployments` + dashboard. Deploy production:

       npm run deploy        # runs predeploy secret guard, then deploy

3. **Switch DNS** to Cloudflare (the custom-domain binding manages the proxied
   record). Confirm the apex (and `www`) now resolve to the Worker.

## 4. Post-cutover verification

- [ ] `https://scrapeconvert.com/` and the three legal pages serve from the Worker
  (check a response header or known content).
- [ ] `/scraper`, `/workbench`, `/api/turnstile`, `/api/fetch` respond from the Worker.
- [ ] `/sitemap.xml`, `/robots.txt`, OG image, favicon serve.
- [ ] No `vercel.json` remains in the repo (`git ls-files | grep vercel.json` empty).

## 5. Rollback (one line)

Revert the DNS record(s) to the captured Vercel values:

    # Set scrapeconvert.com back to the Vercel A/CNAME captured in step 3.1.

DNS propagation makes this effective within the TTL. Keep the Vercel project
deployed until the cutover has been stable for at least 24–48h.

## Canonical host: redirect www → apex (covers /sitemap.xml)

We canonicalize to the apex `scrapeconvert.com`. `www.scrapeconvert.com/*` must
`301` to `scrapeconvert.com/*` — this is what makes
`https://www.scrapeconvert.com/sitemap.xml` resolve to the real sitemap.

Both the apex and `www` must point at Cloudflare (proxied DNS record / custom
domain) so www requests reach the rule below.

Three layers, in order of authority:

1. **Cloudflare Redirect Rule — authoritative; the only layer that reliably
   covers static assets like `/sitemap.xml` and `/robots.txt`** (it runs at the
   edge before both the Worker and the assets layer). Dashboard: **Rules →
   Redirect Rules → Create rule**:
   - When incoming requests match: `Hostname equals www.scrapeconvert.com`
   - Then → **Dynamic redirect**:
     - URL: `concat("https://scrapeconvert.com", http.request.uri.path)`
     - Status code: `301`, **Preserve query string: on**

   Terraform equivalent: a `cloudflare_ruleset` in the
   `http_request_dynamic_redirect` phase with the same expression.

2. **`public/_redirects`** (ships with the build, assets layer) as a backup:
   `https://www.scrapeconvert.com/* https://scrapeconvert.com/:splat 301`.

3. **Astro middleware** (`src/middleware.ts`) — 301s www→apex for SSR routes that
   reach the Worker (static assets bypass it, hence layer 1).

To flip the canonical to `www` instead: change `CANONICAL_HOST` in
`src/lib/canonical.ts`, reverse the Redirect Rule + `_redirects`, and update the
Base `site`, `robots.txt`, and `sitemap.xml` to the `www` host.

## Captured prior DNS (fill in before cutover)

    # type  name                    value                 ttl
    # (record the live Vercel values here before switching)
