import { describe, it, expect, vi, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { POST } from './turnstile';

function req(body: unknown, ip = '9.9.9.9') {
  return new Request('https://scrapeconvert.com/api/turnstile', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
    body: JSON.stringify(body),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asCtx = (request: Request) => ({ request }) as any;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })));
});

describe('POST /api/turnstile', () => {
  it('mints a session token on success', async () => {
    const res = await POST(asCtx(req({ token: 'fresh-1' })));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { sessionToken?: string };
    expect(typeof json.sessionToken).toBe('string');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('400 on missing token', async () => {
    const res = await POST(asCtx(req({})));
    expect(res.status).toBe(400);
  });

  it('400 when siteverify fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 200 })));
    const res = await POST(asCtx(req({ token: 'bad-1' })));
    expect(res.status).toBe(400);
  });

  it('400 on duplicate Turnstile token (single-use)', async () => {
    const r1 = await POST(asCtx(req({ token: 'dup-token' }, '7.7.7.7')));
    expect(r1.status).toBe(200);
    const r2 = await POST(asCtx(req({ token: 'dup-token' }, '7.7.7.7')));
    expect(r2.status).toBe(400);
  });

  it('429 after exceeding per-IP mint rate', async () => {
    let last = 200;
    for (let i = 0; i < 12; i++) {
      const res = await POST(asCtx(req({ token: 'mint-' + i }, '5.5.5.5')));
      last = res.status;
    }
    expect(last).toBe(429);
  });

  it('throws when SESSION_HMAC_SECRET is unset (deploy must fail)', async () => {
    const e = env as Record<string, unknown>;
    const original = e.SESSION_HMAC_SECRET;
    e.SESSION_HMAC_SECRET = '';
    await expect(POST(asCtx(req({ token: 'x' })))).rejects.toThrow(/SESSION_HMAC_SECRET/);
    e.SESSION_HMAC_SECRET = original;
  });
});
