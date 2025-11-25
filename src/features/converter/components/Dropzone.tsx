import { useState, useCallback, useRef, DragEvent, ChangeEvent } from 'react';

interface DropzoneProps {
  onFilesSelected: (files: File[]) => void;
  compact?: boolean;
}

const Dropzone = ({ onFilesSelected, compact = false }: DropzoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files) as File[];
      const imageFiles = droppedFiles.filter(file => file.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        onFilesSelected(imageFiles);
      }
    }
  }, [onFilesSelected]);

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files) as File[];
      const imageFiles = selectedFiles.filter(file => file.type.startsWith('image/'));
      onFilesSelected(imageFiles);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  if (compact) {
    return (
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleButtonClick}
        className={`
          relative w-full py-3 px-4 border border-dashed rounded-lg cursor-pointer transition-all duration-200 ease-in-out group
          ${isDragging
            ? 'border-primary bg-primary/10'
            : 'border-slate-600 hover:border-primary hover:bg-surface/50'
          }
        `}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInput}
          multiple
          accept="image/*"
          className="hidden"
        />

        <div className="flex items-center justify-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 ${isDragging ? 'text-primary' : 'text-slate-400 group-hover:text-primary'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span className={`text-sm font-medium ${isDragging ? 'text-primary' : 'text-slate-400 group-hover:text-slate-200'}`}>
            {isDragging ? 'Drop to add more' : 'Add more images'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleButtonClick}
      className={`
        relative w-full p-10 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ease-in-out group
        ${isDragging
          ? 'border-primary bg-primary/10 scale-[1.01]'
          : 'border-slate-600 hover:border-primary hover:bg-surface'
        }
      `}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInput}
        multiple
        accept="image/*"
        className="hidden"
      />

      <div className="flex flex-col items-center justify-center space-y-4 text-center">
        <div className={`
          p-4 rounded-full bg-surface shadow-lg transition-transform duration-300
          ${isDragging ? 'scale-110 text-primary' : 'text-slate-400 group-hover:text-primary'}
        `}>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div>
          <p className="text-xl font-medium text-slate-200">
            {isDragging ? 'Drop images here' : 'Click or drop images here'}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Supports JPG, PNG, WEBP, SVG, GIF
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dropzone;