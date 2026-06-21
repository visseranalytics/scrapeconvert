// Shared types (SHARED INTERFACE CONTRACT). Imported across phases; do not rename.

export interface ScrapedImage {
  id: string;
  url: string;
  alt: string;
  name: string;
  format: string;
  size?: number;
  width?: number;
  height?: number;
  selected: boolean;
  isDuplicate?: boolean;
  sourcePageUrl?: string;
  sourcePageTitle?: string;
}

export interface ConvertOptions {
  format: 'webp' | 'avif' | 'png' | 'jpeg';
  quality: number;
  maxWidth?: number;
  maxHeight?: number;
  keepAspect: boolean;
  stripExif: boolean;
  removeColorProfile: boolean;
}
