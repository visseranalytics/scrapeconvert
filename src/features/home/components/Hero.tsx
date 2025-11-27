interface HeroProps {
  onNavigate: (page: 'converter' | 'scraper') => void;
}

const Hero = ({ onNavigate }: HeroProps) => {
  return (
    <div className="relative overflow-hidden pt-32 pb-20 lg:pt-48 lg:pb-32">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-primary/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700/50 mb-8 backdrop-blur-sm">
          <span className="flex h-2 w-2 rounded-full bg-green-400 animate-pulse"></span>
          <span className="text-xs font-medium text-slate-300">v2.0 Now Available</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 mb-6 tracking-tight">
          Master Your Media <br className="hidden md:block" />
          <span className="text-white">Without the Server.</span>
        </h1>

        <p className="max-w-2xl mx-auto text-lg text-slate-400 mb-10 leading-relaxed">
          We are tired of having to manually download the images from a website one at a time, then convert them, etc. ScrapeConvert handles the tedious work securely in your browser.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={() => onNavigate('converter')}
            className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-primaryDark text-white font-bold rounded-xl shadow-xl shadow-primary/20 transition-all transform hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Launch Converter
          </button>

          <button
            onClick={() => onNavigate('scraper')}
            className="w-full sm:w-auto px-8 py-4 bg-surface hover:bg-slate-700 border border-slate-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-secondary" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            Start Scraping
          </button>
        </div>

        {/* Feature Grid Mini */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mt-20">
          {[
            { title: "Browser Native", desc: "No server uploads. Your files never leave your device." },
            { title: "Batch Processing", desc: "Convert hundreds of images in seconds with WebWorkers." },
            { title: "Smart Scraper", desc: "Extract assets from any URL via secure proxy." }
          ].map((item, i) => (
            <div key={i} className="p-6 rounded-2xl bg-surface/30 border border-slate-700/50 backdrop-blur-sm text-left">
              <h3 className="text-white font-bold mb-2">{item.title}</h3>
              <p className="text-slate-400 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Hero;
