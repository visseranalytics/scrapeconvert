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
[Cloudflare Worker](https://workers.cloudflare.com) using `@astrojs/cloudflare`. Styling
is [Tailwind CSS](https://tailwindcss.com) v4 via the Vite plugin. Image conversion runs
entirely in the browser with WebAssembly codecs. The only server-side work is a hardened
fetch relay that retrieves page HTML, sitemaps, and the bytes of the images you choose to
convert. See the FAQ on the site for how the relay handles CORS, rate limits, and abuse.

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

The build runs `astro build`, and the `@astrojs/cloudflare` adapter emits the deployable
config at `dist/server/wrangler.json`, which the deploy scripts pass to Wrangler with
`-c`. The deploy fails if `SESSION_HMAC_SECRET` is unset. There is no default.

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

## Proxy security and abuse

The scraping proxy (`/api/fetch`) is SSRF-pinned and abuse-bounded. Before deploy:

- Set the required secrets (deploy fails if unset):
  - `wrangler secret put SESSION_HMAC_SECRET`
  - `wrangler secret put TURNSTILE_SECRET_KEY`
- Review the budget vars in `wrangler.toml`: `PER_TOKEN_FETCH_BUDGET`,
  `PER_TOKEN_BYTE_BUDGET`, `PER_HOST_FETCH_CAP`, `GLOBAL_EGRESS_BYTE_CAP`,
  `MINT_RATE_PER_IP_PER_MIN`, `SESSION_TOKEN_TTL_SECONDS`.
- Extend the destination blocklist with `HOST_DENYLIST` (comma-separated host
  suffixes) as needed.
- Read [`docs/ABUSE_POLICY.md`](docs/ABUSE_POLICY.md) so you understand the
  residual open-relay risk you accept by running an instance.

## License

MIT. See [LICENSE](LICENSE).
