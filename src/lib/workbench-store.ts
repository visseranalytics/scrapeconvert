import type { ScrapedImage, ConvertOptions } from './types';

export const DEFAULT_CONVERT_OPTIONS: ConvertOptions = {
  format: 'webp',
  quality: 80,
  keepAspect: true,
  stripExif: true,
  removeColorProfile: false,
};

export interface WorkbenchData {
  images: ScrapedImage[];
  options: ConvertOptions;
  source?: string;
}

const KEY = 'sc.workbench';

// Scraper and Workbench are separate Astro routes/islands, so the scrape result
// + settings are handed off via sessionStorage. Only metadata is persisted, never
// image blobs (memory/quota); bytes are re-fetched at convert time.
export function saveWorkbench(data: WorkbenchData): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable; caller keeps in-memory state */
  }
}

export function loadWorkbench(): WorkbenchData | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WorkbenchData) : null;
  } catch {
    return null;
  }
}

export function selectAll(images: ScrapedImage[], selected: boolean): void {
  for (const i of images) i.selected = selected;
}

export function toggleSelect(images: ScrapedImage[], id: string): void {
  const i = images.find((x) => x.id === id);
  if (i) i.selected = !i.selected;
}

export function countSelected(images: ScrapedImage[]): number {
  return images.reduce((n, i) => (i.selected ? n + 1 : n), 0);
}

export function visibleImages(images: ScrapedImage[], hideDuplicates: boolean): ScrapedImage[] {
  return hideDuplicates ? images.filter((i) => !i.isDuplicate) : images;
}
