import type { ScrapedImage } from '../types';

// Paid stock-photo domains we refuse to surface (carried over from the original
// scraper). Images from these are skipped to avoid unauthorized reuse.
const BLOCKED_IMAGE_DOMAINS = [
  'stock.adobe.com', 'as1.ftcdn.net', 'as2.ftcdn.net', 't3.ftcdn.net', 't4.ftcdn.net', 'ftcdn.net',
  'istockphoto.com', 'media.istockphoto.com', 'gettyimages.com', 'media.gettyimages.com',
  'shutterstock.com', 'image.shutterstock.com', 'depositphotos.com', 'st.depositphotos.com',
  'static.depositphotos.com', '123rf.com', 'previews.123rf.com', 'dreamstime.com',
  'thumbs.dreamstime.com', 'alamy.com', 'c8.alamy.com', 'bigstockphoto.com',
  'static.bigstockphoto.com', 'pond5.com', 'canstockphoto.com', 'media-photos.depop.com',
];

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp', 'tiff'];

function isBlockedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return BLOCKED_IMAGE_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

function getExtension(url: string): string {
  const parts = url.split(/[#?]/)[0].split('.');
  const ext = parts.length > 1 ? parts.pop()?.trim().toLowerCase() : '';
  if (ext && IMAGE_EXTS.includes(ext)) return ext === 'jpeg' ? 'jpg' : ext;
  return 'unknown';
}

function cleanImageUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname; // strip query + hash
  } catch {
    return url.split('?')[0].split('#')[0];
  }
}

// Match url('...'), url("..."), and url(...) in CSS.
function extractBackgroundImageUrls(cssText: string): string[] {
  const urls: string[] = [];
  const re = /url\(\s*(['"]?)([^'")\s]+)\1\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cssText)) !== null) {
    const url = m[2];
    if (url && !url.startsWith('data:') && url.trim().length > 0) urls.push(url);
  }
  return urls;
}

export function extractImages(html: string, baseUrl: string, sourcePageUrl?: string): ScrapedImage[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const seen = new Set<string>();
  const images: ScrapedImage[] = [];
  const validBase = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
  const sourcePageTitle = doc.querySelector('title')?.textContent?.trim() || undefined;

  const add = (src: string, alt = ''): void => {
    if (!src || src.startsWith('data:')) return;
    let absolute: string;
    try {
      absolute = new URL(src, validBase).href;
    } catch {
      return;
    }
    if (isBlockedDomain(absolute)) return;
    const cleaned = cleanImageUrl(absolute);
    if (seen.has(cleaned)) return;
    seen.add(cleaned);

    let name = cleaned.split('/').pop() || 'image';
    const format = getExtension(cleaned);
    if (format !== 'unknown' && !name.toLowerCase().endsWith(format)) name = `${name}.${format}`;
    if (name.length > 60) name = name.slice(0, 60);

    images.push({
      id: crypto.randomUUID(),
      url: cleaned,
      alt,
      name,
      format: (format === 'unknown' ? 'jpg' : format).toUpperCase(),
      selected: false,
      sourcePageUrl,
      sourcePageTitle,
    });
  };

  // 1. <img src>
  for (const img of Array.from(doc.getElementsByTagName('img'))) {
    const src = img.getAttribute('src');
    if (src) add(src, img.getAttribute('alt') || '');
  }
  // 2. inline style background-image
  for (const el of Array.from(doc.querySelectorAll('[style]'))) {
    const style = el.getAttribute('style') || '';
    if (style.includes('background')) {
      for (const url of extractBackgroundImageUrls(style)) add(url, 'Background Image');
    }
  }
  // 3. <style> blocks
  for (const styleTag of Array.from(doc.getElementsByTagName('style'))) {
    for (const url of extractBackgroundImageUrls(styleTag.textContent || '')) add(url, 'Background Image');
  }

  return images;
}

export function parseSitemap(
  xml: string,
  _baseUrl: string,
): { urls: string[]; imageUrls: string[]; isIndex: boolean } {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const SITEMAP_NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';
  const IMAGE_NS = 'http://www.google.com/schemas/sitemap-image/1.1';

  const text = (els: Element[]) => els.map((l) => l.textContent?.trim() || '').filter(Boolean);

  // Sitemap index: <loc> under <sitemap>.
  let sitemapLocs = Array.from(doc.getElementsByTagNameNS(SITEMAP_NS, 'loc')).filter(
    (el) => el.parentElement?.localName === 'sitemap',
  );
  if (sitemapLocs.length === 0) {
    sitemapLocs = Array.from(doc.querySelectorAll('sitemapindex > sitemap > loc'));
  }
  if (sitemapLocs.length > 0) {
    return { urls: text(sitemapLocs), imageUrls: [], isIndex: true };
  }

  // Regular urlset: <loc> under <url>.
  let urlLocs = Array.from(doc.getElementsByTagNameNS(SITEMAP_NS, 'loc')).filter(
    (el) => el.parentElement?.localName === 'url',
  );
  if (urlLocs.length === 0) urlLocs = Array.from(doc.querySelectorAll('urlset > url > loc'));
  if (urlLocs.length === 0) {
    urlLocs = Array.from(doc.getElementsByTagName('loc')).filter((el) => el.parentElement?.localName === 'url');
  }

  const imageLocs = Array.from(doc.getElementsByTagNameNS(IMAGE_NS, 'loc'));
  return { urls: text(urlLocs), imageUrls: text(imageLocs), isIndex: false };
}
