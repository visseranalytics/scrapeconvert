import type { ConvertOptions } from '../types';
import { decodeAndResize } from './resize';
import { encode } from './codecs';

export { buildZip } from './zip';
export { estimateSize } from './estimate';

const MIME: Record<ConvertOptions['format'], string> = {
  webp: 'image/webp',
  avif: 'image/avif',
  png: 'image/png',
  jpeg: 'image/jpeg',
};

// CONTRACT: takes a Blob (bytes already fetched via the proxy), runs
// decode+resize -> encode, and returns a Blob of the target MIME. A per-image
// failure rejects so the caller can continue the batch.
export async function convertImage(input: Blob, opts: ConvertOptions): Promise<Blob> {
  const imageData = await decodeAndResize(input, opts);
  const buf = await encode(imageData, opts);
  return new Blob([buf], { type: MIME[opts.format] });
}
