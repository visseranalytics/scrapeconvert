interface Props {
  active: 'scraper' | 'workbench';
  hasSession: boolean;
}

const tab = 'rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-400';
const activeTab = 'rounded-lg px-3 py-2 text-sm font-medium text-zinc-100';

export function AppTopBar({ active, hasSession }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/80 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 lg:px-6" aria-label="App">
        <a href="/" className="flex items-center gap-2 font-mono text-sm font-semibold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-md bg-white" aria-hidden="true">
            <img src="/images/logo-mark.png" alt="" className="h-full w-full object-cover" />
          </span>
          <span><span className="text-zinc-50">Scrape</span><span className="text-accent-400">Convert</span></span>
        </a>
        <div className="flex items-center gap-1">
          <a href="/scraper" className={active === 'scraper' ? activeTab : tab} aria-current={active === 'scraper' ? 'page' : undefined}>Scraper</a>
          <a href="/workbench" className={active === 'workbench' ? activeTab : tab} aria-current={active === 'workbench' ? 'page' : undefined}>Workbench</a>
        </div>
        <div className="flex items-center gap-3">
          <a href="https://github.com/scrapeconvert/scrapeconvert" className="font-mono text-xs text-zinc-400 hover:text-zinc-100">GitHub</a>
          {hasSession && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-400/30 bg-accent-400/10 px-2.5 py-1 font-mono text-xs text-accent-300" data-testid="verified-chip">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-400" aria-hidden="true" />
              verified
            </span>
          )}
        </div>
      </nav>
    </header>
  );
}
