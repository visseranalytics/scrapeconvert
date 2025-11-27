import React, { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs: FAQItem[] = [
    {
      question: "Are my images uploaded to a server?",
      answer: "No. ScrapeConvert runs entirely in your browser. Your images never leave your device—all processing happens locally using browser APIs and WebWorkers."
    },
    {
      question: "What image formats are supported?",
      answer: "You can convert between JPEG, PNG, and WebP. The scraper can pull most common image formats from websites, and you can then convert them to your preferred format."
    },
    {
      question: "How does the batch URL scraping work?",
      answer: "Enter multiple URLs (one per line), and ScrapeConvert will fetch all images from each page simultaneously. Images are deduplicated automatically, so you won't end up with multiple copies of the same asset."
    },
    {
      question: "Is there a limit to how many images I can process?",
      answer: "There's no artificial limit. The only constraint is your browser's available memory. We've tested with hundreds of images without issues."
    },
    {
      question: "Why WebP?",
      answer: "WebP typically offers 25-35% smaller file sizes compared to JPEG and PNG at equivalent quality. This means faster page loads and lower bandwidth costs in production."
    },
    {
      question: "Can I use this for production assets?",
      answer: "ScrapeConvert is designed as a development tool to speed up asset collection and optimization. The converted images are production-ready, but we recommend running them through your standard build pipeline."
    }
  ];

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-white mb-8">Frequently asked questions</h2>

        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="rounded-xl bg-surface/50 border border-slate-700/50 overflow-hidden"
            >
              <button
                onClick={() => toggle(index)}
                className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 hover:bg-surface/70 transition-colors"
              >
                <span className="text-white font-medium">{faq.question}</span>
                <svg
                  className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openIndex === index && (
                <div className="px-5 pb-4">
                  <p className="text-slate-400 text-sm leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
