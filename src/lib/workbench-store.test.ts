// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveWorkbench, loadWorkbench, selectAll, toggleSelect, countSelected, visibleImages, DEFAULT_CONVERT_OPTIONS,
} from './workbench-store';
import type { ScrapedImage } from './types';

const mk = (id: string, over: Partial<ScrapedImage> = {}): ScrapedImage => ({
  id, url: 'https://e.com/' + id, alt: '', name: id, format: 'PNG', selected: false, ...over,
});

beforeEach(() => sessionStorage.clear());

describe('workbench store', () => {
  it('persists images + options and rehydrates them', () => {
    const data = { images: [mk('a'), mk('b')], options: DEFAULT_CONVERT_OPTIONS, source: 'https://e.com' };
    saveWorkbench(data);
    const back = loadWorkbench();
    expect(back?.images.map((i) => i.id)).toEqual(['a', 'b']);
    expect(back?.options.format).toBe('webp');
    expect(back?.source).toBe('https://e.com');
  });

  it('returns null when nothing is stored', () => {
    expect(loadWorkbench()).toBeNull();
  });

  it('selection helpers: select all, toggle, count', () => {
    const imgs = [mk('a'), mk('b'), mk('c')];
    selectAll(imgs, true);
    expect(countSelected(imgs)).toBe(3);
    toggleSelect(imgs, 'b');
    expect(countSelected(imgs)).toBe(2);
    expect(imgs.find((i) => i.id === 'b')?.selected).toBe(false);
  });

  it('hide-duplicates filter excludes flagged images', () => {
    const imgs = [mk('a'), mk('b', { isDuplicate: true }), mk('c')];
    expect(visibleImages(imgs, true).map((i) => i.id)).toEqual(['a', 'c']);
    expect(visibleImages(imgs, false)).toHaveLength(3);
  });

  it('never writes binary data to sessionStorage', () => {
    saveWorkbench({ images: [mk('a')], options: DEFAULT_CONVERT_OPTIONS });
    const raw = sessionStorage.getItem('sc.workbench') || '';
    expect(raw).not.toContain('Blob');
    expect(raw).not.toContain('ArrayBuffer');
  });
});
