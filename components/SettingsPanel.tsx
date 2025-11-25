import React from 'react';
import { ConversionFormat, ConversionSettings } from '../types';

interface SettingsPanelProps {
  settings: ConversionSettings;
  onSettingsChange: (newSettings: ConversionSettings) => void;
  disabled: boolean;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  settings, 
  onSettingsChange, 
  disabled 
}) => {
  
  const handleChange = (key: keyof ConversionSettings, value: any) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className="glass-panel w-full rounded-2xl p-6 shadow-xl border-l-4 border-l-primary">
      <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center">
        
        {/* Header Section */}
        <div className="flex items-center gap-3 lg:w-48 flex-shrink-0">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Settings</h2>
            <p className="text-xs text-slate-400">Conversion rules</p>
          </div>
        </div>

        {/* Separator */}
        <div className="hidden lg:block w-px h-16 bg-slate-700/50"></div>

        {/* Controls Grid */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
          
          {/* Format */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Format</label>
            <div className="relative">
              <select
                value={settings.format}
                onChange={(e) => handleChange('format', e.target.value)}
                disabled={disabled}
                className="w-full bg-dark/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none appearance-none transition-colors hover:border-slate-500"
              >
                <option value={ConversionFormat.JPEG}>JPEG</option>
                <option value={ConversionFormat.PNG}>PNG</option>
                <option value={ConversionFormat.WEBP}>WEBP</option>
              </select>
            </div>
          </div>

          {/* Quality */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quality</label>
              <span className="text-xs font-mono text-primary">{settings.quality}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={settings.quality}
              onChange={(e) => handleChange('quality', parseInt(e.target.value))}
              disabled={disabled}
              className="w-full h-1.5 bg-dark rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>

          {/* Dimensions */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Max Dimensions</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  placeholder="W"
                  value={settings.maxWidth}
                  onChange={(e) => handleChange('maxWidth', parseInt(e.target.value))}
                  disabled={disabled}
                  className="w-full bg-dark/50 border border-slate-600 rounded-lg pl-6 pr-2 py-2 text-sm text-slate-200 focus:border-primary outline-none"
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-[10px] font-bold">W</span>
              </div>
              <div className="relative flex-1">
                <input
                  type="number"
                  placeholder="H"
                  value={settings.maxHeight}
                  onChange={(e) => handleChange('maxHeight', parseInt(e.target.value))}
                  disabled={disabled}
                  className="w-full bg-dark/50 border border-slate-600 rounded-lg pl-6 pr-2 py-2 text-sm text-slate-200 focus:border-primary outline-none"
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-[10px] font-bold">H</span>
              </div>
            </div>
          </div>

          {/* Checkbox */}
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={settings.maintainAspectRatio}
                  onChange={(e) => handleChange('maintainAspectRatio', e.target.checked)}
                  disabled={disabled}
                  className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-slate-600 bg-dark checked:border-primary checked:bg-primary focus:outline-none transition-all"
                />
                <svg
                  className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 opacity-0 peer-checked:opacity-100 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <span className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors">Maintain Ratio</span>
            </label>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
