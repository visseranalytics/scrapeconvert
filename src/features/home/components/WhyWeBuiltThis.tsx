import React from 'react';

const WhyWeBuiltThis: React.FC = () => {
  const painPoints = [
    {
      problem: "No batch URL support",
      desc: "Other tools force you to scrape one page at a time. We needed to pull assets from multiple URLs in one go."
    },
    {
      problem: "Manual WebP conversion",
      desc: "After downloading, we'd have to convert each image to WebP separately. That's time we'd rather spend building."
    },
    {
      problem: "Duplicate images everywhere",
      desc: "Scraped folders full of the same image in different sizes. ScrapeConvert deduplicates automatically."
    },
    {
      problem: "Workflow interruptions",
      desc: "Switching between tools, waiting for uploads, managing downloads—it all adds up and kills momentum."
    }
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-white mb-4">Why we built ScrapeConvert</h2>
        <p className="text-slate-400 mb-8">
          At <span className="text-white font-medium">Visser Analytics</span>, we kept running into the same friction during development—collecting and optimizing image assets was painfully slow. Existing tools didn't cut it:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {painPoints.map((item, i) => (
            <div key={i} className="p-5 rounded-xl bg-surface/50 border border-slate-700/50">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex-shrink-0">
                  <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">{item.problem}</h3>
                  <p className="text-slate-400 text-sm">{item.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-slate-400 mt-8">
          ScrapeConvert is the internal tool we built to solve these problems. It runs entirely in your browser during development, so there's no uploading, no waiting, and no friction—just fast asset collection and optimization.
        </p>
      </div>
    </section>
  );
};

export default WhyWeBuiltThis;
