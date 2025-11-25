import { v4 as uuidv4 } from 'uuid';
import { ScrapedImage } from '../types';

// List of proxies to try in sequence.
// Different proxies have different rules regarding headers, cookies, and rate limits.
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
async function fetchWithFallback(url: string): Promise<Response> {
  // 1. Try Direct Fetch (Optimistic)
  // This works if the target server supports CORS (Access-Control-Allow-Origin: *)
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (response.ok) return response;
  } catch (e) {
    // Direct fetch failed (likely CORS), proceed to proxies
  }

  // 2. Try Proxies in order
  for (const createProxyUrl of PROXIES) {
    try {
      const proxyUrl = createProxyUrl(url);
      const response = await fetch(proxyUrl);
      if (response.ok) return response;
    } catch (e) {
      console.warn(`Proxy attempt failed for ${url} using ${createProxyUrl('').split('?')[0]}`, e);
      // Continue to next proxy
    }
  }

  throw new Error(`Failed to retrieve resource after multiple attempts: ${url}`);
}

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

export const extractImagesFromHtml = (html: string, baseUrl: string): ScrapedImage[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const imgElements = Array.from(doc.getElementsByTagName('img'));
  const uniqueUrls = new Set<string>();
  
  const images: ScrapedImage[] = [];

  imgElements.forEach((img) => {
    let src = img.getAttribute('src');
    if (!src) return;

    // Handle data URLs directly
    if (src.startsWith('data:')) {
       // We skip data URLs for scraper results usually as they are often tiny thumbnails,
       // unless requested otherwise. For now, let's skip to keep list clean.
       return; 
    }

    // Handle relative URLs
    try {
      const validBase = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
      const absoluteUrl = new URL(src, validBase).href;

      if (!uniqueUrls.has(absoluteUrl)) {
        uniqueUrls.add(absoluteUrl);
        
        // Try to guess a name
        const nameParts = absoluteUrl.split('/');
        let name = nameParts.pop()?.split('?')[0] || 'image';
        if (!name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
            name = `${name}.jpg`; // Default extension if missing
        }
        const cleanName = name.length > 30 ? name.substring(0, 30) + '...' : name;

        images.push({
          id: uuidv4(),
          url: absoluteUrl,
          alt: img.getAttribute('alt') || '',
          name: cleanName,
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
      if (url.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i)) {
         allImages.push({
           id: uuidv4(),
           url: url,
           alt: 'Direct Link',
           name: url.split('/').pop() || 'image.jpg',
           selected: true
         });
         continue; 
      }

      const html = await fetchHtml(url);
      const images = extractImagesFromHtml(html, url);
      allImages = [...allImages, ...images];
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
      // Fallback: assume it might be an image link even if extension check failed or fetchHtml failed
      // (sometimes servers return 403 for html scraping but 200 for image hotlinking)
      allImages.push({
           id: uuidv4(),
           url: url,
           alt: 'Potential Image Link',
           name: url.split('/').pop() || 'link',
           selected: false // Don't auto-select if we aren't sure
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
        // Simple extension fallback
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