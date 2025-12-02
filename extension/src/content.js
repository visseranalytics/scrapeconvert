// Content script - runs on every page to detect images

const MIN_IMAGE_SIZE = 50; // Minimum dimension to consider

/**
 * Extract all images from the current page
 */
function extractImages() {
  const images = new Map(); // Use Map to dedupe by URL

  // Get all <img> elements
  document.querySelectorAll('img').forEach((img) => {
    const src = img.src || img.dataset.src || img.dataset.lazySrc;
    if (src && isValidImageUrl(src)) {
      const width = img.naturalWidth || img.width || 0;
      const height = img.naturalHeight || img.height || 0;

      // Skip tiny images (likely icons/tracking pixels)
      if (width >= MIN_IMAGE_SIZE || height >= MIN_IMAGE_SIZE || (width === 0 && height === 0)) {
        images.set(src, {
          url: src,
          alt: img.alt || '',
          width: width,
          height: height,
          type: 'img'
        });
      }
    }
  });

  // Get background images from elements
  document.querySelectorAll('*').forEach((el) => {
    const style = window.getComputedStyle(el);
    const bgImage = style.backgroundImage;

    if (bgImage && bgImage !== 'none') {
      const urlMatch = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
      if (urlMatch && urlMatch[1]) {
        const url = resolveUrl(urlMatch[1]);
        if (isValidImageUrl(url) && !images.has(url)) {
          images.set(url, {
            url: url,
            alt: '',
            width: el.offsetWidth || 0,
            height: el.offsetHeight || 0,
            type: 'background'
          });
        }
      }
    }
  });

  // Get images from <picture> elements
  document.querySelectorAll('picture source').forEach((source) => {
    const srcset = source.srcset;
    if (srcset) {
      // Parse srcset and get the largest image
      const urls = parseSrcset(srcset);
      urls.forEach((url) => {
        if (isValidImageUrl(url) && !images.has(url)) {
          images.set(url, {
            url: url,
            alt: '',
            width: 0,
            height: 0,
            type: 'picture'
          });
        }
      });
    }
  });

  // Get images from srcset attributes on img elements
  document.querySelectorAll('img[srcset]').forEach((img) => {
    const srcset = img.srcset;
    if (srcset) {
      const urls = parseSrcset(srcset);
      urls.forEach((url) => {
        if (isValidImageUrl(url) && !images.has(url)) {
          images.set(url, {
            url: url,
            alt: img.alt || '',
            width: 0,
            height: 0,
            type: 'srcset'
          });
        }
      });
    }
  });

  // Get images from <svg> elements with xlink:href
  document.querySelectorAll('image[href], image[xlink\\:href]').forEach((img) => {
    const href = img.getAttribute('href') || img.getAttribute('xlink:href');
    if (href && isValidImageUrl(href)) {
      const url = resolveUrl(href);
      if (!images.has(url)) {
        images.set(url, {
          url: url,
          alt: '',
          width: parseInt(img.getAttribute('width')) || 0,
          height: parseInt(img.getAttribute('height')) || 0,
          type: 'svg'
        });
      }
    }
  });

  return Array.from(images.values());
}

/**
 * Parse srcset attribute and extract URLs
 */
function parseSrcset(srcset) {
  const urls = [];
  const parts = srcset.split(',');

  parts.forEach((part) => {
    const trimmed = part.trim();
    const spaceIndex = trimmed.indexOf(' ');
    const url = spaceIndex > -1 ? trimmed.substring(0, spaceIndex) : trimmed;
    if (url) {
      urls.push(resolveUrl(url));
    }
  });

  return urls;
}

/**
 * Resolve relative URLs to absolute
 */
function resolveUrl(url) {
  if (url.startsWith('data:')) return url;
  if (url.startsWith('//')) return window.location.protocol + url;
  if (url.startsWith('/')) return window.location.origin + url;
  if (url.startsWith('http')) return url;

  // Relative path
  const base = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
  return base + url;
}

/**
 * Check if URL is a valid image URL
 */
function isValidImageUrl(url) {
  if (!url) return false;

  // Skip data URIs that are too small (likely tracking pixels)
  if (url.startsWith('data:')) {
    return url.length > 500; // Reasonable size for actual images
  }

  // Skip common non-image patterns
  const skipPatterns = [
    'data:image/svg+xml,%3csvg', // Inline SVG icons
    'facebook.com/tr',
    'google-analytics.com',
    'googletagmanager.com',
    'doubleclick.net',
    '/pixel',
    '/tracking',
    '/beacon',
    '.gif?', // Often tracking pixels
  ];

  const lowerUrl = url.toLowerCase();
  for (const pattern of skipPatterns) {
    if (lowerUrl.includes(pattern)) return false;
  }

  // Check for image extensions or data URIs
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif'];
  const hasImageExtension = imageExtensions.some((ext) => lowerUrl.includes(ext));
  const isDataUri = url.startsWith('data:image/');
  const hasImageInPath = lowerUrl.includes('/image') || lowerUrl.includes('/img') || lowerUrl.includes('/photo');

  return hasImageExtension || isDataUri || hasImageInPath || lowerUrl.includes('?');
}

/**
 * Fetch image as blob and get actual dimensions
 */
async function fetchImageInfo(imageData) {
  try {
    // Skip data URIs for fetching
    if (imageData.url.startsWith('data:')) {
      return imageData;
    }

    const response = await fetch(imageData.url, {
      mode: 'cors',
      credentials: 'omit'
    });

    if (!response.ok) {
      return { ...imageData, error: 'fetch_failed' };
    }

    const blob = await response.blob();
    const size = blob.size;

    // Try to get actual dimensions if not available
    if (!imageData.width || !imageData.height) {
      try {
        const dimensions = await getImageDimensions(imageData.url);
        return {
          ...imageData,
          width: dimensions.width,
          height: dimensions.height,
          size: size
        };
      } catch {
        return { ...imageData, size: size };
      }
    }

    return { ...imageData, size: size };
  } catch (error) {
    return { ...imageData, error: 'cors_blocked' };
  }
}

/**
 * Get image dimensions by loading it
 */
function getImageDimensions(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = url;
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractImages') {
    const images = extractImages();

    // Apply minimum size filter
    const minSize = request.minSize || 0;
    const filtered = images.filter((img) => {
      if (img.width === 0 && img.height === 0) return true; // Include unknown sizes
      return img.width >= minSize || img.height >= minSize;
    });

    sendResponse({ images: filtered });
    return true;
  }

  if (request.action === 'getImageInfo') {
    fetchImageInfo(request.image).then((info) => {
      sendResponse({ image: info });
    });
    return true; // Keep channel open for async response
  }
});
