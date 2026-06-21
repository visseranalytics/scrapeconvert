import { describe, it, expect } from 'vitest';
import { canonicalRedirect } from './canonical';

describe('canonicalRedirect', () => {
  it('301-redirects the www host to the apex, preserving path + query', () => {
    const r = canonicalRedirect(new URL('https://www.scrapeconvert.com/sitemap.xml'));
    expect(r).not.toBeNull();
    expect(r!.status).toBe(301);
    expect(r!.headers.get('location')).toBe('https://scrapeconvert.com/sitemap.xml');
  });

  it('preserves a path with a query string', () => {
    const r = canonicalRedirect(new URL('https://www.scrapeconvert.com/scraper?x=1&y=2'));
    expect(r!.headers.get('location')).toBe('https://scrapeconvert.com/scraper?x=1&y=2');
  });

  it('returns null for the apex host (no redirect loop)', () => {
    expect(canonicalRedirect(new URL('https://scrapeconvert.com/sitemap.xml'))).toBeNull();
  });

  it('returns null for an unrelated host', () => {
    expect(canonicalRedirect(new URL('https://scrapeconvert-staging.workers.dev/'))).toBeNull();
  });

  it('reverses when the canonical host is configured as www (flip)', () => {
    const r = canonicalRedirect(new URL('https://www.scrapeconvert.com/'), 'scrapeconvert.com');
    expect(r!.status).toBe(301);
  });
});
