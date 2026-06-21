import { describe, it, expect } from 'vitest';
import { flagDuplicates } from './dedupe';
import type { ScrapedImage } from './types';

function img(over: Partial<ScrapedImage>): ScrapedImage {
  return { id: Math.random().toString(36), url: 'https://x/' + Math.random(), alt: '', name: 'n', format: 'PNG', selected: false, ...over };
}

describe('flagDuplicates', () => {
  it('flags the second+ image sharing size and dimensions', () => {
    const a = img({ size: 100, width: 10, height: 10 });
    const b = img({ size: 100, width: 10, height: 10 });
    flagDuplicates([a, b]);
    expect(a.isDuplicate).toBe(false);
    expect(b.isDuplicate).toBe(true);
  });

  it('excludes images missing size or dimensions', () => {
    const a = img({ size: 100, width: 10 }); // no height
    const b = img({ width: 10, height: 10 }); // no size
    flagDuplicates([a, b]);
    expect(a.isDuplicate).toBe(false);
    expect(b.isDuplicate).toBe(false);
  });

  it('does not treat same size with different dimensions as duplicate', () => {
    const a = img({ size: 100, width: 10, height: 10 });
    const b = img({ size: 100, width: 20, height: 5 });
    flagDuplicates([a, b]);
    expect(a.isDuplicate).toBe(false);
    expect(b.isDuplicate).toBe(false);
  });

  it('is idempotent and re-derives on each call (progressive metadata)', () => {
    const a = img({ size: 100, width: 10, height: 10 });
    const b = img({ size: 100, width: 10, height: 10, isDuplicate: true });
    flagDuplicates([a, b]);
    flagDuplicates([a, b]);
    expect(a.isDuplicate).toBe(false);
    expect(b.isDuplicate).toBe(true);
    // a late-arriving size newly flags a previously-excluded image
    const c = img({ size: 100, width: 10, height: 10 });
    const d = img({ width: 10, height: 10 }); // no size yet -> excluded
    flagDuplicates([c, d]);
    expect(d.isDuplicate).toBe(false);
    d.size = 100;
    flagDuplicates([c, d]);
    expect(d.isDuplicate).toBe(true);
  });
});
