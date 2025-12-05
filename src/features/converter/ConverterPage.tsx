import { useNavigate } from 'react-router-dom';
import { useState, useCallback, DragEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PageHero } from '@/shared/components';
import { useAppContext } from '@/shared/context/AppContext';
import { getImageDimensions } from '@/shared/services/imageUtils';
import { ImageFile } from '@/shared/types';
import ConverterFeature from './ConverterFeature';

const ConverterPage = () => {
  const navigate = useNavigate();
  const { converterFiles, setConverterFiles } = useAppContext();
  const hasFiles = converterFiles.length > 0;
  const [isDraggingOnPage, setIsDraggingOnPage] = useState(false);

  const handleFilesSelected = useCallback(
    async (newFiles: File[]) => {
      const imageFiles = newFiles.filter(file => file.type.startsWith('image/'));
      if (imageFiles.length === 0) return;

      const newImageFiles: ImageFile[] = await Promise.all(
        imageFiles.map(async (file) => {
          const previewUrl = URL.createObjectURL(file);
          const { width, height } = await getImageDimensions(previewUrl);
          return {
            id: uuidv4(),
            file,
            previewUrl,
            originalWidth: width,
            originalHeight: height,
            status: 'idle',
          };
        })
      );
      setConverterFiles((prev) => [...prev, ...newImageFiles]);
    },
    [setConverterFiles]
  );

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOnPage(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if leaving the page container itself
    if (e.currentTarget === e.target) {
      setIsDraggingOnPage(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOnPage(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files) as File[];
      handleFilesSelected(droppedFiles);
    }
  }, [handleFilesSelected]);

  return (
    <div
      className="animate-in fade-in zoom-in-95 duration-300 min-h-[calc(100vh-4rem)] relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Full-page drop overlay */}
      {isDraggingOnPage && (
        <div className="fixed inset-0 z-50 bg-dark/90 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="border-2 border-dashed border-primary rounded-3xl p-16 bg-primary/10 animate-pulse">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-4 rounded-full bg-primary/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-white">Drop images anywhere</p>
              <p className="text-slate-400">Release to add images to the converter</p>
            </div>
          </div>
        </div>
      )}
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
