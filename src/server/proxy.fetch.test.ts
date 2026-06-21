import { describe, it, expect, beforeEach } from 'vitest';
import { pinnedFetch, __setHooks, __resetHooks } from './proxy';

const PUBLIC_IP = { ok: true as const, ips: ['93.184.216.34'] };

// Build a fake upstream Response. redirect/error statuses use a null body.
function upstream(status: number, headers: Record<string, string>, body: BodyInit | null = null): Response {
  return new Response(body, { status, headers });
}

// 6MB body (> 5MB page cap), no reliable content-length.
function bigBody(): ReadableStream<Uint8Array> {
  const big = new Uint8Array(6 * 1024 * 1024);
  let sent = false;
  return new ReadableStream<Uint8Array>({
    pull(c) {
      if (!sent) {
        c.enqueue(big);
        sent = true;
      } else {
        c.close();
      }
    },
  });
}

beforeEach(() => __resetHooks());

describe('pinnedFetch — happy path page', () => {
  it('returns 200 text body and resolves the host first', async () => {
    let fetchedUrl = '';
    let sentHeaders: Record<string, string> = {};
    let resolvedHost = '';
    __setHooks({
      resolve: async (h) => {
        resolvedHost = h;
        return PUBLIC_IP;
      },
      fetch: async (url, headers) => {
        fetchedUrl = url.href;
        sentHeaders = headers;
        return upstream(200, { 'content-type': 'text/html; charset=utf-8' }, '<html></html>');
      },
    });
    const res = await pinnedFetch(new URL('https://example.com/'), { type: 'page' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')?.startsWith('text/')).toBe(true);
    expect(resolvedHost).toBe('example.com'); // host validated before the relay
    expect(fetchedUrl).toBe('https://example.com/');
    const keys = Object.keys(sentHeaders).map((k) => k.toLowerCase());
    expect(keys).not.toContain('cookie');
    expect(keys).not.toContain('authorization');
    expect(await res.text()).toContain('<html>');
  });
});

describe('pinnedFetch — request header hygiene', () => {
  it('only sends User-Agent, Accept, Accept-Encoding: identity', async () => {
    let sent: Record<string, string> = {};
    __setHooks({
      resolve: async () => PUBLIC_IP,
      fetch: async (_url, headers) => {
        sent = headers;
        return upstream(200, { 'content-type': 'text/plain' });
      },
    });
    await pinnedFetch(new URL('https://example.com/'), { type: 'page' });
    const lc: Record<string, string> = {};
    for (const [k, v] of Object.entries(sent)) lc[k.toLowerCase()] = v;
    expect(lc['accept-encoding']).toMatch(/identity/i);
    expect(lc['x-forwarded-for']).toBeUndefined();
    expect(lc['referer']).toBeUndefined();
    expect(Object.keys(lc).some((k) => k.startsWith('cf-'))).toBe(false);
  });
});

describe('pinnedFetch — manual redirects', () => {
  it('follows a redirect to a public host and re-validates', async () => {
    const calls: string[] = [];
    let hop = 0;
    __setHooks({
      resolve: async (h) => {
        calls.push('resolve:' + h);
        return PUBLIC_IP;
      },
      fetch: async () => {
        hop++;
        if (hop === 1) return upstream(301, { location: 'https://example.org/final' });
        return upstream(200, { 'content-type': 'text/html' }, 'ok');
      },
    });
    const res = await pinnedFetch(new URL('https://example.com/'), { type: 'page' });
    expect(res.status).toBe(200);
    expect(calls).toContain('resolve:example.org');
  });

  it('rejects a redirect to a private host (late-hop rebind)', async () => {
    let hop = 0;
    __setHooks({
      resolve: async (h) => (h === 'internal.test' ? { ok: false, reason: 'private-ip' } : PUBLIC_IP),
      fetch: async () => {
        hop++;
        if (hop === 1) return upstream(302, { location: 'http://internal.test/' });
        return upstream(200, { 'content-type': 'text/html' });
      },
    });
    await expect(pinnedFetch(new URL('https://example.com/'), { type: 'page' })).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a redirect to a non-http scheme', async () => {
    __setHooks({
      resolve: async () => PUBLIC_IP,
      fetch: async () => upstream(302, { location: 'file:///etc/passwd' }),
    });
    await expect(pinnedFetch(new URL('https://example.com/'), { type: 'page' })).rejects.toMatchObject({ status: 400 });
  });

  it('rejects on too many hops', async () => {
    __setHooks({
      resolve: async () => PUBLIC_IP,
      fetch: async () => upstream(301, { location: 'https://example.com/loop' }),
    });
    await expect(pinnedFetch(new URL('https://example.com/'), { type: 'page' })).rejects.toMatchObject({ status: 502 });
  });
});

describe('pinnedFetch — stream-and-count cap', () => {
  it('aborts a body that exceeds the page cap (no content-length)', async () => {
    __setHooks({
      resolve: async () => PUBLIC_IP,
      fetch: async () => upstream(200, { 'content-type': 'text/html' }, bigBody()),
    });
    await expect(
      (async () => {
        const r = await pinnedFetch(new URL('https://example.com/'), { type: 'page' });
        await r.text();
      })(),
    ).rejects.toMatchObject({ status: 413 });
  });

  it('aborts even when content-length lies small', async () => {
    __setHooks({
      resolve: async () => PUBLIC_IP,
      fetch: async () => upstream(200, { 'content-type': 'text/html', 'content-length': '10' }, bigBody()),
    });
    await expect(
      (async () => {
        const r = await pinnedFetch(new URL('https://example.com/'), { type: 'page' });
        await r.text();
      })(),
    ).rejects.toMatchObject({ status: 413 });
  });

  it('rejects a non-identity content-encoding (decompression-bomb guard)', async () => {
    __setHooks({
      resolve: async () => PUBLIC_IP,
      fetch: async () => upstream(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' }, new Uint8Array(100)),
    });
    await expect(pinnedFetch(new URL('https://example.com/'), { type: 'page' })).rejects.toMatchObject({ status: 502 });
  });
});

describe('pinnedFetch — response sanitize', () => {
  it('emits only our headers (no Set-Cookie / HSTS / CSP passthrough)', async () => {
    __setHooks({
      resolve: async () => PUBLIC_IP,
      fetch: async () =>
        upstream(
          200,
          {
            'content-type': 'text/html',
            'set-cookie': 'sid=1',
            'strict-transport-security': 'max-age=1',
            'content-security-policy': 'default-src *',
          },
          'ok',
        ),
    });
    const res = await pinnedFetch(new URL('https://example.com/'), { type: 'page' });
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(res.headers.get('strict-transport-security')).toBeNull();
    expect(res.headers.get('content-security-policy')).toBeNull();
  });

  it('serves type=image with sanitized image/*, attachment, nosniff', async () => {
    __setHooks({
      resolve: async () => PUBLIC_IP,
      fetch: async () => upstream(200, { 'content-type': 'image/png' }, new Uint8Array([137, 80, 78, 71])),
    });
    const res = await pinnedFetch(new URL('https://cdn.example.com/a.png'), { type: 'image' });
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('content-disposition')).toContain('attachment');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('refuses to relay text/html as type=image', async () => {
    __setHooks({
      resolve: async () => PUBLIC_IP,
      fetch: async () => upstream(200, { 'content-type': 'text/html' }, '<html>'),
    });
    await expect(pinnedFetch(new URL('https://cdn.example.com/x'), { type: 'image' })).rejects.toMatchObject({ status: 502 });
  });

  it('refuses to relay image bytes as type=page (content-type mismatch)', async () => {
    __setHooks({
      resolve: async () => PUBLIC_IP,
      fetch: async () => upstream(200, { 'content-type': 'image/png' }, new Uint8Array([1, 2])),
    });
    await expect(pinnedFetch(new URL('https://example.com/'), { type: 'page' })).rejects.toMatchObject({ status: 502 });
  });
});
