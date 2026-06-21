import type { ScrapedImage, ConvertOptions } from './types';

type Format = ConvertOptions['format'];

const EXT: Record<Format, string> = { avif: 'avif', webp: 'webp', png: 'png', jpeg: 'jpg' };
const MIME: Record<Format, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  png: 'image/png',
  jpeg: 'image/jpeg',
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function baseName(img: ScrapedImage): string {
  const raw = img.name || img.url;
  const last = raw.split(/[#?]/)[0].split('/').pop() || 'image';
  const dot = last.lastIndexOf('.');
  return dot > 0 ? last.slice(0, dot) : last;
}

// Build a production-ready <picture>: AVIF source, then WebP source (when those
// formats are requested), then an <img> fallback (jpeg preferred, else png).
// Extensions are derived from the chosen formats, not the source format.
export function pictureSnippet(img: ScrapedImage, formats: Format[]): string {
  const base = baseName(img);
  const alt = escapeHtml(img.alt || '');
  const lines: string[] = ['<picture>'];
  if (formats.includes('avif')) lines.push(`  <source srcset="${base}.${EXT.avif}" type="${MIME.avif}" />`);
  if (formats.includes('webp')) lines.push(`  <source srcset="${base}.${EXT.webp}" type="${MIME.webp}" />`);
  const fallback: Format = formats.includes('jpeg') ? 'jpeg' : formats.includes('png') ? 'png' : 'jpeg';
  lines.push(`  <img src="${base}.${EXT[fallback]}" alt="${alt}" />`);
  lines.push('</picture>');
  return lines.join('\n');
}
