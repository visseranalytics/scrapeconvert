interface ConverterFeaturesProps {
  onNavigate: (page: 'converter' | 'scraper') => void;
}

const ConverterFeatures = ({ onNavigate }: ConverterFeaturesProps) => {
  const features = [
    {
      title: 'Mixed Format Batches',
      desc: 'Drop PNGs, JPEGs, WebPs, and GIFs all at once. We detect each file type automatically and convert them all to your target format in one batch.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      title: 'Redo with New Settings',
      desc: 'Not happy with the result? Hit "Redo" to re-convert with different quality or format settings—no need to re-upload your files.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
    },
    {
      title: 'Smart Size Optimization',
      desc: 'If the converted file ends up larger than the original (common with already-optimized images), we automatically keep the smaller file.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      title: 'Batch ZIP Download',
      desc: 'Convert hundreds of images, then download them all as a single ZIP file. No more clicking download 50 times.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      ),
    },
    {
      title: 'Quality Control',
      desc: 'Fine-tune compression from 10% to 100%. Find the sweet spot between file size and visual quality for your specific needs.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      ),
    },
    {
      title: 'Resize on the Fly',
      desc: 'Set max width/height constraints with optional aspect ratio lock. Resize and convert in a single step.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      ),
    },
  ];

  const formats = [
    { from: 'PNG', to: 'WEBP', savings: '73%' },
    { from: 'JPEG', to: 'WEBP', savings: '34%' },
    { from: 'WEBP', to: 'JPEG', savings: 'compat' },
    { from: 'GIF', to: 'PNG', savings: 'quality' },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-gradient-to-b from-transparent via-primary/5 to-transparent">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-1/4 left-0 w-72 h-72 bg-secondary/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-xs font-medium text-primary">Batch Conversion</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Convert Smarter.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Not Harder.</span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Drop any mix of image formats and convert them all at once.
            Automatic format detection, smart optimization, and one-click batch downloads.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
          {features.map((feature, i) => (
            <div
              key={i}
              className="group p-5 rounded-2xl bg-surface/50 border border-slate-700/50 hover:border-primary/30 transition-all duration-300 hover:bg-surface/70"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform duration-300">
                {feature.icon}
              </div>
              <h3 className="text-white font-bold mb-2">{feature.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* Format Conversion Examples */}
        <div className="rounded-2xl bg-gradient-to-b from-surface to-surface/50 border border-slate-700/50 p-8 mb-12">
          <div className="text-center mb-8">
            <h3 className="text-white font-bold text-lg mb-2">Supported Conversions</h3>
            <p className="text-slate-500 text-sm">Convert between any format. Real savings from actual conversions.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {formats.map((fmt, i) => (
              <div key={i} className="flex flex-col items-center p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-slate-300 bg-slate-700 px-2 py-1 rounded">{fmt.from}</span>
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span className="text-xs font-bold text-primary bg-primary/20 px-2 py-1 rounded">{fmt.to}</span>
                </div>
                <span className={`text-xs font-bold ${
                  fmt.savings.includes('%') ? 'text-green-400' : 'text-slate-400'
                }`}>
                  {fmt.savings.includes('%') ? `Up to ${fmt.savings} smaller` : fmt.savings === 'compat' ? 'Browser compatibility' : 'Lossless quality'}
                </span>
              </div>
            ))}
          </div>

          {/* Workflow illustration */}
          <div className="mt-8 pt-8 border-t border-slate-700/50">
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
              {/* Step 1 */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">1</span>
                </div>
                <div className="text-left">
                  <span className="text-white font-medium text-sm">Drop files</span>
                  <p className="text-slate-500 text-xs">Any format, any amount</p>
                </div>
              </div>

              <svg className="hidden md:block w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>

              {/* Step 2 */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">2</span>
                </div>
                <div className="text-left">
                  <span className="text-white font-medium text-sm">Set options</span>
                  <p className="text-slate-500 text-xs">Format, quality, size</p>
                </div>
              </div>

              <svg className="hidden md:block w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>

              {/* Step 3 */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <span className="text-primary font-bold text-sm">3</span>
                </div>
                <div className="text-left">
                  <span className="text-white font-medium text-sm">Download ZIP</span>
                  <p className="text-slate-500 text-xs">All files, one click</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Redo Feature Highlight */}
        <div className="rounded-2xl bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 p-6 md:p-8 mb-12">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-white font-bold text-lg mb-2">The Redo Button You've Been Waiting For</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Converted at 90% quality but want to try 70%? Just hit Redo. Your files stay loaded—tweak settings and re-convert instantly.
                No re-uploading, no re-selecting. Experiment until you find the perfect balance.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={() => onNavigate('converter')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-primary to-primaryDark hover:from-primary/90 hover:to-primaryDark/90 text-white font-bold rounded-xl shadow-xl shadow-primary/20 transition-all transform hover:-translate-y-1 active:translate-y-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Launch Converter
          </button>
          <p className="text-slate-500 text-sm mt-4">
            Drag, drop, convert. It's that simple.
          </p>
        </div>
      </div>
    </section>
  );
};

export default ConverterFeatures;
