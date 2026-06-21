import { describe, it, expect } from 'vitest';
import { cacheKeyFor, getCached, putCached } from './cache';

describe('cacheKeyFor', () => {
  it('normalizes to the target URL only (drops token/headers/fragment)', () => {
    const k1 = cacheKeyFor(new URL('https://example.com/a?b=1#frag'));
    const k2 = cacheKeyFor(new URL('https://example.com/a?b=1'));
    expect(new URL(k1.url).hash).toBe('');
    expect(k1.url).toBe(k2.url);
  });
  it('different targets -> different keys', () => {
    expect(cacheKeyFor(new URL('https://a.com/')).url).not.toBe(cacheKeyFor(new URL('https://b.com/')).url);
  });
});

describe('putCached / getCached', () => {
  it('stores a 200 and reads it back', async () => {
    const cache = await caches.open('test-cache');
    const key = cacheKeyFor(new URL('https://example.com/img.png'));
    const res = new Response('hello', { status: 200, headers: { 'content-type': 'text/plain' } });
    await putCached(cache, key, res, 3600, 1024);
    const got = await getCached(cache, key);
    expect(got).toBeDefined();
    expect(await got!.text()).toBe('hello');
  });

  it('does not store responses over maxBytes', async () => {
    const cache = await caches.open('test-cache-2');
    const key = cacheKeyFor(new URL('https://example.com/big'));
    const res = new Response('x'.repeat(2000), { status: 200, headers: { 'content-type': 'text/plain' } });
    await putCached(cache, key, res, 3600, 1024);
    const got = await getCached(cache, key);
    expect(got).toBeUndefined();
  });
});
