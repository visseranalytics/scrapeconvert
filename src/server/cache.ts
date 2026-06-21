export function cacheKeyFor(targetUrl: URL): Request {
  const u = new URL(targetUrl.href);
  u.hash = '';
  // Key on the normalized target only; never the session token or client headers.
  return new Request(`https://cache.scrapeconvert.internal/${encodeURIComponent(u.href)}`, { method: 'GET' });
}

export async function getCached(cache: Cache, key: Request): Promise<Response | undefined> {
  const hit = await cache.match(key);
  return hit ?? undefined;
}

export async function putCached(
  cache: Cache,
  key: Request,
  res: Response,
  ttlSeconds: number,
  maxBytes: number,
): Promise<Response> {
  // Only cache validated 2xx; buffer to enforce a max object size; clone so the
  // caller still gets a live body.
  if (res.status !== 200) return res;
  const buf = await res.clone().arrayBuffer();
  if (buf.byteLength > maxBytes) return res;
  const headers = new Headers(res.headers);
  headers.set('cache-control', `public, max-age=${ttlSeconds}`);
  const stored = new Response(buf, { status: 200, headers });
  await cache.put(key, stored.clone());
  return stored;
}
