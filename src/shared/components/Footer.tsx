const Footer = () => {
  return (
    <footer className="border-t border-white/5 bg-dark py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-secondary flex items-center justify-center text-white text-[8px] font-bold">SC</div>
            <span className="text-lg font-bold text-white">ScrapeConvert</span>
          </div>

          <p className="text-slate-500 text-sm">
            Powered by <a href="https://visseranalytics.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primaryDark transition-colors font-medium">Visser Analytics</a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
