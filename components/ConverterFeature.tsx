import React, { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
import Dropzone from './Dropzone';
import SettingsPanel from './SettingsPanel';
import ImageCard from './ImageCard';
import { ImageFile, ConversionSettings, ConversionFormat } from '../types';
import { readFileAsDataURL, getImageDimensions, convertImage, getExtensionFromMimeType } from '../services/imageUtils';

interface ConverterFeatureProps {
  files: ImageFile[];
  setFiles: React.Dispatch<React.SetStateAction<ImageFile[]>>;
}

const ConverterFeature: React.FC<ConverterFeatureProps> = ({ files, setFiles }) => {
  const [settings, setSettings] = useState<ConversionSettings>({
    format: ConversionFormat.JPEG,
    quality: 90,
    maxWidth: 1920,
    maxHeight: 1080,
    maintainAspectRatio: true,
  });
  const [isZipping, setIsZipping] = useState(false);

  const handleFilesSelected = useCallback(async (newFiles: File[]) => {
    const newImageFiles: ImageFile[] = await Promise.all(
      newFiles.map(async (file) => {
        const previewUrl = await readFileAsDataURL(file);
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
    setFiles((prev) => [...prev, ...newImageFiles]);
  }, [setFiles]);

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClearAll = () => {
    files.forEach(f => {
      if (f.resultUrl) URL.revokeObjectURL(f.resultUrl);
    });
    setFiles([]);
  };

  const handleConvertAll = async () => {
    const filesToProcess = files.filter(f => f.status === 'idle' || f.status === 'error');
    if (filesToProcess.length === 0) return;

    setFiles(prev => prev.map(f => 
      (f.status === 'idle' || f.status === 'error') ? { ...f, status: 'processing', errorMsg: undefined } : f
    ));
    
    const currentSettings = { ...settings };

    const results = await Promise.all(filesToProcess.map(async (item) => {
      if (item.file.size === 0 && item.originalWidth === 0) {
         return { id: item.id, status: 'error', errorMsg: 'Image not fully loaded yet' } as const;
      }

      try {
        const blob = await convertImage(
          item.previewUrl,
          currentSettings.format,
          currentSettings.quality,
          currentSettings.maxWidth,
          currentSettings.maxHeight,
          currentSettings.maintainAspectRatio
        );
        const resultUrl = URL.createObjectURL(blob);
        return { 
          id: item.id, 
          status: 'done', 
          resultUrl, 
          resultSize: blob.size,
          outputFormat: currentSettings.format 
        } as const;
      } catch (error: any) {
        return { id: item.id, status: 'error', errorMsg: error.message || 'Unknown error' } as const;
      }
    }));

    setFiles(prev => prev.map(f => {
      const result = results.find(r => r.id === f.id);
      if (result) return { ...f, ...result };
      return f;
    }));
  };

  const handleDownloadAll = async () => {
    const doneFiles = files.filter(f => f.status === 'done' && f.resultUrl);
    if (doneFiles.length === 0) return;

    setIsZipping(true);
    try {
      const zip = new JSZip();
      const nameTracker: Record<string, number> = {};

      // Process sequentially to manage names correctly
      for (const file of doneFiles) {
        if (!file.resultUrl) continue;
        const response = await fetch(file.resultUrl);
        const blob = await response.blob();
        const ext = getExtensionFromMimeType(file.outputFormat || 'image/jpeg');
        
        // Strip existing extension and sanitize
        let baseName = file.file.name.substring(0, file.file.name.lastIndexOf('.')) || file.file.name;
        baseName = baseName.replace(/[^a-z0-9_-]/gi, '_');

        let fileName = `${baseName}.${ext}`;
        
        if (nameTracker[fileName]) {
           nameTracker[fileName]++;
           fileName = `${baseName}_${nameTracker[fileName]}.${ext}`;
        } else {
           nameTracker[fileName] = 1;
        }

        zip.file(fileName, blob);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'morphix_batch_converted.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Failed to zip files", error);
    } finally {
      setIsZipping(false);
    }
  };

  const isProcessing = files.some(f => f.status === 'processing');
  const hasFiles = files.length > 0;
  
  // Logic for button state
  const isAllProcessed = files.length > 0 && files.every(f => f.status === 'done' || f.status === 'error');
  const hasSuccessfulConversions = files.some(f => f.status === 'done');
  const showDownloadAll = isAllProcessed && hasSuccessfulConversions;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-6">
      
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white mb-2">Image Converter</h2>
        <p className="text-slate-400">Optimize and format your images in bulk.</p>
      </div>

      {/* Settings */}
      <div className="w-full">
         <SettingsPanel 
            settings={settings} 
            onSettingsChange={setSettings}
            disabled={isProcessing}
          />
      </div>

      {/* Input */}
      <div className="w-full">
         <Dropzone onFilesSelected={handleFilesSelected} />
      </div>

      {/* Queue & Results */}
      <div className="w-full">
         {hasFiles ? (
            <div className="bg-dark/30 rounded-2xl border border-slate-700/30 p-4 md:p-6 min-h-[200px]">
              <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                 <h3 className="text-xl font-bold text-white flex items-center gap-2">
                   Queue
                   <span className="text-sm font-normal text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{files.length}</span>
                 </h3>
                 
                 <div className="flex gap-3 w-full sm:w-auto">
                   <button
                     onClick={handleClearAll}
                     disabled={isProcessing || isZipping}
                     className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors disabled:opacity-50 hover:bg-white/5 rounded-lg border border-transparent hover:border-slate-600"
                   >
                     Clear
                   </button>
                   <button
                     onClick={showDownloadAll ? handleDownloadAll : handleConvertAll}
                     disabled={isProcessing || isZipping || (!hasFiles && !isAllProcessed)}
                     className={`
                       flex-1 sm:flex-none relative overflow-hidden px-6 py-2 rounded-lg text-sm font-bold text-white shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2
                       ${(isProcessing || isZipping)
                         ? 'bg-slate-600 cursor-not-allowed shadow-none' 
                         : showDownloadAll
                           ? 'bg-green-600 hover:bg-green-500 shadow-green-500/30'
                           : 'bg-gradient-to-r from-primary to-primaryDark hover:shadow-primary/40'
                       }
                     `}
                   >
                     {(isProcessing) && (
                       <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                     )}
                     {isProcessing ? 'Processing...' : 
                      isZipping ? 'Zipping...' : 
                      showDownloadAll ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          Download All (ZIP)
                        </>
                      ) : 'Start Conversion'}
                   </button>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {files.map((file) => (
                  <ImageCard 
                    key={file.id} 
                    item={file} 
                    onRemove={handleRemoveFile} 
                  />
                ))}
              </div>
            </div>
         ) : (
           <div className="text-center py-12 opacity-50 border-2 border-dashed border-slate-800 rounded-xl">
             <p className="text-slate-500">Queue is empty. Add files above.</p>
           </div>
         )}
      </div>
    </div>
  );
};

export default ConverterFeature;