import { useNavigate } from 'react-router-dom';
import Hero from './components/Hero';
import ConverterFeatures from './components/ConverterFeatures';
import ScraperFeatures from './components/ScraperFeatures';
import WhyWeBuiltThis from './components/WhyWeBuiltThis';
import Pricing from './components/Pricing';
import FAQ from './components/FAQ';

const HomePage = () => {
  const navigate = useNavigate();

  const handleNavigate = (page: 'converter' | 'scraper') => {
    navigate(`/${page}`);
  };

  return (
    <>
      <Hero onNavigate={handleNavigate} />
      <ConverterFeatures onNavigate={handleNavigate} />
      <ScraperFeatures onNavigate={handleNavigate} />
      <WhyWeBuiltThis />
      <Pricing />
      <FAQ />
    </>
  );
};

export default HomePage;
