import { ConversionFormat, ConversionSettings } from '@/shared/types';

interface ConversionProfile {
  id: string;
  name: string;
  description: string;
  settings: Partial<ConversionSettings>;
}

const PROFILES: ConversionProfile[] = [
  {
    id: 'web-optimized',
    name: 'Web Optimized',
    description: 'Best balance of quality & size',
    settings: { format: ConversionFormat.WEBP, quality: 80, maxWidth: 1920, maxHeight: 1080, maintainAspectRatio: true, keepSmaller: true }
  },
  {
    id: 'high-quality',
    name: 'High Quality',
    description: 'Minimal compression',
    settings: { format: ConversionFormat.JPEG, quality: 95, maxWidth: 0, maxHeight: 0, maintainAspectRatio: true, keepSmaller: false }
  },
  {
    id: 'lossless',
    name: 'Lossless',
    description: 'No quality loss (PNG)',
    settings: { format: ConversionFormat.PNG, quality: 100, maxWidth: 0, maxHeight: 0, maintainAspectRatio: true, keepSmaller: false }
  },
  {
    id: 'small-file',
    name: 'Small File',
    description: 'Maximum compression',
    settings: { format: ConversionFormat.WEBP, quality: 60, maxWidth: 1280, maxHeight: 720, maintainAspectRatio: true, keepSmaller: true }
  },
  {
    id: 'social-media',
    name: 'Social Media',
    description: 'Optimized for sharing',
    settings: { format: ConversionFormat.JPEG, quality: 85, maxWidth: 1200, maxHeight: 1200, maintainAspectRatio: true, keepSmaller: true }
  },
  {
    id: 'thumbnail',
    name: 'Thumbnail',
    description: 'Small preview images',
    settings: { format: ConversionFormat.WEBP, quality: 75, maxWidth: 300, maxHeight: 300, maintainAspectRatio: true, keepSmaller: true }
  },
];

interface SettingsPanelProps {
  settings: ConversionSettings;
  onSettingsChange: (newSettings: ConversionSettings) => void;
  disabled: boolean;
}

const SettingsPanel = ({
  settings,
  onSettingsChange,
  disabled
}: SettingsPanelProps) => {

  const handleChange = (key: keyof ConversionSettings, value: any) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const applyProfile = (profile: ConversionProfile) => {
    onSettingsChange({ ...settings, ...profile.settings });
  };

  // Check which profile matches current settings (if any)
  const activeProfileId = PROFILES.find(p => {
    const s = p.settings;
    return s.format === settings.format &&
           s.quality === settings.quality &&
           s.maxWidth === settings.maxWidth &&
           s.maxHeight === settings.maxHeight;
  })?.id;

  return (
    <div className="glass-panel w-full rounded-xl p-4 shadow-lg border border-white/5 space-y-4">
      {/* Profile Presets */}
      <div className="flex flex-wrap gap-2">
        {PROFILES.map(profile => (
          <button
            key={profile.id}
            onClick={() => applyProfile(profile)}
            disabled={disabled}
            title={profile.description}
            className={`
              px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${activeProfileId === profile.id
                ? 'bg-primary text-white shadow-md shadow-primary/30'
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:text-white border border-slate-600/50'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {profile.name}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
        
        {/* Left: Format & Quality */}
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-center">
          <div className="relative w-full sm:w-40">
            <label className="absolute -top-2 left-2 px-1 bg-[#1e293b] text-[10px] font-bold text-slate-400 uppercase tracking-wider">Format</label>
            <select
              value={settings.format}
              onChange={(e) => handleChange('format', e.target.value)}
              disabled={disabled}
              className="w-full h-10 bg-dark/50 border border-slate-600 rounded-lg px-3 text-sm text-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none appearance-none transition-colors hover:border-slate-500 font-medium"
            >
              <option value={ConversionFormat.JPEG}>JPEG</option>
              <option value={ConversionFormat.PNG}>PNG</option>
              <option value={ConversionFormat.WEBP}>WEBP</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="w-full sm:w-48 relative border border-slate-600 rounded-lg px-4 py-2 h-10 flex items-center bg-dark/50">
             <label className="absolute -top-2 left-2 px-1 bg-[#1e293b] text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quality: {settings.quality}%</label>
             <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={settings.quality}
              onChange={(e) => handleChange('quality', parseInt(e.target.value))}
              disabled={disabled}
              className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
        </div>

        {/* Right: Dimensions */}
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-center">
           <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-28">
                <label className="absolute -top-2 left-2 px-1 bg-[#1e293b] text-[10px] font-bold text-slate-400 uppercase tracking-wider">Width</label>
                <input
                  type="number"
                  placeholder="Auto"
                  value={settings.maxWidth}
                  onChange={(e) => handleChange('maxWidth', parseInt(e.target.value))}
                  disabled={disabled}
                  className="w-full h-10 bg-dark/50 border border-slate-600 rounded-lg px-3 text-sm text-slate-200 focus:border-primary outline-none"
                />
              </div>
              <span className="text-slate-500 font-light">×</span>
              <div className="relative flex-1 sm:w-28">
                <label className="absolute -top-2 left-2 px-1 bg-[#1e293b] text-[10px] font-bold text-slate-400 uppercase tracking-wider">Height</label>
                <input
                  type="number"
                  placeholder="Auto"
                  value={settings.maxHeight}
                  onChange={(e) => handleChange('maxHeight', parseInt(e.target.value))}
                  disabled={disabled}
                  className="w-full h-10 bg-dark/50 border border-slate-600 rounded-lg px-3 text-sm text-slate-200 focus:border-primary outline-none"
                />
              </div>
           </div>

           <label className="flex items-center gap-2 cursor-pointer group select-none">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={settings.maintainAspectRatio}
                  onChange={(e) => handleChange('maintainAspectRatio', e.target.checked)}
                  disabled={disabled}
                  className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-slate-600 bg-dark checked:border-primary checked:bg-primary focus:outline-none transition-all"
                />
                <svg
                  className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 opacity-0 peer-checked:opacity-100 text-white"
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
              <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Lock Ratio</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer group select-none" title="If converted file is larger than original, keep the original">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={settings.keepSmaller}
                  onChange={(e) => handleChange('keepSmaller', e.target.checked)}
                  disabled={disabled}
                  className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-slate-600 bg-dark checked:border-primary checked:bg-primary focus:outline-none transition-all"
                />
                <svg
                  className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 opacity-0 peer-checked:opacity-100 text-white"
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
              <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Keep Smaller</span>
            </label>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;