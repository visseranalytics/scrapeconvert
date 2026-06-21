import { getSessionToken } from './session';

export type ProxyErrorKind = 'needs-verification' | 'blocked' | 'too-large' | 'rate-limited' | 'upstream';

export class ProxyClientError extends Error {
  constructor(
    public kind: ProxyErrorKind,
    public status: number,
    public retryAfter?: number,
  ) {
    super(`proxy:${kind}:${status}`);
  }
}

function originBase(): string {
  return typeof location !== 'undefined' && location.origin ? location.origin : 'https://scrapeconvert.com';
}

// GET /api/fetch wrapper. Attaches the Bearer session token and maps the proxy's
// status codes to distinct typed errors. A 401 raises needs-verification (the
// caller re-runs Turnstile, per spec §13 default); it does NOT silently re-mint.
export async function fetchViaProxy(url: string, type: 'page' | 'sitemap' | 'image'): Promise<Response> {
  const token = getSessionToken();
  if (!token) throw new ProxyClientError('needs-verification', 401);

  const u = new URL('/api/fetch', originBase());
  u.searchParams.set('url', url);
  u.searchParams.set('type', type);

  const res = await fetch(u.href, { headers: { authorization: `Bearer ${token}` } });
  if (res.ok) return res;

  const retryAfter = Number(res.headers.get('retry-after')) || undefined;
  const kind: ProxyErrorKind =
    res.status === 401 ? 'needs-verification'
    : res.status === 413 ? 'too-large'
    : res.status === 429 ? 'rate-limited'
    : res.status === 400 ? 'blocked'
    : 'upstream';
  throw new ProxyClientError(kind, res.status, retryAfter);
}
