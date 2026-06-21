import { extractImages, parseSitemap } from './parse';
import { flagDuplicates } from '../dedupe';
import type { ScrapedImage } from '../types';

export type CrawlMode = 'single' | 'multiple' | 'sitemap';
export type PageStatus = 'pending' | 'crawling' | 'done' | 'error';
export type DiscoveryStatus = 'pending' | 'checking' | 'found' | 'not_found';

export interface CrawlLogEntry {
  url: string;
  status: PageStatus;
  imageCount: number;
}
export interface DiscoveryEntry {
  label: string;
  url: string;
  status: DiscoveryStatus;
}
export interface CrawlState {
  status: 'idle' | 'discovering' | 'crawling' | 'paused' | 'done' | 'error';
  images: ScrapedImage[];
  log: CrawlLogEntry[];
  discovery: DiscoveryEntry[];
  pageCount: number;
  imageCount: number;
  needsVerification: boolean;
  error?: string;
}

export interface CrawlDeps {
  // Return the HTML/XML body for a URL (via the proxy in production). On a
  // needs-verification failure, throw an error whose `.kind === 'needs-verification'`.
  fetchPage: (url: string) => Promise<string>;
  fetchSitemap: (url: string) => Promise<string>;
}

export interface CrawlOptions {
  mode: CrawlMode;
  input: string;
  maxPages?: number;
  deps: CrawlDeps;
  onUpdate?: (state: CrawlState) => void;
}

function isNeedsVerification(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as { kind?: string }).kind === 'needs-verification';
}

function isSitemapUrl(u: string): boolean {
  const l = u.toLowerCase();
  return l.endsWith('.xml') || l.includes('sitemap');
}

function makeImage(url: string, sourcePageUrl?: string): ScrapedImage {
  const cleaned = url.split('#')[0].split('?')[0];
  const name = cleaned.split('/').pop() || 'image';
  const ext = (name.split('.').pop() || '').toLowerCase();
  return {
    id: crypto.randomUUID(),
    url: cleaned,
    alt: 'Sitemap Image',
    name,
    format: (ext || 'jpg').toUpperCase(),
    selected: false,
    sourcePageUrl,
  };
}

export function createCrawl(opts: CrawlOptions) {
  const state: CrawlState = {
    status: 'idle',
    images: [],
    log: [],
    discovery: [],
    pageCount: 0,
    imageCount: 0,
    needsVerification: false,
  };
  const maxPages = opts.maxPages ?? 100;
  let resumeResolve: (() => void) | null = null;

  const emit = () => opts.onUpdate?.(state);

  function resume(): void {
    const r = resumeResolve;
    resumeResolve = null;
    if (r) r();
  }

  async function waitForResume(): Promise<void> {
    state.status = 'paused';
    state.needsVerification = true;
    emit();
    await new Promise<void>((res) => {
      resumeResolve = res;
    });
    state.needsVerification = false;
    state.status = 'crawling';
    emit();
  }

  // Retry the SAME page after a pause; do not restart the crawl.
  async function fetchPageWithPause(url: string): Promise<string> {
    for (;;) {
      try {
        return await opts.deps.fetchPage(url);
      } catch (e) {
        if (isNeedsVerification(e)) {
          await waitForResume();
          continue;
        }
        throw e;
      }
    }
  }

  async function crawlPages(urls: string[]): Promise<void> {
    const toCrawl = urls.slice(0, maxPages);
    for (const url of toCrawl) {
      const entry: CrawlLogEntry = { url, status: 'crawling', imageCount: 0 };
      state.log.push(entry);
      emit();
      try {
        const html = await fetchPageWithPause(url);
        const imgs = extractImages(html, url, url);
        state.images.push(...imgs);
        entry.imageCount = imgs.length;
        entry.status = 'done';
        state.pageCount++;
        state.imageCount = state.images.length;
        flagDuplicates(state.images);
      } catch {
        entry.status = 'error'; // per-page failure logged + skipped; crawl continues
      }
      emit();
    }
  }

  async function discoverSitemap(input: string): Promise<string | null> {
    if (isSitemapUrl(input)) {
      state.discovery = [{ label: input, url: input, status: 'found' }];
      emit();
      return input;
    }
    let origin: string;
    try {
      origin = new URL(input.startsWith('http') ? input : `https://${input}`).origin;
    } catch {
      return null;
    }
    const candidates = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/sitemap-index.xml`];
    state.discovery = candidates.map((url) => ({ label: url.replace(origin, ''), url, status: 'pending' as DiscoveryStatus }));
    emit();
    for (const entry of state.discovery) {
      entry.status = 'checking';
      emit();
      try {
        const xml = await opts.deps.fetchSitemap(entry.url);
        if (xml.includes('<urlset') || xml.includes('<sitemapindex')) {
          entry.status = 'found';
          emit();
          return entry.url;
        }
        entry.status = 'not_found';
      } catch {
        entry.status = 'not_found';
      }
      emit();
    }
    return null;
  }

  async function expandSitemap(sitemapUrl: string): Promise<string[]> {
    const visited = new Set<string>();
    const pageUrls: string[] = [];
    const walk = async (url: string): Promise<void> => {
      if (visited.has(url) || pageUrls.length >= maxPages) return;
      visited.add(url);
      let xml: string;
      try {
        xml = await opts.deps.fetchSitemap(url);
      } catch {
        return;
      }
      const { urls, imageUrls, isIndex } = parseSitemap(xml, url);
      for (const iu of imageUrls) state.images.push(makeImage(iu, sitemapUrl));
      if (isIndex) {
        for (const child of urls) await walk(child);
      } else {
        pageUrls.push(...urls);
      }
    };
    await walk(sitemapUrl);
    state.imageCount = state.images.length;
    flagDuplicates(state.images);
    emit();
    return pageUrls;
  }

  async function start(): Promise<CrawlState> {
    try {
      if (opts.mode === 'single') {
        state.status = 'crawling';
        emit();
        await crawlPages([opts.input.trim()]);
      } else if (opts.mode === 'multiple') {
        state.status = 'crawling';
        emit();
        const urls = opts.input.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
        await crawlPages(urls);
      } else {
        state.status = 'discovering';
        emit();
        const found = await discoverSitemap(opts.input.trim());
        if (!found) {
          state.status = 'done';
          emit();
          return state;
        }
        const pageUrls = await expandSitemap(found);
        state.status = 'crawling';
        emit();
        await crawlPages(pageUrls);
      }
      state.status = 'done';
      emit();
    } catch (e) {
      state.status = 'error';
      state.error = String(e);
      emit();
    }
    return state;
  }

  return { start, resume, getState: () => state };
}
