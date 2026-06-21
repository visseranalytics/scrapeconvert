import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildZip } from './zip';

const blob = (s: string) => new Blob([s], { type: 'image/png' });

describe('buildZip', () => {
  it('produces a zip blob containing all files', async () => {
    const out = await buildZip([
      { name: 'a.png', blob: blob('aaa') },
      { name: 'b.png', blob: blob('bbb') },
    ]);
    expect(out.type).toBe('application/zip');
    const z = await JSZip.loadAsync(await out.arrayBuffer());
    expect(Object.keys(z.files).sort()).toEqual(['a.png', 'b.png']);
  });

  it('de-duplicates colliding file names', async () => {
    const out = await buildZip([
      { name: 'logo.png', blob: blob('1') },
      { name: 'logo.png', blob: blob('2') },
      { name: 'logo.png', blob: blob('3') },
    ]);
    const z = await JSZip.loadAsync(await out.arrayBuffer());
    expect(Object.keys(z.files).sort()).toEqual(['logo-1.png', 'logo-2.png', 'logo.png']);
  });

  it('handles an empty list (returns an empty zip)', async () => {
    const out = await buildZip([]);
    const z = await JSZip.loadAsync(await out.arrayBuffer());
    expect(Object.keys(z.files)).toHaveLength(0);
  });
});
