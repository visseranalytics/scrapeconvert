// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createCrawl, type CrawlDeps } from './crawl';

const pageHtml = (imgs: string[]) =>
  `<html><body>${imgs.map((u) => `<img src="${u}">`).join('')}</body></html>`;

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('createCrawl', () => {
  it('single page fetches once and extracts images', async () => {
    const fetchPage = vi.fn(async () => pageHtml(['https://e.com/a.png', 'https://e.com/b.png']));
    const deps: CrawlDeps = { fetchPage, fetchSitemap: vi.fn() };
    const state = await createCrawl({ mode: 'single', input: 'https://e.com/', deps }).start();
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(state.status).toBe('done');
    expect(state.images.map((i) => i.url).sort()).toEqual(['https://e.com/a.png', 'https://e.com/b.png']);
    expect(state.pageCount).toBe(1);
  });

  it('multiple urls fetches each and accumulates', async () => {
    const fetchPage = vi.fn(async (url: string) => pageHtml([`${url}img.png`]));
    const deps: CrawlDeps = { fetchPage, fetchSitemap: vi.fn() };
    const state = await createCrawl({ mode: 'multiple', input: 'https://a.com/\nhttps://b.com/', deps }).start();
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(state.images).toHaveLength(2);
  });

  it('sitemap discovers, expands a child index, and crawls pages (one fetch per page, maxPages respected)', async () => {
    const indexXml = `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <sitemap><loc>https://e.com/child.xml</loc></sitemap></sitemapindex>`;
    const childXml = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://e.com/p1</loc></url>
      <url><loc>https://e.com/p2</loc></url>
      <url><loc>https://e.com/p3</loc></url></urlset>`;
    const fetchSitemap = vi.fn(async (url: string) => (url.endsWith('child.xml') ? childXml : indexXml));
    const fetchPage = vi.fn(async (url: string) => pageHtml([`${url}/i.png`]));
    const deps: CrawlDeps = { fetchPage, fetchSitemap };
    const state = await createCrawl({ mode: 'sitemap', input: 'https://e.com/sitemap.xml', maxPages: 2, deps }).start();
    expect(state.status).toBe('done');
    expect(fetchPage).toHaveBeenCalledTimes(2); // maxPages = 2, one fetch per page
    expect(state.pageCount).toBe(2);
    expect(state.discovery[0].status).toBe('found');
  });

  it('logs a per-page error and continues', async () => {
    const fetchPage = vi.fn(async (url: string) => {
      if (url.includes('bad')) throw new Error('boom');
      return pageHtml(['https://e.com/ok.png']);
    });
    const deps: CrawlDeps = { fetchPage, fetchSitemap: vi.fn() };
    const state = await createCrawl({ mode: 'multiple', input: 'https://e.com/good\nhttps://e.com/bad', deps }).start();
    expect(state.status).toBe('done');
    expect(state.log.find((l) => l.url.includes('bad'))?.status).toBe('error');
    expect(state.log.find((l) => l.url.includes('good'))?.status).toBe('done');
    expect(state.images).toHaveLength(1);
  });

  it('pauses on needs-verification and resumes the same page without restarting', async () => {
    let attempts = 0;
    const fetchPage = vi.fn(async () => {
      attempts++;
      if (attempts === 1) throw { kind: 'needs-verification' };
      return pageHtml(['https://e.com/x.png']);
    });
    const deps: CrawlDeps = { fetchPage, fetchSitemap: vi.fn() };
    const crawl = createCrawl({ mode: 'single', input: 'https://e.com/', deps });
    const done = crawl.start();
    // let it hit the pause
    await tick();
    await tick();
    expect(crawl.getState().needsVerification).toBe(true);
    expect(crawl.getState().status).toBe('paused');
    crawl.resume();
    const state = await done;
    expect(state.status).toBe('done');
    expect(state.needsVerification).toBe(false);
    expect(fetchPage).toHaveBeenCalledTimes(2); // retried same page, not restarted
    expect(state.images).toHaveLength(1);
  });

  it('emits progressive updates and exposes observable state while running', async () => {
    const updates: number[] = [];
    const fetchPage = vi.fn(async (url: string) => pageHtml([`${url}1.png`]));
    const deps: CrawlDeps = { fetchPage, fetchSitemap: vi.fn() };
    const crawl = createCrawl({
      mode: 'multiple',
      input: 'https://e.com/a\nhttps://e.com/b\nhttps://e.com/c',
      deps,
      onUpdate: (s) => updates.push(s.imageCount),
    });
    const state = await crawl.start();
    expect(state.imageCount).toBe(3);
    expect(updates.length).toBeGreaterThan(1); // progressive
    expect(Math.max(...updates)).toBe(3);
  });
});
