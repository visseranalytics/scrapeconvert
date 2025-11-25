import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="border-t border-white/5 bg-dark py-12 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-white text-xs font-bold">M</div>
              <span className="text-lg font-bold text-white">Morphix</span>
            </div>
            <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
              Secure, client-side image processing tools. Convert, resize, and scrape images without your data ever leaving your browser.
            </p>
          </div>
          
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm">Product</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="hover:text-primary cursor-pointer transition-colors">Image Converter</li>
              <li className="hover:text-primary cursor-pointer transition-colors">Web Scraper</li>
              <li className="hover:text-primary cursor-pointer transition-colors">Batch Processing</li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4 text-sm">Legal</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="hover:text-primary cursor-pointer transition-colors">Privacy Policy</li>
              <li className="hover:text-primary cursor-pointer transition-colors">Terms of Service</li>
              <li className="hover:text-primary cursor-pointer transition-colors">Cookie Policy</li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-600 text-xs">© {new Date().getFullYear()} Morphix Studio. All rights reserved.</p>
          <div className="flex gap-4">
            {/* Social Placeholders */}
            <div className="w-5 h-5 bg-slate-800 rounded hover:bg-slate-700 cursor-pointer transition-colors"></div>
            <div className="w-5 h-5 bg-slate-800 rounded hover:bg-slate-700 cursor-pointer transition-colors"></div>
            <div className="w-5 h-5 bg-slate-800 rounded hover:bg-slate-700 cursor-pointer transition-colors"></div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;