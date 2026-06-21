// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchViaProxy, ProxyClientError } from './proxy-client';
import { setSessionToken, clearSessionToken } from './session';

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('fetchViaProxy', () => {
  it('throws needs-verification when no token is present', async () => {
    clearSessionToken();
    await expect(fetchViaProxy('https://e.com/', 'page')).rejects.toMatchObject({ kind: 'needs-verification' });
  });

  it('attaches the Bearer token and the url/type params', async () => {
    setSessionToken('tok-9');
    let calledUrl = '';
    let auth = '';
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calledUrl = url;
      auth = String((init?.headers as Record<string, string>)?.authorization);
      return new Response('ok', { status: 200 });
    }));
    await fetchViaProxy('https://e.com/page', 'page');
    expect(auth).toBe('Bearer tok-9');
    expect(calledUrl).toContain('/api/fetch?');
    expect(calledUrl).toContain('url=https%3A%2F%2Fe.com%2Fpage');
    expect(calledUrl).toContain('type=page');
  });

  it('maps 401 to needs-verification', async () => {
    setSessionToken('tok');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })));
    await expect(fetchViaProxy('https://e.com/', 'page')).rejects.toMatchObject({ kind: 'needs-verification', status: 401 });
  });

  it('maps 413/429/400/502 to distinct typed errors and surfaces Retry-After on 429', async () => {
    setSessionToken('tok');
    const cases: Array<[number, string]> = [[413, 'too-large'], [400, 'blocked'], [502, 'upstream']];
    for (const [status, kind] of cases) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status })));
      await expect(fetchViaProxy('https://e.com/', 'page')).rejects.toMatchObject({ kind, status });
    }
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 429, headers: { 'retry-after': '30' } })));
    try {
      await fetchViaProxy('https://e.com/', 'page');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ProxyClientError);
      expect((e as ProxyClientError).kind).toBe('rate-limited');
      expect((e as ProxyClientError).retryAfter).toBe(30);
    }
  });
});
