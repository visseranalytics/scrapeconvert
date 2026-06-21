// Canonical-host redirect. We canonicalize to the apex `scrapeconvert.com`; any
// request to the `www.` host gets a 301 to the same path+query on the apex.
// Pure + host-parameterized so it is unit-testable and easy to flip (swap the
// canonical host and the rule reverses).
export const CANONICAL_HOST = 'scrapeconvert.com';

export function canonicalRedirect(url: URL, canonicalHost: string = CANONICAL_HOST): Response | null {
  if (url.hostname === `www.${canonicalHost}`) {
    const target = new URL(url.href);
    target.hostname = canonicalHost;
    return Response.redirect(target.href, 301);
  }
  return null;
}
