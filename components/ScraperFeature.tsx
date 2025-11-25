
import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import UrlScraper from './UrlScraper';
import { ScrapedImage, ImageFile } from '../types';
import { urlToFile } from '../services/scraperService';
import { readFileAsDataURL, getImageDimensions } from '../services/imageUtils';

interface ScraperFeatureProps {
  onSendToConverter: (files: ImageFile[]) => void;
}

const ScraperFeature: React.FC<ScraperFeatureProps> = ({ onSendToConverter }) => {

  // Wrapper to handle the async fetching before navigation for better UX
  const handleProcessAndNavigate = async (images: ScrapedImage[]) => {
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
    <div className="w-full min-h-[calc(100vh-80px)]">
      <UrlScraper onImagesSelected={handleProcessAndNavigate} />
    </div>
  );
};

export default ScraperFeature;
