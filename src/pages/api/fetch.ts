import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { verifyToken } from '../../server/token';
import { clientIpHash } from '../../server/ip';
import { requireSecret } from '../../server/turnstile';
import { isSafePublicUrl } from '../../lib/url-safety';
import { pinnedFetch, ProxyError, isOwnZoneOrDenied } from '../../server/proxy';
import { cacheKeyFor, getCached, putCached } from '../../server/cache';
import {
  checkBurst,
  consumeFetchBudget,
  consumeByteBudget,
  consumeHostCap,
  consumeGlobalEgress,
  type RateLimitContext,
} from '../../server/budgets';

export const prerender = false;

function err(status: number, code: string, retryAfter?: number): Response {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (retryAfter) headers['retry-after'] = String(retryAfter);
  return new Response(JSON.stringify({ error: code }), { status, headers });
}
function clientIp(req: Request): string {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || '0.0.0.0';
}
function bearer(req: Request): string | null {
  const h = req.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

export async function GET(ctx: APIContext): Promise<Response> {
  const e = env as Record<string, unknown>;
  // Missing prod secret is a deploy misconfig, not a client error: clean 503.
  let hmacSecret: string;
  try {
    hmacSecret = requireSecret('SESSION_HMAC_SECRET', e.SESSION_HMAC_SECRET as string | undefined);
  } catch {
    return err(503, 'server-misconfig');
  }
  const req = ctx.request;

  // 1. Auth
  const token = bearer(req);
  if (!token) return err(401, 'no-token');
  const ipHash = await clientIpHash(clientIp(req));
  const verified = await verifyToken(token, hmacSecret, ipHash);
  if (!verified.ok) return err(401, verified.reason);

  // 2. Params
  const u = new URL(req.url);
  const target = u.searchParams.get('url');
  const type = u.searchParams.get('type');
  if (!target) return err(400, 'missing-url');
  if (type !== 'page' && type !== 'sitemap' && type !== 'image') return err(400, 'bad-type');

  // 3. URL safety + own-zone / denylist
  const safe = isSafePublicUrl(target);
  if (!safe.ok) return err(400, 'blocked-url:' + safe.reason);
  const denylist = String((e.HOST_DENYLIST as string) ?? '').split(',');
  if (isOwnZoneOrDenied(safe.url, u.hostname, String((e.ZONE_APEX as string) ?? ''), denylist)) {
    return err(400, 'own-zone');
  }

  // 4. Budgets: soft per-colo burst throttle + accurate per-token / per-host caps.
  const kv = e.BUDGETS as KVNamespace;
  const nonce = verified.claims.nonce;
  if (await checkBurst({ kv, rl: e.RATE_LIMITER as RateLimitContext['rl'] }, nonce)) return err(429, 'burst', 10);
  if (await consumeFetchBudget(kv, nonce, Number((e.PER_TOKEN_FETCH_BUDGET as string) ?? '300'))) {
    return err(429, 'fetch-budget', 60);
  }
  if (await consumeHostCap(kv, safe.url.hostname.toLowerCase(), Number((e.PER_HOST_FETCH_CAP as string) ?? '120'))) {
    return err(429, 'host-cap', 60);
  }

  // 5. Edge cache (text only; never cache 3xx/4xx/5xx). Image bytes stream through.
  const cache = (caches as unknown as { default?: Cache }).default;
  const key = cacheKeyFor(safe.url);
  if (cache && type !== 'image') {
    const hit = await getCached(cache, key);
    if (hit) return hit;
  }

  const byteBudget = Number((e.PER_TOKEN_BYTE_BUDGET as string) ?? '524288000');
  const egressCap = Number((e.GLOBAL_EGRESS_BYTE_CAP as string) ?? '107374182400');

  // 6. Relay
  try {
    const relayed = await pinnedFetch(safe.url, { type });
    if (type === 'image') {
      // Account the cap as the conservative debit before streaming.
      const imgCap = Number((e.MAX_IMAGE_BYTES as string) ?? '26214400');
      await consumeByteBudget(kv, nonce, imgCap, byteBudget);
      await consumeGlobalEgress(kv, imgCap, egressCap);
      return relayed; // streamed; cap aborts mid-stream
    }
    // page/sitemap: buffer (small, client-parses) so the cap maps cleanly to 413
    const bytes = await relayed.arrayBuffer();
    if (await consumeByteBudget(kv, nonce, bytes.byteLength, byteBudget)) return err(429, 'byte-budget', 60);
    await consumeGlobalEgress(kv, bytes.byteLength, egressCap);
    const out = new Response(bytes, { status: 200, headers: relayed.headers });
    if (cache) {
      const maxObj = Number((e.MAX_HTML_BYTES as string) ?? '5242880');
      return await putCached(cache, key, out, 3600, maxObj);
    }
    return out;
  } catch (e2) {
    if (e2 instanceof ProxyError) return err(e2.status, e2.message, e2.status === 429 ? 30 : undefined);
    return err(502, 'relay-failed');
  }
}
