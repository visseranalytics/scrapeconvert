export enum ConversionFormat {
  JPEG = 'image/jpeg',
  PNG = 'image/png',
  WEBP = 'image/webp',
}

export interface ImageFile {
  id: string;
  file: File;
  previewUrl: string;
  originalWidth: number;
  originalHeight: number;
  status: 'idle' | 'processing' | 'done' | 'error';
  resultUrl?: string;
  resultSize?: number;
  outputFormat?: ConversionFormat;
  errorMsg?: string;
}

export interface ScrapedImage {
  id: string;
  url: string;
  alt: string;
  name: string;
  width?: number;
  height?: number;
  selected: boolean;
}

export interface ConversionSettings {
  format: ConversionFormat;
  quality: number; // 0-100
  maxWidth: number;
  maxHeight: number;
  maintainAspectRatio: boolean;
}