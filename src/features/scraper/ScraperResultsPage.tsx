import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { ScrapedImage, ImageFile } from "@/shared/types";
import {
  readFileAsDataURL,
  getImageDimensions,
} from "@/shared/services/imageUtils";
import { useAppContext } from "@/shared/context/AppContext";
import {
  processUrlInput,
  processSitemapInput,
  urlToFile,
  ScrapeProgress,
  SitemapDiscoveryProgress,
  CrawlLogEntry,
} from "./services/scraperService";
import ImageResultCard from "./components/ImageResultCard";

type SortOption = "name" | "size-desc" | "size-asc" | "bytes-desc";
type CrawlPhase = "idle" | "discovering" | "crawling" | "complete" | "done";

const ScraperResultsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setConverterFiles } = useAppContext();

  const urlsParam = searchParams.get("urls") || "";
  const scrapeMode = searchParams.get("mode") || "pages";
  const maxPages = parseInt(searchParams.get("max") || "50", 10);
  const initialSort = (searchParams.get("sort") as SortOption) || "size-desc";
  const initialFormat = searchParams.get("format") || "ALL";
  const initialSearch = searchParams.get("q") || "";

  const [isProcessing, setIsProcessing] = useState(false);
  const [scrapedImages, setScrapedImages] = useState<ScrapedImage[]>([]);
  const [domainName, setDomainName] = useState<string>("");
  const [progress, setProgress] = useState<ScrapeProgress | null>(null);
  const [crawlPhase, setCrawlPhase] = useState<CrawlPhase>("idle");
  const [discoveryProgress, setDiscoveryProgress] =
    useState<SitemapDiscoveryProgress | null>(null);
  const [discoveryFailed, setDiscoveryFailed] = useState(false);
  const [duplicatesRemoved, setDuplicatesRemoved] = useState(0);

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [sortBy, setSortBy] = useState<SortOption>(initialSort);
  const [selectedFormat, setSelectedFormat] = useState<string>(initialFormat);
  const [invertPreviewBg, setInvertPreviewBg] = useState(false);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [crawlLog, setCrawlLog] = useState<CrawlLogEntry[]>([]);
  const [sitemapUrl, setSitemapUrl] = useState<string>("");
  const [showCrawlLogView, setShowCrawlLogView] = useState(false);
  const [hideDuplicates, setHideDuplicates] = useState(true);
  const [pageSearchQuery, setPageSearchQuery] = useState("");

  const crawlLogRef = useRef<HTMLDivElement>(null);

  // Auto-scroll crawl log when new entries are added or status changes
  useEffect(() => {
    if (crawlLogRef.current && crawlPhase === "crawling") {
      // Find the currently crawling entry and scroll to it
      const crawlingIndex = crawlLog.findIndex((e) => e.status === "crawling");
      if (crawlingIndex >= 0) {
        crawlLogRef.current.scrollTop = crawlingIndex * 52; // Approximate height per row
      }
    }
  }, [crawlLog, crawlPhase]);

  // Sync filters to URL (preserve mode and max params)
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("urls", urlsParam);
    if (scrapeMode !== "pages") params.set("mode", scrapeMode);
    if (scrapeMode === "sitemap" && maxPages !== 50)
      params.set("max", maxPages.toString());
    if (sortBy !== "size-desc") params.set("sort", sortBy);
    if (selectedFormat !== "ALL") params.set("format", selectedFormat);
    if (searchQuery) params.set("q", searchQuery);
    setSearchParams(params, { replace: true });
  }, [
    sortBy,
    selectedFormat,
    searchQuery,
    urlsParam,
    scrapeMode,
    maxPages,
    setSearchParams,
  ]);

  // Scrape on mount
  useEffect(() => {
    if (!urlsParam) {
      navigate("/scraper");
      return;
    }

    const scrape = async () => {
      setCrawlPhase("idle");
      setProgress(null);
      setDiscoveryProgress(null);
      setDiscoveryFailed(false);
      setCrawlLog([]);
      setDuplicatesRemoved(0);

      try {
        const urlObject = new URL(
          urlsParam.split("\n")[0].startsWith("http")
            ? urlsParam.split("\n")[0]
            : `https://${urlsParam.split("\n")[0]}`
        );
        setDomainName(urlObject.hostname);
      } catch {
        setDomainName(urlsParam.split("\n")[0]);
      }

      try {
        let images: ScrapedImage[];

        if (scrapeMode === "sitemap") {
          setCrawlPhase("discovering");

          const result = await processSitemapInput(
            urlsParam,
            (p) => {
              setProgress(p);
              if (p.phase === "crawling") {
                setCrawlPhase("crawling");
              }
            },
            maxPages,
            // Crawl log callback - receives full log array each time
            (logEntries) => {
              setCrawlLog(logEntries);
            },
            (dp) => setDiscoveryProgress(dp)
          );

          // Check if discovery failed
          if (result.discoveryFailed) {
            setDiscoveryFailed(true);
            setCrawlPhase("idle");
            return;
          }

          images = result.images;
          if (result.sitemapUrl) {
            setSitemapUrl(result.sitemapUrl);
          }

          // Calculate duplicates removed (total from crawl log vs final images)
          const totalFromCrawl = crawlLog.reduce(
            (sum, e) => sum + e.imageCount,
            0
          );
          if (totalFromCrawl > images.length) {
            setDuplicatesRemoved(totalFromCrawl - images.length);
          }
        } else {
          images = await processUrlInput(urlsParam);
        }

        // Set all images at once (already deduplicated by the service)
        const processedImages = images.map((img) => ({
          ...img,
          selected: true,
        }));
        setScrapedImages(processedImages);

        // Show "All done" animation
        setCrawlPhase("complete");
        setDiscoveryProgress(null);
        setProgress({
          phase: "done",
          current: processedImages.length,
          total: processedImages.length,
        });

        // After animation delay, show results
        setTimeout(() => {
          setCrawlPhase("done");
        }, 1500);
      } catch (error: any) {
        console.error("Scraping failed", error);
        setProgress(null);
        setDiscoveryProgress(null);
        setCrawlPhase("idle");
        alert(
          error.message ||
            "Failed to scrape the provided URL(s). Please check them and try again."
        );
        navigate("/scraper");
      }
    };

    scrape();
  }, [urlsParam, scrapeMode, maxPages, navigate]);

  const handleImageLoad = (id: string, width: number, height: number) => {
    setScrapedImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, width, height } : img))
    );
  };

  const handleSizeLoad = (id: string, size: number) => {
    setScrapedImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, size } : img))
    );
  };

  const formats = useMemo(() => {
    const counts: Record<string, number> = {};
    scrapedImages.forEach((img) => {
      const fmt = img.format || "UNKNOWN";
      counts[fmt] = (counts[fmt] || 0) + 1;
    });
    return counts;
  }, [scrapedImages]);

  // Collect unique pages with their image counts
  const pages = useMemo(() => {
    const pageMap: Record<
      string,
      { title: string; url: string; count: number }
    > = {};
    scrapedImages.forEach((img) => {
      if (img.sourcePageUrl) {
        const key = img.sourcePageUrl;
        if (!pageMap[key]) {
          pageMap[key] = {
            title: img.sourcePageTitle || new URL(img.sourcePageUrl).pathname,
            url: img.sourcePageUrl,
            count: 0,
          };
        }
        pageMap[key].count++;
      }
    });
    // Sort alphabetically by title
    return Object.values(pageMap).sort((a, b) =>
      a.title.localeCompare(b.title)
    );
  }, [scrapedImages]);

  // Count duplicates for display
  const duplicateCount = useMemo(() => {
    return scrapedImages.filter((img) => img.isDuplicate).length;
  }, [scrapedImages]);

  const filteredImages = useMemo(() => {
    let result = scrapedImages;

    // Filter duplicates if hiding them
    if (hideDuplicates) {
      result = result.filter((img) => !img.isDuplicate);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((img) => img.name.toLowerCase().includes(q));
    }

    if (selectedFormat !== "ALL") {
      result = result.filter((img) => img.format === selectedFormat);
    }

    // Filter by selected pages (if any are selected)
    if (selectedPages.size > 0) {
      result = result.filter(
        (img) => img.sourcePageUrl && selectedPages.has(img.sourcePageUrl)
      );
    }

    result.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      const areaA = (a.width || 0) * (a.height || 0);
      const areaB = (b.width || 0) * (b.height || 0);
      if (sortBy === "size-desc") return areaB - areaA;
      if (sortBy === "size-asc") return areaA - areaB;
      if (sortBy === "bytes-desc") return (b.size || 0) - (a.size || 0);
      return 0;
    });

    return result;
  }, [
    scrapedImages,
    searchQuery,
    selectedFormat,
    selectedPages,
    sortBy,
    hideDuplicates,
  ]);

  // Count only from filtered images to respect all active filters
  const selectedCount = filteredImages.filter((img) => img.selected).length;

  const toggleSelection = (id: string) => {
    setScrapedImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, selected: !img.selected } : img
      )
    );
  };

  const selectAll = () => {
    const visibleIds = new Set(filteredImages.map((img) => img.id));
    setScrapedImages((prev) =>
      prev.map((img) =>
        visibleIds.has(img.id) ? { ...img, selected: true } : img
      )
    );
  };

  const deselectAll = () => {
    const visibleIds = new Set(filteredImages.map((img) => img.id));
    setScrapedImages((prev) =>
      prev.map((img) =>
        visibleIds.has(img.id) ? { ...img, selected: false } : img
      )
    );
  };

  const togglePageFilter = (pageUrl: string) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageUrl)) {
        next.delete(pageUrl);
      } else {
        next.add(pageUrl);
      }
      return next;
    });
  };

  const clearPageFilters = () => {
    setSelectedPages(new Set());
  };

  const handleSmartDeduplicate = () => {
    // Normalize URL for comparison (remove protocol, query params, hash, trailing slashes)
    const normalizeUrl = (url: string): string => {
      return url
        .replace(/^https?:\/\//, "")
        .split("?")[0]
        .split("#")[0]
        .replace(/\/+$/, "")
        .toLowerCase();
    };

    const groups: Record<string, ScrapedImage[]> = {};
    scrapedImages.forEach((img) => {
      const key = normalizeUrl(img.url);
      if (!groups[key]) groups[key] = [];
      groups[key].push(img);
    });

    const uniqueIds = new Set<string>();
    Object.values(groups).forEach((group) => {
      if (group.length === 1) {
        uniqueIds.add(group[0].id);
      } else {
        // Keep the one with largest dimensions
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

    setScrapedImages((prev) => prev.filter((img) => uniqueIds.has(img.id)));
    const removedCount = scrapedImages.length - uniqueIds.size;
    alert(
      removedCount > 0
        ? `Removed ${removedCount} duplicate/lower-quality images.`
        : "No duplicates found."
    );
  };

  const handleCopyUrls = () => {
    // Use filteredImages to respect all active filters
    const urls = filteredImages
      .filter((img) => img.selected)
      .map((img) => img.url)
      .join("\n");
    navigator.clipboard.writeText(urls);
    alert(`Copied ${selectedCount} URLs to clipboard`);
  };

  const handleProcess = async () => {
    // Use filteredImages to respect all active filters (duplicates, search, format, pages)
    const selected = filteredImages.filter((img) => img.selected);
    if (selected.length === 0) return;

    setIsProcessing(true);
    try {
      const processedFiles: ImageFile[] = await Promise.all(
        selected.map(async (img) => {
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
              status: "idle" as const,
            };
          } catch {
            return {
              id: uuidv4(),
              file: new File([], img.name),
              previewUrl: img.url,
              originalWidth: 0,
              originalHeight: 0,
              status: "error" as const,
              errorMsg: "Failed to retrieve source",
            };
          }
        })
      );

      setConverterFiles(processedFiles);
      navigate("/converter");
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
    }
  };

  // Calculate totals from crawl log
  const crawlStats = useMemo(() => {
    const completed = crawlLog.filter((e) => e.status === "done").length;
    const errors = crawlLog.filter((e) => e.status === "error").length;
    const total = crawlLog.length;
    const imagesFound = crawlLog.reduce((sum, e) => sum + e.imageCount, 0);
    return { completed, errors, total, imagesFound };
  }, [crawlLog]);

  // Discovery failed state
  if (discoveryFailed) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-4">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-full bg-red-500/10 border border-red-500/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Sitemap Not Found
              </h2>
              <p className="text-sm text-slate-400">
                We couldn't find a sitemap at any common location
              </p>
            </div>
          </div>

          {discoveryProgress && discoveryProgress.locations && (
            <div className="bg-surface rounded-xl border border-slate-700/50 p-4 mb-6">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Locations Checked
              </p>
              <div className="space-y-2">
                {discoveryProgress.locations.map((loc, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 py-2 px-3 bg-dark/50 rounded-lg"
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                        loc.status === "not_found"
                          ? "bg-red-500/10"
                          : "bg-slate-700"
                      }`}
                    >
                      {loc.status === "not_found" && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3 w-3 text-red-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                      {loc.status === "pending" && (
                        <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                      )}
                    </div>
                    <span
                      className={`text-sm font-mono ${
                        loc.status === "not_found"
                          ? "text-slate-500"
                          : "text-slate-400"
                      }`}
                    >
                      {loc.label}
                    </span>
                    <span
                      className={`text-xs ml-auto ${
                        loc.status === "not_found"
                          ? "text-red-400/70"
                          : "text-slate-500"
                      }`}
                    >
                      {loc.status === "not_found" && "Not found"}
                      {loc.status === "pending" && "Skipped"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate("/scraper")}
              className="w-full py-3 bg-primary hover:bg-primaryDark text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                  clipRule="evenodd"
                />
              </svg>
              Try a Different URL
            </button>
            <p className="text-xs text-slate-500 text-center">
              Tip: Try providing a direct sitemap URL (e.g.,
              example.com/sitemap.xml)
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Full-screen crawl log during crawling phase or when viewing from results
  const showCrawlLogFullScreen =
    crawlPhase === "discovering" ||
    crawlPhase === "crawling" ||
    crawlPhase === "complete" ||
    showCrawlLogView;

  if (showCrawlLogFullScreen) {
    const isViewingFromResults = showCrawlLogView && crawlPhase === "done";

    return (
      <div className="min-h-[calc(100vh-100px)] flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-4xl">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            {isViewingFromResults ? (
              <button
                onClick={() => setShowCrawlLogView(false)}
                className="h-12 w-12 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-slate-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </button>
            ) : crawlPhase === "complete" ? (
              <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center animate-scale-in">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-7 w-7 text-green-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            ) : (
              <div className="h-12 w-12 rounded-full border-4 border-slate-700 border-t-secondary animate-spin"></div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white">
                {isViewingFromResults && "Crawl Log"}
                {!isViewingFromResults &&
                  crawlPhase === "discovering" &&
                  "Discovering Sitemap"}
                {!isViewingFromResults &&
                  crawlPhase === "crawling" &&
                  "Crawling Pages"}
                {!isViewingFromResults &&
                  crawlPhase === "complete" &&
                  "All Done!"}
              </h2>
              <p className="text-sm text-slate-400">{domainName}</p>
            </div>
            {isViewingFromResults && (
              <button
                onClick={() => setShowCrawlLogView(false)}
                className="px-4 py-2 bg-primary hover:bg-primaryDark text-white rounded-lg text-sm font-bold transition-colors"
              >
                View Results
              </button>
            )}
          </div>

          {/* Sitemap URL */}
          {sitemapUrl && crawlPhase !== "discovering" && (
            <div className="mb-4 px-3 py-2 bg-dark/50 rounded-lg border border-slate-700/50">
              <p className="text-xs text-slate-500 mb-1">Sitemap</p>
              <p
                className="text-sm font-mono text-slate-300 truncate"
                title={sitemapUrl}
              >
                {sitemapUrl}
              </p>
            </div>
          )}

          {/* Discovery progress */}
          {crawlPhase === "discovering" && discoveryProgress && (
            <div className="bg-surface rounded-xl border border-slate-700/50 p-4 mb-6">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Checking Locations
              </p>
              <div className="space-y-2">
                {discoveryProgress.locations.map((loc, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 py-2 px-3 bg-dark/50 rounded-lg"
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                        loc.status === "checking"
                          ? "bg-secondary/20"
                          : loc.status === "found"
                          ? "bg-green-500/20"
                          : loc.status === "not_found"
                          ? "bg-red-500/10"
                          : "bg-slate-700"
                      }`}
                    >
                      {loc.status === "checking" && (
                        <div className="w-3 h-3 rounded-full border-2 border-secondary/30 border-t-secondary animate-spin"></div>
                      )}
                      {loc.status === "found" && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3 w-3 text-green-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                      {loc.status === "not_found" && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3 w-3 text-red-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                      {loc.status === "pending" && (
                        <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                      )}
                    </div>
                    <span
                      className={`text-sm font-mono ${
                        loc.status === "checking"
                          ? "text-secondary"
                          : loc.status === "found"
                          ? "text-green-400"
                          : loc.status === "not_found"
                          ? "text-slate-500"
                          : "text-slate-400"
                      }`}
                    >
                      {loc.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats bar */}
          {(crawlPhase === "crawling" ||
            crawlPhase === "complete" ||
            isViewingFromResults) &&
            crawlLog.length > 0 && (
              <div className="flex items-center gap-4 mb-4 px-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-white">
                    {crawlStats.completed}
                  </span>
                  <span className="text-sm text-slate-400">
                    / {crawlStats.total} pages
                  </span>
                </div>
                <div className="h-4 w-px bg-slate-700"></div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-primary">
                    {crawlStats.imagesFound}
                  </span>
                  <span className="text-sm text-slate-400">images found</span>
                </div>
                {crawlStats.errors > 0 && (
                  <>
                    <div className="h-4 w-px bg-slate-700"></div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-red-400">
                        {crawlStats.errors}
                      </span>
                      <span className="text-sm text-slate-400">errors</span>
                    </div>
                  </>
                )}
              </div>
            )}

          {/* Progress bar */}
          {crawlPhase === "crawling" && progress && (
            <div className="mb-4">
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-secondary transition-all duration-300"
                  style={{
                    width: `${
                      (progress.current / Math.max(progress.total, 1)) * 100
                    }%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Crawl log */}
          {(crawlPhase === "crawling" ||
            crawlPhase === "complete" ||
            isViewingFromResults) &&
            crawlLog.length > 0 && (
              <div className="bg-surface rounded-xl border border-slate-700/50 overflow-hidden">
                <div
                  ref={crawlLogRef}
                  className="max-h-[50vh] overflow-y-auto custom-scrollbar scroll-smooth"
                >
                  {crawlLog.map((entry, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 px-4 py-3 border-b border-slate-700/30 last:border-b-0 ${
                        entry.status === "crawling" ? "bg-secondary/5" : ""
                      }`}
                    >
                      <div className="w-6 flex-shrink-0 flex justify-center">
                        {entry.status === "pending" && (
                          <div className="h-2 w-2 rounded-full bg-slate-500"></div>
                        )}
                        {entry.status === "crawling" && (
                          <div className="h-4 w-4 rounded-full border-2 border-secondary/30 border-t-secondary animate-spin"></div>
                        )}
                        {entry.status === "done" && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 text-green-500"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                        {entry.status === "error" && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 text-red-500"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      <span
                        className="text-sm font-mono text-slate-400 truncate flex-1"
                        title={entry.url}
                      >
                        {entry.url}
                      </span>
                      <span
                        className={`text-sm font-bold flex-shrink-0 ${
                          entry.imageCount > 0
                            ? "text-primary"
                            : "text-slate-500"
                        }`}
                      >
                        {entry.status === "done" &&
                          `${entry.imageCount} images`}
                        {entry.status === "error" && "Failed"}
                        {entry.status === "crawling" && "Crawling..."}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Complete message */}
          {crawlPhase === "complete" && (
            <div className="mt-6 text-center animate-fade-in">
              <p className="text-lg text-white font-medium">
                Found{" "}
                <span className="text-primary font-bold">
                  {scrapedImages.length}
                </span>{" "}
                images
              </p>
              {duplicatesRemoved > 0 && (
                <p className="text-sm text-slate-400 mt-1">
                  Removed {duplicatesRemoved} duplicates
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Non-sitemap loading state
  if (crawlPhase === "idle" && scrapeMode !== "sitemap") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-4">
        <div className="h-12 w-12 rounded-full border-4 border-slate-700 border-t-secondary animate-spin"></div>
        <p className="text-slate-400 font-medium">Analyzing websites...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[95%] mx-auto px-4 md:px-6 py-6 flex flex-col lg:flex-row gap-6 h-[calc(100vh-100px)]">
      {/* SIDEBAR */}
      <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2 pb-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/scraper")}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
          >
            <div className="p-1 rounded-md bg-surface group-hover:bg-slate-700 transition-colors">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <span className="font-medium text-sm">New Extraction</span>
          </button>
          {scrapeMode === "sitemap" && crawlLog.length > 0 && (
            <>
              <div className="h-4 w-px bg-slate-700"></div>
              <button
                onClick={() => setShowCrawlLogView(true)}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
              >
                <div className="p-1 rounded-md bg-surface group-hover:bg-slate-700 transition-colors">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <span className="font-medium text-sm">Crawl Log</span>
              </button>
            </>
          )}
        </div>

        <div className="p-4 bg-surface rounded-xl border border-slate-700/50 shadow-lg flex flex-col gap-6">
          {/* Sort */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Sort Order
            </label>
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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Filter by Type */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              File Types
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedFormat("ALL")}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all border shadow-sm ${
                  selectedFormat === "ALL"
                    ? "bg-white text-dark border-white scale-105"
                    : "bg-dark text-slate-400 border-slate-700 hover:border-slate-500"
                }`}
              >
                ALL
              </button>
              {Object.entries(formats).map(([fmt, count]) => (
                <button
                  key={fmt}
                  onClick={() => setSelectedFormat(fmt)}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all border uppercase shadow-sm ${
                    selectedFormat === fmt
                      ? "bg-primary text-white border-primary scale-105"
                      : getFormatColor(fmt)
                  }`}
                >
                  {fmt} <span className="opacity-70 ml-0.5">({count})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Toggle Options */}
          <div className="space-y-2 pt-2 border-t border-slate-700/50">
            {/* Hide Duplicates Toggle */}
            {duplicateCount > 0 && (
              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                    hideDuplicates
                      ? "bg-primary border-primary"
                      : "border-slate-600 bg-dark"
                  }`}
                >
                  {hideDuplicates && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3.5 w-3.5 text-white"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={hideDuplicates}
                  onChange={(e) => setHideDuplicates(e.target.checked)}
                />
                <span className="text-sm font-medium text-slate-300 group-hover:text-white">
                  Hide duplicates{" "}
                  <span className="text-slate-500">({duplicateCount})</span>
                </span>
              </label>
            )}

            {/* Invert BG */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <div
                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                  invertPreviewBg
                    ? "bg-primary border-primary"
                    : "border-slate-600 bg-dark"
                }`}
              >
                {invertPreviewBg && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5 text-white"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <input
                type="checkbox"
                className="hidden"
                checked={invertPreviewBg}
                onChange={(e) => setInvertPreviewBg(e.target.checked)}
              />
              <span className="text-sm font-medium text-slate-300 group-hover:text-white">
                Invert preview background
              </span>
            </label>
          </div>

          {/* Filter by Page (only show in sitemap mode with pages) */}
          {scrapeMode === "sitemap" && pages.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Pages <span className="text-slate-500">({pages.length})</span>
                </label>
                {selectedPages.size > 0 && (
                  <button
                    onClick={clearPageFilters}
                    className="text-[10px] font-medium text-primary hover:text-primaryDark transition-colors"
                  >
                    Clear ({selectedPages.size})
                  </button>
                )}
              </div>
              {/* Page search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search pages..."
                  value={pageSearchQuery}
                  onChange={(e) => setPageSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 bg-dark border border-slate-700 rounded-lg text-xs text-slate-300 focus:border-primary outline-none placeholder:text-slate-600"
                />
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                {pages
                  .filter(
                    (page) =>
                      !pageSearchQuery ||
                      page.title
                        .toLowerCase()
                        .includes(pageSearchQuery.toLowerCase())
                  )
                  .map((page) => {
                    const isSelected = selectedPages.has(page.url);
                    const displayTitle =
                      page.title.length > 35
                        ? page.title.substring(0, 35) + "..."
                        : page.title;
                    return (
                      <label
                        key={page.url}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? "bg-primary/10 border border-primary/30"
                            : "bg-dark/50 border border-transparent hover:border-slate-700"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-primary border-primary"
                              : "border-slate-600 bg-dark"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-3 w-3 text-white"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </div>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={isSelected}
                          onChange={() => togglePageFilter(page.url)}
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-xs font-medium text-slate-300 truncate"
                            title={page.title}
                          >
                            {displayTitle}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 flex-shrink-0">
                          {page.count}
                        </span>
                      </label>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Deduplicate */}
          <div className="pt-2">
            <button
              onClick={handleSmartDeduplicate}
              className="w-full py-2.5 bg-dark hover:bg-slate-700 border border-slate-700 hover:border-secondary/50 rounded-lg text-xs font-bold text-secondary transition-all flex items-center justify-center gap-2 group"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 group-hover:scale-110 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                />
              </svg>
              Smart Deduplicate
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 bg-dark/30 rounded-2xl border border-white/5 overflow-hidden">
        <div className="h-16 flex items-center px-6 border-b border-white/5 bg-surface/30 backdrop-blur-md gap-3">
          {/* Search on the left */}
          <div className="w-64 flex-shrink-0">
            <div className="relative">
              <input
                type="text"
                placeholder="Search filename..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 bg-dark border border-slate-700 rounded-lg text-sm text-slate-300 focus:border-primary outline-none placeholder:text-slate-600"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* All/None buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={selectAll}
              className="px-3 py-1.5 bg-dark hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 transition-colors"
            >
              All
            </button>
            <button
              onClick={deselectAll}
              className="px-3 py-1.5 bg-dark hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 transition-colors"
            >
              None
            </button>
          </div>

          {/* Image counts in the middle */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-dark/50 rounded-lg border border-white/5">
            <span className="text-xs font-bold text-white">
              {filteredImages.length}
            </span>
            <span className="text-xs text-slate-400">images</span>
            <div className="h-3 w-px bg-slate-600"></div>
            <span className="text-xs font-bold text-primary">
              {selectedCount}
            </span>
            <span className="text-xs text-slate-400">selected</span>
          </div>

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Copy and Convert buttons on the right */}
          <button
            onClick={handleCopyUrls}
            disabled={selectedCount === 0}
            className="px-4 py-2 bg-dark hover:bg-slate-700 border border-slate-700 rounded-lg text-sm font-bold text-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
              />
            </svg>
            Copy URLs
          </button>
          <button
            onClick={handleProcess}
            disabled={selectedCount === 0 || isProcessing}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
              selectedCount > 0 && !isProcessing
                ? "bg-primary hover:bg-primaryDark text-white"
                : "bg-slate-700 text-slate-400 cursor-not-allowed"
            }`}
          >
            {isProcessing ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 rotate-90"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
                <span>Send to Converter</span>
              </>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-dark/20">
          {filteredImages.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {filteredImages.map((img) => (
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-16 w-16 text-slate-700"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
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
    case "PNG":
      return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    case "JPG":
    case "JPEG":
      return "bg-orange-500/10 text-orange-500 border-orange-500/20";
    case "WEBP":
      return "bg-pink-500/10 text-pink-500 border-pink-500/20";
    case "SVG":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    default:
      return "bg-slate-700 text-slate-400 border-slate-600";
  }
};

export default ScraperResultsPage;
