import { ImageFile, ConversionFormat } from '@/shared/types';
import { formatBytes, getExtensionFromMimeType } from '@/shared/services/imageUtils';

interface ImageCardProps {
  item: ImageFile;
  onRemove: (id: string) => void;
  targetFormat?: ConversionFormat;
}

const ImageCard = ({ item, onRemove, targetFormat }: ImageCardProps) => {
  const isDone = item.status === 'done';
  const isProcessing = item.status === 'processing';
  const isError = item.status === 'error';
  const keptOriginal = item.keptOriginal;

  // Determine extensions for the badge
  const sourceExt = getExtensionFromMimeType(item.file.type || 'image/jpeg').toUpperCase();
  
  // Target extension: 
  // If done, use the actual output format.
  // If not done, use the global target format passed in props.
  const destExt = isDone && item.outputFormat
    ? getExtensionFromMimeType(item.outputFormat).toUpperCase()
    : targetFormat
      ? getExtensionFromMimeType(targetFormat).toUpperCase()
      : '...';

  return (
    <div className={`
      relative overflow-hidden rounded-xl border transition-all duration-300
      ${isDone && !keptOriginal ? 'bg-surface border-green-500/30 hover:border-green-500/50' : 'bg-surface border-slate-700 hover:border-slate-600'}
      ${isDone && keptOriginal ? 'border-amber-500/30 hover:border-amber-500/50' : ''}
      ${isError ? 'border-red-500/50' : ''}
    `}>
      <div className="flex flex-col sm:flex-row h-auto sm:h-32">
        
        {/* Preview Thumbnail */}
        <div className="w-full sm:w-32 h-32 sm:h-full bg-black/40 flex-shrink-0 relative group border-b sm:border-b-0 sm:border-r border-slate-700/50">
          <img 
            src={item.previewUrl} 
            alt="Preview" 
            className="w-full h-full object-cover opacity-90 transition-opacity" 
          />
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col justify-between overflow-hidden">
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-white truncate" title={item.file.name}>
                {item.file.name}
              </h3>
              
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-xs text-slate-400">
                {/* Format Badge */}
                <div className="flex items-center gap-1.5 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/50 whitespace-nowrap">
                    <span className="font-bold text-slate-300">{sourceExt}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    <span className={`font-bold ${isDone ? 'text-green-400' : 'text-primary'}`}>
                        {destExt}
                    </span>
                </div>

                <span className="hidden sm:inline">•</span>
                <span className="font-mono whitespace-nowrap">{item.originalWidth}×{item.originalHeight}</span>
                <span className="hidden sm:inline">•</span>
                
                {/* Size Logic */}
                {isDone && item.resultSize ? (
                  keptOriginal ? (
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <span className="text-amber-400 font-bold">{formatBytes(item.resultSize)}</span>
                      <span className="text-amber-400 text-[10px]">(kept original)</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <span className="line-through decoration-slate-500 opacity-60">{formatBytes(item.file.size)}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-green-400 font-bold">{formatBytes(item.resultSize)}</span>
                    </div>
                  )
                ) : (
                  <span className="whitespace-nowrap">{formatBytes(item.file.size)}</span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* View Full Button (Newly Added) */}
              <a 
                href={item.previewUrl} 
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-md hover:bg-slate-700/50"
                title="View Full Image"
              >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                 </svg>
              </a>

              {/* Download Action */}
              {isDone && item.resultUrl && (
                <a 
                  href={item.resultUrl} 
                  download={`scrapeconvert_${item.file.name.split('.')[0]}.${getExtensionFromMimeType(item.outputFormat || '')}`} 
                  className="text-slate-400 hover:text-green-400 transition-colors p-1.5 rounded-md hover:bg-slate-700/50"
                  title="Download"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </a>
              )}
              
              <button 
                onClick={() => onRemove(item.id)}
                className="text-slate-400 hover:text-red-400 transition-colors p-1.5 rounded-md hover:bg-slate-700/50"
                title="Remove from queue"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between">
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

               {isDone && keptOriginal && (
                 <div className="flex items-center gap-2 text-amber-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="text-xs font-medium">Converted file was larger - original kept</span>
                 </div>
               )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCard;
