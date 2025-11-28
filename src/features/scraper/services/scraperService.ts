import { v4 as uuidv4 } from 'uuid';
import { ScrapedImage } from '@/shared/types';

export interface ScrapeProgress {
  phase: 'parsing' | 'crawling' | 'extracting' | 'deduplicating' | 'done';
  current: number;
  total: number;
  currentUrl?: string;
}

export interface CrawlLogEntry {
  url: string;
  imageCount: number;
  status: 'pending' | 'crawling' | 'done' | 'error';
}

export type CrawlLogCallback = (entries: CrawlLogEntry[]) => void;

export type ProgressCallback = (progress: ScrapeProgress) => void;

// Sitemap discovery types
export interface SitemapLocation {
  url: string;
  label: string;
  status: 'pending' | 'checking' | 'found' | 'not_found';
}

export interface SitemapDiscoveryProgress {
  phase: 'discovering';
  locations: SitemapLocation[];
  foundUrl?: string;
}

export type DiscoveryCallback = (progress: SitemapDiscoveryProgress) => void;

// List of proxies to try in sequence.
const PROXIES = [
  // Corsproxy.io is generally fast and reliable for images
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  // AllOrigins is a standard fallback
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  // CodeTabs is another backup
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

/**
 * Attempts to fetch a resource using direct access first, then falling back
 * to a list of proxies if CORS or other network errors occur.
 */
async function fetchWithFallback(url: string, options?: RequestInit): Promise<Response> {
  // 1. Try Direct Fetch (Optimistic)
  try {
    const response = await fetch(url, { ...options, mode: 'cors' });
    // Check for success (2xx status codes only)
    if (response.ok && response.status >= 200 && response.status < 300) return response;
    // If we got a 404, the resource doesn't exist - don't try proxies
    if (response.status === 404) {
      throw new Error(`Resource not found: ${url}`);
    }
  } catch (e) {
    // Direct fetch failed (likely CORS), proceed to proxies
    // But if it's a "not found" error, rethrow it
    if (e instanceof Error && e.message.includes('not found')) throw e;
  }

  // 2. Try Proxies in order
  for (const createProxyUrl of PROXIES) {
    try {
      const proxyUrl = createProxyUrl(url);
      // Proxies usually don't support custom methods/headers well for simple GET/HEAD
      // We strip custom options for the proxy call usually, but let's try passing method if it's HEAD
      const proxyOptions = options?.method ? { method: options.method } : undefined;
      const response = await fetch(proxyUrl, proxyOptions);
      // Proxy returns 404 means the underlying resource doesn't exist
      if (response.status === 404) {
        throw new Error(`Resource not found: ${url}`);
      }
      if (response.ok && response.status >= 200 && response.status < 300) return response;
    } catch (e) {
      // If it's a "not found" error, stop trying - resource doesn't exist
      if (e instanceof Error && e.message.includes('not found')) throw e;
      console.warn(`Proxy attempt failed for ${url} using ${createProxyUrl('').split('?')[0]}`, e);
      // Continue to next proxy
    }
  }

  throw new Error(`Failed to retrieve resource after multiple attempts: ${url}`);
}

export const getFileSize = async (url: string): Promise<number> => {
    try {
        const response = await fetchWithFallback(url, { method: 'HEAD' });
        const length = response.headers.get('content-length');
        return length ? parseInt(length, 10) : 0;
    } catch (e) {
        return 0;
    }
};

export const fetchHtml = async (url: string): Promise<string> => {
  const target = url.startsWith('http') ? url : `https://${url}`;
  try {
    const response = await fetchWithFallback(target);
    return await response.text();
  } catch (error) {
    console.error(`Failed to fetch HTML for ${url}`, error);
    throw error;
  }
};

const getExtension = (url: string): string => {
    const parts = url.split(/[#?]/)[0].split('.');
    const ext = parts.length > 1 ? parts.pop()?.trim().toLowerCase() : '';
    if (ext && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp', 'tiff'].includes(ext)) {
        return ext === 'jpeg' ? 'jpg' : ext;
    }
    return 'unknown';
};

/**
 * Blocked domains for paid stock photo sites
 * Images from these domains will be excluded to prevent unauthorized use
 */
const BLOCKED_IMAGE_DOMAINS = [
  // Adobe Stock
  'stock.adobe.com',
  'as1.ftcdn.net',
  'as2.ftcdn.net',
  't3.ftcdn.net',
  't4.ftcdn.net',
  'ftcdn.net',
  // iStock / Getty
  'istockphoto.com',
  'media.istockphoto.com',
  'gettyimages.com',
  'media.gettyimages.com',
  // Shutterstock
  'shutterstock.com',
  'image.shutterstock.com',
  // Depositphotos
  'depositphotos.com',
  'st.depositphotos.com',
  'static.depositphotos.com',
  // 123RF
  '123rf.com',
  'previews.123rf.com',
  // Dreamstime
  'dreamstime.com',
  'thumbs.dreamstime.com',
  // Alamy
  'alamy.com',
  'c8.alamy.com',
  // Bigstock
  'bigstockphoto.com',
  'static.bigstockphoto.com',
  // Pond5
  'pond5.com',
  // Can Stock Photo
  'canstockphoto.com',
  // Stock photo CDNs
  'media-photos.depop.com',
];

/**
 * Check if a URL is from a blocked paid stock photo domain
 */
const isBlockedDomain = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    return BLOCKED_IMAGE_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
};

/**
 * Extracts image URLs from CSS background-image properties
 * Handles: url('...'), url("..."), and url(...)
 */
const extractBackgroundImageUrls = (cssText: string): string[] => {
  const urls: string[] = [];
  // Match url() with optional quotes (single, double, or none)
  const urlRegex = /url\(\s*(['"]?)([^'")\s]+)\1\s*\)/gi;
  let match;
  while ((match = urlRegex.exec(cssText)) !== null) {
    const url = match[2];
    // Skip data URLs and empty URLs
    if (url && !url.startsWith('data:') && url.trim().length > 0) {
      urls.push(url);
    }
  }
  return urls;
};

export const extractImagesFromHtml = (html: string, baseUrl: string, sourcePageUrl?: string): ScrapedImage[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const imgElements = Array.from(doc.getElementsByTagName('img'));
  const uniqueUrls = new Set<string>();

  // Extract page title
  const titleElement = doc.querySelector('title');
  const sourcePageTitle = titleElement?.textContent?.trim() || undefined;

  const images: ScrapedImage[] = [];
  const validBase = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;

  // Helper function to add an image if not already seen
  const addImage = (src: string, alt: string = '') => {
    if (!src || src.startsWith('data:')) return;

    try {
      const absoluteUrl = new URL(src, validBase).href;

      // Block paid stock photo domains
      if (isBlockedDomain(absoluteUrl)) return;

      // Clean the URL - strip query params and hash
      const urlObj = new URL(absoluteUrl);
      const cleanedUrl = urlObj.origin + urlObj.pathname;

      if (!uniqueUrls.has(cleanedUrl)) {
        uniqueUrls.add(cleanedUrl);

        // Try to guess a name from cleaned URL
        const nameParts = cleanedUrl.split('/');
        let name = nameParts.pop() || 'image';
        const format = getExtension(cleanedUrl) || 'jpg';

        if (!name.toLowerCase().endsWith(format) && format !== 'unknown') {
            name = `${name}.${format}`;
        }

        const cleanName = name.length > 30 ? name.substring(0, 30) + '...' : name;

        images.push({
          id: uuidv4(),
          url: cleanedUrl,
          alt,
          name: cleanName,
          format: format.toUpperCase(),
          selected: false,
          sourcePageUrl,
          sourcePageTitle,
        });
      }
    } catch (e) {
      console.warn('Failed to resolve URL:', src, e);
    }
  };

  // 1. Extract from <img> tags
  imgElements.forEach((img) => {
    const src = img.getAttribute('src');
    if (src) {
      addImage(src, img.getAttribute('alt') || '');
    }
  });

  // 2. Extract from inline style attributes (background-image)
  const allElements = Array.from(doc.querySelectorAll('[style]'));
  allElements.forEach((el) => {
    const style = el.getAttribute('style');
    if (style && (style.includes('background-image') || style.includes('background:'))) {
      const bgUrls = extractBackgroundImageUrls(style);
      bgUrls.forEach(url => addImage(url, 'Background Image'));
    }
  });

  // 3. Extract from <style> tags
  const styleTags = Array.from(doc.getElementsByTagName('style'));
  styleTags.forEach((styleTag) => {
    const cssText = styleTag.textContent || '';
    const bgUrls = extractBackgroundImageUrls(cssText);
    bgUrls.forEach(url => addImage(url, 'Background Image'));
  });

  return images;
};

/**
 * Detects if a URL points to a sitemap (XML)
 */
const isSitemapUrl = (url: string): boolean => {
  const lowerUrl = url.toLowerCase();
  return lowerUrl.endsWith('.xml') ||
         lowerUrl.includes('sitemap') ||
         lowerUrl.endsWith('/sitemap');
};

/**
 * Parses a sitemap XML and extracts all URLs
 * Handles both regular sitemaps and sitemap index files
 */
const parseSitemap = (xml: string, baseUrl: string): { urls: string[]; imageUrls: string[]; isIndex: boolean } => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  const SITEMAP_NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';
  const IMAGE_NS = 'http://www.google.com/schemas/sitemap-image/1.1';

  // Check for sitemap index (contains links to other sitemaps)
  // Try both namespaced and non-namespaced queries
  let sitemapLocs = Array.from(doc.getElementsByTagNameNS(SITEMAP_NS, 'loc'))
    .filter(el => el.parentElement?.localName === 'sitemap');

  // Fallback to non-namespaced query
  if (sitemapLocs.length === 0) {
    sitemapLocs = Array.from(doc.querySelectorAll('sitemapindex > sitemap > loc'));
  }

  if (sitemapLocs.length > 0) {
    return {
      urls: sitemapLocs.map(loc => loc.textContent?.trim() || '').filter(Boolean),
      imageUrls: [],
      isIndex: true
    };
  }

  // Regular sitemap with page URLs - use namespace-aware query
  let urlLocs = Array.from(doc.getElementsByTagNameNS(SITEMAP_NS, 'loc'))
    .filter(el => el.parentElement?.localName === 'url');

  // Fallback to non-namespaced query
  if (urlLocs.length === 0) {
    urlLocs = Array.from(doc.querySelectorAll('urlset > url > loc'));
  }

  // If still nothing, try getting all loc elements and filter
  if (urlLocs.length === 0) {
    const allLocs = Array.from(doc.getElementsByTagName('loc'));
    urlLocs = allLocs.filter(el => {
      const parent = el.parentElement;
      return parent?.tagName?.toLowerCase() === 'url' || parent?.localName === 'url';
    });
  }

  const urls = urlLocs.map(loc => loc.textContent?.trim() || '').filter(Boolean);

  // Extract image URLs from image sitemap namespace
  const imageLocElements = Array.from(doc.getElementsByTagNameNS(IMAGE_NS, 'loc'));
  const imageUrls = imageLocElements
    .map(loc => loc.textContent?.trim() || '')
    .filter(Boolean);

  return {
    urls,
    imageUrls,
    isIndex: false
  };
};

interface SitemapResult {
  pageUrls: string[];
  imageUrls: string[];
}

/**
 * Recursively fetches and parses sitemaps, handling sitemap indexes
 */
const fetchAllSitemapUrls = async (
  sitemapUrl: string,
  onProgress?: ProgressCallback,
  visited = new Set<string>()
): Promise<SitemapResult> => {
  if (visited.has(sitemapUrl)) return { pageUrls: [], imageUrls: [] };
  visited.add(sitemapUrl);

  try {
    const xml = await fetchHtml(sitemapUrl);
    const { urls, imageUrls, isIndex } = parseSitemap(xml, sitemapUrl);

    if (isIndex) {
      // This is a sitemap index, recursively fetch each child sitemap
      let allPageUrls: string[] = [];
      let allImageUrls: string[] = [];
      for (let i = 0; i < urls.length; i++) {
        const childUrl = urls[i];
        onProgress?.({
          phase: 'parsing',
          current: i + 1,
          total: urls.length,
          currentUrl: childUrl
        });
        const childResult = await fetchAllSitemapUrls(childUrl, onProgress, visited);
        allPageUrls = [...allPageUrls, ...childResult.pageUrls];
        allImageUrls = [...allImageUrls, ...childResult.imageUrls];
      }
      return { pageUrls: allPageUrls, imageUrls: allImageUrls };
    }

    return { pageUrls: urls, imageUrls };
  } catch (error) {
    console.error(`Error parsing sitemap ${sitemapUrl}:`, error);
    return { pageUrls: [], imageUrls: [] };
  }
};

/**
 * Tries to find a sitemap for a given domain
 */
const discoverSitemap = async (
  baseUrl: string,
  onDiscoveryProgress?: DiscoveryCallback
): Promise<string | null> => {
  const urlObj = new URL(baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`);
  const origin = urlObj.origin;

  // Build list of locations to try with labels
  const locations: SitemapLocation[] = [
    { url: `${origin}/sitemap.xml`, label: '/sitemap.xml', status: 'pending' },
    { url: `${origin}/sitemap_index.xml`, label: '/sitemap_index.xml', status: 'pending' },
    { url: `${origin}/sitemap-index.xml`, label: '/sitemap-index.xml', status: 'pending' },
    { url: `${origin}/sitemaps.xml`, label: '/sitemaps.xml', status: 'pending' },
    { url: `${origin}/sitemap/sitemap.xml`, label: '/sitemap/sitemap.xml', status: 'pending' },
    { url: `${origin}/robots.txt`, label: 'robots.txt', status: 'pending' },
  ];

  // Helper to update and broadcast progress
  const updateStatus = (index: number, status: SitemapLocation['status'], foundUrl?: string) => {
    locations[index].status = status;
    onDiscoveryProgress?.({
      phase: 'discovering',
      locations: [...locations],
      foundUrl
    });
  };

  // Initial broadcast
  onDiscoveryProgress?.({ phase: 'discovering', locations: [...locations] });

  // Try each sitemap location (except robots.txt which is last)
  for (let i = 0; i < locations.length - 1; i++) {
    const loc = locations[i];
    updateStatus(i, 'checking');

    try {
      const response = await fetchWithFallback(loc.url, { method: 'HEAD' });
      if (response.ok) {
        updateStatus(i, 'found', loc.url);
        // Mark remaining as not checked (they stay pending)
        return loc.url;
      } else {
        updateStatus(i, 'not_found');
      }
    } catch {
      updateStatus(i, 'not_found');
    }
  }

  // Try robots.txt for sitemap reference
  const robotsIndex = locations.length - 1;
  updateStatus(robotsIndex, 'checking');

  try {
    const robotsUrl = `${origin}/robots.txt`;
    const robotsText = await fetchHtml(robotsUrl);
    const sitemapMatch = robotsText.match(/Sitemap:\s*(.+)/i);
    if (sitemapMatch && sitemapMatch[1]) {
      const foundUrl = sitemapMatch[1].trim();
      updateStatus(robotsIndex, 'found', foundUrl);
      return foundUrl;
    } else {
      updateStatus(robotsIndex, 'not_found');
    }
  } catch {
    updateStatus(robotsIndex, 'not_found');
  }

  return null;
};

export const processUrlInput = async (
  input: string,
  onProgress?: ProgressCallback
): Promise<ScrapedImage[]> => {
  const urls = input.split(/[\n,]+/).map(u => u.trim()).filter(u => u.length > 0);
  let allImages: ScrapedImage[] = [];

  for (const url of urls) {
    try {
      // Skip blocked paid stock domains
      if (isBlockedDomain(url)) continue;

      // Check if the URL itself is an image
      const ext = getExtension(url);
      if (ext !== 'unknown') {
         allImages.push({
           id: uuidv4(),
           url: cleanImageUrl(url),
           alt: 'Direct Link',
           name: url.split('/').pop() || `image.${ext}`,
           format: ext.toUpperCase(),
           selected: true
         });
         continue;
      }

      const html = await fetchHtml(url);
      const images = extractImagesFromHtml(html, url);
      allImages = [...allImages, ...images];
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
      // Fallback - but still check for blocked domains
      if (!isBlockedDomain(url)) {
        allImages.push({
             id: uuidv4(),
             url: url,
             alt: 'Potential Image Link',
             name: url.split('/').pop() || 'link',
             format: 'UNKNOWN',
             selected: false
        });
      }
    }
  }

  return allImages;
};

export type ImageBatchCallback = (images: ScrapedImage[]) => void;

// Result type for sitemap processing that includes discovery failure info
export interface ProcessSitemapResult {
  images: ScrapedImage[];
  sitemapUrl?: string;
  discoveryFailed?: boolean;
  discoveryLocations?: SitemapLocation[];
}

/**
 * Strips query params and hash from image URL for cleaner storage
 */
const cleanImageUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    // Keep the origin and pathname, strip query and hash
    return urlObj.origin + urlObj.pathname;
  } catch {
    // If URL parsing fails, do basic cleaning
    return url.split('?')[0].split('#')[0];
  }
};

/**
 * Process a sitemap URL and crawl all pages for images
 * Now collects all images first, then deduplicates at the end
 */
export const processSitemapInput = async (
  input: string,
  onProgress?: ProgressCallback,
  maxPages: number = 100,
  onCrawlLog?: CrawlLogCallback,
  onDiscoveryProgress?: DiscoveryCallback
): Promise<ProcessSitemapResult> => {
  let sitemapUrl = input.trim();

  // If not explicitly a sitemap URL, try to discover it
  if (!isSitemapUrl(sitemapUrl)) {
    const discovered = await discoverSitemap(sitemapUrl, onDiscoveryProgress);
    if (!discovered) {
      // Return with discovery failure info instead of throwing
      return {
        images: [],
        discoveryFailed: true,
        discoveryLocations: onDiscoveryProgress ? undefined : undefined
      };
    }
    sitemapUrl = discovered;
  }

  // Parse the sitemap(s)
  onProgress?.({ phase: 'parsing', current: 0, total: 1, currentUrl: sitemapUrl });
  const { pageUrls, imageUrls } = await fetchAllSitemapUrls(sitemapUrl, onProgress);

  // Collect ALL images first (will dedupe at the end)
  let allImages: ScrapedImage[] = [];

  // First, add all images found directly in the sitemap (image:loc entries)
  if (imageUrls.length > 0) {
    onProgress?.({ phase: 'extracting', current: 0, total: imageUrls.length, currentUrl: 'Processing sitemap images...' });
    for (let i = 0; i < imageUrls.length; i++) {
      const imgUrl = imageUrls[i];

      // Skip blocked paid stock domains
      if (isBlockedDomain(imgUrl)) continue;

      const cleanedUrl = cleanImageUrl(imgUrl);
      const ext = getExtension(cleanedUrl);
      const name = cleanedUrl.split('/').pop() || `image.${ext}`;
      const newImage: ScrapedImage = {
        id: uuidv4(),
        url: cleanedUrl,
        alt: 'Sitemap Image',
        name: name.length > 30 ? name.substring(0, 30) + '...' : name,
        format: ext !== 'unknown' ? ext.toUpperCase() : 'JPG',
        selected: false,
        sourcePageUrl: sitemapUrl,
        sourcePageTitle: 'Sitemap'
      };
      allImages.push(newImage);
      if (i % 10 === 0 || i === imageUrls.length - 1) {
        onProgress?.({ phase: 'extracting', current: i + 1, total: imageUrls.length, currentUrl: imgUrl });
      }
    }
  }

  // If we have no page URLs to crawl and no images, sitemap was empty
  if (pageUrls.length === 0 && allImages.length === 0) {
    return { images: [], sitemapUrl, discoveryFailed: false };
  }

  // If we have sitemap images but no page URLs, skip crawling and go to dedup
  if (pageUrls.length === 0 && allImages.length > 0) {
    onProgress?.({ phase: 'done', current: allImages.length, total: allImages.length });
    return { images: allImages, sitemapUrl };
  }

  // Limit pages to crawl
  const urlsToCrawl = pageUrls.slice(0, maxPages);

  // Initialize crawl log with all pages as pending
  const crawlLog: CrawlLogEntry[] = urlsToCrawl.map(url => ({
    url,
    imageCount: 0,
    status: 'pending' as const
  }));
  onCrawlLog?.(crawlLog);

  // Crawl each page with try/catch for each
  for (let i = 0; i < urlsToCrawl.length; i++) {
    const pageUrl = urlsToCrawl[i];

    // Update crawl log to show this page is being crawled
    crawlLog[i].status = 'crawling';
    onCrawlLog?.([...crawlLog]);

    onProgress?.({
      phase: 'crawling',
      current: i + 1,
      total: urlsToCrawl.length,
      currentUrl: pageUrl
    });

    try {
      let pageImageCount = 0;

      // Check if it's a direct image URL
      const ext = getExtension(pageUrl);
      if (ext !== 'unknown') {
        // Skip blocked paid stock domains
        if (!isBlockedDomain(pageUrl)) {
          const cleanedUrl = cleanImageUrl(pageUrl);
          const newImage: ScrapedImage = {
            id: uuidv4(),
            url: cleanedUrl,
            alt: 'Sitemap Image',
            name: cleanedUrl.split('/').pop() || `image.${ext}`,
            format: ext.toUpperCase(),
            selected: false,
            sourcePageUrl: pageUrl,
            sourcePageTitle: 'Direct Image'
          };
          allImages.push(newImage);
          pageImageCount = 1;
        }
      } else {
        // Fetch and extract images from the page
        const html = await fetchHtml(pageUrl);
        const images = extractImagesFromHtml(html, pageUrl, pageUrl);

        // Collect images (URLs already cleaned by extractImagesFromHtml)
        allImages.push(...images);
        pageImageCount = images.length;
      }

      // Update crawl log with success
      crawlLog[i].status = 'done';
      crawlLog[i].imageCount = pageImageCount;
      onCrawlLog?.([...crawlLog]);
    } catch (error) {
      console.warn(`Failed to crawl ${pageUrl}:`, error);
      // Update crawl log with error
      crawlLog[i].status = 'error';
      onCrawlLog?.([...crawlLog]);
    }
  }

  // Flag duplicates instead of removing them
  onProgress?.({ phase: 'deduplicating', current: 0, total: allImages.length, currentUrl: 'Flagging duplicates...' });

  const seenUrls = new Set<string>();
  let duplicateCount = 0;

  for (const img of allImages) {
    // URLs are already cleaned (no query params/hash), just compare exactly
    if (seenUrls.has(img.url)) {
      img.isDuplicate = true;
      duplicateCount++;
    } else {
      seenUrls.add(img.url);
      img.isDuplicate = false;
    }
  }

  console.log(`[DEDUP] Flagged ${duplicateCount} duplicates. Total images: ${allImages.length}`);

  onProgress?.({ phase: 'done', current: allImages.length, total: allImages.length });

  return { images: allImages, sitemapUrl };
};

export const urlToFile = async (url: string, filename: string): Promise<File> => {
  try {
    const response = await fetchWithFallback(url);
    const blob = await response.blob();

    // Determine mime type
    let type = response.headers.get('content-type');
    if (!type || type === 'application/octet-stream') {
        if (filename.endsWith('.svg')) type = 'image/svg+xml';
        else if (filename.endsWith('.png')) type = 'image/png';
        else if (filename.endsWith('.webp')) type = 'image/webp';
        else type = 'image/jpeg';
    }

    return new File([blob], filename, { type });
  } catch (error) {
    console.error(`Error converting URL to file: ${url}`, error);
    throw new Error(`Failed to download image: ${filename}`);
  }
};
