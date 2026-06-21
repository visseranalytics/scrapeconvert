import type { ConvertOptions } from '../types';

// Heuristic output-size estimate. Output size is unknowable without actually
// encoding, so the totals bar says "estimated". This applies a format/quality
// compression ratio, then an area-based resize factor when max dimensions are
// set. It is an estimate, not a measurement.
const BASE_RATIO: Record<ConvertOptions['format'], number> = {
  avif: 0.25,
  webp: 0.35,
  jpeg: 0.5,
  png: 0.9,
};

const RESIZE_REF = 1920; // assumed typical source long edge for the resize heuristic

export function estimateSize(originalBytes: number, opts: ConvertOptions): number {
  if (originalBytes <= 0) return 0;
  const base = BASE_RATIO[opts.format] ?? 0.5;
  const q = Math.min(100, Math.max(10, opts.quality)) / 100;
  // Lower quality -> smaller (monotonic): scale the ratio between 40% and 100%.
  const ratio = base * (0.4 + 0.6 * q);

  let resizeFactor = 1;
  const dims = [opts.maxWidth, opts.maxHeight].filter((d): d is number => typeof d === 'number' && d > 0);
  if (dims.length > 0) {
    const linear = Math.min(1, Math.min(...dims) / RESIZE_REF);
    resizeFactor = linear * linear; // area scales with the square of the linear factor
  }

  return Math.max(1, Math.round(originalBytes * ratio * resizeFactor));
}
