// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { Workbench } from './Workbench';
import { DEFAULT_CONVERT_OPTIONS, type WorkbenchData } from '../../lib/workbench-store';
import type { ScrapedImage } from '../../lib/types';

afterEach(cleanup);

const img = (id: string, over: Partial<ScrapedImage> = {}): ScrapedImage => ({
  id, url: `https://e.com/${id}.png`, alt: id, name: `${id}.png`, format: 'PNG', size: 1000, width: 10, height: 10, selected: false, ...over,
});

const data = (images: ScrapedImage[]): WorkbenchData => ({ images, options: { ...DEFAULT_CONVERT_OPTIONS }, source: 'https://e.com' });

describe('Workbench', () => {
  it('rehydrates from data and renders the grid', () => {
    render(<Workbench initialData={data([img('a'), img('b')])} />);
    expect(screen.getByLabelText('Select a.png')).toBeTruthy();
    expect(screen.getByLabelText('Select b.png')).toBeTruthy();
  });

  it('format and quality controls update the options', () => {
    render(<Workbench initialData={data([img('a', { selected: true })])} />);
    const avif = screen.getByRole('button', { name: 'AVIF' });
    fireEvent.click(avif);
    expect(avif.getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(screen.getByLabelText('Quality'), { target: { value: '50' } });
    expect((screen.getByLabelText('Quality') as HTMLInputElement).value).toBe('50');
  });

  it('shows the amber dupe flag and hide-duplicates filters it out', () => {
    render(<Workbench initialData={data([img('a'), img('b', { isDuplicate: true })])} />);
    expect(screen.getByText('dupe')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Hide duplicates'));
    expect(screen.queryByLabelText('Select b.png')).toBeNull();
    expect(screen.getByLabelText('Select a.png')).toBeTruthy();
  });

  it('filters unsafe thumbnail URLs out of the grid', () => {
    render(<Workbench initialData={data([img('ok'), img('bad', { url: 'http://169.254.169.254/x.png' })])} />);
    expect(screen.getByLabelText('Select ok.png')).toBeTruthy();
    expect(screen.queryByLabelText('Select bad.png')).toBeNull();
  });

  it('Get <picture> code shows the snippet', () => {
    render(<Workbench initialData={data([img('hero')])} />);
    fireEvent.click(screen.getByRole('button', { name: /Get <picture> code/ }));
    const dialog = screen.getByRole('dialog', { name: 'picture snippet' });
    expect(within(dialog).getByRole('textbox')).toHaveProperty('value');
    expect((within(dialog).getByRole('textbox') as HTMLTextAreaElement).value).toContain('<picture>');
    expect((within(dialog).getByRole('textbox') as HTMLTextAreaElement).value).toContain('type="image/avif"');
  });

  it('converts selected images via injected deps and downloads a zip', async () => {
    const fetchBytes = vi.fn(async () => new Blob(['raw']));
    const convert = vi.fn(async () => new Blob(['conv'], { type: 'image/webp' }));
    const zip = vi.fn(async (_files: { name: string; blob: Blob }[]) => new Blob(['zip'], { type: 'application/zip' }));
    const onDownload = vi.fn();
    render(<Workbench initialData={data([img('a', { selected: true }), img('b', { selected: true })])} deps={{ fetchBytes, convert, zip, onDownload }} />);
    fireEvent.click(screen.getByRole('button', { name: /Convert & download ZIP/ }));
    await waitFor(() => expect(onDownload).toHaveBeenCalled());
    expect(fetchBytes).toHaveBeenCalledTimes(2);
    expect(convert).toHaveBeenCalledTimes(2);
    expect(zip).toHaveBeenCalledTimes(1);
    expect(zip.mock.calls[0][0]).toHaveLength(2);
  });

  it('re-verifies up front and aborts convert when verification fails', async () => {
    const convert = vi.fn();
    const reverify = vi.fn(async () => false);
    render(<Workbench initialData={data([img('a', { selected: true })])} deps={{ reverify, convert }} />);
    fireEvent.click(screen.getByRole('button', { name: /Convert & download ZIP/ }));
    await waitFor(() => expect(screen.getByText('Verify to continue')).toBeTruthy());
    expect(convert).not.toHaveBeenCalled();
  });

  it('local files populate the grid with no network', () => {
    render(<Workbench initialData={data([])} />);
    const file = new File(['bytes'], 'mine.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Upload local files'), { target: { files: [file] } });
    expect(screen.getByLabelText('Select mine.png')).toBeTruthy();
  });

  it('shows the bandwidth warning when selected bytes exceed the threshold', () => {
    render(<Workbench initialData={data([img('big', { selected: true, size: 200 * 1024 * 1024 })])} />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
