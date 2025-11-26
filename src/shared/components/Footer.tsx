import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="border-t border-white/5 bg-dark py-12 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <img
                src="/images/favicon.png"
                alt="ScrapeConvert"
                className="h-8 w-8"
              />
              <span className="text-xl font-bold">
                <span className="text-[#2d5a87]">Scrape</span>
                <span className="text-[#e8832a]">Convert</span>
              </span>
            </Link>
            <p className="text-slate-400 text-sm max-w-xs">
              Extract images from any website and convert them to modern formats.
              100% client-side processing.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Product</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/converter" className="text-slate-400 hover:text-white text-sm transition-colors">
                  Image Converter
                </Link>
              </li>
              <li>
                <Link to="/scraper" className="text-slate-400 hover:text-white text-sm transition-colors">
                  Web Scraper
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/terms" className="text-slate-400 hover:text-white text-sm transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-slate-400 hover:text-white text-sm transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/acceptable-use" className="text-slate-400 hover:text-white text-sm transition-colors">
                  Acceptable Use
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/5 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-500 text-sm">
            &copy; {new Date().getFullYear()} ScrapeConvert. All rights reserved.
          </p>
          <p className="text-slate-500 text-sm">
            Powered by{" "}
            <a
              href="https://visseranalytics.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primaryDark transition-colors font-medium"
            >
              Visser Analytics
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
