import { useNavigate } from 'react-router-dom';
import { PageHero } from '@/shared/components';
import { useAppContext } from '@/shared/context/AppContext';
import ConverterFeature from './ConverterFeature';

const ConverterPage = () => {
  const navigate = useNavigate();
  const { converterFiles, setConverterFiles } = useAppContext();
  const hasFiles = converterFiles.length > 0;

  return (
    <div className="animate-in fade-in zoom-in-95 duration-300">
      <PageHero
        title="Image Converter"
        subtitle="Resize, compress, and convert your images to WebP, JPEG, or PNG. All processing happens locally in your browser—your files never leave your device."
        accentColor="primary"
        badge={{
          text: "Browser-native processing",
          icon: (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          ),
        }}
        actions={
          !hasFiles && (
            <button
              onClick={() => navigate('/scraper')}
              className="px-5 py-2.5 bg-surface hover:bg-slate-700 border border-slate-700 text-white font-medium rounded-xl transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              Or scrape from URL
            </button>
          )
        }
      />

      <ConverterFeature files={converterFiles} setFiles={setConverterFiles} />
    </div>
  );
};

export default ConverterPage;
