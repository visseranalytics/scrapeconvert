import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Hero from './components/Hero';
import ConverterFeature from './components/ConverterFeature';
import ScraperFeature from './components/ScraperFeature';
import { ImageFile } from './types';

type Page = 'home' | 'converter' | 'scraper';

const App: React.FC = () => {
  const [activePage, setActivePage] = useState<Page>('home');
  // State lifted to App to persist data between tab switches
  const [converterFiles, setConverterFiles] = useState<ImageFile[]>([]);

  const navigateTo = (page: Page) => {
    window.scrollTo(0, 0);
    setActivePage(page);
  };

  const handleScraperHandoff = (files: ImageFile[]) => {
    // "Wipes out whatever else was in there" - User Request
    // We replace the entire converterFiles state with the new batch from Scraper
    setConverterFiles(files);
    navigateTo('converter');
  };

  return (
    <div className="min-h-screen bg-dark bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-surface to-dark flex flex-col font-sans">
      
      <Navbar activePage={activePage} onNavigate={navigateTo} />

      <main className="flex-grow pt-16">
        {activePage === 'home' && (
          <Hero onNavigate={navigateTo} />
        )}

        {activePage === 'converter' && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <ConverterFeature 
              files={converterFiles} 
              setFiles={setConverterFiles} 
            />
          </div>
        )}

        {activePage === 'scraper' && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <ScraperFeature onSendToConverter={handleScraperHandoff} />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default App;