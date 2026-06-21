// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ScraperInput } from './ScraperInput';
import type { CrawlDeps } from '../../lib/scrape/crawl';

afterEach(cleanup);
beforeEach(() => sessionStorage.clear());

const pageDeps: CrawlDeps = {
  fetchPage: async () => '<html><body><img src="https://e.com/a.png"></body></html>',
  fetchSitemap: async () => '',
};

describe('ScraperInput', () => {
  it('switches the input variant per mode', () => {
    render(<ScraperInput deps={pageDeps} initialHasSession={true} />);
    // single (default): single URL input
    expect(screen.getByLabelText('Page URL')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Multiple pages' }));
    expect(screen.getByLabelText('URLs, one per line')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Sitemap' }));
    expect(screen.getByLabelText('Max pages to crawl')).toBeTruthy();
  });

  it('gates Find behind a verified session (mints via the verify button)', async () => {
    const onMint = vi.fn(async () => 'tok');
    render(<ScraperInput deps={pageDeps} initialHasSession={false} onMint={onMint} />);
    expect(screen.queryByRole('button', { name: /Find images/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Verify you are human/ }));
    await waitFor(() => expect(onMint).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: /Find images/ })).toBeTruthy());
  });

  it('mints via the real Turnstile widget when a site key is provided', async () => {
    const onMint = vi.fn(async () => 'sess');
    // Stub the Turnstile global so loadTurnstile() short-circuits and render() fires the callback.
    (window as unknown as { turnstile?: unknown }).turnstile = {
      render: (_el: HTMLElement, opts: { callback: (t: string) => void }) => {
        opts.callback('real-turnstile-token');
        return 'wid';
      },
      reset: () => {},
      remove: () => {},
    };
    try {
      render(<ScraperInput deps={pageDeps} initialHasSession={false} onMint={onMint} siteKey="0xTEST" />);
      // The plain fallback button is not rendered when a site key is configured.
      expect(screen.queryByRole('button', { name: /Verify you are human/ })).toBeNull();
      await waitFor(() => expect(onMint).toHaveBeenCalledWith('real-turnstile-token'));
      await waitFor(() => expect(screen.getByRole('button', { name: /Find images/ })).toBeTruthy());
    } finally {
      delete (window as unknown as { turnstile?: unknown }).turnstile;
    }
  });

  it('runs the crawl and renders the log + counts + Open the Workbench', async () => {
    render(<ScraperInput deps={pageDeps} initialHasSession={true} />);
    fireEvent.change(screen.getByLabelText('Page URL'), { target: { value: 'https://e.com/' } });
    fireEvent.click(screen.getByRole('button', { name: /Find images/ }));
    await waitFor(() => expect(screen.getByText(/Open the Workbench/)).toBeTruthy());
    expect(screen.getByText(/1 images · 1 pages/)).toBeTruthy();
    // results persisted for the workbench
    expect(sessionStorage.getItem('sc.workbench')).toContain('a.png');
  });
});
