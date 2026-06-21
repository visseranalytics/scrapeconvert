import { describe, it, expect } from 'vitest';
import { safeThumbnailUrls } from './safe-thumbnails';
import type { ScrapedImage } from './types';

const img = (url: string): ScrapedImage => ({ id: url, url, alt: '', name: 'n', format: 'PNG', selected: false });

describe('safeThumbnailUrls', () => {
  it('drops localhost / private-IP / credentialed / non-http(s) image URLs', () => {
    const input = [
      img('https://cdn.example.com/a.png'),
      img('http://localhost/secret.png'),
      img('http://169.254.169.254/meta.png'),
      img('http://192.168.1.1/router.png'),
      img('https://user:pass@example.com/creds.png'),
      img('ftp://example.com/x.png'),
      img('https://ok.example.com/b.jpg'),
    ];
    const out = safeThumbnailUrls(input).map((i) => i.url);
    expect(out).toEqual(['https://cdn.example.com/a.png', 'https://ok.example.com/b.jpg']);
  });

  it('keeps ordinary public https/http URLs', () => {
    const input = [img('https://a.com/1.png'), img('http://b.com/2.png')];
    expect(safeThumbnailUrls(input)).toHaveLength(2);
  });
});
