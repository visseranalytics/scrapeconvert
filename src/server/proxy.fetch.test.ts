import { describe, it, expect, beforeEach } from 'vitest';
import { pinnedFetch, __setHooks, __resetHooks } from './proxy';

// Build a fake upstream HTTP/1.1 raw response as a ReadableStream of bytes.
function rawHttp(statusLine: string, headers: Record<string, string>, body: Uint8Array): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const head = statusLine + '\r\n' + Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n';
  const chunks = [enc.encode(head), body];
  let i = 0;
  return new ReadableStream({
    pull(c) {
      if (i < chunks.length) c.enqueue(chunks[i++]);
      else c.close();
    },
  });
}

beforeEach(() => __resetHooks());

describe('pinnedFetch — happy path page', () => {
  it('returns 200 text body, pinned to validated IP', async () => {
    let sentRequest = '';
    let pinnedIp = '';
    let usedTls = false;
    __setHooks({
      resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
      connect: async ({ ip, secure, rawRequest }) => {
        sentRequest = rawRequest;
        pinnedIp = ip;
        usedTls = secure;
        return rawHttp('HTTP/1.1 200 OK', { 'content-type': 'text/html; charset=utf-8', 'content-length': '11' }, new TextEncoder().encode('<html></h>'));
      },
    });
    const res = await pinnedFetch(new URL('https://example.com/'), { type: 'page' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')?.startsWith('text/')).toBe(true);
    expect(pinnedIp).toBe('93.184.216.34'); // connected to the validated literal IP, not the hostname
    expect(usedTls).toBe(true); // https target -> TLS enabled
    expect(sentRequest).toContain('Host: example.com');
    expect(sentRequest).not.toMatch(/cookie/i);
    expect(sentRequest).not.toMatch(/authorization/i);
    const text = await res.text();
    expect(text).toContain('<html>');
  });
});

describe('pinnedFetch — request header hygiene', () => {
  it('only sends User-Agent, Accept, Accept-Encoding: identity', async () => {
    let req = '';
    __setHooks({
      resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
      connect: async ({ rawRequest }) => {
        req = rawRequest;
        return rawHttp('HTTP/1.1 200 OK', { 'content-type': 'text/plain' }, new Uint8Array());
      },
    });
    await pinnedFetch(new URL('https://example.com/'), { type: 'page' });
    expect(req).toMatch(/Accept-Encoding: identity/i);
    expect(req).not.toMatch(/X-Forwarded-For/i);
    expect(req).not.toMatch(/CF-/i);
    expect(req).not.toMatch(/Referer/i);
  });
});

describe('pinnedFetch — manual redirects', () => {
  it('follows a redirect to a public host and re-validates', async () => {
    const calls: string[] = [];
    __setHooks({
      resolve: async (h) => {
        calls.push('resolve:' + h);
        return { ok: true, ips: ['93.184.216.34'] };
      },
      connect: async () => {
        if (calls.filter((c) => c.startsWith('connect')).length === 0) {
          calls.push('connect:1');
          return rawHttp('HTTP/1.1 301 Moved', { location: 'https://example.org/final' }, new Uint8Array());
        }
        calls.push('connect:2');
        return rawHttp('HTTP/1.1 200 OK', { 'content-type': 'text/html' }, new TextEncoder().encode('ok'));
      },
    });
    const res = await pinnedFetch(new URL('https://example.com/'), { type: 'page' });
    expect(res.status).toBe(200);
    expect(calls).toContain('resolve:example.org');
  });

  it('rejects a redirect to a private host (late-hop rebind)', async () => {
    let hop = 0;
    __setHooks({
      resolve: async (h) => (h === 'internal.test' ? { ok: false, reason: 'private-ip' } : { ok: true, ips: ['93.184.216.34'] }),
      connect: async () => {
        hop++;
        if (hop === 1) return rawHttp('HTTP/1.1 302 Found', { location: 'http://internal.test/' }, new Uint8Array());
        return rawHttp('HTTP/1.1 200 OK', { 'content-type': 'text/html' }, new Uint8Array());
      },
    });
    await expect(pinnedFetch(new URL('https://example.com/'), { type: 'page' })).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a redirect to a non-http scheme', async () => {
    __setHooks({
      resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
      connect: async () => rawHttp('HTTP/1.1 302 Found', { location: 'file:///etc/passwd' }, new Uint8Array()),
    });
    await expect(pinnedFetch(new URL('https://example.com/'), { type: 'page' })).rejects.toMatchObject({ status: 400 });
  });

  it('rejects on too many hops', async () => {
    __setHooks({
      resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
      connect: async () => rawHttp('HTTP/1.1 301 Moved', { location: 'https://example.com/loop' }, new Uint8Array()),
    });
    await expect(pinnedFetch(new URL('https://example.com/'), { type: 'page' })).rejects.toMatchObject({ status: 502 });
  });
});

describe('pinnedFetch — stream-and-count cap', () => {
  it('aborts chunked body with no content-length once over cap (page 5MB)', async () => {
    __setHooks({
      resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
      connect: async () => {
        const enc = new TextEncoder();
        const head = 'HTTP/1.1 200 OK\r\ncontent-type: text/html\r\ntransfer-encoding: chunked\r\n\r\n';
        const big = new Uint8Array(6 * 1024 * 1024); // 6MB > 5MB cap, no content-length
        let sent = false;
        return new ReadableStream<Uint8Array>({
          pull(c) {
            if (!sent) {
              c.enqueue(enc.encode(head));
              sent = true;
              return;
            }
            c.enqueue(big);
            c.close();
          },
        });
      },
    });
    await expect((async () => {
      const r = await pinnedFetch(new URL('https://example.com/'), { type: 'page' });
      await r.text();
    })()).rejects.toMatchObject({ status: 413 });
  });

  it('aborts on a lying (small) content-length that the body exceeds', async () => {
    __setHooks({
      resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
      connect: async () => {
        const enc = new TextEncoder();
        const head = 'HTTP/1.1 200 OK\r\ncontent-type: text/html\r\ncontent-length: 10\r\n\r\n';
        const big = new Uint8Array(6 * 1024 * 1024);
        let sent = false;
        return new ReadableStream<Uint8Array>({
          pull(c) {
            if (!sent) {
              c.enqueue(enc.encode(head));
              sent = true;
              return;
            }
            c.enqueue(big);
            c.close();
          },
        });
      },
    });
    await expect((async () => {
      const r = await pinnedFetch(new URL('https://example.com/'), { type: 'page' });
      await r.text();
    })()).rejects.toMatchObject({ status: 413 });
  });

  it('rejects a Content-Encoding: gzip body (we requested identity)', async () => {
    __setHooks({
      resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
      connect: async () => rawHttp('HTTP/1.1 200 OK', { 'content-type': 'text/html', 'content-encoding': 'gzip' }, new Uint8Array(100)),
    });
    await expect(pinnedFetch(new URL('https://example.com/'), { type: 'page' })).rejects.toMatchObject({ status: 502 });
  });
});

describe('pinnedFetch — response sanitize', () => {
  it('strips Set-Cookie and upstream security headers', async () => {
    __setHooks({
      resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
      connect: async () => rawHttp('HTTP/1.1 200 OK', {
        'content-type': 'text/html', 'set-cookie': 'sid=1', 'strict-transport-security': 'max-age=1', 'content-security-policy': 'default-src *',
      }, new TextEncoder().encode('ok')),
    });
    const res = await pinnedFetch(new URL('https://example.com/'), { type: 'page' });
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(res.headers.get('strict-transport-security')).toBeNull();
    expect(res.headers.get('content-security-policy')).toBeNull();
  });

  it('serves type=image with sanitized image/*, attachment, nosniff', async () => {
    __setHooks({
      resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
      connect: async () => rawHttp('HTTP/1.1 200 OK', { 'content-type': 'image/png' }, new Uint8Array([137, 80, 78, 71])),
    });
    const res = await pinnedFetch(new URL('https://cdn.example.com/a.png'), { type: 'image' });
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('content-disposition')).toContain('attachment');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('refuses to relay text/html as type=image', async () => {
    __setHooks({
      resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
      connect: async () => rawHttp('HTTP/1.1 200 OK', { 'content-type': 'text/html' }, new TextEncoder().encode('<html>')),
    });
    await expect(pinnedFetch(new URL('https://cdn.example.com/x'), { type: 'image' })).rejects.toMatchObject({ status: 502 });
  });

  it('refuses to relay image bytes as type=page (content-type mismatch)', async () => {
    __setHooks({
      resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
      connect: async () => rawHttp('HTTP/1.1 200 OK', { 'content-type': 'image/png' }, new Uint8Array([1, 2])),
    });
    await expect(pinnedFetch(new URL('https://example.com/'), { type: 'page' })).rejects.toMatchObject({ status: 502 });
  });
});
