import { fetchViaProxy } from './proxy-client';

// Dimensions come from the thumbnail's own load (naturalWidth/Height), no proxy.
// A failed thumbnail (hotlink/CORP/referrer) has naturalWidth 0 -> return
// undefined so dedupe excludes it (spec §5.4 placeholder-and-exclude).
export function captureDimensions(img: HTMLImageElement): { width: number; height: number } | undefined {
  if (!img.naturalWidth || !img.naturalHeight) return undefined;
  return { width: img.naturalWidth, height: img.naturalHeight };
}

// Byte size from the thumbnail GET the browser already made (Performance
// Resource Timing). No extra network.
export function readTransferSize(url: string): number | undefined {
  if (typeof performance === 'undefined' || typeof performance.getEntriesByName !== 'function') return undefined;
  const entries = performance.getEntriesByName(url) as PerformanceResourceTiming[];
  const last = entries[entries.length - 1];
  const size = last?.transferSize;
  return typeof size === 'number' && size > 0 ? size : undefined;
}

// Fallback only: ask the proxy for the bytes and read content-length, cancelling
// the body so we do not buffer the whole image. This costs egress (documented);
// use it only when transferSize is unavailable and dedupe needs the size.
export async function headSizeViaProxy(url: string): Promise<number | undefined> {
  try {
    const res = await fetchViaProxy(url, 'image');
    const len = Number(res.headers.get('content-length'));
    res.body?.cancel().catch(() => {});
    return Number.isFinite(len) && len > 0 ? len : undefined;
  } catch {
    return undefined;
  }
}
