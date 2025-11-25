import { useNavigate } from 'react-router-dom';
import Hero from './components/Hero';
import WhyWeBuiltThis from './components/WhyWeBuiltThis';
import Pricing from './components/Pricing';
import FAQ from './components/FAQ';
import Support from './components/Support';

const HomePage = () => {
  const navigate = useNavigate();

  const handleNavigate = (page: 'converter' | 'scraper') => {
    navigate(`/${page}`);
  };

  return (
    <>
      <Hero onNavigate={handleNavigate} />
      <WhyWeBuiltThis />
      <Pricing />
      <FAQ />
      <Support />
    </>
  );
};

export default HomePage;
