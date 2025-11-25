import { v4 as uuidv4 } from 'uuid';
import { ScrapedImage } from '@/shared/types';

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

export const processUrlInput = async (input: string): Promise<ScrapedImage[]> => {
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
