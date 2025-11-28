import { ConversionFormat } from '../types';
import { encode as encodeJpeg } from '@jsquash/jpeg';
import { encode as encodePng } from '@jsquash/png';
import { encode as encodeWebp } from '@jsquash/webp';
import { optimise as optimizePng } from '@jsquash/oxipng';

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

/**
 * Get ImageData from a canvas - used by jSquash encoders
 */
const getImageData = (
  img: HTMLImageElement,
  width: number,
  height: number,
  fillWhite: boolean
): ImageData => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  if (fillWhite) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(img, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
};

/**
 * Convert image using jSquash WASM codecs for superior compression
 * Uses MozJPEG, OxiPNG, and libwebp - same as Squoosh
 */
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

    img.onload = async () => {
      try {
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

        // Get ImageData for jSquash encoders
        const fillWhite = format === ConversionFormat.JPEG;
        const imageData = getImageData(img, width, height, fillWhite);

        let outputBuffer: ArrayBuffer;

        // Use jSquash WASM encoders for superior compression
        switch (format) {
          case ConversionFormat.JPEG:
            // MozJPEG encoder - much better than browser's JPEG
            outputBuffer = await encodeJpeg(imageData, { quality });
            break;

          case ConversionFormat.PNG:
            // First encode to PNG, then optimize with OxiPNG
            const pngBuffer = await encodePng(imageData);
            // OxiPNG optimization level 2 is a good balance of speed/compression
            outputBuffer = await optimizePng(pngBuffer, { level: 2 });
            break;

          case ConversionFormat.WEBP:
            // libwebp encoder
            outputBuffer = await encodeWebp(imageData, { quality });
            break;

          default:
            throw new Error(`Unsupported format: ${format}`);
        }

        const blob = new Blob([outputBuffer], { type: format });

        // If original file provided and converted is larger, keep original
        if (originalFile && blob.size > originalFile.size) {
          resolve({ blob: originalFile, keptOriginal: true });
        } else {
          resolve({ blob, keptOriginal: false });
        }
      } catch (error) {
        console.error('jSquash conversion error:', error);
        reject(new Error('Image conversion failed'));
      }
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
