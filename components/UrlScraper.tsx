import React, { useState, useMemo } from 'react';
import { ScrapedImage } from '../types';
import { processUrlInput } from '../services/scraperService';

interface UrlScraperProps {
  onImagesSelected: (images: ScrapedImage[]) => Promise<void> | void;
}

const UrlScraper: React.FC<UrlScraperProps> = ({ onImagesSelected }) => {
  const [inputUrl, setInputUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scrapedImages, setScrapedImages] = useState<ScrapedImage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);

  const handleScrape = async () => {
    if (!inputUrl.trim()) return;
    
    setIsLoading(true);
    setShowResults(true);
    setScrapedImages([]);
    
    try {
      const images = await processUrlInput(inputUrl);
      setScrapedImages(images.map(img => ({ ...img, selected: true })));
    } catch (error) {
      console.error('Scraping failed', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredImages = useMemo(() => {
    if (!searchQuery) return scrapedImages;
    const lowerQuery = searchQuery.toLowerCase();
    return scrapedImages.filter(img => 
      img.name.toLowerCase().includes(lowerQuery) || 
      img.alt.toLowerCase().includes(lowerQuery)
    );
  }, [scrapedImages, searchQuery]);

  const toggleSelection = (id: string) => {
    setScrapedImages(prev => prev.map(img => 
      img.id === id ? { ...img, selected: !img.selected } : img
    ));
  };

  const toggleAll = () => {
    const allSelected = filteredImages.every(img => img.selected);
    setScrapedImages(prev => prev.map(img => {
      // Only affect visible images
      if (filteredImages.find(fi => fi.id === img.id)) {
        return { ...img, selected: !allSelected };
      }
      return img;
    }));
  };

  const handleAddSelected = async () => {
    const selected = scrapedImages.filter(img => img.selected);
    if (selected.length === 0) return;

    setIsProcessing(true);
    try {
      await onImagesSelected(selected);
      // Reset after adding (component might unmount, but safe to reset if it doesn't)
      setInputUrl('');
      setShowResults(false);
      setScrapedImages([]);
    } catch (e) {
      console.error("Failed to add selected images", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedCount = scrapedImages.filter(img => img.selected).length;

  return (
    <div className="w-full space-y-6">
      {!showResults ? (
        <div className="bg-surface/50 border border-slate-700/50 rounded-xl p-6 md:p-8">
           <div className="flex flex-col gap-4">
             <div className="flex items-center gap-2 mb-2">
                <span className="p-2 bg-secondary/10 text-secondary rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                </span>
                <h3 className="text-lg font-semibold text-white">Extract Images from Web</h3>
             </div>
             <textarea
               value={inputUrl}
               onChange={(e) => setInputUrl(e.target.value)}
               placeholder="Enter website URL(s) or direct image links here... (one per line)"
               className="w-full h-32 bg-dark/50 border border-slate-600 rounded-xl p-4 text-slate-200 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors resize-none font-mono text-sm"
             />
             <div className="flex justify-end">
               <button
                 onClick={handleScrape}
                 disabled={isLoading || !inputUrl.trim()}
                 className="px-6 py-2.5 bg-secondary hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-secondary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
               >
                 {isLoading ? 'Scanning...' : 'Find Images'}
               </button>
             </div>
           </div>
        </div>
      ) : (
        <div className="bg-surface/50 border border-slate-700/50 rounded-xl p-6 min-h-[500px] flex flex-col">
          {/* Header */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6 pb-6 border-b border-slate-700/50">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <button 
                onClick={() => setShowResults(false)} 
                className="text-slate-400 hover:text-white"
                disabled={isProcessing}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h3 className="font-bold text-white text-lg">Found {scrapedImages.length} Images</h3>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <input
                  type="text"
                  placeholder="Filter by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={isProcessing}
                  className="w-full bg-dark/50 border border-slate-600 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:border-secondary outline-none disabled:opacity-50"
                />
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <button 
                onClick={toggleAll}
                disabled={isProcessing}
                className="px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-dark/50 border border-slate-600 rounded-lg disabled:opacity-50"
              >
                {filteredImages.every(i => i.selected) ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>

          {/* Grid Container */}
          <div className="flex-1 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar relative">
            
            {/* Loading Overlay */}
            {isLoading && (
               <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/80 z-20 backdrop-blur-sm transition-all duration-300 rounded-lg">
                 <div className="flex flex-col items-center gap-4 p-8">
                    <div className="h-12 w-12 rounded-full border-4 border-slate-700 border-t-secondary animate-spin"></div>
                    <div className="text-center">
                        <p className="font-bold text-white text-lg">Scanning Source...</p>
                        <p className="text-slate-400 text-sm mt-1">Analyzing HTML and extracting assets</p>
                    </div>
                 </div>
               </div>
            )}

            {!isLoading && filteredImages.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredImages.map((img) => (
                  <div 
                    key={img.id}
                    onClick={() => !isProcessing && toggleSelection(img.id)}
                    className={`
                      group relative aspect-square rounded-lg border-2 overflow-hidden transition-all
                      ${img.selected ? 'border-secondary ring-2 ring-secondary/30' : 'border-slate-700 hover:border-slate-500'}
                      ${isProcessing ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}
                    `}
                  >
                    <img 
                      src={img.url} 
                      alt={img.alt} 
                      className="w-full h-full object-cover bg-black/20"
                      onError={(e) => {
                         (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNDc1NTY5IiBzdHJva2Utd2lkdGg9IjIiPjxyZWN0IHg9IjMiIHk9IjMiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgcng9IjIiIHJ5PSIyIi8+PGNpcmNsZSBjeD0iOC41IiBjeT0iOC41IiByPSIxLjUiLz48cG9seWxpbmUgcG9pbnRzPSIyMSAxNSAxNiAxMCA1IDIxIi8+PC9zdmc+';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                       <p className="text-xs text-white truncate font-medium">{img.name}</p>
                       <p className="text-[10px] text-slate-300 truncate">{img.alt}</p>
                    </div>
                    {img.selected && (
                      <div className="absolute top-2 right-2 bg-secondary text-white rounded-full p-1 shadow-md">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : !isLoading && (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-lg font-medium">No images found</p>
                <p className="text-sm">Try checking your filter or the URL</p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="mt-6 pt-4 border-t border-slate-700/50 flex justify-between items-center">
            <span className="text-sm text-slate-400">
              {selectedCount} selected
            </span>
            <button
              onClick={handleAddSelected}
              disabled={selectedCount === 0 || isProcessing}
              className={`
                 px-8 py-3 font-bold rounded-xl transition-all shadow-lg flex items-center gap-2
                 ${selectedCount === 0 || isProcessing
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed shadow-none' 
                    : 'bg-primary hover:bg-primaryDark text-white shadow-primary/20 hover:shadow-primary/40 transform active:scale-95'
                 }
              `}
            >
              {isProcessing && (
                  <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
              )}
              {isProcessing ? 'Downloading...' : 'Add to Converter'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UrlScraper;