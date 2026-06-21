import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { checkBurst, consumeFetchBudget, consumeByteBudget, consumeHostCap, consumeGlobalEgress } from './budgets';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const kv = () => (env as any).BUDGETS as KVNamespace;

describe('consumeFetchBudget', () => {
  it('allows up to the limit then blocks', async () => {
    const n = 'nonce-fetch-' + Math.random();
    let blocked = false;
    for (let i = 0; i < 4; i++) blocked = await consumeFetchBudget(kv(), n, 3);
    expect(blocked).toBe(true);
  });
});

describe('consumeByteBudget', () => {
  it('blocks once cumulative bytes exceed the limit', async () => {
    const n = 'nonce-byte-' + Math.random();
    expect(await consumeByteBudget(kv(), n, 600, 1000)).toBe(false);
    expect(await consumeByteBudget(kv(), n, 600, 1000)).toBe(true);
  });
});

describe('consumeHostCap', () => {
  it('caps fetches per destination host', async () => {
    const h = 'victim-' + Math.random() + '.test';
    let blocked = false;
    for (let i = 0; i < 3; i++) blocked = await consumeHostCap(kv(), h, 2);
    expect(blocked).toBe(true);
  });
});

describe('consumeGlobalEgress', () => {
  it('trips the global breaker over the instance cap', async () => {
    expect(await consumeGlobalEgress(kv(), 10, 15)).toBe(false);
    expect(await consumeGlobalEgress(kv(), 10, 15)).toBe(true);
  });
});

describe('checkBurst', () => {
  it('returns false when the RL binding reports success', async () => {
    const limited = await checkBurst({ kv: kv(), rl: { limit: async () => ({ success: true }) } }, 'nonce-x');
    expect(limited).toBe(false);
  });
  it('returns true when the RL binding reports throttled', async () => {
    const limited = await checkBurst({ kv: kv(), rl: { limit: async () => ({ success: false }) } }, 'nonce-y');
    expect(limited).toBe(true);
  });
  it('returns false when no RL binding present', async () => {
    const limited = await checkBurst({ kv: kv() }, 'nonce-z');
    expect(limited).toBe(false);
  });
});
