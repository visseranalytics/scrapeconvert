import { describe, it, expect, vi, beforeEach } from 'vitest';

const { decodeAndResize, encode } = vi.hoisted(() => ({ decodeAndResize: vi.fn(), encode: vi.fn() }));
vi.mock('./resize', () => ({ decodeAndResize }));
vi.mock('./codecs', () => ({ encode }));

import { convertImage } from './index';
import type { ConvertOptions } from '../types';

const opts = (over: Partial<ConvertOptions>): ConvertOptions => ({
  format: 'webp', quality: 80, keepAspect: true, stripExif: true, removeColorProfile: false, ...over,
});
const fakeImageData = { width: 1, height: 1 };

beforeEach(() => {
  decodeAndResize.mockReset();
  encode.mockReset();
});

describe('convertImage', () => {
  it('takes a Blob, runs resize then encode in order, returns a Blob of the target MIME', async () => {
    const order: string[] = [];
    decodeAndResize.mockImplementation(async () => { order.push('resize'); return fakeImageData; });
    encode.mockImplementation(async () => { order.push('encode'); return new ArrayBuffer(8); });
    const out = await convertImage(new Blob(['x']), opts({ format: 'avif' }));
    expect(order).toEqual(['resize', 'encode']);
    expect(out).toBeInstanceOf(Blob);
    expect(out.type).toBe('image/avif');
    expect(encode).toHaveBeenCalledWith(fakeImageData, expect.objectContaining({ format: 'avif' }));
  });

  it('propagates a per-image failure as a rejection (caller continues batch)', async () => {
    decodeAndResize.mockResolvedValue(fakeImageData);
    encode.mockRejectedValue(new Error('encode-failed'));
    await expect(convertImage(new Blob(['x']), opts({}))).rejects.toThrow('encode-failed');
  });
});
