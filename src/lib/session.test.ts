// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mintSession, getSessionToken, setSessionToken, clearSessionToken } from './session';

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('session token storage', () => {
  it('set / get / clear round-trip via sessionStorage', () => {
    expect(getSessionToken()).toBeNull();
    setSessionToken('tok-1');
    expect(getSessionToken()).toBe('tok-1');
    clearSessionToken();
    expect(getSessionToken()).toBeNull();
  });
});

describe('mintSession', () => {
  it('posts the turnstile token and stores the returned sessionToken', async () => {
    const f = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ sessionToken: 'minted-abc' }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    const t = await mintSession('turnstile-xyz');
    expect(t).toBe('minted-abc');
    expect(getSessionToken()).toBe('minted-abc');
    const body = JSON.parse((f.mock.calls[0][1] as RequestInit).body as unknown as string);
    expect(body.token).toBe('turnstile-xyz');
  });

  it('concurrent mints share one in-flight request', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 5));
      return new Response(JSON.stringify({ sessionToken: 'shared' }), { status: 200 });
    }));
    const [a, b] = await Promise.all([mintSession('t'), mintSession('t')]);
    expect(a).toBe('shared');
    expect(b).toBe('shared');
    expect(calls).toBe(1);
  });

  it('throws on a non-200 mint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 429 })));
    await expect(mintSession('t')).rejects.toThrow(/mint-failed:429/);
  });
});
