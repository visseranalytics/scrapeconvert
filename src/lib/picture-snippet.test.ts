import { describe, it, expect } from 'vitest';
import { pictureSnippet } from './picture-snippet';
import type { ScrapedImage } from './types';

const img: ScrapedImage = {
  id: '1',
  url: 'https://example.com/photos/hero.png',
  alt: 'A "great" sunset <hero>',
  name: 'hero.png',
  format: 'PNG',
  selected: true,
};

describe('pictureSnippet', () => {
  it('emits AVIF and WebP sources plus an img fallback', () => {
    const out = pictureSnippet(img, ['avif', 'webp', 'jpeg']);
    expect(out).toContain('type="image/avif"');
    expect(out).toContain('type="image/webp"');
    expect(out).toContain('<img src="hero.jpg"');
    expect(out).toContain('</picture>');
  });

  it('orders avif before webp before img', () => {
    const out = pictureSnippet(img, ['avif', 'webp', 'jpeg']);
    const ai = out.indexOf('image/avif');
    const wi = out.indexOf('image/webp');
    const ii = out.indexOf('<img');
    expect(ai).toBeLessThan(wi);
    expect(wi).toBeLessThan(ii);
  });

  it('uses the image base name with the right extension per source', () => {
    const out = pictureSnippet(img, ['avif', 'webp']);
    expect(out).toContain('srcset="hero.avif"');
    expect(out).toContain('srcset="hero.webp"');
  });

  it('escapes alt text', () => {
    const out = pictureSnippet(img, ['webp']);
    expect(out).toContain('alt="A &quot;great&quot; sunset &lt;hero&gt;"');
  });

  it('omits a source when its format is not requested', () => {
    const out = pictureSnippet(img, ['webp', 'jpeg']);
    expect(out).not.toContain('image/avif');
    expect(out).toContain('image/webp');
  });

  it('always includes a fallback img even with only sources requested', () => {
    const out = pictureSnippet(img, ['avif', 'webp']);
    expect(out).toMatch(/<img src="hero\.(jpg|png)"/);
  });
});
