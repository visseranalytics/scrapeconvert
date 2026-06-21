import { useMemo, useRef, useState } from 'react';
import type { ScrapedImage, ConvertOptions } from '../../lib/types';
import {
  loadWorkbench, DEFAULT_CONVERT_OPTIONS, countSelected, visibleImages, type WorkbenchData,
} from '../../lib/workbench-store';
import { isSafePublicUrl } from '../../lib/url-safety';
import { captureDimensions, readTransferSize } from '../../lib/metadata';
import { flagDuplicates } from '../../lib/dedupe';
import { estimateSize } from '../../lib/convert/estimate';
import { pictureSnippet } from '../../lib/picture-snippet';
import { convertImage, buildZip } from '../../lib/convert';
import { fetchViaProxy } from '../../lib/proxy-client';
import { createLimiter } from '../../lib/concurrency';
import { formatBytes } from '../../lib/bytes';
import { AppTopBar } from './shared/AppTopBar';

const FORMATS: ConvertOptions['format'][] = ['webp', 'avif', 'png', 'jpeg'];
const WARN_BYTES = 100 * 1024 * 1024;

interface WorkbenchDeps {
  convert?: (blob: Blob, opts: ConvertOptions) => Promise<Blob>;
  fetchBytes?: (url: string) => Promise<Blob>;
  zip?: (files: { name: string; blob: Blob }[]) => Promise<Blob>;
  onDownload?: (blob: Blob, filename: string) => void;
  reverify?: () => Promise<boolean>;
}
interface Props {
  initialData?: WorkbenchData;
  localBlobs?: Map<string, Blob>;
  deps?: WorkbenchDeps;
  hasSession?: boolean;
}

function nameFor(img: ScrapedImage, format: ConvertOptions['format']): string {
  const base = (img.name || 'image').replace(/\.[^.]+$/, '');
  const ext = format === 'jpeg' ? 'jpg' : format;
  return `${base}.${ext}`;
}

export function Workbench({ initialData, localBlobs, deps = {}, hasSession = true }: Props) {
  const stored = useMemo(() => initialData ?? loadWorkbench(), [initialData]);
  const [images, setImages] = useState<ScrapedImage[]>(stored?.images ?? []);
  const [options, setOptions] = useState<ConvertOptions>(stored?.options ?? DEFAULT_CONVERT_OPTIONS);
  const [hideDuplicates, setHideDuplicates] = useState(false);
  const [snippetFor, setSnippetFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const blobs = useRef<Map<string, Blob>>(localBlobs ?? new Map());

  const convert = deps.convert ?? convertImage;
  const fetchBytes = deps.fetchBytes ?? (async (url: string) => (await fetchViaProxy(url, 'image')).blob());
  const zip = deps.zip ?? buildZip;
  const onDownload = deps.onDownload ?? defaultDownload;

  const renderable = images.filter((i) => i.url.startsWith('blob:') || isSafePublicUrl(i.url).ok);
  const visible = visibleImages(renderable, hideDuplicates);
  const selected = images.filter((i) => i.selected);
  const selectedBytes = selected.reduce((n, i) => n + (i.size ?? 0), 0);
  const estimatedBytes = selected.reduce((n, i) => n + (i.size ? estimateSize(i.size, options) : 0), 0);
  // Sizes come from the thumbnail's transferSize where the browser exposes it
  // (same-origin / CORS-timed) and from the file for local uploads; cross-origin
  // scraped thumbnails report none. Show a dash rather than a misleading 0 B.
  const anySized = selected.some((i) => i.size != null);

  function update(patch: Partial<ConvertOptions>) {
    setOptions((o) => ({ ...o, ...patch }));
  }
  function rerender() {
    setImages((imgs) => [...imgs]);
  }
  function onThumbLoad(img: ScrapedImage, el: HTMLImageElement) {
    let changed = false;
    const dims = captureDimensions(el);
    if (dims) {
      img.width = dims.width;
      img.height = dims.height;
      changed = true;
    }
    if (img.size == null) {
      const size = readTransferSize(img.url);
      if (size != null) {
        img.size = size;
        changed = true;
      }
    }
    if (changed) {
      flagDuplicates(images);
      rerender();
    }
  }
  function toggle(id: string) {
    const i = images.find((x) => x.id === id);
    if (i) {
      i.selected = !i.selected;
      rerender();
    }
  }
  function selectAllVisible(on: boolean) {
    for (const i of visible) i.selected = on;
    rerender();
  }

  async function convertAndDownload() {
    if (selected.length === 0) return;
    if (deps.reverify && !(await deps.reverify())) {
      setStatus('Verify to continue');
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const limiter = createLimiter(4);
      const out: { name: string; blob: Blob }[] = [];
      await Promise.all(
        selected.map((img) =>
          limiter(async () => {
            const src = blobs.current.get(img.id) ?? (await fetchBytes(img.url));
            const converted = await convert(src, options);
            out.push({ name: nameFor(img, options.format), blob: converted });
          }),
        ),
      );
      const archive = await zip(out);
      onDownload(archive, 'scrapeconvert.zip');
      setStatus(`Converted ${out.length} image${out.length === 1 ? '' : 's'}.`);
    } catch {
      setStatus('Some images failed to convert.');
    } finally {
      setBusy(false);
    }
  }

  function addLocalFiles(files: FileList | null) {
    if (!files) return;
    const added: ScrapedImage[] = [];
    for (const file of Array.from(files)) {
      const id = crypto.randomUUID();
      blobs.current.set(id, file);
      added.push({
        id,
        url: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : `blob:local/${id}`,
        alt: file.name,
        name: file.name,
        format: (file.type.split('/')[1] || 'png').toUpperCase(),
        size: file.size,
        selected: true,
      });
    }
    setImages((imgs) => [...imgs, ...added]);
  }

  return (
    <>
      <AppTopBar active="workbench" hasSession={hasSession} />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[20rem_1fr]">
        <aside className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
            <h2 className="font-mono text-xs uppercase tracking-wider text-zinc-500">Source</h2>
            <p className="mt-2 truncate font-mono text-xs text-zinc-300">{stored?.source ?? 'Your uploads'}</p>
            <label className="mt-3 block cursor-pointer rounded-lg border border-dashed border-white/15 px-3 py-2 text-center font-mono text-xs text-zinc-400">
              or drop your own files
              <input type="file" multiple accept="image/*" className="sr-only" aria-label="Upload local files" onChange={(e) => addLocalFiles(e.target.files)} />
            </label>
          </section>

          <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
            <h2 className="font-mono text-xs uppercase tracking-wider text-zinc-500">Convert settings</h2>
            <div className="mt-2 grid grid-cols-4 gap-1" role="group" aria-label="Output format">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  aria-pressed={options.format === f}
                  onClick={() => update({ format: f })}
                  className={`rounded-md py-1.5 font-mono text-xs ${options.format === f ? 'bg-accent-400/10 text-accent-300' : 'bg-zinc-950 text-zinc-400'}`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
            <label className="mt-3 block font-mono text-xs text-zinc-400">
              Quality <span className="tabular-nums text-zinc-300">{options.quality}</span>
              <input type="range" min={10} max={100} value={options.quality} aria-label="Quality" onChange={(e) => update({ quality: Number(e.target.value) })} className="mt-1 w-full" />
            </label>
          </section>

          <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
            <h2 className="font-mono text-xs uppercase tracking-wider text-zinc-500">Advanced</h2>
            {([['keepAspect', 'Keep aspect ratio'], ['stripExif', 'Strip metadata (EXIF)'], ['removeColorProfile', 'Remove color profile']] as const).map(([k, label]) => (
              <label key={k} className="mt-2 flex items-center justify-between font-mono text-xs text-zinc-300">
                {label}
                <input type="checkbox" aria-label={label} checked={options[k]} onChange={(e) => update({ [k]: e.target.checked } as Partial<ConvertOptions>)} />
              </label>
            ))}
          </section>

          <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
            <div className="font-mono text-xs text-zinc-400">
              <div className="flex justify-between"><span>Selected</span><span className="tabular-nums text-zinc-200">{countSelected(images)}</span></div>
              <div className="flex justify-between"><span>Original</span><span className="tabular-nums">{anySized ? formatBytes(selectedBytes) : '—'}</span></div>
              <div className="flex justify-between"><span>Estimated after</span><span className="tabular-nums text-accent-300">{anySized ? formatBytes(estimatedBytes) : '—'}</span></div>
            </div>
            {selectedBytes > WARN_BYTES && (
              <p className="mt-2 rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-1 font-mono text-[11px] text-amber-300" role="alert">
                That is {formatBytes(selectedBytes)} to fetch and convert. Convert a smaller selection to go faster.
              </p>
            )}
            <button onClick={convertAndDownload} disabled={busy || selected.length === 0} className="mt-3 w-full rounded-lg bg-accent-400 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50">
              {busy ? 'Converting…' : 'Convert & download ZIP'}
            </button>
            {status && <p className="mt-2 font-mono text-[11px] text-zinc-400" role="status">{status}</p>}
          </section>
        </aside>

        <main>
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-sm text-zinc-300">Images <span className="text-zinc-500">{visible.length}</span></span>
            <div className="flex items-center gap-3 font-mono text-xs text-zinc-400">
              <button
                onClick={() => selectAllVisible(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-zinc-300 transition-colors hover:border-white/15 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              >
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded border border-accent-400 bg-accent-400/20 text-accent-300">
                  <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                Select all
              </button>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" aria-label="Hide duplicates" checked={hideDuplicates} onChange={(e) => setHideDuplicates(e.target.checked)} />
                Hide duplicates
              </label>
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-zinc-900/40 p-8 text-center font-mono text-sm text-zinc-500">No images yet.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {visible.map((img) => (
                <li
                  key={img.id}
                  className={`group relative overflow-hidden rounded-lg border bg-zinc-800 transition-colors ${
                    img.selected ? 'border-accent-400/40 ring-1 ring-accent-400/20' : 'border-white/10'
                  }`}
                >
                  <label className="block cursor-pointer">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      aria-label={`Select ${img.name}`}
                      checked={img.selected}
                      onChange={() => toggle(img.id)}
                    />
                    <img
                      src={img.url}
                      alt={img.alt}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      className="aspect-[4/3] w-full object-cover"
                      onLoad={(e) => onThumbLoad(img, e.currentTarget)}
                    />
                    <span className="pointer-events-none absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded border border-white/30 bg-zinc-950/60 text-transparent transition-colors peer-checked:border-accent-400 peer-checked:bg-accent-400/20 peer-checked:text-accent-300 peer-focus-visible:ring-2 peer-focus-visible:ring-accent-400 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-zinc-950">
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  </label>
                  <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                    {img.isDuplicate && (
                      <span className="rounded bg-amber-400/90 px-1 font-mono text-[9px] font-medium text-zinc-950">dupe</span>
                    )}
                    <button
                      onClick={() => setSnippetFor(img.id)}
                      aria-label="Get <picture> code"
                      title="Get <picture> code"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-white/15 bg-zinc-950/80 text-zinc-300 backdrop-blur transition-colors hover:border-accent-400/40 hover:text-accent-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                    >
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m18 16 4-4-4-4" />
                        <path d="m6 8-4 4 4 4" />
                        <path d="m14.5 4-5 16" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center justify-between bg-black/55 px-1.5 py-1 font-mono text-[10px] text-zinc-200">
                    <span>{img.format}</span>
                    <span className="tabular-nums">{img.size ? formatBytes(img.size) : '—'}</span>
                  </div>
                  {snippetFor === img.id && (
                    <div className="absolute inset-0 z-10 flex flex-col bg-zinc-950/95 p-2" role="dialog" aria-label="picture snippet">
                      <textarea readOnly className="flex-1 resize-none bg-transparent font-mono text-[10px] text-accent-200" value={pictureSnippet(img, FORMATS)} />
                      <button onClick={() => setSnippetFor(null)} className="mt-1 font-mono text-[10px] text-zinc-400">Close</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>
    </>
  );
}

function defaultDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
