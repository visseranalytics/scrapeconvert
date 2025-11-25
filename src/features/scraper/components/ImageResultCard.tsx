import { useState, useEffect } from 'react';
import { ScrapedImage } from '@/shared/types';
import { formatBytes } from '@/shared/services/imageUtils';
import { getFileSize } from '../services/scraperService';

interface ImageResultCardProps {
  image: ScrapedImage;
  invertBg: boolean;
  onToggle: () => void;
  onLoad: (id: string, w: number, h: number) => void;
  onSizeCheck: (id: string, size: number) => void;
}

const ImageResultCard = ({ image, invertBg, onToggle, onLoad, onSizeCheck }: ImageResultCardProps) => {
  const [loaded, setLoaded] = useState(false);

  const lightBg = 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNMCAwSDRWNEgwVjB6TTQgNEg4VjhINFY0eiIgZmlsbD0iI2VlZSIvPjwvc3ZnPg==")';
  const darkBg = 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiMxZTI5M2IiLz48cGF0aCBkPSJNMCAwSDRWNEgwVjB6TTQgNEg4VjhINFY0eiIgZmlsbD0iIzMzNDE1NSIvPjwvc3ZnPg==")';

  useEffect(() => {
    let isActive = true;
    if (image.size === undefined) {
      getFileSize(image.url).then(size => {
        if (isActive && size > 0) onSizeCheck(image.id, size);
      });
    }
    return () => { isActive = false; };
  }, [image.url, image.id, image.size, onSizeCheck]);

  const getFormatColor = (fmt: string) => {
    switch (fmt) {
      case 'PNG': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'JPG': case 'JPEG': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'WEBP': return 'bg-pink-500/10 text-pink-500 border-pink-500/20';
      case 'SVG': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-slate-700 text-slate-400 border-slate-600';
    }
  };

  return (
    <div
      className={`
        relative rounded-xl border-2 transition-all duration-200 overflow-hidden bg-surface group flex flex-col shadow-sm
        ${image.selected ? 'border-slate-600 shadow-xl shadow-primary/20' : 'border-slate-800/50 hover:border-slate-600 hover:shadow-md'}
      `}
    >
      <div
        onClick={onToggle}
        className="relative cursor-pointer w-full aspect-[4/3] overflow-hidden transition-all duration-300"
        style={{ backgroundImage: invertBg ? lightBg : darkBg }}
      >
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface">
            <div className="h-5 w-5 rounded-full border-2 border-slate-700 border-t-slate-400 animate-spin"></div>
          </div>
        )}
        <img
          src={image.url}
          alt={image.alt}
          className={`w-full h-full object-contain p-2 transition-all duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} group-hover:scale-105`}
          onLoad={(e) => {
            setLoaded(true);
            const target = e.target as HTMLImageElement;
            onLoad(image.id, target.naturalWidth, target.naturalHeight);
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNDc1NTY5IiBzdHJva2Utd2lkdGg9IjIiPjxyZWN0IHg9IjMiIHk9IjMiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgcng9IjIiIHJ5PSIyIi8+PGNpcmNsZSBjeD0iOC41IiBjeT0iOC41IiByPSIxLjUiLz48cG9seWxpbmUgcG9pbnRzPSIyMSAxNSAxNiAxMCA1IDIxIi8+PC9zdmc+';
            setLoaded(true);
          }}
        />

        {image.selected && (
          <div className="absolute inset-0 pointer-events-none rounded-t-lg bg-primary/10">
            <div className="absolute top-2 left-2 bg-primary text-white rounded-full p-0.5 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 bg-surface border-t border-white/5 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold text-xs text-slate-200 truncate leading-tight select-all" title={image.name}>
            {image.name}
          </p>
          <a
            href={image.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-white transition-colors p-1 hover:bg-slate-700 rounded flex-shrink-0"
            title="Open Original Image"
            onClick={(e) => e.stopPropagation()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span className={`font-bold px-1 rounded uppercase border flex-shrink-0 ${getFormatColor(image.format)}`}>
            {image.format}
          </span>
          <span className="truncate font-mono">
            {image.width && image.height ? `${image.width} × ${image.height}` : '...'}
          </span>
          {image.size && (
            <span className="ml-auto font-mono text-slate-300">
              {formatBytes(image.size, 0)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageResultCard;
