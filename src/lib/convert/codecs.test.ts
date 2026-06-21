import { describe, it, expect, vi } from 'vitest';

const jpegEnc = vi.fn(async () => new ArrayBuffer(6));
const webpEnc = vi.fn(async () => new ArrayBuffer(4));
const avifEnc = vi.fn(async () => new ArrayBuffer(5));
const pngEnc = vi.fn(async () => new ArrayBuffer(7));
const oxi = vi.fn(async (b: ArrayBuffer) => b);

vi.mock('@jsquash/jpeg', () => ({ encode: jpegEnc }));
vi.mock('@jsquash/webp', () => ({ encode: webpEnc }));
vi.mock('@jsquash/avif', () => ({ encode: avifEnc }));
vi.mock('@jsquash/png', () => ({ encode: pngEnc }));
vi.mock('@jsquash/oxipng', () => ({ optimise: oxi }));

import { encode } from './codecs';
import type { ConvertOptions } from '../types';

const data = { data: new Uint8ClampedArray(4), width: 1, height: 1 } as unknown as ImageData;
const opts = (over: Partial<ConvertOptions>): ConvertOptions => ({
  format: 'webp', quality: 80, keepAspect: true, stripExif: true, removeColorProfile: false, ...over,
});

describe('encode', () => {
  it('dispatches webp/png/jpeg/avif by format', async () => {
    await encode(data, opts({ format: 'webp' }));
    await encode(data, opts({ format: 'jpeg' }));
    await encode(data, opts({ format: 'avif' }));
    expect(webpEnc).toHaveBeenCalled();
    expect(jpegEnc).toHaveBeenCalled();
    expect(avifEnc).toHaveBeenCalled();
  });

  it('runs oxipng after the png encode', async () => {
    await encode(data, opts({ format: 'png' }));
    expect(pngEnc).toHaveBeenCalled();
    expect(oxi).toHaveBeenCalled();
  });

  it('passes the quality through', async () => {
    await encode(data, opts({ format: 'webp', quality: 42 }));
    expect(webpEnc).toHaveBeenCalledWith(data, { quality: 42 });
  });

  it('rejects an unknown format', async () => {
    await expect(encode(data, opts({ format: 'bmp' as ConvertOptions['format'] }))).rejects.toThrow(/unknown-format/);
  });
});
