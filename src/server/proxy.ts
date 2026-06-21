import { env } from 'cloudflare:workers';
import { isBlockedIp, isSafePublicUrl } from '../lib/url-safety';

interface DohAnswer {
  type: number;
  data: string;
}

export async function resolveAndValidate(
  host: string,
): Promise<{ ok: true; ips: string[] } | { ok: false; reason: string }> {
  const endpoint = (env as Record<string, string>).DOH_ENDPOINT || 'https://cloudflare-dns.com/dns-query';
  const ips: string[] = [];
  for (const t of ['A', 'AAAA']) {
    const url = `${endpoint}?name=${encodeURIComponent(host)}&type=${t}`;
    let res: Response;
    try {
      res = await fetch(url, { headers: { accept: 'application/dns-json' } });
    } catch {
      return { ok: false, reason: 'doh-network' };
    }
    if (res.status !== 200) return { ok: false, reason: 'doh-status' };
    let body: { Status?: number; Answer?: DohAnswer[] };
    try {
      body = await res.json();
    } catch {
      return { ok: false, reason: 'doh-parse' };
    }
    const answers = body.Answer ?? [];
    for (const a of answers) {
      if (a.type !== 1 && a.type !== 28) continue; // A or AAAA only
      const ip = a.data.trim();
      if (isBlockedIp(ip)) return { ok: false, reason: 'private-ip' };
      ips.push(ip);
    }
  }
  if (ips.length === 0) return { ok: false, reason: 'no-records' };
  return { ok: true, ips };
}

export class ProxyError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Test seam: pinnedFetch resolves via `resolveAndValidate` (DoH + IP blocklist)
// and relays via the platform `fetch()` with manual redirect handling. Both are
// injected so tests never touch the network.
//
// We relay via fetch() rather than raw connect() sockets: on Workers, HTTPS
// cannot be IP-pinned anyway (connect() derives its TLS SNI from the dialed
// hostname, so an https hop re-resolves by name), so the raw-socket path added
// real complexity and fragility (it failed at runtime in workerd with "Stream
// was cancelled") for no pinning benefit in the dominant https case. SSRF
// protection comes from isSafePublicUrl + resolveAndValidate run on EVERY hop,
// plus the manual per-hop redirect re-validation below; the residual
// resolve-then-fetch rebinding window is the same tradeoff the spec accepts
// (§16/§17). fetch() also handles TLS, chunked transfer-encoding, and HTTP/2
// correctly, which the hand-rolled HTTP/1.1 parser did not.
type ResolveFn = (host: string) => Promise<{ ok: true; ips: string[] } | { ok: false; reason: string }>;
type FetchFn = (url: URL, headers: Record<string, string>) => Promise<Response>;

let resolveHook: ResolveFn = resolveAndValidate;
let fetchHook: FetchFn = realFetch;
export function __setHooks(h: { resolve?: ResolveFn; fetch?: FetchFn }): void {
  if (h.resolve) resolveHook = h.resolve;
  if (h.fetch) fetchHook = h.fetch;
}
export function __resetHooks(): void {
  resolveHook = resolveAndValidate;
  fetchHook = realFetch;
}

const MAX_HOPS = 5;
const PAGE_CAP = Number((env as Record<string, string>).MAX_HTML_BYTES ?? '5242880');
const IMAGE_CAP = Number((env as Record<string, string>).MAX_IMAGE_BYTES ?? '26214400');

// Minimal, hygienic egress header set. No cookies, no Authorization, no
// forwarding headers (X-Forwarded-For / CF-* / Referer), so nothing about the
// caller or this Worker leaks to the upstream. Accept-Encoding: identity asks
// the upstream not to compress (decompression-bomb defense; the streaming byte
// cap below is the real backstop).
const OUTBOUND_HEADERS: Record<string, string> = {
  'User-Agent': 'ScrapeConvertBot/1.0 (+https://scrapeconvert.com/about)',
  Accept: '*/*',
  'Accept-Encoding': 'identity',
};

// Relay one hop via the platform fetch(). redirect:'manual' returns the raw 3xx
// response (with a readable Location header on Workers) so we re-validate the
// next hop ourselves instead of letting the runtime follow to an unvalidated host.
async function realFetch(url: URL, headers: Record<string, string>): Promise<Response> {
  return fetch(url.href, { method: 'GET', headers, redirect: 'manual' });
}

function sanitizeImageType(ct: string): string | null {
  const base = ct.split(';')[0].trim().toLowerCase();
  const ok = [
    'image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif',
    'image/svg+xml', 'image/bmp', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/tiff',
  ];
  return ok.includes(base) ? base : null;
}

async function discard(resp: Response): Promise<void> {
  try {
    await resp.body?.cancel();
  } catch {
    /* already closed */
  }
}

export async function pinnedFetch(url: URL, opts: { type: 'page' | 'sitemap' | 'image' }): Promise<Response> {
  const cap = opts.type === 'image' ? IMAGE_CAP : PAGE_CAP;
  let current = url;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const safe = isSafePublicUrl(current.href);
    if (!safe.ok) throw new ProxyError(400, 'blocked-url:' + safe.reason);
    const resolved = await resolveHook(current.hostname);
    if (!resolved.ok) throw new ProxyError(400, 'blocked-host:' + resolved.reason);

    let resp: Response;
    try {
      resp = await fetchHook(current, { ...OUTBOUND_HEADERS });
    } catch {
      throw new ProxyError(502, 'connect-failed');
    }

    // redirects: manual, re-validate next hop
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get('location');
      await discard(resp);
      if (!loc) throw new ProxyError(502, 'redirect-no-location');
      let next: URL;
      try {
        next = new URL(loc, current);
      } catch {
        throw new ProxyError(400, 'redirect-bad-url');
      }
      if (next.protocol !== 'http:' && next.protocol !== 'https:') throw new ProxyError(400, 'redirect-scheme');
      current = next;
      continue;
    }
    if (resp.status >= 400) {
      await discard(resp);
      throw new ProxyError(502, 'upstream-' + resp.status);
    }

    // We requested identity. If the runtime/upstream still reports a non-identity
    // content-encoding, refuse (defeats gzip-bomb decode-blow). In practice the
    // platform fetch transparently decodes and strips this header; the streaming
    // cap below is the actual backstop for an undeclared bomb.
    const ce = resp.headers.get('content-encoding');
    if (ce && ce.toLowerCase() !== 'identity') {
      await discard(resp);
      throw new ProxyError(502, 'unexpected-encoding');
    }

    const rawCt = resp.headers.get('content-type') ?? '';
    const reader = (resp.body ?? new ReadableStream<Uint8Array>({ start(c) { c.close(); } })).getReader();

    if (opts.type === 'image') {
      const sane = sanitizeImageType(rawCt);
      if (!sane) {
        reader.cancel().catch(() => {});
        throw new ProxyError(502, 'not-an-image');
      }
      return streamCapped(reader, new Uint8Array(0), cap, {
        'content-type': sane,
        'content-disposition': 'attachment',
        'x-content-type-options': 'nosniff',
      });
    } else {
      const base = rawCt.split(';')[0].trim().toLowerCase();
      if (
        !base.startsWith('text/') &&
        base !== 'application/xml' &&
        base !== 'application/rss+xml' &&
        base !== 'application/atom+xml' &&
        base !== ''
      ) {
        reader.cancel().catch(() => {});
        throw new ProxyError(502, 'not-text');
      }
      return streamCapped(reader, new Uint8Array(0), cap, {
        'content-type': rawCt || 'text/plain; charset=utf-8',
        'x-content-type-options': 'nosniff',
      });
    }
  }
  throw new ProxyError(502, 'too-many-redirects');
}

function streamCapped(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  head: Uint8Array,
  cap: number,
  outHeaders: Record<string, string>,
): Response {
  let count = head.length;
  if (count > cap) {
    reader.cancel().catch(() => {});
    throw new ProxyError(413, 'over-cap');
  }
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (head.length) controller.enqueue(head);
    },
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      count += value.length;
      if (count > cap) {
        reader.cancel().catch(() => {});
        controller.error(new ProxyError(413, 'over-cap'));
        return;
      }
      controller.enqueue(value);
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
  return new Response(body, { status: 200, headers: outHeaders });
}

export function isOwnZoneOrDenied(
  target: URL,
  requestHost: string,
  zoneApex: string,
  denylist: string[],
): boolean {
  const host = target.hostname.toLowerCase();
  const apex = zoneApex.toLowerCase();
  if (apex && (host === apex || host.endsWith('.' + apex))) return true;
  if (host === requestHost.toLowerCase()) return true;
  if (host.endsWith('.workers.dev')) return true;
  if (target.pathname.startsWith('/api/fetch')) return true;
  for (const d of denylist) {
    const dd = d.trim().toLowerCase();
    if (!dd) continue;
    if (host === dd || host.endsWith('.' + dd)) return true;
  }
  return false;
}
