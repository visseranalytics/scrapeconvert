import React, { useState, createContext, useContext } from 'react';
import { ImageFile } from '../types';

interface AppContextType {
  converterFiles: ImageFile[];
  setConverterFiles: React.Dispatch<React.SetStateAction<ImageFile[]>>;
}

const AppContext = createContext<AppContextType | null>(null);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: React.ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [converterFiles, setConverterFiles] = useState<ImageFile[]>([]);

  return (
    <AppContext.Provider value={{ converterFiles, setConverterFiles }}>
      {children}
    </AppContext.Provider>
  );
};
