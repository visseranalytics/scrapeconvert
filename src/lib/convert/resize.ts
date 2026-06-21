import type { ConvertOptions } from '../types';

// Pure target-dimension math: proportional max-W/max-H, never upscaling.
// keepAspect=true scales both axes by one factor; keepAspect=false clamps each
// axis independently. This is the unit-tested core of resize.
export function computeTargetSize(
  srcW: number,
  srcH: number,
  opts: Pick<ConvertOptions, 'maxWidth' | 'maxHeight' | 'keepAspect'>,
): { width: number; height: number } {
  let w = srcW;
  let h = srcH;
  const maxW = opts.maxWidth;
  const maxH = opts.maxHeight;
  if (opts.keepAspect) {
    let scale = 1;
    if (maxW && w > maxW) scale = Math.min(scale, maxW / w);
    if (maxH && h > maxH) scale = Math.min(scale, maxH / h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  } else {
    if (maxW && w > maxW) w = maxW;
    if (maxH && h > maxH) h = maxH;
  }
  return { width: Math.max(1, w), height: Math.max(1, h) };
}

// Browser-only: decode a Blob, resize to the computed target, and return
// ImageData. Drawing to a canvas inherently drops EXIF (satisfies stripExif).
// For JPEG (no alpha) the canvas is filled white first so transparency does not
// become black. jsdom has no canvas, so this is verified in a real browser; the
// pure dimension math above is unit-tested.
export async function decodeAndResize(blob: Blob, opts: ConvertOptions): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  const { width, height } = computeTargetSize(bitmap.width, bitmap.height, opts);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { colorSpace: opts.removeColorProfile ? 'srgb' : undefined });
  if (!ctx) throw new Error('no-2d-context');
  if (opts.format === 'jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  return ctx.getImageData(0, 0, width, height);
}
