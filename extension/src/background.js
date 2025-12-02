// Background service worker for handling downloads and cross-origin requests

// Store for tracking download progress
const downloadState = {
  active: false,
  total: 0,
  completed: 0,
  cancelled: false
};

/**
 * Download an image with optional conversion
 */
async function downloadImage(imageUrl, filename, format, quality) {
  try {
    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    let blob = await response.blob();
    let finalFilename = filename;

    // Convert if format is specified and different from original
    if (format && format !== 'original') {
      const converted = await convertImageBlob(blob, format, quality);
      if (converted) {
        blob = converted.blob;
        finalFilename = changeExtension(filename, format);
      }
    }

    // Create object URL and download
    const objectUrl = URL.createObjectURL(blob);

    const downloadId = await chrome.downloads.download({
      url: objectUrl,
      filename: `scrapeconvert/${sanitizeFilename(finalFilename)}`,
      saveAs: false
    });

    // Clean up object URL after download starts
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);

    return { success: true, downloadId };
  } catch (error) {
    console.error('Download failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Convert image blob to specified format using Canvas API
 * Falls back to canvas.toBlob since we can't use WASM in service worker
 */
async function convertImageBlob(blob, format, quality) {
  try {
    // Create ImageBitmap from blob
    const bitmap = await createImageBitmap(blob);

    // Create offscreen canvas
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');

    // Fill white background for JPEG (no transparency support)
    if (format === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(bitmap, 0, 0);

    // Convert to blob
    const convertedBlob = await canvas.convertToBlob({
      type: format,
      quality: quality / 100
    });

    bitmap.close();

    return { blob: convertedBlob };
  } catch (error) {
    console.error('Conversion failed:', error);
    return null;
  }
}

/**
 * Change file extension based on format
 */
function changeExtension(filename, format) {
  const extMap = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  };

  const newExt = extMap[format] || 'jpg';
  const baseName = filename.replace(/\.[^.]+$/, '');
  return `${baseName}.${newExt}`;
}

/**
 * Sanitize filename for safe saving
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 200);
}

/**
 * Extract filename from URL
 */
function getFilenameFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const segments = pathname.split('/');
    let filename = segments[segments.length - 1] || 'image';

    // Remove query parameters from filename
    filename = filename.split('?')[0];

    // Add extension if missing
    if (!filename.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)$/i)) {
      filename += '.jpg';
    }

    return decodeURIComponent(filename);
  } catch {
    return 'image.jpg';
  }
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadImages') {
    handleBatchDownload(request.images, request.format, request.quality, sender.tab?.id)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'downloadSingle') {
    const filename = getFilenameFromUrl(request.image.url);
    downloadImage(request.image.url, filename, request.format, request.quality)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'cancelDownload') {
    downloadState.cancelled = true;
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'getDownloadState') {
    sendResponse(downloadState);
    return true;
  }
});

/**
 * Handle batch download of multiple images
 */
async function handleBatchDownload(images, format, quality, tabId) {
  downloadState.active = true;
  downloadState.total = images.length;
  downloadState.completed = 0;
  downloadState.cancelled = false;

  const results = {
    success: [],
    failed: []
  };

  for (const image of images) {
    if (downloadState.cancelled) {
      break;
    }

    const filename = getFilenameFromUrl(image.url);
    const result = await downloadImage(image.url, filename, format, quality);

    if (result.success) {
      results.success.push(image.url);
    } else {
      results.failed.push({ url: image.url, error: result.error });
    }

    downloadState.completed++;

    // Notify popup of progress
    if (tabId) {
      chrome.runtime.sendMessage({
        action: 'downloadProgress',
        completed: downloadState.completed,
        total: downloadState.total
      }).catch(() => {}); // Ignore if popup is closed
    }

    // Small delay between downloads to avoid overwhelming
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  downloadState.active = false;

  return {
    success: true,
    downloaded: results.success.length,
    failed: results.failed.length,
    failedItems: results.failed
  };
}
