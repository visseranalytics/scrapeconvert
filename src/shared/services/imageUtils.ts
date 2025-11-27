import { ConversionFormat } from '../types';

export interface ConversionResult {
  blob: Blob;
  keptOriginal: boolean;
}

export const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const getImageDimensions = (url: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = url;
  });
};

export const convertImage = async (
  sourceUrl: string,
  format: ConversionFormat,
  quality: number,
  maxWidth: number | null,
  maxHeight: number | null,
  maintainAspectRatio: boolean,
  originalFile?: File
): Promise<ConversionResult> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Only apply resizing if max dimensions are specified
      const effectiveMaxWidth = maxWidth || width;
      const effectiveMaxHeight = maxHeight || height;

      if (maintainAspectRatio) {
        const ratio = Math.min(effectiveMaxWidth / width, effectiveMaxHeight / height);
        if (ratio < 1) {
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
      } else {
        width = Math.min(width, effectiveMaxWidth);
        height = Math.min(height, effectiveMaxHeight);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      if (format === ConversionFormat.JPEG) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            // If original file provided and converted is larger, keep original
            if (originalFile && blob.size > originalFile.size) {
              resolve({ blob: originalFile, keptOriginal: true });
            } else {
              resolve({ blob, keptOriginal: false });
            }
          } else {
            reject(new Error('Canvas to Blob failed. Possible CORS issue if image source is remote.'));
          }
        },
        format,
        quality / 100
      );
    };
    img.onerror = () => reject(new Error('Failed to load image for conversion'));
    img.src = sourceUrl;
  });
};

export const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const getExtensionFromMimeType = (mimeType: string): string => {
  switch (mimeType) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'image/svg+xml': return 'svg';
    default: return 'jpg';
  }
};
