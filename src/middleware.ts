import { defineMiddleware } from 'astro:middleware';
import { canonicalRedirect } from './lib/canonical';

// SSR-route backup for the www -> apex canonical redirect. NOTE: static assets
// (e.g. /sitemap.xml, /robots.txt, /_astro/*) are served by the Workers Assets
// layer BEFORE this middleware runs, so the authoritative www->apex handling for
// those is the zone-level Cloudflare Redirect Rule (see docs/runbooks/cutover.md)
// and public/_redirects. This catches www requests that reach the SSR Worker.
export const onRequest = defineMiddleware((context, next) => {
  const redirect = canonicalRedirect(context.url);
  if (redirect) return redirect;
  return next();
});
