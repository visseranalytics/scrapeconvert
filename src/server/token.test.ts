import { describe, it, expect } from 'vitest';
import { signToken, verifyToken, type SessionClaims } from './token';

const SECRET = 'unit-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const now = () => Math.floor(Date.now() / 1000);

function claims(over: Partial<SessionClaims> = {}): SessionClaims {
  return { iat: now(), exp: now() + 2700, nonce: 'n-123', ipHash: 'abc123', ...over };
}

describe('signToken / verifyToken', () => {
  it('round-trips a valid token', async () => {
    const t = await signToken(claims(), SECRET);
    const r = await verifyToken(t, SECRET, 'abc123');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.claims.nonce).toBe('n-123');
  });

  it('rejects a forged signature', async () => {
    const t = await signToken(claims(), SECRET);
    const forged = t.slice(0, -4) + (t.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA');
    const r = await verifyToken(forged, SECRET, 'abc123');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('signature');
  });

  it('rejects a token signed with a different secret', async () => {
    const t = await signToken(claims(), SECRET);
    const r = await verifyToken(t, 'different-secret', 'abc123');
    expect(r.ok).toBe(false);
  });

  it('rejects an expired token', async () => {
    const t = await signToken(claims({ iat: now() - 5000, exp: now() - 1 }), SECRET);
    const r = await verifyToken(t, SECRET, 'abc123');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('expired');
  });

  it('rejects an ip-hash mismatch', async () => {
    const t = await signToken(claims({ ipHash: 'abc123' }), SECRET);
    const r = await verifyToken(t, SECRET, 'different-network');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('ip-mismatch');
  });

  it('rejects a malformed token', async () => {
    expect((await verifyToken('garbage', SECRET, 'abc123')).ok).toBe(false);
    expect((await verifyToken('a.b', SECRET, 'abc123')).ok).toBe(false);
  });
});
