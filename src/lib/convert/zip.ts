import JSZip from 'jszip';

// Build a single application/zip Blob. De-duplicates colliding file names
// (a.png -> a-1.png -> a-2.png) so same-named scraped images do not overwrite.
// Generated as an ArrayBuffer then wrapped in a Blob so it works in both the
// browser and node test runtimes.
export async function buildZip(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const zip = new JSZip();
  const used = new Map<string, number>();
  for (const f of files) {
    let name = f.name || 'image';
    const prev = used.get(name);
    if (prev !== undefined) {
      const n = prev + 1;
      used.set(name, n);
      const dot = name.lastIndexOf('.');
      name = dot > 0 ? `${name.slice(0, dot)}-${n}${name.slice(dot)}` : `${name}-${n}`;
    } else {
      used.set(name, 0);
    }
    // Read to an ArrayBuffer (universally supported by jszip across browser + node).
    zip.file(name, await f.blob.arrayBuffer());
  }
  const buf = await zip.generateAsync({ type: 'arraybuffer', streamFiles: true });
  return new Blob([buf], { type: 'application/zip' });
}
