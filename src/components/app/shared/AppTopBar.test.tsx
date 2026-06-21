// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AppTopBar } from './AppTopBar';

afterEach(cleanup);

describe('AppTopBar', () => {
  it('marks the active tab with aria-current=page', () => {
    render(<AppTopBar active="workbench" hasSession={false} />);
    expect(screen.getByText('Workbench').getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('Scraper').getAttribute('aria-current')).toBeNull();
  });

  it('shows the verified chip only when a session token exists', () => {
    const { rerender } = render(<AppTopBar active="scraper" hasSession={false} />);
    expect(screen.queryByTestId('verified-chip')).toBeNull();
    rerender(<AppTopBar active="scraper" hasSession={true} />);
    expect(screen.getByTestId('verified-chip')).toBeTruthy();
  });
});
