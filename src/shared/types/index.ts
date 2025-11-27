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
  keptOriginal?: boolean; // True when converted file was larger than original
}

export interface ScrapedImage {
  id: string;
  url: string;
  alt: string;
  name: string;
  format: string;
  width?: number;
  height?: number;
  size?: number;
  selected: boolean;
}

export interface ConversionSettings {
  format: ConversionFormat;
  quality: number;
  maxWidth: number;
  maxHeight: number;
  maintainAspectRatio: boolean;
}
