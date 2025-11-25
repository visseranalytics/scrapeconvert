import { ReactNode } from 'react';

interface PageHeroProps {
  title: string;
  subtitle: string;
  accentColor?: 'primary' | 'secondary';
  badge?: {
    text: string;
    icon?: ReactNode;
  };
  actions?: ReactNode;
}

const PageHero = ({
  title,
  subtitle,
  accentColor = 'primary',
  badge,
  actions
}: PageHeroProps) => {
  const accentClasses = {
    primary: {
      blur1: 'bg-primary/20',
      blur2: 'bg-blue-400/10',
      badge: 'border-primary/30 text-primary',
    },
    secondary: {
      blur1: 'bg-secondary/20',
      blur2: 'bg-emerald-400/10',
      badge: 'border-secondary/30 text-secondary',
    },
  };

  const accent = accentClasses[accentColor];

  return (
    <div className="relative py-16 md:py-20 text-center overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className={`absolute top-10 left-1/4 w-64 h-64 ${accent.blur1} rounded-full blur-[100px] opacity-60`}></div>
        <div className={`absolute bottom-10 right-1/4 w-72 h-72 ${accent.blur2} rounded-full blur-[120px] opacity-40`}></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4">
        {badge && (
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border ${accent.badge} mb-6 backdrop-blur-sm`}>
            {badge.icon}
            <span className="text-xs font-medium">{badge.text}</span>
          </div>
        )}

        <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 mb-4 tracking-tight leading-tight pb-1">
          {title}
        </h1>

        <p className="text-slate-400 max-w-2xl mx-auto text-lg leading-relaxed mb-8">
          {subtitle}
        </p>

        {actions && (
          <div className="flex flex-wrap gap-4 justify-center">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHero;
