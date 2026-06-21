import { describe, it, expect } from 'vitest';
import { createLimiter } from './concurrency';

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('createLimiter', () => {
  it('never exceeds max concurrent and runs all tasks', async () => {
    const run = createLimiter(3);
    let active = 0;
    let peak = 0;
    const results: number[] = [];
    const tasks = Array.from({ length: 12 }, (_, i) =>
      run(async () => {
        active++;
        peak = Math.max(peak, active);
        await tick(5);
        active--;
        results.push(i);
        return i;
      }),
    );
    const out = await Promise.all(tasks);
    expect(peak).toBeLessThanOrEqual(3);
    expect(out).toHaveLength(12);
    expect(results.sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i));
  });

  it('propagates task rejection without wedging the pool', async () => {
    const run = createLimiter(2);
    await expect(run(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    // pool still works after a rejection
    await expect(run(async () => 42)).resolves.toBe(42);
  });
});
