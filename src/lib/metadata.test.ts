// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { fetchViaProxy } = vi.hoisted(() => ({ fetchViaProxy: vi.fn() }));
vi.mock('./proxy-client', () => ({ fetchViaProxy }));

import { captureDimensions, readTransferSize, headSizeViaProxy } from './metadata';

function imageWith(w: number, h: number): HTMLImageElement {
  const img = new Image();
  Object.defineProperty(img, 'naturalWidth', { value: w, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: h, configurable: true });
  return img;
}

beforeEach(() => {
  fetchViaProxy.mockReset();
  vi.restoreAllMocks();
});

describe('captureDimensions', () => {
  it('returns naturalWidth/naturalHeight for a loaded image', () => {
    expect(captureDimensions(imageWith(800, 600))).toEqual({ width: 800, height: 600 });
  });
  it('returns undefined for a failed thumbnail (naturalWidth 0)', () => {
    expect(captureDimensions(imageWith(0, 0))).toBeUndefined();
  });
});

describe('readTransferSize', () => {
  it('returns the transferSize entry when present', () => {
    vi.spyOn(performance, 'getEntriesByName').mockReturnValue([{ transferSize: 2048 } as PerformanceResourceTiming]);
    expect(readTransferSize('https://e.com/a.png')).toBe(2048);
  });
  it('returns undefined when there is no entry', () => {
    vi.spyOn(performance, 'getEntriesByName').mockReturnValue([]);
    expect(readTransferSize('https://e.com/none.png')).toBeUndefined();
  });
});

describe('headSizeViaProxy', () => {
  it('reads content-length via the proxy and cancels the body', async () => {
    fetchViaProxy.mockResolvedValue(new Response('xxxx', { status: 200, headers: { 'content-length': '4096' } }));
    expect(await headSizeViaProxy('https://e.com/a.png')).toBe(4096);
    expect(fetchViaProxy).toHaveBeenCalledWith('https://e.com/a.png', 'image');
  });
  it('returns undefined when the proxy throws', async () => {
    fetchViaProxy.mockRejectedValue(new Error('blocked'));
    expect(await headSizeViaProxy('https://e.com/a.png')).toBeUndefined();
  });
});
