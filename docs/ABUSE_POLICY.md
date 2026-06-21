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
robots compliance should add target hosts to `HOST_DENYLIST` or run the optional
robots check client-side before crawling. This stance is documented, not silently
ignored.

## Configurable destination denylist
Set `HOST_DENYLIST` in `wrangler.toml` to a comma-separated list of host
suffixes. A target matches if its host equals an entry or ends with `.<entry>`.
Example: `HOST_DENYLIST = "internal.example,partner.test"`.

## Takedown / abuse contact (hosted instance)
Report abuse of the hosted instance to the contact published at
`scrapeconvert.com/about`. The operator may add hosts to the denylist, tighten
budgets, or revoke issuance. Self-hosters are responsible for their own instance.

## Free-tier note
Self-hosters on the Cloudflare free tier rely on the soft Rate Limiting binding
plus the KV budgets above. The Worker stays within the free-tier limits (<=50
subrequests per invocation, ~10ms CPU): one page or one image per invocation,
no server-side fan-out, no server-side HTML/XML parsing.
