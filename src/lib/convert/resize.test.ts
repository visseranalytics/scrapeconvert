import { describe, it, expect } from 'vitest';
import { computeTargetSize } from './resize';

describe('computeTargetSize', () => {
  it('scales down proportionally and never upscales', () => {
    expect(computeTargetSize(4000, 2000, { maxWidth: 2000, keepAspect: true })).toEqual({ width: 2000, height: 1000 });
    // smaller than max -> unchanged (no upscale)
    expect(computeTargetSize(800, 600, { maxWidth: 2000, keepAspect: true })).toEqual({ width: 800, height: 600 });
  });

  it('honors the tighter of maxWidth / maxHeight when keepAspect', () => {
    // height is the binding constraint
    expect(computeTargetSize(4000, 3000, { maxWidth: 2000, maxHeight: 600, keepAspect: true })).toEqual({ width: 800, height: 600 });
  });

  it('clamps each axis independently when keepAspect is false', () => {
    expect(computeTargetSize(4000, 3000, { maxWidth: 1000, maxHeight: 1000, keepAspect: false })).toEqual({ width: 1000, height: 1000 });
  });

  it('never returns below 1px', () => {
    const r = computeTargetSize(10, 10, { maxWidth: 0, keepAspect: true });
    expect(r.width).toBeGreaterThanOrEqual(1);
    expect(r.height).toBeGreaterThanOrEqual(1);
  });
});
