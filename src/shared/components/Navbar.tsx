import { NavLink, Link, useLocation } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();

  const navLinkClass = ({ isActive }: { isActive: boolean }) => `
    px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
    ${isActive
      ? 'text-white bg-white/10 shadow-sm'
      : 'text-slate-400 hover:text-white hover:bg-white/5'
    }
  `;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-dark/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primaryDark flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary/30 group-hover:shadow-primary/50 transition-all">
              M
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-white leading-none">Morphix</span>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest leading-none mt-1">Studio</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-2">
            <NavLink to="/" className={navLinkClass} end>
              Overview
            </NavLink>
            <NavLink to="/converter" className={navLinkClass}>
              Converter
            </NavLink>
            <NavLink
              to="/scraper"
              className={({ isActive }) => navLinkClass({
                isActive: isActive || location.pathname.startsWith('/scraper')
              })}
            >
              Web Scraper
            </NavLink>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button className="text-slate-400 hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
