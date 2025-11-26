import { Link } from 'react-router-dom';

const NotFoundPage = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-8xl font-bold text-primary mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-white mb-2">Page Not Found</h2>
      <p className="text-slate-400 mb-8 max-w-md">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="flex gap-4">
        <Link
          to="/"
          className="px-6 py-3 bg-primary hover:bg-primaryDark text-white font-medium rounded-lg transition-colors"
        >
          Go Home
        </Link>
        <Link
          to="/converter"
          className="px-6 py-3 bg-surface hover:bg-surface/80 text-white font-medium rounded-lg border border-white/10 transition-colors"
        >
          Try Converter
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
