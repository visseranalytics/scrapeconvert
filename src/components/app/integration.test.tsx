// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { createCrawl, type CrawlDeps } from '../../lib/scrape/crawl';
import { saveWorkbench, DEFAULT_CONVERT_OPTIONS } from '../../lib/workbench-store';
import { Workbench } from './Workbench';

afterEach(cleanup);
beforeEach(() => sessionStorage.clear());

describe('integration: scrape -> workbench -> convert -> zip', () => {
  it('runs the full client pipeline (proxy mocked) and downloads the expected files', async () => {
    // 1. Scrape a fixture page (network injected).
    const deps: CrawlDeps = {
      fetchPage: async () => '<html><body><img src="https://e.com/a.png"><img src="https://e.com/b.png"></body></html>',
      fetchSitemap: async () => '',
    };
    const final = await createCrawl({ mode: 'single', input: 'https://e.com/', deps }).start();
    expect(final.images).toHaveLength(2);

    // 2. Hand off to the workbench (metadata only), selected + sized so convert proceeds.
    saveWorkbench({
      images: final.images.map((i) => ({ ...i, selected: true, size: 1000, width: 10, height: 10 })),
      options: DEFAULT_CONVERT_OPTIONS,
      source: 'https://e.com',
    });

    // 3. Workbench rehydrates and converts via injected deps.
    const fetchBytes = vi.fn(async () => new Blob(['raw']));
    const convert = vi.fn(async () => new Blob(['c'], { type: 'image/webp' }));
    const zip = vi.fn(async (_files: { name: string; blob: Blob }[]) => new Blob(['z'], { type: 'application/zip' }));
    const onDownload = vi.fn();
    render(<Workbench deps={{ fetchBytes, convert, zip, onDownload }} />);

    expect(screen.getByLabelText('Select a.png')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Convert & download ZIP/ }));
    await waitFor(() => expect(onDownload).toHaveBeenCalled());
    expect(fetchBytes).toHaveBeenCalledTimes(2);
    expect(zip.mock.calls[0][0]).toHaveLength(2);
  });

  it('a per-page proxy failure surfaces gracefully (crawl completes, logs error, no crash)', async () => {
    const deps: CrawlDeps = {
      fetchPage: async () => {
        throw new Error('blocked');
      },
      fetchSitemap: async () => '',
    };
    const final = await createCrawl({ mode: 'single', input: 'https://e.com/', deps }).start();
    expect(final.status).toBe('done');
    expect(final.images).toHaveLength(0);
    expect(final.log[0].status).toBe('error');
  });
});
