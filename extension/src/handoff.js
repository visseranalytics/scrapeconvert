// Builds a ScrapedImage[] payload from the popup selection and hands it to the
// ScrapeConvert web Workbench. No proxy and no Turnstile: the extension only
// passes already-resolved URLs; the Workbench fetches their bytes (via its own
// proxy) at convert time. Mirrors the ScrapedImage shape from src/lib/types.ts.

export const DEFAULT_WORKBENCH_BASE = 'https://scrapeconvert.com';
export const HANDOFF_STORAGE_KEY = 'sc.handoff';

function deriveName(url) {
  try {
    const path = new URL(url).pathname;
    const last = path.split('/').pop() || 'image';
    return last || 'image';
  } catch {
    return 'image';
  }
}

function deriveFormat(url) {
  const m = /\.([a-z0-9]+)(?:$|[?#])/i.exec(url);
  const ext = (m ? m[1] : '').toLowerCase();
  const known = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'bmp'];
  return (known.includes(ext) ? (ext === 'jpeg' ? 'jpg' : ext) : 'jpg').toUpperCase();
}

function newId() {
  return globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

// Map the content-script image objects ({url, alt, width, height, ...}) to the
// CONTRACT ScrapedImage shape the Workbench ingests.
export function buildHandoffPayload(selected, pageUrl, pageTitle) {
  return selected.map((i) => {
    const o = {
      id: newId(),
      url: i.url,
      alt: i.alt || '',
      name: deriveName(i.url),
      format: deriveFormat(i.url),
      selected: true,
      sourcePageUrl: pageUrl,
      sourcePageTitle: pageTitle,
    };
    if (i.width) o.width = i.width;
    if (i.height) o.height = i.height;
    return o;
  });
}

// Persist the payload to extension storage (the Workbench reads it on load) and
// open the Workbench tab. storage + openTab are injected so this is testable
// without the chrome runtime. Returns the opened URL.
export async function openWorkbench(payload, { baseUrl = DEFAULT_WORKBENCH_BASE, storage, openTab } = {}) {
  const url = `${baseUrl.replace(/\/$/, '')}/workbench`;
  if (storage && typeof storage.set === 'function') {
    await storage.set({ [HANDOFF_STORAGE_KEY]: { images: payload, at: Date.now() } });
  }
  if (openTab) openTab(url);
  return url;
}
