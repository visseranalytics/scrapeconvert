import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { AppProvider } from '../context/AppContext';
import Navbar from './Navbar';
import Footer from './Footer';

const Layout = () => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <AppProvider>
      <div className="min-h-screen bg-dark bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-surface to-dark flex flex-col font-sans">
        <Navbar />
        <main className="flex-grow pt-16">
          <Outlet />
        </main>
        <Footer />
      </div>
      <Analytics />
    </AppProvider>
  );
};

export default Layout;
