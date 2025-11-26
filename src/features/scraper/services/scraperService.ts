import { v4 as uuidv4 } from 'uuid';
import { ScrapedImage } from '@/shared/types';

export interface ScrapeProgress {
  phase: 'parsing' | 'crawling' | 'extracting' | 'done';
  current: number;
  total: number;
  currentUrl?: string;
}

export type ProgressCallback = (progress: ScrapeProgress) => void;

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
    if (response.ok) return response;
  } catch (e) {
    // Direct fetch failed (likely CORS), proceed to proxies
  }

  // 2. Try Proxies in order
  for (const createProxyUrl of PROXIES) {
    try {
      const proxyUrl = createProxyUrl(url);
      // Proxies usually don't support custom methods/headers well for simple GET/HEAD
      // We strip custom options for the proxy call usually, but let's try passing method if it's HEAD
      const proxyOptions = options?.method ? { method: options.method } : undefined;
      const response = await fetch(proxyUrl, proxyOptions);
      if (response.ok) return response;
    } catch (e) {
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

export const extractImagesFromHtml = (html: string, baseUrl: string): ScrapedImage[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const imgElements = Array.from(doc.getElementsByTagName('img'));
  const uniqueUrls = new Set<string>();
  
  const images: ScrapedImage[] = [];

  imgElements.forEach((img) => {
    let src = img.getAttribute('src');
    if (!src) return;

    if (src.startsWith('data:')) return; 

    try {
      const validBase = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
      const absoluteUrl = new URL(src, validBase).href;

      if (!uniqueUrls.has(absoluteUrl)) {
        uniqueUrls.add(absoluteUrl);
        
        // Try to guess a name
        const nameParts = absoluteUrl.split('/');
        let name = nameParts.pop()?.split('?')[0] || 'image';
        const format = getExtension(absoluteUrl) || 'jpg';

        if (!name.toLowerCase().endsWith(format) && format !== 'unknown') {
            name = `${name}.${format}`;
        }
        
        const cleanName = name.length > 30 ? name.substring(0, 30) + '...' : name;

        images.push({
          id: uuidv4(),
          url: absoluteUrl,
          alt: img.getAttribute('alt') || '',
          name: cleanName,
          format: format.toUpperCase(),
          selected: false,
        });
      }
    } catch (e) {
      console.warn('Failed to resolve URL:', src, e);
    }
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
const discoverSitemap = async (baseUrl: string): Promise<string | null> => {
  const urlObj = new URL(baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`);
  const origin = urlObj.origin;

  // Common sitemap locations to try
  const sitemapLocations = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap-index.xml`,
    `${origin}/sitemaps.xml`,
    `${origin}/sitemap/sitemap.xml`,
  ];

  for (const loc of sitemapLocations) {
    try {
      const response = await fetchWithFallback(loc, { method: 'HEAD' });
      if (response.ok) {
        return loc;
      }
    } catch {
      // Continue to next location
    }
  }

  // Try robots.txt for sitemap reference
  try {
    const robotsUrl = `${origin}/robots.txt`;
    const robotsText = await fetchHtml(robotsUrl);
    const sitemapMatch = robotsText.match(/Sitemap:\s*(.+)/i);
    if (sitemapMatch && sitemapMatch[1]) {
      return sitemapMatch[1].trim();
    }
  } catch {
    // No robots.txt or no sitemap reference
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
      // Check if the URL itself is an image
      const ext = getExtension(url);
      if (ext !== 'unknown') {
         allImages.push({
           id: uuidv4(),
           url: url,
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
      // Fallback
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

  return allImages;
};

/**
 * Process a sitemap URL and crawl all pages for images
 */
export const processSitemapInput = async (
  input: string,
  onProgress?: ProgressCallback,
  maxPages: number = 100
): Promise<ScrapedImage[]> => {
  let sitemapUrl = input.trim();

  // If not explicitly a sitemap URL, try to discover it
  if (!isSitemapUrl(sitemapUrl)) {
    onProgress?.({ phase: 'parsing', current: 0, total: 1, currentUrl: 'Discovering sitemap...' });
    const discovered = await discoverSitemap(sitemapUrl);
    if (!discovered) {
      throw new Error('Could not find a sitemap for this URL. Try providing a direct sitemap URL.');
    }
    sitemapUrl = discovered;
  }

  // Parse the sitemap(s)
  onProgress?.({ phase: 'parsing', current: 0, total: 1, currentUrl: sitemapUrl });
  const { pageUrls, imageUrls } = await fetchAllSitemapUrls(sitemapUrl, onProgress);

  let allImages: ScrapedImage[] = [];
  const seenUrls = new Set<string>();

  // First, add all images found directly in the sitemap (image:loc entries)
  if (imageUrls.length > 0) {
    onProgress?.({ phase: 'extracting', current: 0, total: imageUrls.length, currentUrl: 'Processing sitemap images...' });
  }
  for (let i = 0; i < imageUrls.length; i++) {
    const imgUrl = imageUrls[i];
    if (!seenUrls.has(imgUrl)) {
      seenUrls.add(imgUrl);
      const ext = getExtension(imgUrl);
      const name = imgUrl.split('/').pop()?.split('?')[0] || `image.${ext}`;
      allImages.push({
        id: uuidv4(),
        url: imgUrl,
        alt: 'Sitemap Image',
        name: name.length > 30 ? name.substring(0, 30) + '...' : name,
        format: ext !== 'unknown' ? ext.toUpperCase() : 'JPG',
        selected: false
      });
    }
    if (i % 10 === 0 || i === imageUrls.length - 1) {
      onProgress?.({ phase: 'extracting', current: i + 1, total: imageUrls.length, currentUrl: imgUrl });
    }
  }

  // If we have no page URLs to crawl, just return the images from sitemap
  if (pageUrls.length === 0 && allImages.length > 0) {
    return allImages;
  }

  if (pageUrls.length === 0 && allImages.length === 0) {
    throw new Error('No URLs found in the sitemap.');
  }

  // Limit pages to crawl
  const urlsToCrawl = pageUrls.slice(0, maxPages);

  // Crawl each page
  for (let i = 0; i < urlsToCrawl.length; i++) {
    const pageUrl = urlsToCrawl[i];

    onProgress?.({
      phase: 'crawling',
      current: i + 1,
      total: urlsToCrawl.length,
      currentUrl: pageUrl
    });

    try {
      // Check if it's a direct image URL
      const ext = getExtension(pageUrl);
      if (ext !== 'unknown') {
        if (!seenUrls.has(pageUrl)) {
          seenUrls.add(pageUrl);
          allImages.push({
            id: uuidv4(),
            url: pageUrl,
            alt: 'Sitemap Image',
            name: pageUrl.split('/').pop() || `image.${ext}`,
            format: ext.toUpperCase(),
            selected: false
          });
        }
        continue;
      }

      // Fetch and extract images from the page
      const html = await fetchHtml(pageUrl);
      const images = extractImagesFromHtml(html, pageUrl);

      // Deduplicate
      for (const img of images) {
        if (!seenUrls.has(img.url)) {
          seenUrls.add(img.url);
          allImages.push(img);
        }
      }
    } catch (error) {
      console.warn(`Failed to crawl ${pageUrl}:`, error);
    }
  }

  // Don't call progress with 'done' - let the caller handle completion
  return allImages;
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
