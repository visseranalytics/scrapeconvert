
import React, { useState, useMemo } from 'react';
import { ScrapedImage } from '../types';
import { processUrlInput, getFileSize } from '../services/scraperService';
import { formatBytes } from '../services/imageUtils';

interface UrlScraperProps {
  onImagesSelected: (images: ScrapedImage[]) => Promise<void> | void;
}

type SortOption = 'name' | 'size-desc' | 'size-asc' | 'bytes-desc';

const UrlScraper: React.FC<UrlScraperProps> = ({ onImagesSelected }) => {
  // State
  const [inputUrl, setInputUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [scrapedImages, setScrapedImages] = useState<ScrapedImage[]>([]);
  
  // Filters & Settings
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('size-desc');
  const [selectedFormat, setSelectedFormat] = useState<string>('ALL');
  const [invertPreviewBg, setInvertPreviewBg] = useState(false);
  const [domainName, setDomainName] = useState<string>('');

  // Handle image load to update dimensions for sorting
  const handleImageLoad = (id: string, width: number, height: number) => {
    setScrapedImages(prev => prev.map(img => 
      img.id === id ? { ...img, width, height } : img
    ));
  };
  
  // Update file size state
  const handleSizeLoad = (id: string, size: number) => {
      setScrapedImages(prev => prev.map(img => 
        img.id === id ? { ...img, size } : img
      ));
  };

  const handleScrape = async () => {
    if (!inputUrl.trim()) return;
    
    setIsLoading(true);
    // Don't show results immediately, wait for processing to start or finish to avoid flash
    setScrapedImages([]);
    setDomainName(inputUrl); // Simple domain display
    
    try {
      const urlObject = new URL(inputUrl.startsWith('http') ? inputUrl : `https://${inputUrl}`);
      setDomainName(urlObject.hostname);
    } catch {}

    try {
      const images = await processUrlInput(inputUrl);
      setScrapedImages(images.map(img => ({ ...img, selected: true })));
      setShowResults(true);
    } catch (error) {
      console.error('Scraping failed', error);
      alert('Failed to scrape the provided URL(s). Please check them and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // derived data
  const formats = useMemo(() => {
    const counts: Record<string, number> = {};
    scrapedImages.forEach(img => {
      const fmt = img.format || 'UNKNOWN';
      counts[fmt] = (counts[fmt] || 0) + 1;
    });
    return counts;
  }, [scrapedImages]);

  const filteredImages = useMemo(() => {
    let result = scrapedImages;

    // Filter by Search
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(img => 
        img.name.toLowerCase().includes(lowerQuery) || 
        img.alt.toLowerCase().includes(lowerQuery)
      );
    }

    // Filter by Format
    if (selectedFormat !== 'ALL') {
      result = result.filter(img => img.format === selectedFormat);
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      
      // Dimensions sorting
      const areaA = (a.width || 0) * (a.height || 0);
      const areaB = (b.width || 0) * (b.height || 0);
      
      if (sortBy === 'size-desc') return areaB - areaA;
      if (sortBy === 'size-asc') return areaA - areaB;
      
      // File Size sorting
      if (sortBy === 'bytes-desc') return (b.size || 0) - (a.size || 0);

      return 0;
    });

    return result;
  }, [scrapedImages, searchQuery, selectedFormat, sortBy]);

  const selectedCount = scrapedImages.filter(img => img.selected).length;
  
  // Actions
  const toggleSelection = (id: string) => {
    setScrapedImages(prev => prev.map(img => 
      img.id === id ? { ...img, selected: !img.selected } : img
    ));
  };

  const selectAll = () => {
    const visibleIds = new Set(filteredImages.map(img => img.id));
    setScrapedImages(prev => prev.map(img => 
      visibleIds.has(img.id) ? { ...img, selected: true } : img
    ));
  };

  const deselectAll = () => {
    const visibleIds = new Set(filteredImages.map(img => img.id));
    setScrapedImages(prev => prev.map(img => 
      visibleIds.has(img.id) ? { ...img, selected: false } : img
    ));
  };

  const handleSmartDeduplicate = () => {
      // Group by name (stem), then find max resolution
      const groups: Record<string, ScrapedImage[]> = {};
      
      scrapedImages.forEach(img => {
          const key = img.name; 
          if (!groups[key]) groups[key] = [];
          groups[key].push(img);
      });

      const uniqueIds = new Set<string>();

      Object.values(groups).forEach(group => {
          if (group.length === 1) {
              uniqueIds.add(group[0].id);
          } else {
              // Find max area
              let best = group[0];
              let maxArea = (best.width || 0) * (best.height || 0);

              for (let i = 1; i < group.length; i++) {
                  const current = group[i];
                  const area = (current.width || 0) * (current.height || 0);
                  if (area > maxArea) {
                      maxArea = area;
                      best = current;
                  }
              }
              uniqueIds.add(best.id);
          }
      });

      // Filter state to only include these IDs
      setScrapedImages(prev => prev.filter(img => uniqueIds.has(img.id)));
      
      const removedCount = scrapedImages.length - uniqueIds.size;
      if (removedCount > 0) {
          alert(`Removed ${removedCount} duplicate/lower-quality images.`);
      } else {
          alert('No duplicates found.');
      }
  };

  const handleCopyUrls = () => {
    const urls = scrapedImages.filter(img => img.selected).map(img => img.url).join('\n');
    navigator.clipboard.writeText(urls);
    alert(`Copied ${selectedCount} URLs to clipboard`);
  };

  const handleProcess = async () => {
    const selected = scrapedImages.filter(img => img.selected);
    if (selected.length === 0) return;

    setIsProcessing(true);
    try {
      await onImagesSelected(selected);
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
    }
  };

  // --- RENDER INPUT HERO ---
  
  if (!showResults) {
    return (
      <div className="relative w-full py-16 px-4 md:px-8 flex flex-col items-center justify-center min-h-[80vh] overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
          <div className="absolute top-10 left-0 w-72 h-72 bg-primary/10 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-10 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-[120px]"></div>
        </div>

        <div className="relative z-10 w-full max-w-4xl mx-auto text-center">
            
            <div className="mb-10">
                <h1 className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 mb-6 tracking-tight">
                   Universal Image Extractor
                </h1>
                <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
                   Input one or more URLs to instantly scrape, filter, and batch download high-quality assets from any website.
                </p>
            </div>

            {/* Input Card */}
            <div className="bg-surface/50 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl mb-12">
               <div className="bg-dark/50 rounded-xl p-4 md:p-6 border border-white/5">
                 <div className="flex flex-col gap-4">
                    <div className="relative">
                        <textarea
                           value={inputUrl}
                           onChange={(e) => setInputUrl(e.target.value)}
                           placeholder="https://example.com/gallery&#10;https://unsplash.com/s/photos/tech"
                           className="w-full h-32 bg-dark border border-slate-700 rounded-xl p-4 text-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none font-mono text-sm shadow-inner placeholder:text-slate-600"
                         />
                         <div className="absolute bottom-3 right-3 text-[10px] text-slate-500 bg-dark px-2 py-1 rounded border border-slate-800">
                            Support multiple URLs
                         </div>
                    </div>
                    
                    <button
                       onClick={handleScrape}
                       disabled={isLoading || !inputUrl.trim()}
                       className="w-full py-4 bg-primary hover:bg-primaryDark text-white font-bold rounded-xl transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transform active:scale-[0.99] group"
                    >
                       {isLoading ? (
                         <>
                           <div className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                           <span>Analyzing Websites...</span>
                         </>
                       ) : (
                         <>
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white/80 group-hover:text-white transition-colors" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                           </svg>
                           <span>Start Extraction</span>
                         </>
                       )}
                    </button>
                 </div>
               </div>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
               {[
                 { 
                   icon: (
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                     </svg>
                   ),
                   title: "Intelligent Scraping", 
                   desc: "Automatically detects images hidden in CSS backgrounds and deeply nested structures." 
                 },
                 { 
                    icon: (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ),
                    title: "Smart Deduplication", 
                    desc: "Identifies duplicate filenames and automatically preserves the highest resolution version." 
                 },
                 { 
                    icon: (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    ),
                    title: "Batch Export", 
                    desc: "Seamlessly send hundreds of images to the converter or download them directly as a ZIP." 
                 }
               ].map((item, i) => (
                 <div key={i} className="p-6 rounded-2xl bg-surface/30 border border-slate-700/50 hover:bg-surface/50 transition-colors backdrop-blur-sm">
                   <div className="mb-4 bg-dark/50 w-12 h-12 rounded-lg flex items-center justify-center border border-white/5 shadow-inner">
                      {item.icon}
                   </div>
                   <h3 className="text-white font-bold mb-2 text-lg">{item.title}</h3>
                   <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                 </div>
               ))}
            </div>

        </div>
      </div>
    );
  }

  // --- RENDER RESULTS UI ---

  return (
    <div className="w-full max-w-[95%] mx-auto px-4 md:px-6 py-6 flex flex-col lg:flex-row gap-6 h-[calc(100vh-100px)]">
      
      {/* SIDEBAR */}
      <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2 pb-10">
        
        <button 
          onClick={() => setShowResults(false)}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
        >
          <div className="p-1 rounded-md bg-surface group-hover:bg-slate-700 transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
             </svg>
          </div>
          <span className="font-medium text-sm">New Extraction</span>
        </button>

        <div className="p-4 bg-surface rounded-xl border border-slate-700/50 shadow-lg flex flex-col gap-6">
            
            {/* 1. Sort */}
            <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sort Order</label>
            <div className="relative">
                <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full h-10 pl-3 pr-8 bg-dark border border-slate-700 rounded-lg text-sm text-slate-300 focus:border-primary outline-none appearance-none font-medium"
                >
                <option value="size-desc">Size (Big → Small)</option>
                <option value="size-asc">Size (Small → Big)</option>
                <option value="bytes-desc">File Size (Heavy → Light)</option>
                <option value="name">Name (A-Z)</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                </div>
            </div>
            </div>

            {/* 2. Filter by Type */}
            <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">File Types</label>
            <div className="flex flex-wrap gap-2">
                <button
                onClick={() => setSelectedFormat('ALL')}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all border shadow-sm ${selectedFormat === 'ALL' ? 'bg-white text-dark border-white scale-105' : 'bg-dark text-slate-400 border-slate-700 hover:border-slate-500'}`}
                >
                ALL
                </button>
                {Object.entries(formats).map(([fmt, count]) => (
                <button
                    key={fmt}
                    onClick={() => setSelectedFormat(fmt)}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all border uppercase shadow-sm
                    ${selectedFormat === fmt 
                        ? 'bg-primary text-white border-primary scale-105' 
                        : getFormatColor(fmt)
                    }
                    `}
                >
                    {fmt} <span className="opacity-70 ml-0.5">({count})</span>
                </button>
                ))}
            </div>
            </div>

            {/* 3. Search */}
            <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filter Results</label>
            <div className="relative">
                <input 
                    type="text" 
                    placeholder="Search filename..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 bg-dark border border-slate-700 rounded-lg text-sm text-slate-300 focus:border-primary outline-none placeholder:text-slate-600"
                />
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>
            </div>

             {/* 3.5 Deduplicate */}
            <div className="pt-2">
                <button
                    onClick={handleSmartDeduplicate}
                    className="w-full py-2.5 bg-dark hover:bg-slate-700 border border-slate-700 hover:border-secondary/50 rounded-lg text-xs font-bold text-secondary transition-all flex items-center justify-center gap-2 group"
                    title="Keeps only the largest image if multiple have the same filename"
                >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                Smart Deduplicate
                </button>
            </div>
        </div>

        {/* 4. Invert BG */}
        <label className="flex items-center gap-3 cursor-pointer group px-1">
           <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${invertPreviewBg ? 'bg-primary border-primary' : 'border-slate-600 bg-dark'}`}>
              {invertPreviewBg && <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
           </div>
           <input type="checkbox" className="hidden" checked={invertPreviewBg} onChange={(e) => setInvertPreviewBg(e.target.checked)} />
           <span className="text-sm font-medium text-slate-300 group-hover:text-white">Invert image preview background</span>
        </label>

        {/* 5. Download / Actions */}
        <div className="space-y-4 pt-4 border-t border-slate-700/50">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bulk Actions</label>
          
          <div className="flex gap-2">
            <button onClick={selectAll} className="flex-1 py-2 bg-surface hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 transition-colors flex items-center justify-center gap-2">
               All
            </button>
            <button onClick={deselectAll} className="flex-1 py-2 bg-surface hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 transition-colors flex items-center justify-center gap-2">
               None
            </button>
          </div>

          <button
             onClick={handleProcess}
             disabled={selectedCount === 0 || isProcessing}
             className={`w-full py-3 rounded-xl font-bold text-sm shadow-lg transition-all transform active:translate-y-0.5 flex items-center justify-center gap-2
               ${selectedCount > 0 && !isProcessing
                 ? 'bg-primary hover:bg-primaryDark text-white shadow-primary/20' 
                 : 'bg-slate-700 text-slate-400 cursor-not-allowed'
               }`}
          >
             {isProcessing ? (
                <>
                   <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                   <span>Processing...</span>
                </>
             ) : (
                <>
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 rotate-90" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                   </svg>
                   <span>Send to Converter</span>
                </>
             )}
          </button>

          <button
             onClick={handleCopyUrls}
             disabled={selectedCount === 0}
             className="w-full py-3 bg-surface hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-bold text-slate-300 transition-colors flex items-center justify-center gap-2"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
             </svg>
             Copy URLs
          </button>
        </div>

      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 bg-dark/30 rounded-2xl border border-white/5 overflow-hidden">
        
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-surface/30 backdrop-blur-md">
          <h2 className="text-base font-medium text-slate-200">
            Found <span className="font-bold text-white">{filteredImages.length}</span> images
          </h2>
          <div className="flex items-center gap-4">
             <div className="hidden sm:block text-xs text-slate-400 font-mono bg-dark/50 px-2 py-1 rounded border border-white/5">
                {domainName}
             </div>
             <div className="h-4 w-px bg-slate-700 hidden sm:block"></div>
             <span className="text-xs font-bold text-primary">{selectedCount} Selected</span>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-dark/20">
           {filteredImages.length > 0 ? (
             <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
               {filteredImages.map(img => (
                 <ImageResultCard 
                    key={img.id} 
                    image={img} 
                    invertBg={invertPreviewBg}
                    onToggle={() => toggleSelection(img.id)}
                    onLoad={handleImageLoad}
                    onSizeCheck={handleSizeLoad}
                 />
               ))}
             </div>
           ) : (
             <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60 gap-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p>No images found matching your filter</p>
             </div>
           )}
        </div>

      </div>
    </div>
  );
};

// Helper for format badge colors
const getFormatColor = (fmt: string) => {
  switch (fmt) {
    case 'PNG': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    case 'JPG': case 'JPEG': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    case 'WEBP': return 'bg-pink-500/10 text-pink-500 border-pink-500/20';
    case 'SVG': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    default: return 'bg-slate-700 text-slate-400 border-slate-600';
  }
};

interface ImageResultCardProps {
  image: ScrapedImage;
  invertBg: boolean;
  onToggle: () => void;
  onLoad: (id: string, w: number, h: number) => void;
  onSizeCheck: (id: string, size: number) => void;
}

const ImageResultCard: React.FC<ImageResultCardProps> = ({ image, invertBg, onToggle, onLoad, onSizeCheck }) => {
  const [loaded, setLoaded] = useState(false);
  
  // Use constant Base64 strings for the backgrounds to avoid Tailwind arbitrary value parsing issues
  const lightBg = 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNMCAwSDRWNEgwVjB6TTQgNEg4VjhINFY0eiIgZmlsbD0iI2VlZSIvPjwvc3ZnPg==")';
  const darkBg = 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiMxZTI5M2IiLz48cGF0aCBkPSJNMCAwSDRWNEgwVjB6TTQgNEg4VjhINFY0eiIgZmlsbD0iIzMzNDE1NSIvPjwvc3ZnPg==")';

  // Check size when mounted
  React.useEffect(() => {
     let isActive = true;
     // Only check if we don't have it yet to save bandwidth, 
     // but since we usually scrape new images, we check.
     if (image.size === undefined) {
         getFileSize(image.url).then(size => {
             if (isActive && size > 0) onSizeCheck(image.id, size);
         });
     }
     return () => { isActive = false; };
  }, [image.url, image.id]);

  return (
    <div 
      className={`
        relative rounded-xl border-2 transition-all duration-200 overflow-hidden bg-surface group flex flex-col shadow-sm
        ${image.selected ? 'border-slate-600 shadow-xl shadow-primary/20' : 'border-slate-800/50 hover:border-slate-600 hover:shadow-md'}
      `}
    >
      {/* Image Area */}
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

      {/* Info Footer */}
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

export default UrlScraper;
