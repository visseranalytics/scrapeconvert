import { describe, it, expect } from 'vitest';
import { estimateSize } from './estimate';
import type { ConvertOptions } from '../types';

function opts(over: Partial<ConvertOptions>): ConvertOptions {
  return { format: 'webp', quality: 80, keepAspect: true, stripExif: true, removeColorProfile: false, ...over };
}

describe('estimateSize', () => {
  it('returns a smaller number for lower quality', () => {
    const hi = estimateSize(1_000_000, opts({ quality: 90 }));
    const lo = estimateSize(1_000_000, opts({ quality: 30 }));
    expect(lo).toBeLessThan(hi);
  });

  it('returns smaller for avif than webp at equal quality', () => {
    const avif = estimateSize(1_000_000, opts({ format: 'avif', quality: 80 }));
    const webp = estimateSize(1_000_000, opts({ format: 'webp', quality: 80 }));
    expect(avif).toBeLessThan(webp);
  });

  it('orders avif < webp < jpeg < png at equal quality', () => {
    const q = 80;
    const a = estimateSize(1_000_000, opts({ format: 'avif', quality: q }));
    const w = estimateSize(1_000_000, opts({ format: 'webp', quality: q }));
    const j = estimateSize(1_000_000, opts({ format: 'jpeg', quality: q }));
    const p = estimateSize(1_000_000, opts({ format: 'png', quality: q }));
    expect(a).toBeLessThan(w);
    expect(w).toBeLessThan(j);
    expect(j).toBeLessThan(p);
  });

  it('scales down when resize dimensions shrink the image', () => {
    const full = estimateSize(1_000_000, opts({}));
    const resized = estimateSize(1_000_000, opts({ maxWidth: 960 }));
    expect(resized).toBeLessThan(full);
  });

  it('never returns zero for a positive input and never exceeds the original', () => {
    const e = estimateSize(1000, opts({ format: 'png', quality: 100 }));
    expect(e).toBeGreaterThan(0);
    expect(e).toBeLessThanOrEqual(1000);
  });
});
