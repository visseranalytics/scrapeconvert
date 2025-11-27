interface ScraperFeaturesProps {
  onNavigate: (page: 'converter' | 'scraper') => void;
}

const ScraperFeatures = ({ onNavigate }: ScraperFeaturesProps) => {
  const features = [
    {
      step: '1',
      title: 'Sitemap Crawling',
      desc: 'Drop in a sitemap URL and we\'ll automatically discover all pages on your site. Supports sitemap indexes, nested sitemaps, and standard XML sitemaps.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
      ),
    },
    {
      step: '2',
      title: 'Deep Page Crawling',
      desc: 'We crawl each page and extract every image—including those hidden in CSS background-image properties that other scrapers miss.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      ),
    },
    {
      step: '3',
      title: 'Sitemap Image Extraction',
      desc: 'Many sitemaps include image tags directly. We parse these too, giving you a complete picture of all indexed images without extra crawling.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      step: '4',
      title: 'Background Image Discovery',
      desc: 'CSS background images are often overlooked. Our scraper parses stylesheets and inline styles to capture every visual asset on the page.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      ),
    },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-secondary/5 rounded-full blur-[120px] -translate-y-1/2"></div>
        <div className="absolute top-1/4 right-0 w-72 h-72 bg-primary/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20 mb-6">
            <svg className="w-4 h-4 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-xs font-medium text-secondary">Powerful Scraping</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Extract Every Image.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-secondary to-primary">Automatically.</span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Point us at a sitemap and we'll find every image on your site—even the ones hiding in CSS.
            No more manual hunting through page source.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {features.map((feature, i) => (
            <div
              key={i}
              className="group p-6 rounded-2xl bg-surface/50 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300 hover:bg-surface/70"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-secondary/20 to-primary/20 border border-secondary/20 flex items-center justify-center text-secondary group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                      STEP {feature.step}
                    </span>
                    <h3 className="text-white font-bold">{feature.title}</h3>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Visual Flow Diagram */}
        <div className="rounded-2xl bg-gradient-to-b from-surface to-surface/50 border border-slate-700/50 p-8 mb-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-4">
            {/* Step 1: Sitemap */}
            <div className="flex flex-col items-center text-center flex-1">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-3">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="text-white font-semibold text-sm">sitemap.xml</span>
              <span className="text-slate-500 text-xs">Your sitemap URL</span>
            </div>

            {/* Arrow */}
            <div className="hidden md:block text-slate-600">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            <div className="block md:hidden text-slate-600">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>

            {/* Step 2: Pages */}
            <div className="flex flex-col items-center text-center flex-1">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-3 relative">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="absolute -top-1 -right-1 bg-secondary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  127
                </span>
              </div>
              <span className="text-white font-semibold text-sm">Pages Found</span>
              <span className="text-slate-500 text-xs">Crawled automatically</span>
            </div>

            {/* Arrow */}
            <div className="hidden md:block text-slate-600">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            <div className="block md:hidden text-slate-600">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>

            {/* Step 3: Images */}
            <div className="flex flex-col items-center text-center flex-1">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-secondary/20 to-primary/20 border border-secondary/30 flex items-center justify-center mb-3 relative">
                <svg className="w-8 h-8 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  843
                </span>
              </div>
              <span className="text-white font-semibold text-sm">Images Extracted</span>
              <span className="text-slate-500 text-xs">Ready to download</span>
            </div>
          </div>

          {/* Sources breakdown */}
          <div className="mt-8 pt-6 border-t border-slate-700/50">
            <p className="text-center text-xs text-slate-500 mb-4">Images discovered from:</p>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                { label: 'img tags', count: 412 },
                { label: 'Sitemap images', count: 289 },
                { label: 'CSS backgrounds', count: 142 },
              ].map((source, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <span className="text-slate-400 text-xs">{source.label}</span>
                  <span className="text-white font-bold text-xs">{source.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={() => onNavigate('scraper')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-secondary to-primary hover:from-secondary/90 hover:to-primary/90 text-white font-bold rounded-xl shadow-xl shadow-secondary/20 transition-all transform hover:-translate-y-1 active:translate-y-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            Try the Scraper
          </button>
          <p className="text-slate-500 text-sm mt-4">
            No signup required. Just paste a URL and go.
          </p>
        </div>
      </div>
    </section>
  );
};

export default ScraperFeatures;
