import { describe, it, expect } from 'vitest';
import { formatBytes } from './bytes';

describe('formatBytes', () => {
  it('formats bytes under 1KB', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
  });
  it('formats KB with one decimal under 10', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });
  it('formats MB and GB', () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(1.2 * 1024 * 1024 * 1024)).toBe('1.2 GB');
  });
  it('drops the decimal at or above 10 units', () => {
    expect(formatBytes(25 * 1024 * 1024)).toBe('25 MB');
  });
  it('guards against negative / non-finite input', () => {
    expect(formatBytes(-5)).toBe('0 B');
    expect(formatBytes(NaN)).toBe('0 B');
  });
});
