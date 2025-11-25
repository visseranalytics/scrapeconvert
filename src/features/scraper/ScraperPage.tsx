import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHero } from '@/shared/components';

const ScraperPage = () => {
  const navigate = useNavigate();
  const [inputUrl, setInputUrl] = useState('');

  const handleScrape = () => {
    if (!inputUrl.trim()) return;
    const encoded = encodeURIComponent(inputUrl.trim());
    navigate(`/scraper/results?urls=${encoded}`);
  };

  return (
    <div className="animate-in fade-in zoom-in-95 duration-300">
      <PageHero
        title="Image Scraper"
        subtitle="Extract images from any website. Input one or more URLs to instantly scrape, filter, deduplicate, and batch download high-quality assets."
        accentColor="secondary"
        badge={{
          text: "Batch URL support",
          icon: (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          ),
        }}
        actions={
          <button
            onClick={() => navigate('/converter')}
            className="px-5 py-2.5 bg-surface hover:bg-slate-700 border border-slate-700 text-white font-medium rounded-xl transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Or convert local files
          </button>
        }
      />

      <div className="w-full max-w-4xl mx-auto px-4 md:px-8 pb-16">
        {/* Input Card */}
        <div className="bg-surface/50 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl mb-12">
          <div className="bg-dark/50 rounded-xl p-4 md:p-6 border border-white/5">
            <div className="flex flex-col gap-4">
              <div className="relative">
                <textarea
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://example.com/gallery&#10;https://unsplash.com/s/photos/tech"
                  className="w-full h-32 bg-dark border border-slate-700 rounded-xl p-4 text-slate-200 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all resize-none font-mono text-sm shadow-inner placeholder:text-slate-600"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.metaKey) {
                      handleScrape();
                    }
                  }}
                />
                <div className="absolute bottom-3 right-3 text-[10px] text-slate-500 bg-dark px-2 py-1 rounded border border-slate-800">
                  Supports multiple URLs
                </div>
              </div>

              <button
                onClick={handleScrape}
                disabled={!inputUrl.trim()}
                className="w-full py-4 bg-secondary hover:bg-emerald-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-secondary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transform active:scale-[0.99] group"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white/80 group-hover:text-white transition-colors" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                <span>Start Extraction</span>
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
};

export default ScraperPage;
