import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { ScrapedImage, ImageFile } from '@/shared/types';
import { formatBytes, readFileAsDataURL, getImageDimensions } from '@/shared/services/imageUtils';
import { useAppContext } from '@/shared/context/AppContext';
import { processUrlInput, processSitemapInput, getFileSize, urlToFile, ScrapeProgress, ImageBatchCallback } from './services/scraperService';
import ImageResultCard from './components/ImageResultCard';

type SortOption = 'name' | 'size-desc' | 'size-asc' | 'bytes-desc';

const ScraperResultsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setConverterFiles } = useAppContext();

  const urlsParam = searchParams.get('urls') || '';
  const scrapeMode = searchParams.get('mode') || 'pages';
  const maxPages = parseInt(searchParams.get('max') || '50', 10);
  const initialSort = (searchParams.get('sort') as SortOption) || 'size-desc';
  const initialFormat = searchParams.get('format') || 'ALL';
  const initialSearch = searchParams.get('q') || '';

  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scrapedImages, setScrapedImages] = useState<ScrapedImage[]>([]);
  const [domainName, setDomainName] = useState<string>('');
  const [progress, setProgress] = useState<ScrapeProgress | null>(null);
  const [scrapeComplete, setScrapeComplete] = useState(false);

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [sortBy, setSortBy] = useState<SortOption>(initialSort);
  const [selectedFormat, setSelectedFormat] = useState<string>(initialFormat);
  const [invertPreviewBg, setInvertPreviewBg] = useState(false);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('urls', urlsParam);
    if (sortBy !== 'size-desc') params.set('sort', sortBy);
    if (selectedFormat !== 'ALL') params.set('format', selectedFormat);
    if (searchQuery) params.set('q', searchQuery);
    setSearchParams(params, { replace: true });
  }, [sortBy, selectedFormat, searchQuery, urlsParam, setSearchParams]);

  // Scrape on mount
  useEffect(() => {
    if (!urlsParam) {
      navigate('/scraper');
      return;
    }

    const decodedUrls = decodeURIComponent(urlsParam);

    const scrape = async () => {
      setIsLoading(true);
      setProgress(null);
      setScrapeComplete(false);

      try {
        const urlObject = new URL(decodedUrls.split('\n')[0].startsWith('http')
          ? decodedUrls.split('\n')[0]
          : `https://${decodedUrls.split('\n')[0]}`);
        setDomainName(urlObject.hostname);
      } catch {
        setDomainName(decodedUrls.split('\n')[0]);
      }

      try {
        let images: ScrapedImage[];

        // Callback to stream images as they're found
        const handleImageBatch: ImageBatchCallback = (newImages) => {
          const processedBatch = newImages.map(img => ({ ...img, selected: true }));
          setScrapedImages(prev => [...prev, ...processedBatch]);
          // Show content as soon as first images arrive
          setScrapeComplete(true);
        };

        if (scrapeMode === 'sitemap') {
          images = await processSitemapInput(
            decodedUrls,
            (p) => setProgress(p),
            maxPages,
            handleImageBatch
          );
        } else {
          images = await processUrlInput(decodedUrls);
          // For non-sitemap, set all images at once
          const processedImages = images.map(img => ({ ...img, selected: true }));
          setScrapedImages(processedImages);
        }
        setProgress({ phase: 'done', current: 0, total: 0 });
        setIsLoading(false);
        setScrapeComplete(true);
      } catch (error: any) {
        console.error('Scraping failed', error);
        setProgress(null);
        setIsLoading(false);
        alert(error.message || 'Failed to scrape the provided URL(s). Please check them and try again.');
        navigate('/scraper');
      }
    };

    scrape();
  }, [urlsParam, scrapeMode, maxPages, navigate]);

  const handleImageLoad = (id: string, width: number, height: number) => {
    setScrapedImages(prev => prev.map(img =>
      img.id === id ? { ...img, width, height } : img
    ));
  };

  const handleSizeLoad = (id: string, size: number) => {
    setScrapedImages(prev => prev.map(img =>
      img.id === id ? { ...img, size } : img
    ));
  };

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

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(img => img.name.toLowerCase().includes(q));
    }

    if (selectedFormat !== 'ALL') {
      result = result.filter(img => img.format === selectedFormat);
    }

    result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      const areaA = (a.width || 0) * (a.height || 0);
      const areaB = (b.width || 0) * (b.height || 0);
      if (sortBy === 'size-desc') return areaB - areaA;
      if (sortBy === 'size-asc') return areaA - areaB;
      if (sortBy === 'bytes-desc') return (b.size || 0) - (a.size || 0);
      return 0;
    });

    return result;
  }, [scrapedImages, searchQuery, selectedFormat, sortBy]);

  const selectedCount = scrapedImages.filter(img => img.selected).length;

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

    setScrapedImages(prev => prev.filter(img => uniqueIds.has(img.id)));
    const removedCount = scrapedImages.length - uniqueIds.size;
    alert(removedCount > 0 ? `Removed ${removedCount} duplicate/lower-quality images.` : 'No duplicates found.');
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
      const processedFiles: ImageFile[] = await Promise.all(selected.map(async (img) => {
        try {
          const file = await urlToFile(img.url, img.name);
          const previewUrl = await readFileAsDataURL(file);
          const { width, height } = await getImageDimensions(previewUrl);
          return {
            id: uuidv4(),
            file,
            previewUrl,
            originalWidth: width,
            originalHeight: height,
            status: 'idle' as const
          };
        } catch {
          return {
            id: uuidv4(),
            file: new File([], img.name),
            previewUrl: img.url,
            originalWidth: 0,
            originalHeight: 0,
            status: 'error' as const,
            errorMsg: 'Failed to retrieve source'
          };
        }
      }));

      setConverterFiles(processedFiles);
      navigate('/converter');
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
    }
  };

  // Show loading state until scraping is complete (prevents flash of "0 images")
  const showLoading = !scrapeComplete;

  if (showLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6">
        <div className="h-12 w-12 rounded-full border-4 border-slate-700 border-t-secondary animate-spin"></div>

        {progress ? (
          <div className="flex flex-col items-center gap-3 max-w-md text-center">
            <p className="text-white font-medium">
              {progress.phase === 'parsing' && 'Parsing sitemap...'}
              {progress.phase === 'crawling' && 'Crawling pages for images...'}
              {progress.phase === 'extracting' && 'Extracting images from sitemap...'}
              {progress.phase === 'done' && 'Finishing up...'}
            </p>

            {/* Progress bar */}
            <div className="w-64 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-secondary transition-all duration-300"
                style={{ width: `${(progress.current / Math.max(progress.total, 1)) * 100}%` }}
              />
            </div>

            <p className="text-slate-400 text-sm">
              {progress.current} / {progress.total}
              {progress.phase === 'crawling' && ' pages'}
              {progress.phase === 'parsing' && ' sitemaps'}
              {progress.phase === 'extracting' && ' images'}
            </p>

            {progress.currentUrl && (
              <p className="text-slate-500 text-xs font-mono truncate max-w-full px-4">
                {progress.currentUrl.length > 60
                  ? progress.currentUrl.substring(0, 60) + '...'
                  : progress.currentUrl}
              </p>
            )}
          </div>
        ) : (
          <p className="text-slate-400 font-medium">
            {scrapeMode === 'sitemap' ? 'Discovering sitemap...' : 'Analyzing websites...'}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-[95%] mx-auto px-4 md:px-6 py-6 flex flex-col lg:flex-row gap-6 h-[calc(100vh-100px)]">
      {/* SIDEBAR */}
      <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2 pb-10">
        <button
          onClick={() => navigate('/scraper')}
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
          {/* Sort */}
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

          {/* Filter by Type */}
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
                  className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all border uppercase shadow-sm ${selectedFormat === fmt ? 'bg-primary text-white border-primary scale-105' : getFormatColor(fmt)}`}
                >
                  {fmt} <span className="opacity-70 ml-0.5">({count})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
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

          {/* Deduplicate */}
          <div className="pt-2">
            <button
              onClick={handleSmartDeduplicate}
              className="w-full py-2.5 bg-dark hover:bg-slate-700 border border-slate-700 hover:border-secondary/50 rounded-lg text-xs font-bold text-secondary transition-all flex items-center justify-center gap-2 group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              Smart Deduplicate
            </button>
          </div>
        </div>

        {/* Invert BG */}
        <label className="flex items-center gap-3 cursor-pointer group px-1">
          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${invertPreviewBg ? 'bg-primary border-primary' : 'border-slate-600 bg-dark'}`}>
            {invertPreviewBg && <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
          </div>
          <input type="checkbox" className="hidden" checked={invertPreviewBg} onChange={(e) => setInvertPreviewBg(e.target.checked)} />
          <span className="text-sm font-medium text-slate-300 group-hover:text-white">Invert image preview background</span>
        </label>

        {/* Actions */}
        <div className="space-y-4 pt-4 border-t border-slate-700/50">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bulk Actions</label>
          <div className="flex gap-2">
            <button onClick={selectAll} className="flex-1 py-2 bg-surface hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 transition-colors">All</button>
            <button onClick={deselectAll} className="flex-1 py-2 bg-surface hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 transition-colors">None</button>
          </div>

          <button
            onClick={handleProcess}
            disabled={selectedCount === 0 || isProcessing}
            className={`w-full py-3 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${selectedCount > 0 && !isProcessing ? 'bg-primary hover:bg-primaryDark text-white shadow-primary/20' : 'bg-slate-700 text-slate-400 cursor-not-allowed'}`}
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
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-surface/30 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-medium text-slate-200">
              Found <span className="font-bold text-white">{filteredImages.length}</span> images
            </h2>
            {progress && progress.phase !== 'done' && (
              <div className="flex items-center gap-2 px-3 py-1 bg-secondary/10 border border-secondary/30 rounded-full animate-pulse">
                <div className="h-2 w-2 rounded-full bg-secondary animate-ping"></div>
                <span className="text-xs font-medium text-secondary">
                  {progress.phase === 'crawling' && `Crawling ${progress.current}/${progress.total}`}
                  {progress.phase === 'parsing' && `Parsing sitemaps...`}
                  {progress.phase === 'extracting' && `Extracting ${progress.current}/${progress.total}`}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-xs text-slate-400 font-mono bg-dark/50 px-2 py-1 rounded border border-white/5">{domainName}</div>
            <div className="h-4 w-px bg-slate-700 hidden sm:block"></div>
            <span className="text-xs font-bold text-primary">{selectedCount} Selected</span>
          </div>
        </div>

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

const getFormatColor = (fmt: string) => {
  switch (fmt) {
    case 'PNG': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    case 'JPG': case 'JPEG': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    case 'WEBP': return 'bg-pink-500/10 text-pink-500 border-pink-500/20';
    case 'SVG': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    default: return 'bg-slate-700 text-slate-400 border-slate-600';
  }
};

export default ScraperResultsPage;
