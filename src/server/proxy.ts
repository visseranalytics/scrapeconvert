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

// Test seam: pinnedFetch resolves via `resolveAndValidate` and opens a socket
// via the Workers connect() API. Both are injected so tests never hit the net.
// The connect hook receives the validated literal IP (the pinned address), the
// original hostname (for the TLS SNI + cert + Host header), the port, the
// scheme (so https enables TLS), and the raw HTTP/1.1 request bytes.
type ResolveFn = (host: string) => Promise<{ ok: true; ips: string[] } | { ok: false; reason: string }>;
type ConnectArgs = { ip: string; hostname: string; port: number; secure: boolean; rawRequest: string };
type ConnectFn = (args: ConnectArgs) => Promise<ReadableStream<Uint8Array>>;

let resolveHook: ResolveFn = resolveAndValidate;
let connectHook: ConnectFn = realConnect;
export function __setHooks(h: { resolve?: ResolveFn; connect?: ConnectFn }): void {
  if (h.resolve) resolveHook = h.resolve;
  if (h.connect) connectHook = h.connect;
}
export function __resetHooks(): void {
  resolveHook = resolveAndValidate;
  connectHook = realConnect;
}

const MAX_HOPS = 5;
const PAGE_CAP = Number((env as Record<string, string>).MAX_HTML_BYTES ?? '5242880');
const IMAGE_CAP = Number((env as Record<string, string>).MAX_IMAGE_BYTES ?? '26214400');
const HOP_HEADER_CAP = 64 * 1024; // upstream header block ceiling

// Open the upstream socket.
//
// Cloudflare's connect() derives the TLS SNI (and cert hostname check) from the
// `hostname` field of the address it is given; the documented SocketOptions are
// only `secureTransport` ('off' | 'on' | 'starttls') and `allowHalfOpen`. There
// is no separate "set SNI but dial this IP" option, so:
//   - http  -> dial the validated literal IP directly (true IP pinning, no TLS).
//   - https -> dial by the ORIGINAL hostname with TLS on, so SNI + cert
//     validation pass against the real certificate. The hostname's A/AAAA
//     records were already validated against the special-use blocklist in
//     resolveAndValidate and are re-validated on every redirect hop, so the
//     residual resolve-then-connect-by-name rebinding window is the exact
//     tradeoff the spec flags as acceptable for the hosted instance in
//     §16/§17. (If Cloudflare later exposes an SNI-override option, switch the
//     https branch to dial args.ip with that SNI to close the window fully.)
async function realConnect(args: ConnectArgs): Promise<ReadableStream<Uint8Array>> {
  const { connect } = await import('cloudflare:sockets');
  const socket = args.secure
    ? connect({ hostname: args.hostname, port: args.port }, { secureTransport: 'on', allowHalfOpen: false })
    : connect({ hostname: args.ip, port: args.port }, { secureTransport: 'off', allowHalfOpen: false });
  const writer = socket.writable.getWriter();
  await writer.write(new TextEncoder().encode(args.rawRequest));
  await writer.releaseLock();
  return socket.readable as ReadableStream<Uint8Array>;
}

function buildRequest(url: URL): string {
  const path = url.pathname + url.search || '/';
  return [
    `GET ${path} HTTP/1.1`,
    `Host: ${url.hostname}`,
    `User-Agent: ScrapeConvertBot/1.0 (+https://scrapeconvert.com/about)`,
    `Accept: */*`,
    `Accept-Encoding: identity`,
    `Connection: close`,
    '',
    '',
  ].join('\r\n');
}

interface ParsedHead {
  status: number;
  headers: Headers;
  rest: Uint8Array;
}

function indexOf(hay: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

async function readHead(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<ParsedHead> {
  const dec = new TextDecoder();
  let buf = new Uint8Array(0);
  const needle = new TextEncoder().encode('\r\n\r\n');
  while (true) {
    const idx = indexOf(buf, needle);
    if (idx !== -1) {
      const headBytes = buf.slice(0, idx);
      const rest = buf.slice(idx + 4);
      const lines = dec.decode(headBytes).split('\r\n');
      const statusLine = lines.shift() ?? '';
      const m = /^HTTP\/\d\.\d (\d{3})/.exec(statusLine);
      if (!m) throw new ProxyError(502, 'bad-status-line');
      const headers = new Headers();
      for (const l of lines) {
        const c = l.indexOf(':');
        if (c === -1) continue;
        headers.append(l.slice(0, c).trim(), l.slice(c + 1).trim());
      }
      return { status: Number(m[1]), headers, rest };
    }
    if (buf.length > HOP_HEADER_CAP) throw new ProxyError(502, 'header-too-large');
    const { value, done } = await reader.read();
    if (done) throw new ProxyError(502, 'truncated-head');
    const next = new Uint8Array(buf.length + value.length);
    next.set(buf);
    next.set(value, buf.length);
    buf = next;
  }
}

function sanitizeImageType(ct: string): string | null {
  const base = ct.split(';')[0].trim().toLowerCase();
  const ok = [
    'image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif',
    'image/svg+xml', 'image/bmp', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/tiff',
  ];
  return ok.includes(base) ? base : null;
}

export async function pinnedFetch(url: URL, opts: { type: 'page' | 'sitemap' | 'image' }): Promise<Response> {
  const cap = opts.type === 'image' ? IMAGE_CAP : PAGE_CAP;
  let current = url;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const safe = isSafePublicUrl(current.href);
    if (!safe.ok) throw new ProxyError(400, 'blocked-url:' + safe.reason);
    const resolved = await resolveHook(current.hostname);
    if (!resolved.ok) throw new ProxyError(400, 'blocked-host:' + resolved.reason);
    const secure = current.protocol === 'https:';
    const port = current.port ? Number(current.port) : secure ? 443 : 80;
    let stream: ReadableStream<Uint8Array>;
    try {
      stream = await connectHook({
        ip: resolved.ips[0],
        hostname: current.hostname,
        port,
        secure,
        rawRequest: buildRequest(current),
      });
    } catch {
      throw new ProxyError(502, 'connect-failed');
    }
    const reader = stream.getReader();
    const head = await readHead(reader);

    // redirects: manual, re-validate next hop
    if (head.status >= 300 && head.status < 400) {
      reader.cancel().catch(() => {});
      const loc = head.headers.get('location');
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
    if (head.status >= 400) {
      reader.cancel().catch(() => {});
      throw new ProxyError(502, 'upstream-' + head.status);
    }

    // we requested identity; refuse any content-encoding (defeats gzip-bomb decode-blow)
    const ce = head.headers.get('content-encoding');
    if (ce && ce.toLowerCase() !== 'identity') {
      reader.cancel().catch(() => {});
      throw new ProxyError(502, 'unexpected-encoding');
    }

    const rawCt = head.headers.get('content-type') ?? '';
    if (opts.type === 'image') {
      const sane = sanitizeImageType(rawCt);
      if (!sane) {
        reader.cancel().catch(() => {});
        throw new ProxyError(502, 'not-an-image');
      }
      return streamCapped(reader, head.rest, cap, {
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
      return streamCapped(reader, head.rest, cap, {
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
