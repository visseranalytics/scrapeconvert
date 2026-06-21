import type { ScrapedImage } from './types';

// Content-based duplicate flagging, keyed on (byte size + intrinsic dimensions),
// NOT on URL. The first occurrence of a key stays un-flagged; later matches are
// flagged. Images missing size OR dimensions are excluded (left un-flagged) per
// the placeholder-and-exclude fallback (spec ##5.4). Re-derives from scratch on
// every call so a late-arriving size can newly flag an image (progressive
// metadata) without leaving stale flags.
export function flagDuplicates(images: ScrapedImage[]): void {
  const seen = new Set<string>();
  for (const img of images) {
    if (img.size == null || img.width == null || img.height == null) {
      img.isDuplicate = false;
      continue;
    }
    const key = `${img.size}:${img.width}x${img.height}`;
    if (seen.has(key)) {
      img.isDuplicate = true;
    } else {
      seen.add(key);
      img.isDuplicate = false;
    }
  }
}
