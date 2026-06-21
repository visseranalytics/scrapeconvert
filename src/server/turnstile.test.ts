import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireSecret, verifyTurnstileToken, mintSession } from './turnstile';

describe('requireSecret', () => {
  it('returns a present secret', () => expect(requireSecret('X', 'val')).toBe('val'));
  it('throws on undefined', () => expect(() => requireSecret('X', undefined)).toThrow(/X/));
  it('throws on empty', () => expect(() => requireSecret('X', '')).toThrow(/X/));
});

describe('verifyTurnstileToken', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('passes when siteverify success', async () => {
    const f = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    const r = await verifyTurnstileToken('tok', 'secret', '1.2.3.4');
    expect(r.ok).toBe(true);
    const init = f.mock.calls[0][1] as RequestInit;
    const body = init.body as unknown as FormData;
    expect(body.get('remoteip')).toBe('1.2.3.4');
    expect(body.get('secret')).toBe('secret');
  });
  it('fails when siteverify rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }), { status: 200 })));
    const r = await verifyTurnstileToken('tok', 'secret', '1.2.3.4');
    expect(r.ok).toBe(false);
  });
});

describe('mintSession', () => {
  it('produces a verifiable token bound to the coarse ip', async () => {
    const t = await mintSession('1.2.3.4', 'hmac-secret', 2700);
    expect(t.split('.').length).toBe(2);
  });
});
