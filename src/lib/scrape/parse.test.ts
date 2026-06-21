// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { extractImages, parseSitemap } from './parse';

describe('extractImages', () => {
  it('finds <img src> and resolves relative URLs against base', () => {
    const html = `<html><body>
      <img src="../img/a.png" alt="A">
      <img src="https://cdn.example.com/b.jpg">
    </body></html>`;
    const out = extractImages(html, 'https://example.com/dir/page.html');
    const urls = out.map((i) => i.url);
    expect(urls).toContain('https://example.com/img/a.png');
    expect(urls).toContain('https://cdn.example.com/b.jpg');
    expect(out.find((i) => i.url.endsWith('a.png'))?.alt).toBe('A');
    expect(out.every((i) => i.selected === false)).toBe(true);
  });

  it('finds inline style and <style> block background-image', () => {
    const html = `<html><head><style>.hero{background-image:url('/bg/hero.webp')}</style></head>
      <body><div style="background: url(/inline/bg.png) no-repeat"></div></body></html>`;
    const out = extractImages(html, 'https://example.com/');
    const urls = out.map((i) => i.url);
    expect(urls).toContain('https://example.com/bg/hero.webp');
    expect(urls).toContain('https://example.com/inline/bg.png');
  });

  it('skips data: URIs and blocked stock-photo domains', () => {
    const html = `<html><body>
      <img src="data:image/png;base64,AAAA">
      <img src="https://image.shutterstock.com/x.jpg">
      <img src="https://ok.example.com/real.png">
    </body></html>`;
    const out = extractImages(html, 'https://example.com/');
    const urls = out.map((i) => i.url);
    expect(urls).toEqual(['https://ok.example.com/real.png']);
  });

  it('does NOT pull srcset (deferred)', () => {
    const html = `<html><body><img src="https://e.com/a.png" srcset="https://e.com/b.png 2x"></body></html>`;
    const out = extractImages(html, 'https://e.com/');
    const urls = out.map((i) => i.url);
    expect(urls).toContain('https://e.com/a.png');
    expect(urls).not.toContain('https://e.com/b.png');
  });

  it('dedupes the same cleaned URL within a page', () => {
    const html = `<html><body>
      <img src="https://e.com/a.png?v=1">
      <img src="https://e.com/a.png?v=2">
    </body></html>`;
    const out = extractImages(html, 'https://e.com/');
    expect(out).toHaveLength(1);
  });
});

describe('parseSitemap', () => {
  it('detects a sitemap index and returns child URLs with isIndex true', () => {
    const xml = `<?xml version="1.0"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://e.com/sitemap-1.xml</loc></sitemap>
        <sitemap><loc>https://e.com/sitemap-2.xml</loc></sitemap>
      </sitemapindex>`;
    const r = parseSitemap(xml, 'https://e.com/');
    expect(r.isIndex).toBe(true);
    expect(r.urls).toEqual(['https://e.com/sitemap-1.xml', 'https://e.com/sitemap-2.xml']);
  });

  it('returns page urls from a urlset', () => {
    const xml = `<?xml version="1.0"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://e.com/p1</loc></url>
        <url><loc>https://e.com/p2</loc></url>
      </urlset>`;
    const r = parseSitemap(xml, 'https://e.com/');
    expect(r.isIndex).toBe(false);
    expect(r.urls).toEqual(['https://e.com/p1', 'https://e.com/p2']);
  });

  it('extracts image:loc from an image sitemap', () => {
    const xml = `<?xml version="1.0"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
              xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
        <url>
          <loc>https://e.com/page</loc>
          <image:image><image:loc>https://e.com/img/a.jpg</image:loc></image:image>
        </url>
      </urlset>`;
    const r = parseSitemap(xml, 'https://e.com/');
    expect(r.imageUrls).toContain('https://e.com/img/a.jpg');
  });

  it('survives a missing namespace via fallback selectors', () => {
    const xml = `<urlset><url><loc>https://e.com/p1</loc></url></urlset>`;
    const r = parseSitemap(xml, 'https://e.com/');
    expect(r.urls).toEqual(['https://e.com/p1']);
  });
});
