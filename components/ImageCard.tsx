import React from 'react';
import { ImageFile } from '../types';
import { formatBytes, getExtensionFromMimeType } from '../services/imageUtils';

interface ImageCardProps {
  item: ImageFile;
  onRemove: (id: string) => void;
}

const ImageCard: React.FC<ImageCardProps> = ({ item, onRemove }) => {
  const isDone = item.status === 'done';
  const isProcessing = item.status === 'processing';
  const isError = item.status === 'error';

  return (
    <div className={`
      relative overflow-hidden rounded-xl border transition-all duration-300
      ${isDone ? 'bg-surface border-green-500/30 hover:border-green-500/50' : 'bg-surface border-slate-700 hover:border-slate-600'}
      ${isError ? 'border-red-500/50' : ''}
    `}>
      <div className="flex flex-col sm:flex-row h-auto sm:h-28">
        
        {/* Preview Thumbnail */}
        <div className="w-full sm:w-28 h-32 sm:h-full bg-black/40 flex-shrink-0 relative group border-b sm:border-b-0 sm:border-r border-slate-700/50">
          <img 
            src={item.previewUrl} 
            alt="Original" 
            className="w-full h-full object-cover opacity-90 transition-opacity" 
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
            <span className="text-[10px] text-white/90 font-mono uppercase">Original</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate" title={item.file.name}>
                {item.file.name}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                <span className="font-mono">{item.originalWidth}×{item.originalHeight}</span>
                <span>•</span>
                <span>{formatBytes(item.file.size)}</span>
              </div>
            </div>
            
            <button 
              onClick={() => onRemove(item.id)}
              className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded-md hover:bg-slate-700/50"
              title="Remove from queue"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between">
             {/* Status Indicators */}
             <div className="flex-1">
               {isProcessing && (
                 <div className="flex items-center gap-2 text-primary">
                   <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                   <span className="text-xs font-medium animate-pulse">Converting...</span>
                 </div>
               )}

               {isError && (
                 <div className="flex items-center gap-2 text-red-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="text-xs font-medium">{item.errorMsg || 'Conversion failed'}</span>
                 </div>
               )}

               {item.status === 'idle' && (
                 <span className="text-xs text-slate-500 font-medium bg-slate-800 px-2 py-1 rounded">Ready to convert</span>
               )}

               {isDone && item.resultSize && (
                 <div className="flex items-center gap-2 text-green-400">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                     <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                   </svg>
                   <span className="text-xs font-bold">Done ({formatBytes(item.resultSize)})</span>
                 </div>
               )}
             </div>

             {/* Download Action */}
             {isDone && item.resultUrl && (
               <a 
                 href={item.resultUrl} 
                 download={`morphix_${item.file.name.split('.')[0]}.${getExtensionFromMimeType(item.outputFormat || '')}`} 
                 className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg hover:shadow-green-500/20 transform hover:-translate-y-0.5"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                   <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                 </svg>
                 Download
               </a>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCard;