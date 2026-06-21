import type { ConvertOptions } from '../types';

// Encode dispatch over the single-thread @jsquash builds (no SharedArrayBuffer,
// so cross-origin <img> thumbnails keep working). Each codec module is loaded
// lazily via dynamic import; the ES module loader caches it, so subsequent
// encodes reuse the same instance. AVIF encode is slower (single-thread
// tradeoff, spec §5.1).
export async function encode(imageData: ImageData, opts: ConvertOptions): Promise<ArrayBuffer> {
  switch (opts.format) {
    case 'jpeg': {
      const { encode: enc } = await import('@jsquash/jpeg');
      return enc(imageData, { quality: opts.quality });
    }
    case 'webp': {
      const { encode: enc } = await import('@jsquash/webp');
      return enc(imageData, { quality: opts.quality });
    }
    case 'avif': {
      const { encode: enc } = await import('@jsquash/avif');
      return enc(imageData, { quality: opts.quality });
    }
    case 'png': {
      const { encode: enc } = await import('@jsquash/png');
      const { optimise } = await import('@jsquash/oxipng');
      const raw = await enc(imageData);
      return optimise(raw);
    }
    default:
      throw new Error('unknown-format:' + (opts as { format: string }).format);
  }
}
