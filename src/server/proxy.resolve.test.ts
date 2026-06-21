import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveAndValidate } from './proxy';

function dohResponse(answers: { type: number; data: string }[]) {
  return new Response(JSON.stringify({ Status: 0, Answer: answers }), {
    status: 200,
    headers: { 'content-type': 'application/dns-json' },
  });
}

describe('resolveAndValidate', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('returns the validated public IPs', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      dohResponse([{ type: 1, data: '93.184.216.34' }, { type: 28, data: '2606:2800:220:1:248:1893:25c8:1946' }]),
    ));
    const r = await resolveAndValidate('example.com');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ips).toContain('93.184.216.34');
  });

  it('rejects when ANY record is private (rebinding)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      dohResponse([{ type: 1, data: '93.184.216.34' }, { type: 1, data: '169.254.169.254' }]),
    ));
    const r = await resolveAndValidate('rebind.evil.test');
    expect(r.ok).toBe(false);
  });

  it('rejects when there are no A/AAAA answers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => dohResponse([{ type: 5, data: 'cname.target.' }])));
    const r = await resolveAndValidate('cname-only.test');
    expect(r.ok).toBe(false);
  });

  it('rejects on DoH non-200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 502 })));
    const r = await resolveAndValidate('broken.test');
    expect(r.ok).toBe(false);
  });

  it('rejects an all-private answer set', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => dohResponse([{ type: 1, data: '10.0.0.1' }])));
    const r = await resolveAndValidate('internal.test');
    expect(r.ok).toBe(false);
  });
});
