import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import UrlScraper from './UrlScraper';
import { ScrapedImage, ImageFile } from '../types';
import { urlToFile, fetchHtml } from '../services/scraperService';
import { readFileAsDataURL, getImageDimensions } from '../services/imageUtils';

interface ScraperFeatureProps {
  onSendToConverter: (files: ImageFile[]) => void;
}

const ScraperFeature: React.FC<ScraperFeatureProps> = ({ onSendToConverter }) => {

  const handleImagesSelected = async (images: ScrapedImage[]) => {
    // Convert scraped items to ImageFile format used by converter
    // We create placeholders initially then load in background
    const newFileEntries: ImageFile[] = images.map(img => ({
      id: uuidv4(),
      file: new File([], img.name), // Placeholder
      previewUrl: img.url,
      originalWidth: 0,
      originalHeight: 0,
      status: 'idle',
    }));
    
    // Trigger the switch immediately
    onSendToConverter(newFileEntries);

    // Process actual file objects asynchronously (this will likely happen after unmount/state update
    // in a real app, but since we are lifting state up in App.tsx, the references are shared).
    // Note: In this architecture, we are handing off to the App state. 
    // To make this robust, we should probably fetch them *before* navigating or pass the promise.
    // For UI responsiveness, we'll fetch them here and assume the App state updates the reference.
    
    // NOTE: In a strictly separated page architecture, we might lose this processing if component unmounts.
    // However, since we're using conditional rendering in App.tsx, the actual "state" is in App.tsx, 
    // but this component unmounts. 
    
    // Better Approach: Do the fetching here, show a loader, THEN navigate.
  };

  // Wrapper to handle the async fetching before navigation for better UX
  const handleProcessAndNavigate = async (images: ScrapedImage[]) => {
    // Show some global loading or local loading? UrlScraper handles selection.
    // We will do a quick fetch loop here.
    
    const processedFiles: ImageFile[] = await Promise.all(images.map(async (img) => {
        try {
            const file = await urlToFile(img.url, img.name);
            const previewUrl = await readFileAsDataURL(file);
            const { width, height } = await getImageDimensions(previewUrl);
            return {
                id: uuidv4(),
                file,
                previewUrl,
                originalWidth: width,
                originalHeight: height,
                status: 'idle' as const
            };
        } catch (e) {
            // Fallback for failed fetches
            return {
                id: uuidv4(),
                file: new File([], img.name),
                previewUrl: img.url,
                originalWidth: 0,
                originalHeight: 0,
                status: 'error' as const,
                errorMsg: 'Failed to retrieve source'
            };
        }
    }));

    onSendToConverter(processedFiles);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white mb-2">Web Scraper</h2>
        <p className="text-slate-400">Extract images from websites for your projects.</p>
      </div>

      <UrlScraper onImagesSelected={handleProcessAndNavigate} />
    </div>
  );
};

export default ScraperFeature;