import { useRef, useState, useEffect } from 'react';
import { createCrawl, type CrawlState, type CrawlMode, type CrawlDeps } from '../../lib/scrape/crawl';
import { mintSession, getSessionToken } from '../../lib/session';
import { fetchViaProxy } from '../../lib/proxy-client';
import { saveWorkbench, DEFAULT_CONVERT_OPTIONS } from '../../lib/workbench-store';
import { AppTopBar } from './shared/AppTopBar';

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

// Load the Cloudflare Turnstile script once (explicit-render mode). Resolves
// immediately if it — or a test stub — is already present on window.
let turnstileLoad: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (turnstileLoad) return turnstileLoad;
  turnstileLoad = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('turnstile-script-failed'));
    document.head.appendChild(s);
  });
  return turnstileLoad;
}

const defaultDeps: CrawlDeps = {
  fetchPage: async (url) => (await fetchViaProxy(url, 'page')).text(),
  fetchSitemap: async (url) => (await fetchViaProxy(url, 'sitemap')).text(),
};

interface Props {
  deps?: CrawlDeps;
  initialHasSession?: boolean;
  onMint?: (turnstileToken: string) => Promise<string>;
  /** Turnstile site key, injected from the Worker runtime env via scraper.astro.
   *  When absent (tests / misconfig) a plain verify button is shown instead. */
  siteKey?: string;
}

const MODES: { id: CrawlMode; label: string }[] = [
  { id: 'single', label: 'Single page' },
  { id: 'multiple', label: 'Multiple URLs' },
  { id: 'sitemap', label: 'Sitemap crawl' },
];

export function ScraperInput({ deps = defaultDeps, initialHasSession, onMint = mintSession, siteKey }: Props) {
  const [mode, setMode] = useState<CrawlMode>('single');
  const [input, setInput] = useState('');
  const [maxPages, setMaxPages] = useState(100);
  const [hasSession, setHasSession] = useState(
    initialHasSession ?? (typeof window !== 'undefined' && !!getSessionToken()),
  );
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [crawl, setCrawl] = useState<CrawlState | null>(null);
  const [running, setRunning] = useState(false);
  const ctrl = useRef<ReturnType<typeof createCrawl> | null>(null);
  const widgetHostRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Exchange a Turnstile token for a session token, then unlock the crawl.
  async function completeMint(token: string) {
    setVerifying(true);
    setVerifyError(null);
    try {
      await onMint(token);
      setHasSession(true);
    } catch {
      setVerifyError('Verification failed — please try again.');
    } finally {
      setVerifying(false);
    }
  }
  // Point the widget callback at the latest closure without re-rendering the
  // widget on every keystroke.
  const mintRef = useRef(completeMint);
  mintRef.current = completeMint;

  // Render the real Turnstile widget when a site key is configured.
  useEffect(() => {
    if (hasSession || !siteKey) return;
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        const ts = typeof window !== 'undefined' ? window.turnstile : undefined;
        const host = widgetHostRef.current;
        if (cancelled || !ts || !host || widgetIdRef.current) return;
        widgetIdRef.current = ts.render(host, {
          sitekey: siteKey,
          action: 'turnstile-spin-v1',
          theme: 'dark',
          callback: (token: string) => void mintRef.current(token),
          'error-callback': () => setVerifyError('Verification error — refresh and try again.'),
          'expired-callback': () => {
            if (widgetIdRef.current) ts.reset(widgetIdRef.current);
          },
        });
      })
      .catch(() => setVerifyError('Could not load the verification widget.'));
    return () => {
      cancelled = true;
      const ts = typeof window !== 'undefined' ? window.turnstile : undefined;
      if (ts && widgetIdRef.current) {
        try {
          ts.remove(widgetIdRef.current);
        } catch {
          /* widget already gone */
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, hasSession]);

  async function find() {
    if (!hasSession || !input.trim()) return;
    setRunning(true);
    const c = createCrawl({ mode, input, maxPages, deps, onUpdate: (s) => setCrawl({ ...s }) });
    ctrl.current = c;
    const final = await c.start();
    saveWorkbench({ images: final.images, options: DEFAULT_CONVERT_OPTIONS, source: input });
    setCrawl({ ...final });
    setRunning(false);
  }

  return (
    <>
      <AppTopBar active="scraper" hasSession={hasSession} />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-accent-400">Scraper</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">Tell it where to pull images from.</h1>

        <div className="mt-8 rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
          <div role="tablist" aria-label="Scrape mode" className="flex gap-1 rounded-lg border border-white/10 bg-zinc-950 p-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                role="tab"
                aria-selected={mode === m.id}
                onClick={() => setMode(m.id)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm ${mode === m.id ? 'bg-accent-400/10 text-accent-300' : 'text-zinc-400'}`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {mode === 'multiple' ? (
              <textarea
                aria-label="URLs, one per line"
                rows={4}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="https://example.com/page-1&#10;https://example.com/page-2"
                className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200"
              />
            ) : (
              <input
                aria-label={mode === 'sitemap' ? 'Sitemap URL' : 'Page URL'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={mode === 'sitemap' ? 'https://example.com/sitemap.xml' : 'https://example.com'}
                className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200"
              />
            )}
            {mode === 'sitemap' && (
              <label className="mt-3 flex items-center gap-2 font-mono text-xs text-zinc-400">
                Max pages to crawl
                <input
                  type="number"
                  aria-label="Max pages to crawl"
                  value={maxPages}
                  min={1}
                  onChange={(e) => setMaxPages(Number(e.target.value) || 1)}
                  className="w-24 rounded-md border border-white/10 bg-zinc-950 px-2 py-1 text-right text-zinc-200"
                />
              </label>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            {hasSession ? (
              <button
                onClick={find}
                disabled={running || !input.trim()}
                className="inline-flex items-center rounded-lg bg-accent-400 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50"
              >
                {running ? 'Finding…' : 'Find images'}
              </button>
            ) : siteKey ? (
              <div className="flex flex-col gap-1.5">
                <div ref={widgetHostRef} aria-label="Verify you are human" />
                {verifying && <span className="font-mono text-xs text-zinc-400">Verifying…</span>}
                {verifyError && <span className="font-mono text-xs text-amber-400">{verifyError}</span>}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => void completeMint('turnstile-token-placeholder')}
                  disabled={verifying}
                  className="inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-zinc-100"
                >
                  {verifying ? 'Verifying…' : 'Verify you are human'}
                </button>
                {verifyError && <span className="font-mono text-xs text-amber-400">{verifyError}</span>}
              </div>
            )}
            <span className="font-mono text-xs text-zinc-500">Reads &lt;img&gt; tags and CSS background-image. Public images only.</span>
          </div>
        </div>

        {crawl && (
          <section className="mt-6 rounded-2xl border border-white/10 bg-zinc-900/60 p-5" aria-label="Crawl progress">
            {crawl.discovery.length > 0 && (
              <ul className="mb-4 space-y-1 font-mono text-xs">
                {crawl.discovery.map((d) => (
                  <li key={d.url} className="flex justify-between text-zinc-400">
                    <span>{d.label}</span>
                    <span className={d.status === 'found' ? 'text-accent-300' : 'text-zinc-500'}>{d.status}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-between font-mono text-xs text-zinc-400">
              <span>{crawl.needsVerification ? 'Verify to continue' : `${crawl.imageCount} images · ${crawl.pageCount} pages`}</span>
              <span>{crawl.status}</span>
            </div>
            <ul className="mt-3 max-h-48 space-y-1 overflow-auto font-mono text-[11px]">
              {crawl.log.map((l, i) => (
                <li key={l.url + i} className="flex justify-between text-zinc-400">
                  <span className="truncate">{l.url}</span>
                  <span className={l.status === 'error' ? 'text-amber-400' : l.status === 'done' ? 'text-accent-300' : 'text-zinc-500'}>
                    {l.status === 'done' ? `${l.imageCount} images` : l.status}
                  </span>
                </li>
              ))}
            </ul>
            {crawl.images.length > 0 && (
              <a href="/workbench" className="mt-4 inline-flex items-center rounded-lg bg-accent-400 px-4 py-2 text-sm font-medium text-zinc-950">
                Open Workbench ({crawl.images.length})
              </a>
            )}
          </section>
        )}
      </main>
    </>
  );
}
